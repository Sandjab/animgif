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
  it('nouveaux filtres avec les bonnes unités, dans l\'ordre documenté', () => {
    expect(buildFilterString({
      brightness: 1, contrast: 1, saturation: 1,
      sepia: 0.4, grayscale: 0.3, hueRotate: 90, blur: 2, invert: true,
    })).toBe('sepia(0.4) grayscale(0.3) hue-rotate(90deg) invert(1) blur(2px)');
  });
  it('nouveaux filtres neutres omis', () => {
    expect(buildFilterString({
      brightness: 1, contrast: 1, saturation: 1,
      sepia: 0, grayscale: 0, hueRotate: 0, blur: 0, invert: false,
    })).toBe('none');
  });
});
