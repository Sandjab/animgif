import { describe, expect, it } from 'vitest';
import { computeFrameMatrices } from './frameGenerator';
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
