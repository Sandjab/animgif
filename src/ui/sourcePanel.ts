import type { Store } from '../state';

function loadFile(file: File, store: Store, onError: (msg: string) => void) {
  if (!file.type.startsWith('image/')) {
    onError(`« ${file.name} » n'est pas une image.`);
    return;
  }
  const img = new Image();
  img.onload = () => {
    URL.revokeObjectURL(img.src);
    store.update({ sourceImage: img, bgRemovedBlob: null });
  };
  img.onerror = () => onError('Impossible de décoder cette image.');
  img.src = URL.createObjectURL(file);
}

export function initSourcePanel(store: Store) {
  const dropzone = document.querySelector<HTMLElement>('#dropzone')!;
  const input = document.querySelector<HTMLInputElement>('#file-input')!;
  const status = document.querySelector<HTMLElement>('#bg-status')!;
  const onError = (msg: string) => { status.textContent = msg; };

  document.querySelector('#btn-pick')!.addEventListener('click', () => input.click());
  input.addEventListener('change', () => { if (input.files?.[0]) loadFile(input.files[0], store, onError); });

  // Drag & drop sur toute la fenêtre
  window.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  window.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    const file = e.dataTransfer?.files[0];
    if (file) loadFile(file, store, onError);
  });

  // Sliders de retouche
  const bind = (id: string, key: 'brightness' | 'contrast' | 'saturation') => {
    document.querySelector<HTMLInputElement>(id)!.addEventListener('input', (e) => {
      const v = Number((e.target as HTMLInputElement).value);
      store.update({ adjustments: { ...store.get().adjustments, [key]: v } });
    });
  };
  bind('#adj-brightness', 'brightness');
  bind('#adj-contrast', 'contrast');
  bind('#adj-saturation', 'saturation');

  document.querySelector('#btn-flip-h')!.addEventListener('click', () => {
    const a = store.get().adjustments;
    store.update({ adjustments: { ...a, flipH: !a.flipH } });
  });
  document.querySelector('#btn-flip-v')!.addEventListener('click', () => {
    const a = store.get().adjustments;
    store.update({ adjustments: { ...a, flipV: !a.flipV } });
  });
  document.querySelector('#btn-rot90')!.addEventListener('click', () => {
    const a = store.get().adjustments;
    store.update({ adjustments: { ...a, rotate90: ((a.rotate90 + 1) % 4) as 0 | 1 | 2 | 3 } });
  });
  document.querySelector<HTMLInputElement>('#adj-bg')!.addEventListener('input', (e) => {
    store.update({ adjustments: { ...store.get().adjustments, backgroundColor: (e.target as HTMLInputElement).value } });
  });
}
