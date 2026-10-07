// "Your season, wrapped": the year's cards to flip through and share, and the
// card on Today that opens them, with what you've picked this year.

import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { todayIso } from '../model/ids';
import type { Garden, Plant } from '../model/types';
import { formatWeight, picksIn } from '../planting/harvest';
import { fileSafe, posterFile } from '../share/poster';
import { drawWrappedCard, seasonStats, seasonYear, wrappedCards } from '../share/wrapped';
import { photoUrl } from '../storage/photos';
import { useApp } from './appContext';
import { PlantIcon } from './PlantIcon';
import { canShareFiles, download } from './ShareDialog';

export function WrappedDialog({ garden, plantOf, known, close }: { garden: Garden; plantOf: (id: string) => Plant; known: (id: string) => boolean; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const year = seasonYear(todayIso());
  const cards = useMemo(() => wrappedCards(seasonStats(garden, year, known), garden.name, (id) => plantOf(id).commonName), [garden, year]);
  const [i, setI] = useState(0);
  const card = cards[i];

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  useEffect(() => {
    const c = canvas.current;
    if (!c || !card) return;
    if (!card.photo) return drawWrappedCard(c, card, i, cards.length);
    let live = true;
    photoUrl(card.photo).then((url) => {
      if (!live) return;
      if (!url) return drawWrappedCard(c, { ...card, big: '', line: card.line }, i, cards.length);
      const img = new Image();
      img.onload = () => live && drawWrappedCard(c, card, i, cards.length, img);
      img.src = url;
    });
    return () => {
      live = false;
    };
  }, [i, card]);

  const share = async () => {
    if (!canvas.current) return;
    const file = await posterFile(canvas.current, fileSafe(`${garden.name} ${year} ${i + 1}`));
    if (canShareFiles('image/png')) {
      try {
        await navigator.share({ files: [file], title: `${garden.name}, ${year}` });
      } catch (e) {
        if ((e as Error).name !== 'AbortError') download(file);
      }
    } else download(file);
  };

  return (
    <dialog ref={ref} class="dialog wrapped-dialog" aria-labelledby="wrapped-title" onClose={close}>
      <div class="dialog-body">
        <h2 id="wrapped-title" class="title">
          Your {year} season
        </h2>
        {!card ? (
          <p class="muted">Nothing to look back on yet: mark what you sow, plant and pick, and your year comes together here.</p>
        ) : (
          <>
            <canvas ref={canvas} class="wrapped-card" width={1080} height={1920} role="img" aria-label={`${card.eyebrow}: ${card.big} ${card.line}`} />
            <div class="button-row wrapped-nav">
              <button type="button" class="btn" disabled={i === 0} onClick={() => setI(i - 1)}>
                Back
              </button>
              <span class="muted small">
                {i + 1} of {cards.length}
              </span>
              <button type="button" class="btn" disabled={i === cards.length - 1} onClick={() => setI(i + 1)}>
                Next
              </button>
            </div>
          </>
        )}
        <div class="button-row">
          {card && (
            <button type="button" class="btn btn-primary" onClick={share}>
              {canShareFiles('image/png') ? 'Share this card' : 'Save this card'}
            </button>
          )}
          <button type="button" class="btn" onClick={() => ref.current?.close()}>
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}

/** Today: what you've picked this year, and the season wrapped from September on. */
export function SeasonCard({ garden, plantOf }: { garden: Garden; plantOf: (id: string) => Plant }) {
  const app = useApp();
  const today = todayIso();
  const year = Number(today.slice(0, 4));
  const picked = useMemo(() => picksIn(garden, year), [garden, year]);
  const month = Number(today.slice(5, 7));
  const wrapTime = month >= 9 || month === 1;
  const grown = useMemo(() => (wrapTime ? seasonStats(garden, seasonYear(today)).plantings : 0), [garden, wrapTime, today]);
  if (!picked.length && !grown) return null;
  const total = picked.reduce((a, t) => a + t.grams, 0);
  return (
    <section class="card season-card" aria-labelledby="season-title">
      <div class="card-head">
        <h2 id="season-title">{picked.length ? `Picked this year: ${formatWeight(total)}` : `Your ${seasonYear(today)} season`}</h2>
      </div>
      {picked.length > 0 && (
        <ul class="plain-list season-top">
          {picked.slice(0, 3).map((t) => (
            <li key={t.plantId}>
              <PlantIcon plant={plantOf(t.plantId)} size={24} stage="harvesting" />
              <span>{plantOf(t.plantId).commonName}</span>
              <span class="muted">{formatWeight(t.grams)}</span>
            </li>
          ))}
        </ul>
      )}
      {wrapTime && grown > 0 && (
        <button type="button" class="btn btn-primary" onClick={() => app.openWrapped()}>
          Your season, wrapped
        </button>
      )}
    </section>
  );
}
