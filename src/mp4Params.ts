// Arrondit une dimension d'export au pair inférieur (H.264/yuv420 exige des
// dimensions paires), avec un plancher à 16. NaN → 16.
export function evenDim(v: number): number {
  const n = Math.round(v) || 16;
  return Math.max(16, n - (n % 2));
}

// Remappe le curseur qualité (1–100) en débit MP4 (bits/s). Le débit croît avec la
// qualité et est proportionné au flux de pixels (largeur·hauteur·fps), borné à
// [100 kbit/s, 50 Mbit/s]. bpp = bits par pixel visé selon la qualité.
export function qualityToBitrate(quality: number, width: number, height: number, fps: number): number {
  const q = Math.min(100, Math.max(1, quality)) / 100;
  const bpp = 0.03 + q * (0.2 - 0.03);
  const bitrate = Math.round(bpp * width * height * fps);
  return Math.min(50_000_000, Math.max(100_000, bitrate));
}
