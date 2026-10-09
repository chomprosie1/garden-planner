// "Install the app": on Today, until it's installed or put away. Chrome, Edge
// and Samsung Internet offer their own prompt; on an iPhone it's Share, then
// Add to Home Screen.

import { useEffect, useState } from 'preact/hooks';
import type { PrefsStore } from '../theme/prefs';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let saved: InstallPrompt | null = null;
const listeners = new Set<() => void>();

/** Keeps the browser's install prompt for when you ask for it. Called once, as the app starts. */
export function catchInstallPrompt(): void {
  addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    saved = e as InstallPrompt;
    listeners.forEach((l) => l());
  });
  addEventListener('appinstalled', () => {
    saved = null;
    listeners.forEach((l) => l());
  });
}

/** Running as an installed app already. */
export const isInstalled = () => matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** An iPhone or iPad in Safari, which installs from the Share menu. */
export const isIosSafari = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios|edgios/i.test(navigator.userAgent);

export function InstallCard({ hidden, prefsStore }: { hidden: boolean; prefsStore: PrefsStore }) {
  const [prompt, setPrompt] = useState(saved);
  useEffect(() => {
    const on = () => setPrompt(saved);
    listeners.add(on);
    return () => void listeners.delete(on);
  }, []);
  if (hidden || isInstalled() || (!prompt && !isIosSafari())) return null;
  return (
    <section class="card install-card" aria-labelledby="install-title">
      <h2 id="install-title">Put it on your home screen</h2>
      <p class="muted">It opens like an app, works without a signal, and can warn you of frost.</p>
      {prompt ? (
        <div class="button-row">
          <button
            type="button"
            class="btn btn-primary"
            onClick={async () => {
              await prompt.prompt();
              const choice = await prompt.userChoice;
              if (choice.outcome === 'accepted') prefsStore.set({ installHidden: true });
              saved = null;
              setPrompt(null);
            }}
          >
            Install the app
          </button>
          <button type="button" class="btn btn-quiet" onClick={() => prefsStore.set({ installHidden: true })}>
            Not now
          </button>
        </div>
      ) : (
        <>
          <p class="muted">It keeps your garden safe too: Safari can clear what a website keeps if it isn’t visited for a few weeks.</p>
          <p>
            Tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
          </p>
          <button type="button" class="btn btn-quiet" onClick={() => prefsStore.set({ installHidden: true })}>
            Not now
          </button>
        </>
      )}
    </section>
  );
}
