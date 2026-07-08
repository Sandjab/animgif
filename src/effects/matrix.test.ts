import { describe, expect, it } from 'vitest';
import { apply, identity, multiply, rotationDeg, scaling, translation } from './matrix';

describe('matrix', () => {
  it('identity laisse un point inchangé', () => {
    expect(apply(identity(), { x: 3, y: -2 })).toEqual({ x: 3, y: -2 });
  });
  it('translation déplace', () => {
    expect(apply(translation(10, 5), { x: 1, y: 1 })).toEqual({ x: 11, y: 6 });
  });
  it('scaling autour d\'un centre laisse le centre fixe', () => {
    const m = scaling(2, 2, 50, 50);
    expect(apply(m, { x: 50, y: 50 })).toEqual({ x: 50, y: 50 });
    expect(apply(m, { x: 60, y: 50 })).toEqual({ x: 70, y: 50 });
  });
  it('rotation de 90° autour d\'un centre', () => {
    const p = apply(rotationDeg(90, 0, 0), { x: 1, y: 0 });
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(1);
  });
  it('multiply(A, B) applique B puis A', () => {
    const m = multiply(translation(100, 0), scaling(2, 2, 0, 0));
    expect(apply(m, { x: 1, y: 1 })).toEqual({ x: 102, y: 2 });
  });
});
