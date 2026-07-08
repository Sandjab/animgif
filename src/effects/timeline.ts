// n steps → t ∈ [0,1] régulièrement espacés, bornes incluses.
export function sampleTimes(steps: number): number[] {
  if (steps < 2) throw new Error('Il faut au moins 2 steps');
  return Array.from({ length: steps }, (_, i) => i / (steps - 1));
}

// Ordre des index de frames pour une boucle ping-pong : 0..n-1 puis n-2..1
// (les extrémités ne sont pas dupliquées, la boucle GIF enchaîne naturellement).
export function pingPongOrder(frameCount: number): number[] {
  const forward = Array.from({ length: frameCount }, (_, i) => i);
  const back = forward.slice(1, -1).reverse();
  return [...forward, ...back];
}

export const delayToFps = (delayMs: number) => 1000 / delayMs;
