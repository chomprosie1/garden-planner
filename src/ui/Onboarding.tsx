import { useState } from 'preact/hooks';
import { seasonFor } from '../content/seasons';
import type { Store } from '../model/store';
import type { Garden } from '../model/types';
import type { Prefs, PrefsStore, View } from '../theme/prefs';
import { GardenNameField, UseLocationButton } from './GardenSettings';
import { Choice, LookPicker } from './LookPicker';
import { SeasonPhoto } from './SeasonPhoto';

interface Props {
  store: Store;
  garden: Garden;
  prefs: Prefs;
  prefsStore: PrefsStore;
  go: (v: View) => void;
}

/** First run: welcome, choose a look, name the garden. Every step can be skipped. */
export function Onboarding({ store, garden, prefs, prefsStore, go }: Props) {
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; lines: string[] } | null>(null);
  const month = new Date().getMonth() + 1;
  const finish = () => {
    prefsStore.set({ onboarded: true });
    go('plan');
  };

  if (step === 0)
    return (
      <div class="welcome">
        <SeasonPhoto month={month} sizes="100vw" class="welcome-photo" />
        <div class="welcome-text on-photo">
          <p class="eyebrow">{seasonFor(month).name}</p>
          <h1 class="title welcome-title">Plan your garden, month by month.</h1>
          <p>Draw it to scale, choose what to grow where, and see what to do each month.</p>
          <div class="button-row">
            <button type="button" class="btn btn-primary btn-large" onClick={() => setStep(1)}>
              Get started
            </button>
            <button type="button" class="btn btn-on-photo" onClick={finish}>
              Skip
            </button>
          </div>
        </div>
      </div>
    );

  return (
    <div class="onboarding">
      <div class="onboarding-inner">
        <p class="eyebrow">Step {step} of 2</p>
        {step === 1 ? (
          <>
            <h1 class="title">Choose a look</h1>
            <p class="muted">You can change this at any time in Settings.</p>
            <LookPicker prefs={prefs} prefsStore={prefsStore} />
            <Choice
              legend="Light or dark"
              name="ob-mode"
              value={prefs.mode}
              options={[
                { value: 'auto', label: 'Match device' },
                { value: 'light', label: 'Light' },
                { value: 'dark', label: 'Dark' },
              ]}
              onChange={(mode) => prefsStore.set({ mode })}
            />
          </>
        ) : (
          <>
            <h1 class="title">Your garden</h1>
            <p class="muted">Its location is used to work out sun and shade. You can change both later.</p>
            <GardenNameField store={store} garden={garden} />
            <UseLocationButton store={store} onMessage={setMessage} />
            {message && (
              <div class={`message ${message.kind}`} role="status">
                {message.lines.map((l) => (
                  <p key={l}>{l}</p>
                ))}
              </div>
            )}
          </>
        )}
        <div class="button-row onboarding-actions">
          <button type="button" class="btn" onClick={() => setStep(step - 1)}>
            Back
          </button>
          <button type="button" class="btn btn-primary" onClick={() => (step === 1 ? setStep(2) : finish())}>
            {step === 1 ? 'Next' : 'Start planning'}
          </button>
          <button type="button" class="btn btn-quiet" onClick={finish}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
