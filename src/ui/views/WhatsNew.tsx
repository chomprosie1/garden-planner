import { useEffect, useState } from 'preact/hooks';
import { latestNews, unseenNews, WHATS_NEW } from '../../content/whatsNew';
import type { Prefs, PrefsStore, View } from '../../theme/prefs';
import { Icon } from '../icons';
import { formatDate } from '../NotesSection';

interface Props {
  prefs: Prefs;
  prefsStore: PrefsStore;
  back: () => void;
  go: (v: View) => void;
}

/** What's changed in the app, newest first, in plain English. Opening it counts as having seen it all. */
export function WhatsNew({ prefs, prefsStore, back, go }: Props) {
  // Which were new when you opened the page, so they stay marked while you read.
  const [fresh] = useState(() => new Set(unseenNews(prefs.seenNews).map((e) => e.id)));
  useEffect(() => {
    if (prefsStore.get().seenNews !== latestNews().id) prefsStore.set({ seenNews: latestNews().id });
  }, [prefsStore]);

  return (
    <div class="page news-page">
      <header class="page-head">
        <button type="button" class="icon-btn" aria-label="Back" onClick={back}>
          <Icon name="back" />
        </button>
        <h1 class="title">What’s new</h1>
      </header>
      <p class="muted">The latest changes to the app, newest first.</p>
      {WHATS_NEW.map((e) => (
        <section key={e.id} class={`card news-entry${fresh.has(e.id) ? ' news-fresh' : ''}`} aria-labelledby={`news-${e.id}`}>
          <p class="eyebrow news-date">
            {formatDate(e.date)}
            {fresh.has(e.id) && <span class="news-badge">New</span>}
          </p>
          <h2 id={`news-${e.id}`}>{e.title}</h2>
          <ul class="news-items">
            {e.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          {e.tryIt && (
            <button type="button" class="btn" onClick={() => go(e.tryIt!.view)}>
              {e.tryIt.label}
            </button>
          )}
        </section>
      ))}
    </div>
  );
}
