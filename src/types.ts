export interface Rect { x: number; y: number; w: number; h: number }

export type Easing = 'linear' | 'easeInOut' | 'bounce' | 'easeIn' | 'easeOut' | 'elastic';

export type Effect =
  | { kind: 'kenBurns'; from: Rect; to: Rect; easing: Easing }
  | { kind: 'rotation'; fromDeg: number; toDeg: number; easing: Easing }
  | { kind: 'translation'; dx: number; dy: number; easing: Easing }
  | { kind: 'bounce'; amplitude: number; oscillations: number }
  | { kind: 'spin3d'; axis: 'x' | 'y'; turns: number; easing: Easing };

export interface Adjustments {
  brightness: number;   // 1 = neutre
  contrast: number;     // 1 = neutre
  saturation: number;   // 1 = neutre
  sepia: number;        // 0 = neutre, 0–1
  grayscale: number;    // 0 = neutre, 0–1
  hueRotate: number;    // degrés, 0 = neutre
  blur: number;         // px, 0 = neutre
  invert: boolean;
  flipH: boolean;
  flipV: boolean;
  rotate90: 0 | 1 | 2 | 3; // quarts de tour horaires
  backgroundColor: string; // couleur CSS, ex. '#ffffff'
}

export type LoopMode = 'infinite' | 'count' | 'pingpong';
