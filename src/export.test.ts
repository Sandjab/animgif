import { describe, expect, it } from 'vitest';
import { clampDim } from './export';

// Valide les paramètres d'export : une dimension hors bornes ou invalide ne doit
// jamais atteindre le rendu ni fausser le garde-fou mémoire (une valeur négative
// rendrait l'estimation de poids négative et désactiverait silencieusement l'alerte).
describe('clampDim', () => {
  it('borne dans [16, 4096]', () => {
    expect(clampDim(-5)).toBe(16);
    expect(clampDim(0)).toBe(16);
    expect(clampDim(240)).toBe(240);
    expect(clampDim(99999)).toBe(4096);
  });
  it('arrondit les décimales et retombe sur 16 si invalide', () => {
    expect(clampDim(179.6)).toBe(180);
    expect(clampDim(Number.NaN)).toBe(16);
  });
});
