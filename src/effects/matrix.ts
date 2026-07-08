export interface Mat { a: number; b: number; c: number; d: number; e: number; f: number }

// identity complète l'API d'algèbre (utilisé par les tests) ; scaling sert à spin3d.
export const identity = (): Mat => ({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });

export const translation = (tx: number, ty: number): Mat => ({ a: 1, b: 0, c: 0, d: 1, e: tx, f: ty });

// Échelle autour du centre (cx, cy).
export const scaling = (sx: number, sy: number, cx: number, cy: number): Mat => ({
  a: sx, b: 0, c: 0, d: sy, e: cx - sx * cx, f: cy - sy * cy,
});

// Rotation horaire (repère canvas, y vers le bas) de deg degrés autour de (cx, cy).
export function rotationDeg(deg: number, cx: number, cy: number): Mat {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r), sin = Math.sin(r);
  return {
    a: cos, b: sin, c: -sin, d: cos,
    e: cx - cos * cx + sin * cy,
    f: cy - sin * cx - cos * cy,
  };
}

// multiply(A, B) = A ∘ B : B est appliquée d'abord.
export const multiply = (m: Mat, n: Mat): Mat => ({
  a: m.a * n.a + m.c * n.b,
  b: m.b * n.a + m.d * n.b,
  c: m.a * n.c + m.c * n.d,
  d: m.b * n.c + m.d * n.d,
  e: m.a * n.e + m.c * n.f + m.e,
  f: m.b * n.e + m.d * n.f + m.f,
});

export const apply = (m: Mat, p: { x: number; y: number }) => ({
  x: m.a * p.x + m.c * p.y + m.e,
  y: m.b * p.x + m.d * p.y + m.f,
});
