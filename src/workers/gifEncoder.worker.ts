import encode from 'gifski-wasm';

self.onmessage = async (e: MessageEvent) => {
  const { frames, width, height, frameDurations, quality, repeat } = e.data as {
    frames: Uint8Array[]; width: number; height: number;
    frameDurations: number[]; quality: number; repeat: number;
  };
  try {
    const gif = await encode({ frames, width, height, frameDurations, quality, repeat });
    (self as unknown as Worker).postMessage({ ok: true, gif }, [gif.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ ok: false, error: String(err) });
  }
};
