// n steps → t ∈ [0,1] régulièrement espacés, bornes incluses.
export function sampleTimes(steps: number): number[] {
  if (steps < 2) throw new Error('Il faut au moins 2 steps');
  return Array.from({ length: steps }, (_, i) => i / (steps - 1));
}

// Aller-retour sans dupliquer les extrémités, sur un ordre arbitraire.
export const mirror = (order: number[]) => [...order, ...order.slice(1, -1).reverse()];

// Ordre des frames : ordre de base (éventuellement inversé), puis aller-retour ping-pong.
export function frameOrder(frameCount: number, reverse: boolean, pingpong: boolean): number[] {
  const base = Array.from({ length: frameCount }, (_, i) => (reverse ? frameCount - 1 - i : i));
  return pingpong ? mirror(base) : base;
}

// Conservé pour compat (tests v1) : ping-pong sur l'ordre normal.
export const pingPongOrder = (frameCount: number) => frameOrder(frameCount, false, true);

// Décimation : ne garde qu'une frame sur n de l'ordre de BASE (jamais de doublons
// dos à dos), reconstruit le ping-pong ensuite, et met le délai à l'échelle exacte
// pour préserver la durée totale de l'animation finale (à l'arrondi près).
// Limite connue : la dernière frame de base est sautée si (steps−1) % n ≠ 0.
export function decimatedOrder(
  steps: number,
  reverse: boolean,
  pingpong: boolean,
  n: 1 | 2 | 3,
  delayMs: number,
): { order: number[]; delayMs: number } {
  const full = frameOrder(steps, reverse, pingpong);
  if (n === 1) return { order: full, delayMs };
  const keptBase = frameOrder(steps, reverse, false).filter((_, i) => i % n === 0);
  const order = pingpong ? mirror(keptBase) : keptBase;
  return { order, delayMs: Math.round((delayMs * full.length) / order.length) };
}

export const delayToFps = (delayMs: number) => 1000 / delayMs;
