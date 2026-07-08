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

  const btnRemoveBg = document.querySelector<HTMLButtonElement>('#btn-remove-bg')!;
  const progress = document.querySelector<HTMLProgressElement>('#bg-progress')!;
  btnRemoveBg.addEventListener('click', async () => {
    const img = store.get().sourceImage;
    if (!img) return;
    btnRemoveBg.disabled = true;
    progress.hidden = false;
    progress.value = 0;
    status.textContent = 'Téléchargement du modèle…';
    try {
      const { removeBg } = await import('../bgRemoval');
      // L'objectURL de l'image est révoqué après chargement : on repasse par un canvas.
      const source = await new Promise<Blob>((resolve, reject) => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d')!.drawImage(img, 0, 0);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob a échoué'))), 'image/png');
      });
      status.textContent = 'Suppression du fond…';
      const result = await removeBg(source, (r) => { progress.value = r; });
      if (store.get().sourceImage === img) { // l'image peut avoir changé pendant le traitement
        store.update({ bgRemovedBlob: result });
        status.textContent = 'Fond supprimé.';
      }
    } catch (err) {
      status.textContent = `Échec de la suppression du fond (réseau ?) : ${err instanceof Error ? err.message : err}`;
    } finally {
      btnRemoveBg.disabled = false;
      progress.hidden = true;
    }
  });
}
