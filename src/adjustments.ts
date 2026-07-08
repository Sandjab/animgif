import type { Adjustments } from './types';

export function buildFilterString(a: { brightness: number; contrast: number; saturation: number }): string {
  const parts: string[] = [];
  if (a.brightness !== 1) parts.push(`brightness(${a.brightness})`);
  if (a.contrast !== 1) parts.push(`contrast(${a.contrast})`);
  if (a.saturation !== 1) parts.push(`saturate(${a.saturation})`);
  return parts.length ? parts.join(' ') : 'none';
}

// « Cuit » les retouches dans un canvas : source (ou fond supprimé), filtres, flip, rotation 90°.
// Navigateur uniquement — vérifié visuellement via la preview.
export async function bakeAdjustments(
  source: HTMLImageElement,
  bgRemovedBlob: Blob | null,
  adj: Adjustments,
): Promise<HTMLCanvasElement> {
  let img: CanvasImageSource = source;
  let w = source.naturalWidth, h = source.naturalHeight;
  if (bgRemovedBlob) {
    const bmp = await createImageBitmap(bgRemovedBlob);
    img = bmp; w = bmp.width; h = bmp.height;
  }
  const rotated = adj.rotate90 % 2 === 1;
  const canvas = document.createElement('canvas');
  canvas.width = rotated ? h : w;
  canvas.height = rotated ? w : h;
  const ctx = canvas.getContext('2d')!;
  ctx.filter = buildFilterString(adj);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((adj.rotate90 * Math.PI) / 2);
  ctx.scale(adj.flipH ? -1 : 1, adj.flipV ? -1 : 1);
  ctx.drawImage(img, -w / 2, -h / 2);
  return canvas;
}
