import { pingPongOrder, sampleTimes } from './effects/timeline';
import type { Store } from './state';

export function initPreview(store: Store, drawFrame: (t: number, showOverlay?: boolean) => void) {
  const btn = document.querySelector<HTMLButtonElement>('#btn-play')!;
  const delaySlider = document.querySelector<HTMLInputElement>('#anim-delay')!;
  const delayLabel = document.querySelector<HTMLElement>('#delay-label')!;
  const loopMode = document.querySelector<HTMLSelectElement>('#loop-mode')!;
  const loopCount = document.querySelector<HTMLInputElement>('#loop-count')!;
  let timer: number | null = null;
  let frameIdx = 0;

  function frameSequence(): number[] {
    const { steps } = store.get();
    const order = Array.from({ length: steps }, (_, i) => i);
    return store.get().loopMode === 'pingpong' ? pingPongOrder(steps) : order;
  }

  function tick() {
    const seq = frameSequence();
    const times = sampleTimes(store.get().steps);
    drawFrame(times[seq[frameIdx % seq.length]], false);
    frameIdx++;
    timer = window.setTimeout(tick, store.get().delayMs);
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
