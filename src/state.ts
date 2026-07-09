import type { Adjustments, Effect, LoopMode } from './types';

export interface AppState {
  sourceImage: HTMLImageElement | null; // image importée
  bgRemovedBlob: Blob | null;           // résultat remove background (PNG), sinon null
  adjustments: Adjustments;
  effects: Effect[];
  steps: number;      // nombre de frames générées
  delayMs: number;    // délai inter-frames
  loopMode: LoopMode;
  loopCount: number;  // utilisé si loopMode === 'count'
  reverse: boolean;   // lecture inversée (preview + export)
  decimation: 1 | 2 | 3; // export : 1 frame sur n, délai × n
  outW: number;       // dimensions d'export
  outH: number;
  quality: number;    // gifski 1-100
  format: 'gif' | 'mp4'; // format d'export (défaut gif)
}

export function initialState(): AppState {
  return {
    sourceImage: null,
    bgRemovedBlob: null,
    adjustments: {
      brightness: 1, contrast: 1, saturation: 1,
      sepia: 0, grayscale: 0, hueRotate: 0, blur: 0, invert: false,
      flipH: false, flipV: false, rotate90: 0,
      backgroundColor: '#000000',
    },
    effects: [],
    steps: 24,
    delayMs: 80,
    loopMode: 'infinite',
    loopCount: 1,
    reverse: false,
    decimation: 1,
    outW: 480,
    outH: 480,
    quality: 80,
    format: 'gif',
  };
}

export function createStore(initial: AppState) {
  let state = initial;
  const listeners = new Set<(s: AppState) => void>();
  return {
    // Contrat : ne jamais muter l'objet retourné — toujours passer par update().
    get: () => state,
    // Fusion superficielle : les champs imbriqués (adjustments, effects) doivent être
    // re-spreadés en entier par l'appelant.
    update(patch: Partial<AppState>) {
      state = { ...state, ...patch };
      listeners.forEach((fn) => fn(state));
    },
    subscribe(fn: (s: AppState) => void) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}

export type Store = ReturnType<typeof createStore>;
