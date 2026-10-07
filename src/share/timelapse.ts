// A timelapse of the year: the share picture drawn week by week and recorded
// as a short video with the browser's own recorder. Made on the device;
// nothing is uploaded.

/** Video types to try, best first: MP4 plays everywhere; WebM is what most browsers record. */
const TYPES = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];

/** Whether this browser can record a canvas. */
export function canRecord(): boolean {
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype && TYPES.some((t) => MediaRecorder.isTypeSupported(t));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type FrameTrack = MediaStreamTrack & { requestFrame?: () => void };

/**
 * Records `frames` drawings of the canvas as a video, `fps` a second, holding the last a moment. `draw(i)` draws
 * frame i. `progress` is told how far it's got. Resolves with the video file.
 */
export async function record(canvas: HTMLCanvasElement, frames: number, draw: (i: number) => void, opts: { fps?: number; name: string; progress?: (done: number) => void; cancelled?: () => boolean }): Promise<File | null> {
  const fps = opts.fps ?? 8;
  const type = TYPES.find((t) => MediaRecorder.isTypeSupported(t));
  if (!type) throw new Error('This browser can’t record video.');
  draw(0);
  // Frames on demand where the browser allows it, so each week is one frame however long it takes to draw.
  let stream = canvas.captureStream(0);
  let track = stream.getVideoTracks()[0] as FrameTrack | undefined;
  if (!track?.requestFrame) {
    track?.stop();
    stream = canvas.captureStream(fps);
    track = stream.getVideoTracks()[0] as FrameTrack | undefined;
  }
  const rec = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 5_000_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => {
    if (e.data.size) chunks.push(e.data);
  };
  const stopped = new Promise<void>((r) => (rec.onstop = () => r()));
  rec.start();
  for (let i = 0; i < frames; i++) {
    if (opts.cancelled?.()) break;
    const started = performance.now();
    draw(i);
    track?.requestFrame?.();
    opts.progress?.(i + 1);
    await sleep(Math.max(0, 1000 / fps - (performance.now() - started)));
  }
  // Hold the last week for a moment.
  for (let k = 0; k < fps; k++) {
    track?.requestFrame?.();
    await sleep(1000 / fps);
  }
  rec.stop();
  await stopped;
  track?.stop();
  if (opts.cancelled?.()) return null;
  const base = type.split(';')[0]!;
  return new File(chunks, `${opts.name}.${base === 'video/mp4' ? 'mp4' : 'webm'}`, { type: base });
}
