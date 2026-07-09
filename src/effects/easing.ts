import type { Easing } from '../types';

// t ∈ [0,1] → progression éased. 'bounce' = easeOutBack (léger dépassement puis retour).
export function applyEasing(easing: Easing, t: number): number {
  switch (easing) {
    case 'linear':
      return t;
    case 'easeInOut':
      return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
    case 'bounce': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
    }
    case 'easeIn':
      return t * t;
    case 'easeOut':
      return t * (2 - t);
    case 'elastic': {
      // easeOutElastic : oscillation amortie qui dépasse 1 puis se stabilise.
      if (t === 0) return 0;
      if (t === 1) return 1;
      const c4 = (2 * Math.PI) / 3;
      return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    }
  }
}
