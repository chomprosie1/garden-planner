// The welcome, on the first launch of a month or for something new: the month's
// photo, the garden's name and a line to read, then two ways in straight away:
// Today, and the garden or what's new. The plants load meanwhile. The version is
// at the foot.

import { useEffect, useRef, useState } from 'preact/hooks';
import { pickQuote } from '../content/quotes';
import { seasonFor } from '../content/seasons';
import { versionText } from '../content/version';
import { latestNews, unseenNews } from '../content/whatsNew';
import { loadLibrary } from '../library/library';
import { todayIso } from '../model/ids';
import type { Prefs, PrefsStore, View } from '../theme/prefs';
import { SeasonPhoto } from './SeasonPhoto';

interface Props {
  gardenName: string;
  prefs: Prefs;
  prefsStore: PrefsStore;
  /** Where to go next. */
  done: (v: View) => void;
}

export function Welcome({ gardenName, prefs, prefsStore, done }: Props) {
  const month = new Date().getMonth() + 1;
  const [quote] = useState(() => pickQuote(month, prefs.lastQuote));
  // The photo as on Today: the month's, or the one pinned in Settings; none if photos are off.
  const photoMonth = prefs.photoMonth === 'auto' ? month : prefs.photoMonth;
  const photo = prefs.photos !== 'off';
  const choices = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // News is said here once, whichever way you go in.
    prefsStore.set({ lastQuote: quote.text, welcomedOn: todayIso(), welcomedNews: latestNews().id });
    // The plants load while you read, so the garden's ready when you go in.
    void loadLibrary().catch(() => undefined);
    choices.current?.querySelector<HTMLButtonElement>('button')?.focus();
  }, []);

  // Esc carries on to Today.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && done('home');
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const news = unseenNews(prefs.seenNews).length > 0;

  return (
    <div class={`welcome launch ${photo ? '' : 'launch-plain'}`}>
      {photo && <SeasonPhoto month={photoMonth} sizes="100vw" class="welcome-photo" />}
      <div class="welcome-text on-photo">
        <p class="eyebrow">{seasonFor(month).name}</p>
        <h1 class="title welcome-title">{gardenName}</h1>
        <blockquote class="launch-quote">
          <p>{quote.text}</p>
        </blockquote>
        <div class="launch-choices" ref={choices}>
          <button type="button" class="btn btn-primary btn-large" onClick={() => done('home')}>
            Today
          </button>
          {news ? (
            <button type="button" class="btn btn-on-photo" onClick={() => done('new')}>
              What’s new<span class="launch-new">New</span>
            </button>
          ) : (
            <button type="button" class="btn btn-on-photo" onClick={() => done('plan')}>
              My garden
            </button>
          )}
        </div>
        <p class="launch-version">{versionText()}</p>
      </div>
    </div>
  );
}
