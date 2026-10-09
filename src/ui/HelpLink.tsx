// Ways into Help from where people get stuck: a small "?" beside a heading, a
// link in a message, and "Stuck?" notes at the moments people most often give
// up. A note offered once isn't offered again.

import { useEffect, useState } from 'preact/hooks';
import { helpTopic } from '../content/help';
import { useApp } from './appContext';
import { Icon } from './icons';

/** A "?" that opens a help topic. */
export function HelpButton({ topic }: { topic: string }) {
  const app = useApp();
  const t = helpTopic(topic);
  return (
    <button type="button" class="icon-btn help-btn" aria-label={`Help: ${t?.title ?? 'help'}`} title={`Help: ${t?.title ?? 'help'}`} onClick={() => app.openHelp(topic)}>
      <Icon name="help" />
    </button>
  );
}

/** A link in running text that opens a help topic. */
export function HelpLink({ topic, children }: { topic: string; children: string }) {
  const app = useApp();
  return (
    <button type="button" class="link-btn help-link" onClick={() => app.openHelp(topic)}>
      {children}
    </button>
  );
}

/** How long someone sits on a screen without getting going before the note shows. */
export const STUCK_AFTER_MS = 60_000;

/**
 * "Stuck?" with a way into help, shown once someone has been on a screen a minute without getting going (`waiting`
 * true all that time). `seen` and `dismiss` keep it from coming back (in the device's preferences, `stuckSeen`).
 */
export function StuckNote({ waiting, seen, dismiss, topic, text, class: cls = '' }: { waiting: boolean; seen: boolean; dismiss: () => void; topic: string; text: string; class?: string }) {
  const app = useApp();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!waiting || seen) return setShown(false);
    const t = setTimeout(() => setShown(true), STUCK_AFTER_MS);
    return () => clearTimeout(t);
  }, [waiting, seen]);
  if (!shown || seen) return null;
  return (
    <div class={`stuck-note ${cls}`} role="status">
      <p>
        <strong>Stuck?</strong> {text}
      </p>
      <div class="button-row">
        <button
          type="button"
          class="btn btn-primary"
          onClick={() => {
            dismiss();
            app.openHelp(topic);
          }}
        >
          Show me how
        </button>
        <button type="button" class="link-btn" onClick={dismiss}>
          No thanks
        </button>
      </div>
    </div>
  );
}
