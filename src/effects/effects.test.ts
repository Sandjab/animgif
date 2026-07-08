import { describe, expect, it } from 'vitest';
import { apply } from './matrix';
import { composeEffects, effectMatrix, fitMatrix } from './effects';
import type { Effect } from '../types';

const view = { imageW: 200, imageH: 100, outW: 100, outH: 50 };

describe('fitMatrix', () => {
  it('cadre l\'image entière dans la sortie (contain, centré)', () => {
    const m = fitMatrix(view);
    expect(apply(m, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(apply(m, { x: 200, y: 100 })).toEqual({ x: 100, y: 50 });
  });
});

describe('effectMatrix', () => {
  it('kenBurns à t=0 mappe le rect from sur le viewport', () => {
    const e: Effect = { kind: 'kenBurns', from: { x: 20, y: 10, w: 40, h: 20 }, to: { x: 0, y: 0, w: 200, h: 100 }, easing: 'linear' };
    const m = effectMatrix(e, 0, view);
    expect(apply(m, { x: 20, y: 10 })).toEqual({ x: 0, y: 0 });
    expect(apply(m, { x: 60, y: 30 })).toEqual({ x: 100, y: 50 });
  });
  it('kenBurns à t=1 mappe le rect to sur le viewport', () => {
    const e: Effect = { kind: 'kenBurns', from: { x: 20, y: 10, w: 40, h: 20 }, to: { x: 0, y: 0, w: 200, h: 100 }, easing: 'linear' };
    const m = effectMatrix(e, 1, view);
    expect(apply(m, { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(apply(m, { x: 200, y: 100 })).toEqual({ x: 100, y: 50 });
  });
  it('rotation interpole l\'angle autour du centre de sortie', () => {
    const e: Effect = { kind: 'rotation', fromDeg: 0, toDeg: 90, easing: 'linear' };
    const m = effectMatrix(e, 1, view);
    // centre (50, 25) fixe
    const c = apply(m, { x: 50, y: 25 });
    expect(c.x).toBeCloseTo(50);
    expect(c.y).toBeCloseTo(25);
    // point à droite du centre → sous le centre après 90° horaire
    const p = apply(m, { x: 60, y: 25 });
    expect(p.x).toBeCloseTo(50);
    expect(p.y).toBeCloseTo(35);
  });
  it('translation va de (0,0) à (dx,dy)', () => {
    const e: Effect = { kind: 'translation', dx: 30, dy: -10, easing: 'linear' };
    expect(apply(effectMatrix(e, 0, view), { x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(apply(effectMatrix(e, 0.5, view), { x: 0, y: 0 })).toEqual({ x: 15, y: -5 });
  });
  it('bounce revient à zéro à chaque oscillation et ne dépasse pas l\'amplitude', () => {
    const e: Effect = { kind: 'bounce', amplitude: 20, oscillations: 2 };
    expect(apply(effectMatrix(e, 0, view), { x: 0, y: 0 }).y).toBeCloseTo(0);
    expect(apply(effectMatrix(e, 0.5, view), { x: 0, y: 0 }).y).toBeCloseTo(0);
    expect(apply(effectMatrix(e, 1, view), { x: 0, y: 0 }).y).toBeCloseTo(0);
    const peak = apply(effectMatrix(e, 0.25, view), { x: 0, y: 0 }).y;
    expect(Math.abs(peak)).toBeCloseTo(20); // sommet de la 1re oscillation (vers le haut : y négatif)
    expect(peak).toBeLessThan(0);
  });
});

describe('composeEffects', () => {
  it('sans effet → matrice de cadrage seule', () => {
    const m = composeEffects([], 0.5, view);
    expect(apply(m, { x: 200, y: 100 })).toEqual({ x: 100, y: 50 });
  });
  it('avec kenBurns, le cadrage de base est remplacé par le kenBurns', () => {
    const kb: Effect = { kind: 'kenBurns', from: { x: 0, y: 0, w: 200, h: 100 }, to: { x: 0, y: 0, w: 200, h: 100 }, easing: 'linear' };
    const m = composeEffects([kb], 0, view);
    expect(apply(m, { x: 200, y: 100 })).toEqual({ x: 100, y: 50 });
  });
  it('translation seule s\'applique sur l\'image cadrée', () => {
    const tr: Effect = { kind: 'translation', dx: 10, dy: 0, easing: 'linear' };
    const m = composeEffects([tr], 1, view);
    expect(apply(m, { x: 0, y: 0 })).toEqual({ x: 10, y: 0 });
  });
  it('deux effets se composent dans l\'ordre de la liste (le dernier appliqué en dernier)', () => {
    const sq = { imageW: 100, imageH: 100, outW: 100, outH: 100 };
    const tr: Effect = { kind: 'translation', dx: 10, dy: 0, easing: 'linear' };
    const rot: Effect = { kind: 'rotation', fromDeg: 0, toDeg: 90, easing: 'linear' };
    // [tr, rot] : translation d'abord, rotation ensuite → (0,0) → (10,0) → (100,10)
    const p1 = apply(composeEffects([tr, rot], 1, sq), { x: 0, y: 0 });
    expect(p1.x).toBeCloseTo(100);
    expect(p1.y).toBeCloseTo(10);
    // [rot, tr] : rotation d'abord → (0,0) → (100,0) → puis translation → (110,0)
    const p2 = apply(composeEffects([rot, tr], 1, sq), { x: 0, y: 0 });
    expect(p2.x).toBeCloseTo(110);
    expect(p2.y).toBeCloseTo(0);
  });
});
