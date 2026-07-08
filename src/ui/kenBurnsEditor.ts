import { fitMatrix, type View } from '../effects/effects';
import { apply, type Mat } from '../effects/matrix';
import type { Store } from '../state';
import type { Effect, Rect } from '../types';
import type { CanvasView } from './canvasView';

const HANDLE = 8; // taille des poignées en px écran

function invert(m: Mat): Mat {
  const det = m.a * m.d - m.b * m.c;
  return {
    a: m.d / det, b: -m.b / det, c: -m.c / det, d: m.a / det,
    e: (m.c * m.f - m.d * m.e) / det,
    f: (m.b * m.e - m.a * m.f) / det,
  };
}

type Drag =
  | { rect: 'from' | 'to'; mode: 'move'; startX: number; startY: number; orig: Rect }
  | { rect: 'from' | 'to'; mode: 'resize'; corner: 0 | 1 | 2 | 3; orig: Rect };

export function initKenBurnsEditor(store: Store, canvasView: CanvasView) {
  const canvas = document.querySelector<HTMLCanvasElement>('#view')!;
  const ctx = canvas.getContext('2d')!;
  let drag: Drag | null = null;

  const getKb = () => store.get().effects.find((e) => e.kind === 'kenBurns') as
    | Extract<Effect, { kind: 'kenBurns' }>
    | undefined;

  function viewInfo(): View | null {
    const baked = canvasView.getBaked();
    if (!baked) return null;
    return { imageW: baked.width, imageH: baked.height, outW: canvas.width, outH: canvas.height };
  }

  // Matrice image→écran de l'aperçu statique (cadrage contain).
  const screenMat = () => fitMatrix(viewInfo()!);

  function corners(r: Rect): { x: number; y: number }[] {
    return [
      { x: r.x, y: r.y }, { x: r.x + r.w, y: r.y },
      { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h },
    ];
  }

  function drawOverlay() {
    const kb = getKb();
    const baked = canvasView.getBaked();
    if (!kb || !baked) return;
    // Repeint l'aperçu en cadrage « contain » complet : l'édition se fait sur l'image entière.
    const m = screenMat();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = store.get().adjustments.backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    ctx.drawImage(baked, 0, 0);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    for (const [rect, color] of [[kb.from, '#3fbf3f'], [kb.to, '#e05252']] as const) {
      const pts = corners(rect).map((p) => apply(m, p));
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = color;
      pts.forEach((p) => ctx.fillRect(p.x - HANDLE / 2, p.y - HANDLE / 2, HANDLE, HANDLE));
    }
  }

  function toImageCoords(ev: PointerEvent): { x: number; y: number } {
    const bounds = canvas.getBoundingClientRect();
    const sx = canvas.width / bounds.width, sy = canvas.height / bounds.height;
    const screen = { x: (ev.clientX - bounds.left) * sx, y: (ev.clientY - bounds.top) * sy };
    return apply(invert(screenMat()), screen);
  }

  function hitTest(p: { x: number; y: number }): Drag | null {
    const kb = getKb();
    if (!kb) return null;
    const m = screenMat();
    const sp = apply(m, p);
    const tol = HANDLE; // tolérance en px écran
    const rects = [['to', kb.to], ['from', kb.from]] as const;
    // Toutes les poignées d'abord : un rect englobant ne doit pas masquer les coins de l'autre.
    for (const [name, rect] of rects) {
      const cs = corners(rect).map((c) => apply(m, c));
      for (let i = 0; i < 4; i++) {
        if (Math.abs(cs[i].x - sp.x) < tol && Math.abs(cs[i].y - sp.y) < tol) {
          return { rect: name, mode: 'resize', corner: i as 0 | 1 | 2 | 3, orig: { ...rect } };
        }
      }
    }
    for (const [name, rect] of rects) {
      if (p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h) {
        return { rect: name, mode: 'move', startX: p.x, startY: p.y, orig: { ...rect } };
      }
    }
    return null;
  }

  function patchKb(rect: 'from' | 'to', value: Rect) {
    const effects = store.get().effects.map((e) => (e.kind === 'kenBurns' ? { ...e, [rect]: value } : e));
    store.update({ effects });
  }

  canvas.addEventListener('pointerdown', (ev) => {
    const p = toImageCoords(ev);
    drag = hitTest(p);
    if (drag) { try { canvas.setPointerCapture(ev.pointerId); } catch { /* pointeur déjà relâché */ } }
  });

  canvas.addEventListener('pointermove', (ev) => {
    if (!drag) return;
    const p = toImageCoords(ev);
    const { orig } = drag;
    if (drag.mode === 'move') {
      patchKb(drag.rect, { ...orig, x: orig.x + (p.x - drag.startX), y: orig.y + (p.y - drag.startY) });
    } else {
      // Redimensionnement par coin, ratio de sortie conservé, coin opposé fixe.
      // La taille suit l'axe dominant du geste (x ou y) pour rester naturelle.
      const { outW, outH } = store.get();
      const ratio = outW / outH;
      const anchor = corners(orig)[(drag.corner + 2) % 4];
      const w = Math.max(16, Math.abs(p.x - anchor.x), Math.abs(p.y - anchor.y) * ratio);
      const h = w / ratio;
      patchKb(drag.rect, {
        x: p.x < anchor.x ? anchor.x - w : anchor.x,
        y: p.y < anchor.y ? anchor.y - h : anchor.y,
        w, h,
      });
    }
  });

  const endDrag = () => { drag = null; };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);

  canvasView.setOverlay(drawOverlay);
}
