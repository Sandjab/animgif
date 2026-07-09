import { BufferTarget, CanvasSource, Mp4OutputFormat, Output, canEncode } from 'mediabunny';

// Le navigateur peut-il encoder du H.264 (AVC) ? Appelé paresseusement, à la première
// sélection du format MP4 (mediabunny n'est chargé qu'à ce moment).
export function isMp4Supported(): Promise<boolean> {
  return canEncode('avc');
}

export interface Mp4Options {
  width: number;   // pair (voir evenDim)
  height: number;  // pair
  fps: number;     // 1000 / delayMs
  bitrate: number; // bits/s (voir qualityToBitrate)
  onProgress: (done: number, total: number) => void;
  isCancelled: () => boolean;
}

// Encode les frames (déjà dans l'ordre final voulu) en MP4/H.264 sur le thread
// principal : WebCodecs est asynchrone/non bloquant et mediabunny gère la backpressure
// via `await source.add(...)`. Retourne le Blob video/mp4, ou null si annulé.
export async function encodeMp4(frames: ImageData[], opts: Mp4Options): Promise<Blob | null> {
  const { width, height, fps, bitrate, onProgress, isCancelled } = opts;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Note : l'export mediabunny installé (^1.50.7) nomme cette classe `BufferTarget`
  // (pas `ArrayBufferTarget`) ; son `.buffer` est typé `ArrayBuffer | null`.
  const target = new BufferTarget();
  const output = new Output({ target, format: new Mp4OutputFormat() });
  const source = new CanvasSource(canvas, { codec: 'avc', bitrate });
  output.addVideoTrack(source);
  await output.start();

  const frameDur = 1 / fps; // secondes
  for (let i = 0; i < frames.length; i++) {
    if (isCancelled()) {
      await output.cancel();
      return null;
    }
    ctx.putImageData(frames[i], 0, 0);
    await source.add(i * frameDur, frameDur);
    onProgress(i + 1, frames.length);
  }
  if (isCancelled()) {
    await output.cancel();
    return null;
  }
  await output.finalize();
  // `target.buffer` n'est `null` qu'avant finalisation ; `finalize()` a résolu ci-dessus.
  return new Blob([target.buffer!], { type: 'video/mp4' });
}
