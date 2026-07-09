import { describe, expect, it } from 'vitest';
import { evenDim, qualityToBitrate } from './mp4Params';

describe('evenDim', () => {
  it('laisse une dimension paire inchangée', () => {
    expect(evenDim(480)).toBe(480);
  });
  it('arrondit une dimension impaire au pair inférieur', () => {
    expect(evenDim(481)).toBe(480);
  });
  it('plancher à 16 (pair)', () => {
    expect(evenDim(17)).toBe(16);
    expect(evenDim(15)).toBe(16);
  });
  it('NaN retombe sur 16', () => {
    expect(evenDim(Number.NaN)).toBe(16);
  });
});

describe('qualityToBitrate', () => {
  it('croît avec la qualité (dimensions et fps égaux)', () => {
    const lo = qualityToBitrate(10, 480, 480, 12.5);
    const hi = qualityToBitrate(90, 480, 480, 12.5);
    expect(hi).toBeGreaterThan(lo);
  });
  it('croît avec le nombre de pixels', () => {
    const small = qualityToBitrate(50, 480, 480, 25);
    const large = qualityToBitrate(50, 960, 960, 25);
    expect(large).toBeGreaterThan(small);
  });
  it('borne basse à 100 kbit/s pour de très petites sorties', () => {
    expect(qualityToBitrate(1, 16, 16, 2)).toBe(100_000);
  });
  it('borne haute à 50 Mbit/s pour de très grosses sorties', () => {
    expect(qualityToBitrate(100, 4096, 4096, 60)).toBe(50_000_000);
  });
  it('retourne un entier', () => {
    expect(Number.isInteger(qualityToBitrate(63, 481, 373, 12.5))).toBe(true);
  });
});
