import { describe, expect, it } from 'vitest';
import { applyEasing } from './easing';

describe('applyEasing', () => {
  it('préserve les bornes 0 et 1 pour tous les easings', () => {
    for (const e of ['linear', 'easeInOut', 'bounce'] as const) {
      expect(applyEasing(e, 0)).toBeCloseTo(0);
      expect(applyEasing(e, 1)).toBeCloseTo(1);
    }
  });
  it('linear est identité', () => {
    expect(applyEasing('linear', 0.25)).toBeCloseTo(0.25);
  });
  it('easeInOut est symétrique et passe par 0.5', () => {
    expect(applyEasing('easeInOut', 0.5)).toBeCloseTo(0.5);
    expect(applyEasing('easeInOut', 0.2)).toBeCloseTo(1 - applyEasing('easeInOut', 0.8));
    expect(applyEasing('easeInOut', 0.2)).toBeLessThan(0.2); // démarre lentement
  });
  it('bounce dépasse puis revient (rebond en fin de course)', () => {
    // easeOutBack : dépasse 1 avant de s'y poser
    const overshoot = Math.max(...[0.7, 0.8, 0.9].map((t) => applyEasing('bounce', t)));
    expect(overshoot).toBeGreaterThan(1);
  });
});
