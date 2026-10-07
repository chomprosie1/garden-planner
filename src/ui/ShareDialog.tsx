// Share the plan: a picture of the chosen week, framed for a story or a post,
// and a timelapse of the year ahead. Both are made on this device.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Step } from '../lifecycle/projection';
import { addDays } from '../lifecycle/shed';
import type { Garden, Plant } from '../model/types';
import { drawPoster, fileSafe, FRAMES, monthTitle, posterFile, type Frame } from '../share/poster';
import { canRecord, record } from '../share/timelapse';
import type { LookId, Mode } from '../theme/looks';
import { useApp } from './appContext';
import { yearScene } from './yearScene';

interface Props {
  garden: Garden;
  plantOf: (id: string) => Plant;
  ideaOf: (id: string) => Plant | null;
  timelines: Map<string, Step[]>;
  date: string;
  look: LookId;
  mode: Mode;
  close: () => void;
}

/** Weeks in the timelapse: a year from the week shown. */
const YEAR = 52;

function download(file: File) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** The phone's own share sheet, where it can take files. */
const canShareFiles = (type: string) => {
  try {
    return !!navigator.canShare?.({ files: [new File([''], type === 'image/png' ? 'x.png' : 'x.mp4', { type })] });
  } catch {
    return false;
  }
};

export function ShareDialog({ garden, plantOf, ideaOf, timelines, date, look, mode, close }: Props) {
  const app = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  const preview = useRef<HTMLCanvasElement>(null);
  const [frame, setFrame] = useState<Frame>('post');
  const [video, setVideo] = useState<File | null>(null);
  const [recorded, setRecorded] = useState<number | null>(null);
  const cancelled = useRef(false);
  const name = fileSafe(`${garden.name} ${monthTitle(date)}`);
  const poster = (canvas: HTMLCanvasElement, d: string) => drawPoster(canvas, { garden, plantOf, look, mode, time: yearScene(garden, plantOf, timelines, d, ideaOf).time, date: d, frame });

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    return () => {
      cancelled.current = true;
    };
  }, []);
  useEffect(() => {
    if (preview.current) poster(preview.current, date);
    setVideo(null);
  }, [frame, date, look, mode, garden]);
  const videoUrl = useMemo(() => (video ? URL.createObjectURL(video) : null), [video]);
  useEffect(() => () => void (videoUrl && URL.revokeObjectURL(videoUrl)), [videoUrl]);

  const share = async (file: File) => {
    try {
      await navigator.share({ files: [file], title: garden.name });
    } catch (e) {
      // Closing the share sheet isn't a problem; anything else, offer the file instead.
      if ((e as Error).name !== 'AbortError') download(file);
    }
  };
  const picture = async (how: 'save' | 'share') => {
    if (!preview.current) return;
    const file = await posterFile(preview.current, name);
    if (how === 'share') await share(file);
    else download(file);
  };
  const makeVideo = async () => {
    cancelled.current = false;
    setRecorded(0);
    try {
      // Recorded on a canvas of its own, so the preview stays on the week you chose.
      const canvas = document.createElement('canvas');
      const file = await record(canvas, YEAR + 1, (i) => poster(canvas, addDays(date, i * 7)), { fps: 8, name: `${name}-year`, progress: setRecorded, cancelled: () => cancelled.current });
      if (file) setVideo(file);
    } catch (e) {
      app.notify((e as Error).message || 'The timelapse could not be made.');
    } finally {
      setRecorded(null);
    }
  };

  const f = FRAMES[frame];
  return (
    <dialog ref={ref} class="dialog share-dialog" aria-labelledby="share-title" onClose={close}>
      <div class="dialog-body">
        <div class="dialog-head">
          <h2 id="share-title" class="title">
            Share your plan
          </h2>
        </div>
        <p class="muted small">
          {garden.name} in {monthTitle(date)}, in your look. It’s made on this device; nothing is uploaded.
        </p>
        <div class="choice-row choice-small" role="radiogroup" aria-label="Shape">
          {(Object.keys(FRAMES) as Frame[]).reverse().map((k) => (
            <label key={k} class="choice-option">
              <input type="radio" name="share-frame" checked={frame === k} onChange={() => setFrame(k)} />
              <span>{FRAMES[k].label}</span>
            </label>
          ))}
        </div>
        <div class="share-preview">
          {/* The picture stays drawn under the video, for coming back to it. */}
          <canvas ref={preview} hidden={!!videoUrl} role="img" aria-label={`A picture of ${garden.name} in ${monthTitle(date)}`} style={{ aspectRatio: `${f.w} / ${f.h}` }} />
          {videoUrl && <video src={videoUrl} controls autoPlay loop muted playsInline aria-label="The timelapse" style={{ aspectRatio: `${f.w} / ${f.h}` }} />}
        </div>
        {video ? (
          <div class="button-row">
            {canShareFiles(video.type) && (
              <button type="button" class="btn btn-primary" onClick={() => share(video)}>
                Share the timelapse…
              </button>
            )}
            <button type="button" class={`btn ${canShareFiles(video.type) ? '' : 'btn-primary'}`} onClick={() => download(video)}>
              Save the video
            </button>
            <button type="button" class="btn" onClick={() => setVideo(null)}>
              Back to the picture
            </button>
          </div>
        ) : (
          <div class="button-row">
            {canShareFiles('image/png') && (
              <button type="button" class="btn btn-primary" onClick={() => picture('share')}>
                Share…
              </button>
            )}
            <button type="button" class={`btn ${canShareFiles('image/png') ? '' : 'btn-primary'}`} onClick={() => picture('save')}>
              Save the picture
            </button>
            {canRecord() &&
              (recorded === null ? (
                <button type="button" class="btn" onClick={makeVideo}>
                  Make a timelapse
                </button>
              ) : (
                <span class="share-progress" role="status">
                  Recording the year… {recorded} of {YEAR + 1} weeks
                  <button
                    type="button"
                    class="link-btn"
                    onClick={() => {
                      cancelled.current = true;
                    }}
                  >
                    Stop
                  </button>
                </span>
              ))}
          </div>
        )}
        <div class="button-row">
          <button type="button" class="btn btn-quiet" onClick={() => ref.current?.close()}>
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
