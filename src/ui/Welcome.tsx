// The welcome on launch: the month's photo and the garden's name, a short
// pause while the plants load (1 to 5 seconds) with a line to read and the
// version at the foot, then the ways in: the garden, the month's jobs, the
// garden's own page, What's new, or carry on to Today. After a second, a tap
// skips the pause.

import { useEffect, useRef, useState } from 'preact/hooks';
import { pickQuote } from '../content/quotes';
import { seasonFor } from '../content/seasons';
import { versionText } from '../content/version';
import { unseenNews } from '../content/whatsNew';
import { loadLibrary } from '../library/library';
import type { Prefs, PrefsStore, View } from '../theme/prefs';
import { CHOICES_SETTLE_MS, LONGEST_WAIT_MS, pauseMs, SKIP_AFTER_MS } from './launch';
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
  const [pause] = useState(() => pauseMs());
  const [quote] = useState(() => pickQuote(month, prefs.lastQuote));
  const [ready, setReady] = useState(false);
  const [skippable, setSkippable] = useState(false);
  const [settled, setSettled] = useState(false);
  // The photo as on Today: the month's, or the one pinned in Settings; none if photos are off.
  const photoMonth = prefs.photoMonth === 'auto' ? month : prefs.photoMonth;
  const photo = prefs.photos !== 'off';
  const started = useRef(performance.now());
  const choices = useRef<HTMLDivElement>(null);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    prefsStore.set({ lastQuote: quote.text });
    let gone = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const after = (ms: number) => new Promise((r) => timers.push(setTimeout(r, ms)));
    // The plants load meanwhile: the pause is at least its length, and waits for them, but never too long.
    const loaded = Promise.race([loadLibrary().catch(() => undefined), after(LONGEST_WAIT_MS)]);
    void Promise.all([loaded, after(pause)]).then(() => !gone && setReady(true));
    timers.push(setTimeout(() => !gone && setSkippable(true), SKIP_AFTER_MS));
    return () => {
      gone = true;
      timers.forEach(clearTimeout);
    };
  }, []);

  // The choices settle for a moment before they take a tap, so a second tap to hurry the pause can't pick one.
  useEffect(() => {
    if (!ready) return;
    const t = setTimeout(() => {
      setSettled(true);
      choices.current?.querySelector<HTMLButtonElement>('button')?.focus();
    }, CHOICES_SETTLE_MS);
    return () => clearTimeout(t);
  }, [ready]);

  // Enter or Esc: skip the pause, then carry on to Today.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== 'Escape') return;
      if (!ready) {
        if (performance.now() - started.current >= SKIP_AFTER_MS) setReady(true);
      } else if (e.key === 'Escape' && settled) done('home');
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [ready, settled]);

  const news = unseenNews(prefs.seenNews).length > 0;

  return (
    <div class={`welcome launch ${ready ? 'launch-ready' : ''} ${settled ? 'launch-settled' : ''} ${photo ? '' : 'launch-plain'}`} onClick={() => !ready && skippable && setReady(true)}>
      {photo && <SeasonPhoto month={photoMonth} sizes="100vw" class="welcome-photo" credit={ready} />}
      <div class="welcome-text on-photo">
        <p class="eyebrow">{seasonFor(month).name}</p>
        <h1 class="title welcome-title">{gardenName}</h1>
        {!ready ? (
          <>
            <blockquote class="launch-quote">
              <p>{quote.text}</p>
            </blockquote>
            <div class="launch-bar" role="progressbar" aria-label="Getting your garden ready" aria-valuetext="Loading">
              <div class={still ? 'launch-fill launch-fill-still' : 'launch-fill'} style={{ animationDuration: `${pause}ms` }} />
            </div>
            <p class="launch-skip small" aria-live="polite">
              {skippable ? 'Tap to go straight in' : ' '}
            </p>
          </>
        ) : (
          <div class="launch-choices" ref={choices}>
            <button type="button" class="btn btn-primary btn-large" onClick={() => done('plan')}>
              Enter my garden
            </button>
            <div class="launch-more">
              <button type="button" class="btn btn-on-photo" onClick={() => done('month')}>
                See my tasks
              </button>
              <button type="button" class="btn btn-on-photo" onClick={() => done('profile')}>
                About my garden
              </button>
              <button type="button" class="btn btn-on-photo" onClick={() => done('new')}>
                What’s new{news && <span class="launch-new">New</span>}
              </button>
            </div>
            <button type="button" class="link-btn launch-continue" onClick={() => done('home')}>
              Continue to Today
            </button>
          </div>
        )}
        <p class="launch-version">{versionText()}</p>
      </div>
    </div>
  );
}
