import { describe, expect, it } from 'vitest';
import { decimatedOrder, delayToFps, frameOrder, pingPongOrder, sampleTimes } from './timeline';

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

describe('decimatedOrder', () => {
  it('n=1 : ordre complet, délai inchangé', () => {
    expect(decimatedOrder(4, false, true, 1, 80)).toEqual({ order: [0, 1, 2, 3, 2, 1], delayMs: 80 });
  });
  it('n=2 : décime la base, durée totale préservée', () => {
    // base [0,1,2,3] → [0,2] ; durée 4×80=320 → 2×160
    expect(decimatedOrder(4, false, false, 2, 80)).toEqual({ order: [0, 2], delayMs: 160 });
  });
  it('n=2 + ping-pong : pas de frames dupliquées dos à dos, durée préservée', () => {
    // full ping-pong = 6 frames × 80 = 480 ; base décimée [0,2] → mirror [0,2] ; 480/2 = 240
    expect(decimatedOrder(4, false, true, 2, 80)).toEqual({ order: [0, 2], delayMs: 240 });
  });
  it('longueur non multiple : durée préservée à l\'arrondi près', () => {
    // base 7×100=700 ; gardées [0,3,6] ; 700/3 ≈ 233
    expect(decimatedOrder(7, false, false, 3, 100)).toEqual({ order: [0, 3, 6], delayMs: 233 });
  });
  it('reverse + décimation', () => {
    expect(decimatedOrder(4, true, false, 2, 80)).toEqual({ order: [3, 1], delayMs: 160 });
  });
});
