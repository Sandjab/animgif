import { bakeAdjustments } from './adjustments';
import { decimatedOrder, delayToFps } from './effects/timeline';
import { computeFrameMatrices, renderFramesChunked } from './frameGenerator';
import { evenDim, qualityToBitrate } from './mp4Params';
import type { Store } from './state';

// Garde-fou mémoire : frames RGBA en pleine résolution.
const MAX_BYTES = 500 * 1024 * 1024;

// Borne une dimension d'export saisie : entier dans [16, 4096], 16 si invalide.
export const clampDim = (v: number) => Math.min(4096, Math.max(16, Math.round(v) || 16));

class ExportCancelled extends Error {}

// Déclenche le téléchargement d'un blob sous le nom donné.
function download(blob: Blob, filename: string) {
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = filename;
  a.click();
  // Révocation différée : certains navigateurs (Firefox, certaines versions de Safari/Chrome)
  // n'ont pas encore initié le téléchargement au moment du click() synchrone, et une
  // révocation immédiate le ferait échouer.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function initExport(store: Store) {
  const btn = document.querySelector<HTMLButtonElement>('#btn-export')!;
  const progress = document.querySelector<HTMLProgressElement>('#export-progress')!;
  const status = document.querySelector<HTMLElement>('#export-status')!;
  const outW = document.querySelector<HTMLInputElement>('#out-w')!;
  const outH = document.querySelector<HTMLInputElement>('#out-h')!;
  const lockRatio = document.querySelector<HTMLInputElement>('#lock-ratio')!;
  const quality = document.querySelector<HTMLInputElement>('#out-quality')!;
  const cancelBtn = document.querySelector<HTMLButtonElement>('#btn-cancel-export')!;
  const fmtGif = document.querySelector<HTMLInputElement>('#fmt-gif')!;
  const fmtMp4 = document.querySelector<HTMLInputElement>('#fmt-mp4')!;
  const mp4Hint = document.querySelector<HTMLElement>('#mp4-hint')!;
  let cancelled = false;
  let cancelEncode: (() => void) | null = null;
  cancelBtn.addEventListener('click', () => {
    cancelled = true;      // interrompt la boucle de rendu ET d'encodage MP4
    cancelEncode?.();      // termine le worker gifski si l'encodage GIF a commencé
  });

  // Reflète le format courant dans l'UI : libellé du bouton et ligne d'aide MP4.
  const refreshFormatUI = () => {
    const mp4 = store.get().format === 'mp4';
    btn.textContent = mp4 ? 'Exporter le MP4' : 'Exporter le GIF';
    mp4Hint.hidden = !mp4;
    if (mp4) mp4Hint.textContent = 'Une seule passe ; la boucle est gérée par le lecteur.';
  };
  fmtGif.addEventListener('change', () => {
    if (!fmtGif.checked) return;
    store.update({ format: 'gif' });
    refreshFormatUI();
  });
  // À la première sélection du MP4 : charge mediabunny (paresseux) et vérifie le support
  // d'encodage AVC. Si absent, repasse en GIF et désactive l'option.
  fmtMp4.addEventListener('change', async () => {
    if (!fmtMp4.checked) return;
    let supported: boolean;
    try {
      const { isMp4Supported } = await import('./mp4');
      supported = await isMp4Supported();
    } catch {
      // Échec du chargement paresseux de mediabunny (réseau) ou de la détection
      // (VideoEncoder absent en contexte non sécurisé) : repli GIF sans planter l'UI.
      // On ne désactive PAS l'option — l'échec peut être transitoire (nouvel essai possible).
      if (!fmtMp4.checked) return;
      fmtGif.checked = true;
      store.update({ format: 'gif' });
      refreshFormatUI();
      mp4Hint.hidden = false;
      mp4Hint.textContent = 'Échec du chargement du support MP4.';
      return;
    }
    if (!fmtMp4.checked) return; // l'utilisateur a changé de format pendant le chargement async
    if (!supported) {
      fmtMp4.disabled = true;
      fmtGif.checked = true;
      store.update({ format: 'gif' });
      refreshFormatUI();       // rétablit le libellé du bouton (et masque l'aide MP4)…
      mp4Hint.hidden = false;  // …puis affiche le message de non-support par-dessus.
      mp4Hint.textContent = 'MP4 non supporté par ce navigateur.';
      return;
    }
    store.update({ format: 'mp4' });
    refreshFormatUI();
  });

  // Verrou des proportions : modifier W ajuste H (et réciproquement) selon l'image source.
  const ratio = () => {
    const img = store.get().sourceImage;
    return img ? img.naturalWidth / img.naturalHeight : 1;
  };
  outW.addEventListener('input', () => {
    const w = clampDim(Number(outW.value));
    if (lockRatio.checked) outH.value = String(clampDim(w / ratio()));
    store.update({ outW: w, outH: clampDim(Number(outH.value)) });
  });
  outH.addEventListener('input', () => {
    const h = clampDim(Number(outH.value));
    if (lockRatio.checked) outW.value = String(clampDim(h * ratio()));
    store.update({ outH: h, outW: clampDim(Number(outW.value)) });
  });
  quality.addEventListener('input', () => store.update({ quality: Number(quality.value) }));
  document.querySelector<HTMLSelectElement>('#out-decimation')!.addEventListener('change', (e) => {
    store.update({ decimation: Number((e.target as HTMLSelectElement).value) as 1 | 2 | 3 });
  });

  btn.addEventListener('click', async () => {
    const s = store.get();
    if (!s.sourceImage) return;
    const mp4 = s.format === 'mp4';

    const { order, delayMs } = decimatedOrder(
      s.steps, s.reverse, s.loopMode === 'pingpong', s.decimation, s.delayMs,
    );
    // Dimensions paires imposées par H.264 pour le MP4 (le rendu se fait à ces dimensions).
    const width = mp4 ? evenDim(s.outW) : s.outW;
    const height = mp4 ? evenDim(s.outH) : s.outH;
    // Seules les frames réellement référencées sont rendues (la décimation peut en sauter 2/3).
    const needed = [...new Set(order)].sort((a, b) => a - b);
    // Pic mémoire : GIF ≈ frames rendues + 2× la séquence (concaténation worker + copie wasm) ;
    // MP4 ≈ frames rendues seules (file d'encodeur bornée, pas de concaténation).
    const bytes = (needed.length + (mp4 ? 0 : 2 * order.length)) * width * height * 4;
    if (bytes > MAX_BYTES) {
      const go = confirm(
        `Export volumineux : ${order.length} frames en ${width}×${height} (~${Math.round(bytes / 1e6)} Mo en mémoire au pic). Continuer ?`,
      );
      if (!go) return;
    }

    btn.disabled = true;
    cancelBtn.hidden = false;
    cancelled = false;
    progress.hidden = false;
    progress.max = 1;
    progress.value = 0;
    try {
      const baked = await bakeAdjustments(s.sourceImage, s.bgRemovedBlob, s.adjustments);
      const view = { imageW: baked.width, imageH: baked.height, outW: width, outH: height };
      const matrices = computeFrameMatrices(s.effects, s.steps, view);
      const rendered = await renderFramesChunked(
        baked, needed.map((i) => matrices[i]), width, height, s.adjustments.backgroundColor,
        (done, total) => {
          progress.value = done / total;
          status.textContent = `Rendu des frames… (${done}/${total})`;
        },
        () => cancelled,
      );
      // `|| cancelled` couvre la fenêtre morte : annulation pendant le tout dernier yield
      // du rendu, alors que cancelEncode n'est pas encore branché.
      if (!rendered || cancelled) {
        status.textContent = 'Export annulé.';
        return;
      }
      const frameByIndex = new Map(needed.map((idx, j) => [idx, rendered[j]]));
      const frames = order.map((i) => frameByIndex.get(i)!);

      if (mp4) {
        // Encodage MP4 : progression déterminée aux deux phases ; annulation par le drapeau
        // `cancelled` (sondé dans encodeMp4 → output.cancel()).
        const { encodeMp4 } = await import('./mp4');
        const fps = delayToFps(delayMs);
        status.textContent = `Encodage MP4… (0/${frames.length})`;
        const blob = await encodeMp4(frames, {
          width, height, fps, bitrate: qualityToBitrate(s.quality, width, height, fps),
          onProgress: (done, total) => {
            progress.value = done / total;
            status.textContent = `Encodage MP4… (${done}/${total})`;
          },
          isCancelled: () => cancelled,
        });
        if (!blob) {
          status.textContent = 'Export annulé.';
          return;
        }
        download(blob, 'animation.mp4');
        status.textContent = `MP4 exporté (${(blob.size / 1024).toFixed(0)} Ko).`;
        return;
      }

      status.textContent = 'Encodage gifski… (peut prendre du temps)';
      progress.removeAttribute('value'); // indéterminée : gifski ne remonte pas de progression
      // repeat : vérifié sur pièce dans le binaire gifski-wasm 2.2.0 installé (rust/src/lib.rs
      // du paquet, et `gif` crate 0.13.1 qu'il utilise en interne) — la doc npm ne précise pas
      // la sémantique. gifski-wasm mappe repeat<0 (ou absent) → boucle infinie ; repeat>=0 →
      // Repeat::Finite(repeat), et Finite(0) fait explicitement sauter l'écriture de
      // l'extension NETSCAPE2.0 (donc AUCUNE boucle, pas une boucle infinie comme le
      // supposait le plan initial). On mappe donc loopCount (nombre total de lectures
      // voulues, "n fois" dans l'UI, toujours ≥ 1) sur loopCount-1 répétitions supplémentaires,
      // et -1 pour les modes infinite/pingpong.
      const repeat = s.loopMode === 'count' ? s.loopCount - 1 : -1;
      const job = encodeInWorker({
        frames, width, height,
        frameDurations: frames.map(() => delayMs),
        quality: s.quality, repeat,
      });
      cancelEncode = job.cancel;
      const gif = await job.promise;

      download(new Blob([gif], { type: 'image/gif' }), 'animation.gif');
      status.textContent = `GIF exporté (${(gif.byteLength / 1024).toFixed(0)} Ko).`;
    } catch (err) {
      if (err instanceof ExportCancelled) status.textContent = 'Export annulé.';
      else status.textContent = `Échec de l'export : ${err instanceof Error ? err.message : err}`;
    } finally {
      cancelEncode = null;
      btn.disabled = false;
      cancelBtn.hidden = true;
      progress.hidden = true;
      progress.value = 0;
    }
  });

  refreshFormatUI();
}

function encodeInWorker(payload: {
  frames: ImageData[]; width: number; height: number;
  frameDurations: number[]; quality: number; repeat: number;
}): { promise: Promise<Uint8Array<ArrayBuffer>>; cancel: () => void } {
  let worker: Worker | null = new Worker(
    new URL('./workers/gifEncoder.worker.ts', import.meta.url),
    { type: 'module' },
  );
  let rejectFn: (e: Error) => void = () => {};
  const promise = new Promise<Uint8Array<ArrayBuffer>>((resolve, reject) => {
    rejectFn = reject;
    worker!.onmessage = (e) => {
      worker?.terminate();
      worker = null;
      if (e.data.ok) resolve(e.data.gif);
      else reject(new Error(e.data.error));
    };
    worker!.onerror = (e) => {
      worker?.terminate();
      worker = null;
      reject(new Error(e.message));
    };
    // Envoie des vues RGBA brutes et TRANSFÈRE leurs buffers : pas de clonage des pixels.
    // Le ping-pong référence deux fois les mêmes ImageData ; un buffer ne pouvant être
    // transféré qu'une seule fois, les occurrences suivantes sont copiées.
    const seen = new Set<ArrayBuffer>();
    const frames = payload.frames.map((f) => {
      const buffer = f.data.buffer as ArrayBuffer;
      if (seen.has(buffer)) return new Uint8Array(f.data); // copie : frame dupliquée
      seen.add(buffer);
      return new Uint8Array(buffer, 0, f.data.byteLength);
    });
    worker!.postMessage({ ...payload, frames }, [...seen]);
  });
  return {
    promise,
    cancel: () => {
      if (worker) {
        worker.terminate();
        worker = null;
        rejectFn(new ExportCancelled('Export annulé'));
      }
    },
  };
}
