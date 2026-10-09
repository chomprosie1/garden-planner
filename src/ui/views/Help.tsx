// Help: the topics people most often get stuck on, in short steps, worded for
// a phone or a computer. The address keeps the open topic ("#/help/adding-plants"),
// so the back button steps between topics and the list.

import { useState } from 'preact/hooks';
import { helpByTier, helpTopic, stepText } from '../../content/help';
import type { View } from '../../theme/prefs';
import { hashForHelp, useHelpTopic, useIsPhone } from '../hooks';
import { Icon } from '../icons';

const SCREEN_NAME: Partial<Record<View, string>> = { plan: 'the garden', shed: 'Seedlings', home: 'Today', plants: 'Plants', settings: 'Settings', profile: 'your garden’s page' };

interface Props {
  back: () => void;
  go: (v: View) => void;
}

export function Help({ back, go }: Props) {
  const topicId = useHelpTopic();
  const topic = topicId ? helpTopic(topicId) : undefined;
  const phoneScreen = useIsPhone();
  // Steps for the other kind of screen, for someone reading on one and doing it on the other.
  const [other, setOther] = useState(false);
  // A topic opened from elsewhere (a "?" or a "Stuck?" note): Back returns there, not to the list.
  const [arrivedAt] = useState(topicId);
  const phone = other ? !phoneScreen : phoneScreen;
  const open = (id: string | null) => {
    location.hash = hashForHelp(id ?? undefined).slice(1);
    scrollTo(0, 0);
  };

  if (!topic)
    return (
      <div class="page help-page">
        <header class="page-head">
          <button type="button" class="icon-btn" aria-label="Back" onClick={back}>
            <Icon name="back" />
          </button>
          <h1 class="title">Help</h1>
        </header>
        <p class="muted">Short steps for the things people most often get stuck on.</p>
        {helpByTier().map((g) => (
          <section key={g.tier} class="card help-group" aria-labelledby={`help-tier-${g.tier}`}>
            <h2 id={`help-tier-${g.tier}`}>{g.label}</h2>
            <ul class="help-list">
              {g.topics.map((t) => (
                <li key={t.id}>
                  <a
                    href={hashForHelp(t.id)}
                    onClick={(e) => {
                      e.preventDefault();
                      open(t.id);
                    }}
                  >
                    <span class="help-list-title">{t.title}</span>
                    <span class="muted small">{t.summary}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <p class="muted small">Can’t find it? Search everything from the magnifying glass on the plan, or press Ctrl+K on a computer.</p>
      </div>
    );

  return (
    <div class="page help-page">
      <header class="page-head">
        <button type="button" class="icon-btn" aria-label="Back" onClick={() => (topic.id === arrivedAt ? back() : open(null))}>
          <Icon name="back" />
        </button>
        <h1 class="title">{topic.title}</h1>
      </header>
      <p class="muted">{topic.summary}</p>
      <section class="card help-topic">
        <ol class="help-steps">
          {topic.steps.map((s, i) => (
            <li key={i}>{stepText(s, phone)}</li>
          ))}
        </ol>
        {topic.steps.some((s) => typeof s !== 'string') && (
          <button type="button" class="link-btn small" onClick={() => setOther(!other)}>
            {phone ? 'Show the steps for a computer' : 'Show the steps for a phone'}
          </button>
        )}
        {topic.notes?.map((n) => (
          <p key={n} class="help-note small">
            {n}
          </p>
        ))}
        <div class="button-row">
          <button type="button" class="btn btn-primary" onClick={() => go(topic.view)}>
            Take me to {SCREEN_NAME[topic.view] ?? 'it'}
          </button>
          {topic.id === arrivedAt && (
            <button type="button" class="btn" onClick={() => open(null)}>
              All help
            </button>
          )}
        </div>
      </section>
      {topic.related.length > 0 && (
        <section class="card help-related" aria-labelledby="help-related">
          <h2 id="help-related">Related</h2>
          <ul class="help-list">
            {topic.related.map((id) => {
              const t = helpTopic(id);
              return t ? (
                <li key={id}>
                  <a
                    href={hashForHelp(id)}
                    onClick={(e) => {
                      e.preventDefault();
                      open(id);
                    }}
                  >
                    <span class="help-list-title">{t.title}</span>
                    <span class="muted small">{t.summary}</span>
                  </a>
                </li>
              ) : null;
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
