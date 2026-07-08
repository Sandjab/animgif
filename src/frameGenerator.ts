import { composeEffects, type View } from './effects/effects';
import type { Mat } from './effects/matrix';
import { sampleTimes } from './effects/timeline';
import type { Effect } from './types';

export function computeFrameMatrices(effects: Effect[], steps: number, view: View): Mat[] {
  return sampleTimes(steps).map((t) => composeEffects(effects, t, view));
}

// Rend chaque frame dans un canvas de sortie. `baked` = image retouchée (canvas source).
// Navigateur uniquement (non couvert par Vitest) — vérifié lors de l'export (Task 14).
export function renderFrames(
  baked: HTMLCanvasElement,
  matrices: Mat[],
  outW: number,
  outH: number,
  backgroundColor: string,
): ImageData[] {
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  return matrices.map((m) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, outW, outH);
    ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    ctx.drawImage(baked, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    return ctx.getImageData(0, 0, outW, outH);
  });
}
