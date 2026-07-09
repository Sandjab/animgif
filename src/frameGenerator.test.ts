import { describe, expect, it } from 'vitest';
import { computeFrameBlurs, computeFrameMatrices } from './frameGenerator';
import { apply } from './effects/matrix';
import type { Effect } from './types';

describe('computeFrameMatrices', () => {
  const view = { imageW: 100, imageH: 100, outW: 100, outH: 100 };
  it('une matrice par step, progression monotone', () => {
    const tr: Effect = { kind: 'translation', dx: 90, dy: 0, easing: 'linear' };
    const mats = computeFrameMatrices([tr], 4, view);
    expect(mats).toHaveLength(4);
    const xs = mats.map((m) => apply(m, { x: 0, y: 0 }).x);
    [0, 30, 60, 90].forEach((v, i) => expect(xs[i]).toBeCloseTo(v)); // 90 × ⅓ n'est pas exact en flottants
  });
});

describe('computeFrameBlurs', () => {
  it('un rayon par step, interpolé sur la séquence', () => {
    const b: Effect = { kind: 'blur', fromPx: 0, toPx: 8, easing: 'linear' };
    const blurs = computeFrameBlurs([b], 3);
    expect(blurs).toHaveLength(3);
    [0, 4, 8].forEach((v, i) => expect(blurs[i]).toBeCloseTo(v)); // t = 0, 0.5, 1
  });
  it('0 partout sans effet blur', () => {
    const tr: Effect = { kind: 'translation', dx: 10, dy: 0, easing: 'linear' };
    expect(computeFrameBlurs([tr], 4)).toEqual([0, 0, 0, 0]);
  });
});
