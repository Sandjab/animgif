// Suppression du fond, chargée à la demande (import dynamique) pour ne pas
// alourdir le chargement initial. Assets auto-hébergés dans public/bg-removal/.
export async function removeBg(
  image: Blob | string,
  onProgress: (ratio: number) => void,
): Promise<Blob> {
  const { removeBackground } = await import('@imgly/background-removal');
  return removeBackground(image, {
    publicPath: new URL(`${import.meta.env.BASE_URL}bg-removal/`, location.href).toString(),
    device: 'gpu', // onnxruntime retombe sur CPU/WASM si WebGPU absent
    model: 'isnet_quint8', // SEUL modèle auto-hébergé (public/bg-removal/) : en changer exige d'ajouter ses assets
    progress: (_key, current, total) => onProgress(total ? current / total : 0),
  });
}
