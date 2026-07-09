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
  it('spin3d axe Y : identité à t=0, effondré au quart de tour, miroir à mi-tour', () => {
    const e: Effect = { kind: 'spin3d', axis: 'y', turns: 1, easing: 'linear' };
    const sq = { imageW: 100, imageH: 100, outW: 100, outH: 100 };
    expect(apply(effectMatrix(e, 0, sq), { x: 10, y: 10 })).toEqual({ x: 10, y: 10 });
    // quart de tour : cos(π/2) ≈ 0 → tout converge vers le centre en x
    expect(apply(effectMatrix(e, 0.25, sq), { x: 10, y: 10 }).x).toBeCloseTo(50);
    // mi-tour : cos(π) = −1 → miroir autour du centre, y intact
    const p = apply(effectMatrix(e, 0.5, sq), { x: 10, y: 10 });
    expect(p.x).toBeCloseTo(90);
    expect(p.y).toBeCloseTo(10);
  });
  it('spin3d : turns multiplie la vitesse angulaire', () => {
    const e: Effect = { kind: 'spin3d', axis: 'y', turns: 2, easing: 'linear' };
    const sq = { imageW: 100, imageH: 100, outW: 100, outH: 100 };
    // 2 tours : à t=0.25 on a déjà fait un demi-tour → miroir (cos(π) = −1)
    expect(apply(effectMatrix(e, 0.25, sq), { x: 10, y: 10 }).x).toBeCloseTo(90);
  });
  it('spin3d axe X écrase la dimension verticale', () => {
    const e: Effect = { kind: 'spin3d', axis: 'x', turns: 1, easing: 'linear' };
    const sq = { imageW: 100, imageH: 100, outW: 100, outH: 100 };
    const p = apply(effectMatrix(e, 0.5, sq), { x: 10, y: 10 });
    expect(p.x).toBeCloseTo(10);
    expect(p.y).toBeCloseTo(90);
  });
  it('pulse : échelle 1 (identité) à t=0 et t=1, dilate au pic autour du centre', () => {
    const e: Effect = { kind: 'pulse', amplitude: 20, oscillations: 1 };
    const sq = { imageW: 100, imageH: 100, outW: 100, outH: 100 };
    // t=0 → s=1 → identité (sin(0)=0 exact)
    expect(apply(effectMatrix(e, 0, sq), { x: 10, y: 10 })).toEqual({ x: 10, y: 10 });
    // t=1 → sin(π)≈0 → s≈1 → quasi identité (toBeCloseTo : sin(π) n'est pas exactement 0)
    const p1 = apply(effectMatrix(e, 1, sq), { x: 10, y: 10 });
    expect(p1.x).toBeCloseTo(10);
    expect(p1.y).toBeCloseTo(10);
    // t=0.5 → sin(π/2)=1 → s=1.2 ; centre (50,50) fixe, point à droite s'éloigne de 20%
    const c = apply(effectMatrix(e, 0.5, sq), { x: 50, y: 50 });
    expect(c.x).toBeCloseTo(50);
    expect(c.y).toBeCloseTo(50);
    const p = apply(effectMatrix(e, 0.5, sq), { x: 60, y: 50 });
    expect(p.x).toBeCloseTo(62); // 50 + 10 * 1.2
  });
  it('shake : déplacement nul à t=0 et t=1 (oscillations entières), non nul entre-temps', () => {
    const e: Effect = { kind: 'shake', amplitude: 10, oscillations: 2 };
    const sq = { imageW: 100, imageH: 100, outW: 100, outH: 100 };
    // translation pure : (0,0) mesure le déplacement
    const p0 = apply(effectMatrix(e, 0, sq), { x: 0, y: 0 });
    expect(p0.x).toBeCloseTo(0);
    expect(p0.y).toBeCloseTo(0);
    const p1 = apply(effectMatrix(e, 1, sq), { x: 0, y: 0 });
    expect(p1.x).toBeCloseTo(0);
    expect(p1.y).toBeCloseTo(0);
    // fréquences x/y différentes → déplacement non nul à mi-parcours d'une oscillation
    const p = apply(effectMatrix(e, 0.1, sq), { x: 0, y: 0 });
    expect(Math.abs(p.x) + Math.abs(p.y)).toBeGreaterThan(0);
  });
  it('sway : angle nul à t=0 et t=1, pivote autour du bas du viewport', () => {
    const e: Effect = { kind: 'sway', amplitude: 30, oscillations: 1 };
    const sq = { imageW: 100, imageH: 100, outW: 100, outH: 100 };
    // t=0 → 0° → identité
    const a0 = apply(effectMatrix(e, 0, sq), { x: 50, y: 0 });
    expect(a0.x).toBeCloseTo(50);
    expect(a0.y).toBeCloseTo(0);
    // t=1 → sin(2π)=0 → 0° → identité
    const a1 = apply(effectMatrix(e, 1, sq), { x: 50, y: 0 });
    expect(a1.x).toBeCloseTo(50);
    expect(a1.y).toBeCloseTo(0);
    // pivot en bas (50,100) fixe quel que soit t
    const pivot = apply(effectMatrix(e, 0.25, sq), { x: 50, y: 100 });
    expect(pivot.x).toBeCloseTo(50);
    expect(pivot.y).toBeCloseTo(100);
    // à t=0.25, sin(π/2)=1 → 30° ; un point au sommet se déplace latéralement
    const top = apply(effectMatrix(e, 0.25, sq), { x: 50, y: 0 });
    expect(top.x).not.toBeCloseTo(50);
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
