import { describe, expect, it, vi } from 'vitest';
import { createStore, initialState } from './state';

describe('createStore', () => {
  it('get retourne l\'état courant, update fusionne', () => {
    const s = createStore(initialState());
    s.update({ steps: 24 });
    expect(s.get().steps).toBe(24);
    expect(s.get().delayMs).toBe(initialState().delayMs); // le reste est préservé
  });
  it('subscribe est notifié à chaque update, unsubscribe fonctionne', () => {
    const s = createStore(initialState());
    const fn = vi.fn();
    const off = s.subscribe(fn);
    s.update({ steps: 10 });
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    s.update({ steps: 12 });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('initialState', () => {
  it('exporte en GIF par défaut', () => {
    expect(initialState().format).toBe('gif');
  });
});
