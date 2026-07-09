import { bakeAdjustments } from '../adjustments';
import { composeBlur, composeEffects } from '../effects/effects';
import type { Store } from '../state';

const PREVIEW_MAX = 480; // côté max de l'aperçu (basse résolution pour la fluidité)

export function previewSize(store: Store): { w: number; h: number } {
  const { outW, outH } = store.get();
  const s = Math.min(1, PREVIEW_MAX / Math.max(outW, outH));
  return { w: Math.round(outW * s), h: Math.round(outH * s) };
}

export function initCanvasView(store: Store) {
  const canvas = document.querySelector<HTMLCanvasElement>('#view')!;
  const hint = document.querySelector<HTMLElement>('#canvas-hint')!;
  const ctx = canvas.getContext('2d')!;
  let baked: HTMLCanvasElement | null = null;
  let bakeToken = 0;
  let overlay: (() => void) | null = null; // hook post-dessin (éditeur Ken Burns, Task 12)

  async function rebake() {
    const { sourceImage, bgRemovedBlob, adjustments } = store.get();
    if (!sourceImage) return;
    const token = ++bakeToken;
    const result = await bakeAdjustments(sourceImage, bgRemovedBlob, adjustments);
    if (token !== bakeToken) return; // une retouche plus récente est en cours
    baked = result;
    drawFrame(0);
  }

  // Dessine la frame à t donné (utilisé par l'aperçu statique et le lecteur).
  function drawFrame(t: number, showOverlay = true) {
    if (!baked) return;
    const { w, h } = previewSize(store);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    const view = { imageW: baked.width, imageH: baked.height, outW: w, outH: h };
    const effects = store.get().effects;
    const m = composeEffects(effects, t, view);
    const scale = w / store.get().outW; // même facteur que previewSize
    const blurPx = composeBlur(effects, t) * scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.filter = 'none'; // le fond n'est jamais flouté
    ctx.fillStyle = store.get().adjustments.backgroundColor;
    ctx.fillRect(0, 0, w, h);
    ctx.filter = blurPx > 0 ? `blur(${blurPx}px)` : 'none';
    ctx.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    ctx.drawImage(baked, 0, 0);
    ctx.filter = 'none'; // neutre avant l'overlay (l'éditeur Ken Burns ne doit pas être flouté)
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (t === 0 && showOverlay) overlay?.(); // jamais d'overlay d'édition pendant la lecture
  }

  let lastSource: HTMLImageElement | null = null;
  let lastBlob: Blob | null = null;
  let lastAdj: unknown = null;
  store.subscribe(() => {
    const { sourceImage, bgRemovedBlob, adjustments } = store.get();
    const hasImage = sourceImage !== null;
    hint.hidden = hasImage;
    canvas.hidden = !hasImage;
    document.querySelector<HTMLElement>('#adjustments')!.hidden = !hasImage;
    document.querySelector<HTMLElement>('#anim-controls')!.hidden = !hasImage;
    if (sourceImage === lastSource && bgRemovedBlob === lastBlob && adjustments === lastAdj) {
      drawFrame(0); // seuls les effets/réglages d'animation ont changé : simple redraw
      return;
    }
    lastSource = sourceImage;
    lastBlob = bgRemovedBlob;
    lastAdj = adjustments;
    rebake();
  });

  return {
    drawFrame,
    getBaked: () => baked,
    setOverlay: (fn: (() => void) | null) => { overlay = fn; },
  };
}

export type CanvasView = ReturnType<typeof initCanvasView>;
