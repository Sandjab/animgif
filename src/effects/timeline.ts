// n steps → t ∈ [0,1] régulièrement espacés, bornes incluses.
export function sampleTimes(steps: number): number[] {
  if (steps < 2) throw new Error('Il faut au moins 2 steps');
  return Array.from({ length: steps }, (_, i) => i / (steps - 1));
}

// Ordre des frames : ordre de base (éventuellement inversé), puis aller-retour
// ping-pong sans dupliquer les extrémités.
export function frameOrder(frameCount: number, reverse: boolean, pingpong: boolean): number[] {
  const base = Array.from({ length: frameCount }, (_, i) => (reverse ? frameCount - 1 - i : i));
  if (!pingpong) return base;
  return [...base, ...base.slice(1, -1).reverse()];
}

// Conservé pour compat (tests v1) : ping-pong sur l'ordre normal.
export const pingPongOrder = (frameCount: number) => frameOrder(frameCount, false, true);

// Réduction de poids : ne garde qu'une frame sur n de l'ordre FINAL et multiplie le
// délai par n — la durée totale de l'animation est préservée.
export function decimate(
  order: number[],
  delayMs: number,
  n: 1 | 2 | 3,
): { order: number[]; delayMs: number } {
  if (n === 1) return { order, delayMs };
  return { order: order.filter((_, i) => i % n === 0), delayMs: delayMs * n };
}

export const delayToFps = (delayMs: number) => 1000 / delayMs;
