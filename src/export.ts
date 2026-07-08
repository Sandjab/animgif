import { bakeAdjustments } from './adjustments';
import { pingPongOrder } from './effects/timeline';
import { computeFrameMatrices, renderFrames } from './frameGenerator';
import type { Store } from './state';

// Garde-fou mémoire : frames RGBA en pleine résolution.
const MAX_BYTES = 500 * 1024 * 1024;

export function initExport(store: Store) {
  const btn = document.querySelector<HTMLButtonElement>('#btn-export')!;
  const progress = document.querySelector<HTMLProgressElement>('#export-progress')!;
  const status = document.querySelector<HTMLElement>('#export-status')!;
  const outW = document.querySelector<HTMLInputElement>('#out-w')!;
  const outH = document.querySelector<HTMLInputElement>('#out-h')!;
  const lockRatio = document.querySelector<HTMLInputElement>('#lock-ratio')!;
  const quality = document.querySelector<HTMLInputElement>('#out-quality')!;

  const clampDim = (v: number) => Math.min(4096, Math.max(16, Math.round(v) || 16));

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

  btn.addEventListener('click', async () => {
    const s = store.get();
    if (!s.sourceImage) return;

    const frameCount = s.loopMode === 'pingpong' ? pingPongOrder(s.steps).length : s.steps;
    // Pic mémoire réel ≈ 3× les frames brutes : frames + concaténation worker + copie wasm.
    const bytes = frameCount * s.outW * s.outH * 4 * 3;
    if (bytes > MAX_BYTES) {
      const go = confirm(
        `Export volumineux : ${frameCount} frames en ${s.outW}×${s.outH} (~${Math.round(bytes / 1e6)} Mo en mémoire au pic). Continuer ?`,
      );
      if (!go) return;
    }

    btn.disabled = true;
    progress.hidden = false;
    progress.removeAttribute('value'); // barre indéterminée (gifski ne remonte pas de progression)
    try {
      status.textContent = 'Rendu des frames en pleine résolution…';
      const baked = await bakeAdjustments(s.sourceImage, s.bgRemovedBlob, s.adjustments);
      const view = { imageW: baked.width, imageH: baked.height, outW: s.outW, outH: s.outH };
      const matrices = computeFrameMatrices(s.effects, s.steps, view);
      let frames = renderFrames(baked, matrices, s.outW, s.outH, s.adjustments.backgroundColor);
      if (s.loopMode === 'pingpong') frames = pingPongOrder(s.steps).map((i) => frames[i]);

      status.textContent = 'Encodage gifski… (peut prendre du temps)';
      // repeat : vérifié sur pièce dans le binaire gifski-wasm 2.2.0 installé (rust/src/lib.rs
      // du paquet, et `gif` crate 0.13.1 qu'il utilise en interne) — la doc npm ne précise pas
      // la sémantique. gifski-wasm mappe repeat<0 (ou absent) → boucle infinie ; repeat>=0 →
      // Repeat::Finite(repeat), et Finite(0) fait explicitement sauter l'écriture de
      // l'extension NETSCAPE2.0 (donc AUCUNE boucle, pas une boucle infinie comme le
      // supposait le plan initial). On mappe donc loopCount (nombre total de lectures
      // voulues, "n fois" dans l'UI, toujours ≥ 1) sur loopCount-1 répétitions supplémentaires,
      // et -1 pour les modes infinite/pingpong.
      const repeat = s.loopMode === 'count' ? s.loopCount - 1 : -1;
      const gif = await encodeInWorker({
        frames, width: s.outW, height: s.outH,
        frameDurations: frames.map(() => s.delayMs),
        quality: s.quality, repeat,
      });

      const blob = new Blob([gif], { type: 'image/gif' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'animation.gif';
      a.click();
      URL.revokeObjectURL(a.href);
      status.textContent = `GIF exporté (${(blob.size / 1024).toFixed(0)} Ko).`;
    } catch (err) {
      status.textContent = `Échec de l'export : ${err instanceof Error ? err.message : err}`;
    } finally {
      btn.disabled = false;
      progress.hidden = true;
      progress.value = 0;
    }
  });
}

function encodeInWorker(payload: {
  frames: ImageData[]; width: number; height: number;
  frameDurations: number[]; quality: number; repeat: number;
}): Promise<Uint8Array<ArrayBuffer>> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./workers/gifEncoder.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      worker.terminate();
      if (e.data.ok) resolve(e.data.gif);
      else reject(new Error(e.data.error));
    };
    worker.onerror = (e) => { worker.terminate(); reject(new Error(e.message)); };
    // Envoie des vues RGBA brutes et TRANSFÈRE leurs buffers : pas de clonage des pixels.
    const frames = payload.frames.map((f) => new Uint8Array(f.data.buffer, 0, f.data.byteLength));
    worker.postMessage({ ...payload, frames }, frames.map((f) => f.buffer));
  });
}
