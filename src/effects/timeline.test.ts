import { describe, expect, it } from 'vitest';
import { decimate, delayToFps, frameOrder, pingPongOrder, sampleTimes } from './timeline';

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

describe('frameOrder', () => {
  it('ordre normal', () => {
    expect(frameOrder(4, false, false)).toEqual([0, 1, 2, 3]);
  });
  it('inversé', () => {
    expect(frameOrder(4, true, false)).toEqual([3, 2, 1, 0]);
  });
  it('ping-pong', () => {
    expect(frameOrder(4, false, true)).toEqual([0, 1, 2, 3, 2, 1]);
  });
  it('inversé puis ping-pong (le ping-pong s\'applique à l\'ordre inversé)', () => {
    expect(frameOrder(4, true, true)).toEqual([3, 2, 1, 0, 1, 2]);
  });
});

describe('decimate', () => {
  it('n=1 : identité', () => {
    expect(decimate([0, 1, 2], 80, 1)).toEqual({ order: [0, 1, 2], delayMs: 80 });
  });
  it('n=2 : une frame sur deux, délai doublé (durée totale préservée)', () => {
    expect(decimate([0, 1, 2, 3, 2, 1], 80, 2)).toEqual({ order: [0, 2, 2], delayMs: 160 });
  });
  it('n=3 : une frame sur trois, délai triplé', () => {
    expect(decimate([0, 1, 2, 3, 4, 5], 100, 3)).toEqual({ order: [0, 3], delayMs: 300 });
  });
});
