import { frameOrder, sampleTimes } from './effects/timeline';
import type { Store } from './state';

export function initPreview(store: Store, drawFrame: (t: number, showOverlay?: boolean) => void) {
  const btn = document.querySelector<HTMLButtonElement>('#btn-play')!;
  const delaySlider = document.querySelector<HTMLInputElement>('#anim-delay')!;
  const delayLabel = document.querySelector<HTMLElement>('#delay-label')!;
  const loopMode = document.querySelector<HTMLSelectElement>('#loop-mode')!;
  const loopCount = document.querySelector<HTMLInputElement>('#loop-count')!;
  let timer: number | null = null;
  let frameIdx = 0;

  function tick() {
    const s = store.get();
    const seq = frameOrder(s.steps, s.reverse, s.loopMode === 'pingpong');
    // Mode « n fois » : la lecture s'arrête d'elle-même après loopCount passages complets.
    if (s.loopMode === 'count' && frameIdx >= seq.length * s.loopCount) {
      stop();
      return;
    }
    const times = sampleTimes(s.steps);
    drawFrame(times[seq[frameIdx % seq.length]], false);
    frameIdx++;
    timer = window.setTimeout(tick, s.delayMs);
  }

  function stop() {
    if (timer !== null) { clearTimeout(timer); timer = null; }
    btn.textContent = '▶ Lecture';
  }

  btn.addEventListener('click', () => {
    if (timer !== null) { stop(); return; }
    frameIdx = 0;
    btn.textContent = '⏸ Pause';
    tick();
  });

  delaySlider.addEventListener('input', () => {
    const d = Number(delaySlider.value);
    store.update({ delayMs: d });
    delayLabel.textContent = `${d} ms (${(1000 / d).toFixed(1)} FPS)`;
  });

  loopMode.addEventListener('change', () => {
    store.update({ loopMode: loopMode.value as 'infinite' | 'count' | 'pingpong' });
    loopCount.hidden = loopMode.value !== 'count';
  });
  loopCount.addEventListener('input', () => {
    store.update({ loopCount: Math.max(1, Number(loopCount.value) || 1) });
  });
}
