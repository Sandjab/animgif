import { composeBlur, composeEffects, type View } from './effects/effects';
import type { Mat } from './effects/matrix';
import { sampleTimes } from './effects/timeline';
import type { Effect } from './types';

export function computeFrameMatrices(effects: Effect[], steps: number, view: View): Mat[] {
  return sampleTimes(steps).map((t) => composeEffects(effects, t, view));
}

// Jumeau de computeFrameMatrices pour le canal filtre : un rayon de flou (px) par step.
// Pas de `view` : le flou est un scalaire en px à la résolution d'export.
export function computeFrameBlurs(effects: Effect[], steps: number): number[] {
  return sampleTimes(steps).map((t) => composeBlur(effects, t));
}

// Rend les frames par tranches en cédant la main entre chaque tranche : l'UI reste
// réactive, la progression s'affiche, et l'annulation est possible. Retourne null si annulé.
// Navigateur uniquement (non couvert par Vitest) — vérifié lors de l'export.
export async function renderFramesChunked(
  baked: HTMLCanvasElement,
  matrices: Mat[],
  blurs: number[],
  outW: number,
  outH: number,
  backgroundColor: string,
  onProgress: (done: number, total: number) => void,
  isCancelled: () => boolean,
  chunkSize = 4,
): Promise<ImageData[] | null> {
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const frames: ImageData[] = [];
  for (let i = 0; i < matrices.length; i++) {
    if (isCancelled()) return null;
    const m = matrices[i];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = 'none'; // le fond n'est jamais flouté
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, outW, outH);
    ctx.filter = blurs[i] > 0 ? `blur(${blurs[i]}px)` : 'none';
    ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    ctx.drawImage(baked, 0, 0);
    frames.push(ctx.getImageData(0, 0, outW, outH));
    if ((i + 1) % chunkSize === 0 || i === matrices.length - 1) {
      onProgress(i + 1, matrices.length);
      await new Promise((r) => setTimeout(r, 0)); // cède la main (repaint + événements)
    }
  }
  return frames;
}
