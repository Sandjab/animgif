import type { Effect, Rect } from '../types';
import { applyEasing } from './easing';
import { multiply, rotationDeg, translation, type Mat } from './matrix';

export interface View { imageW: number; imageH: number; outW: number; outH: number }

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const lerpRect = (a: Rect, b: Rect, t: number): Rect => ({
  x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t),
});

// Cadrage « contain » : image entière dans la sortie, centrée.
export function fitMatrix(view: View): Mat {
  const s = Math.min(view.outW / view.imageW, view.outH / view.imageH);
  const e = (view.outW - view.imageW * s) / 2;
  const f = (view.outH - view.imageH * s) / 2;
  return { a: s, b: 0, c: 0, d: s, e, f };
}

// Mappe un rect (coordonnées image) sur le viewport de sortie.
function rectToViewport(r: Rect, view: View): Mat {
  const sx = view.outW / r.w, sy = view.outH / r.h;
  return { a: sx, b: 0, c: 0, d: sy, e: -r.x * sx, f: -r.y * sy };
}

export function effectMatrix(effect: Effect, t: number, view: View): Mat {
  switch (effect.kind) {
    case 'kenBurns':
      return rectToViewport(lerpRect(effect.from, effect.to, applyEasing(effect.easing, t)), view);
    case 'rotation': {
      const deg = lerp(effect.fromDeg, effect.toDeg, applyEasing(effect.easing, t));
      return rotationDeg(deg, view.outW / 2, view.outH / 2);
    }
    case 'translation': {
      const p = applyEasing(effect.easing, t);
      return translation(effect.dx * p, effect.dy * p);
    }
    case 'bounce': {
      // Oscillation verticale : part du sol, monte (y négatif), retombe — |sin| par oscillation.
      const y = -effect.amplitude * Math.abs(Math.sin(Math.PI * effect.oscillations * t));
      return translation(0, y);
    }
  }
}

// Matrice complète d'une frame : base (fit ou kenBurns) puis autres effets par-dessus.
export function composeEffects(effects: Effect[], t: number, view: View): Mat {
  const kb = effects.find((e) => e.kind === 'kenBurns');
  let m = kb ? effectMatrix(kb, t, view) : fitMatrix(view);
  for (const e of effects) {
    if (e.kind === 'kenBurns') continue;
    m = multiply(effectMatrix(e, t, view), m);
  }
  return m;
}
