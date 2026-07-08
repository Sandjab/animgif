import { describe, expect, it } from 'vitest';
import { buildFilterString } from './adjustments';

describe('buildFilterString', () => {
  it('valeurs neutres → "none"', () => {
    expect(buildFilterString({ brightness: 1, contrast: 1, saturation: 1 })).toBe('none');
  });
  it('compose les filtres non neutres seulement', () => {
    expect(buildFilterString({ brightness: 1.2, contrast: 1, saturation: 0.5 }))
      .toBe('brightness(1.2) saturate(0.5)');
  });
});
