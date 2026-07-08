import { bakeAdjustments } from './adjustments';
import { decimatedOrder } from './effects/timeline';
import { computeFrameMatrices, renderFramesChunked } from './frameGenerator';
import type { Store } from './state';

// Garde-fou mémoire : frames RGBA en pleine résolution.
const MAX_BYTES = 500 * 1024 * 1024;

// Borne une dimension d'export saisie : entier dans [16, 4096], 16 si invalide.
export const clampDim = (v: number) => Math.min(4096, Math.max(16, Math.round(v) || 16));

class ExportCancelled extends Error {}

export function initExport(store: Store) {
  const btn = document.querySelector<HTMLButtonElement>('#btn-export')!;
  const progress = document.querySelector<HTMLProgressElement>('#export-progress')!;
  const status = document.querySelector<HTMLElement>('#export-status')!;
  const outW = document.querySelector<HTMLInputElement>('#out-w')!;
  const outH = document.querySelector<HTMLInputElement>('#out-h')!;
  const lockRatio = document.querySelector<HTMLInputElement>('#lock-ratio')!;
  const quality = document.querySelector<HTMLInputElement>('#out-quality')!;
  const cancelBtn = document.querySelector<HTMLButtonElement>('#btn-cancel-export')!;
  let cancelled = false;
  let cancelEncode: (() => void) | null = null;
  cancelBtn.addEventListener('click', () => {
    cancelled = true;      // interrompt la boucle de rendu
    cancelEncode?.();      // termine le worker si l'encodage a commencé
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

    const { order, delayMs } = decimatedOrder(
      s.steps, s.reverse, s.loopMode === 'pingpong', s.decimation, s.delayMs,
    );
    // Pic mémoire réel ≈ 3× les frames brutes : frames + concaténation worker + copie wasm.
    const bytes = order.length * s.outW * s.outH * 4 * 3;
    if (bytes > MAX_BYTES) {
      const go = confirm(
        `Export volumineux : ${order.length} frames en ${s.outW}×${s.outH} (~${Math.round(bytes / 1e6)} Mo en mémoire au pic). Continuer ?`,
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
      const view = { imageW: baked.width, imageH: baked.height, outW: s.outW, outH: s.outH };
      const matrices = computeFrameMatrices(s.effects, s.steps, view);
      const stepFrames = await renderFramesChunked(
        baked, matrices, s.outW, s.outH, s.adjustments.backgroundColor,
        (done, total) => {
          progress.value = done / total;
          status.textContent = `Rendu des frames… (${done}/${total})`;
        },
        () => cancelled,
      );
      if (!stepFrames) {
        status.textContent = 'Export annulé.';
        return;
      }
      const frames = order.map((i) => stepFrames[i]);

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
        frames, width: s.outW, height: s.outH,
        frameDurations: frames.map(() => delayMs),
        quality: s.quality, repeat,
      });
      cancelEncode = job.cancel;
      const gif = await job.promise;

      const blob = new Blob([gif], { type: 'image/gif' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'animation.gif';
      a.click();
      URL.revokeObjectURL(a.href);
      status.textContent = `GIF exporté (${(blob.size / 1024).toFixed(0)} Ko).`;
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
