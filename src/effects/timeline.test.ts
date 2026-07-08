import { describe, expect, it } from 'vitest';
import { delayToFps, pingPongOrder, sampleTimes } from './timeline';

describe('sampleTimes', () => {
  it('n steps → n valeurs de 0 à 1 incluses', () => {
    expect(sampleTimes(5)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
  it('minimum 2 steps', () => {
    expect(() => sampleTimes(1)).toThrow();
  });
});

describe('pingPongOrder', () => {
  it('aller-retour sans dupliquer les extrémités', () => {
    expect(pingPongOrder(4)).toEqual([0, 1, 2, 3, 2, 1]);
  });
  it('2 frames → pas de retour à ajouter', () => {
    expect(pingPongOrder(2)).toEqual([0, 1]);
  });
});

describe('delayToFps', () => {
  it('100 ms → 10 FPS', () => {
    expect(delayToFps(100)).toBe(10);
  });
});
