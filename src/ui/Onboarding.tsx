import { useState } from 'preact/hooks';
import { seasonFor } from '../content/seasons';
import { makeSpace } from '../model/spaces';
import { updateGarden, type Store } from '../model/store';
import type { Garden } from '../model/types';
import type { Prefs, PrefsStore, View } from '../theme/prefs';
import { GardenNameField, UseLocationButton } from './GardenSettings';
import { Choice, LookPicker } from './LookPicker';
import { SeasonPhoto } from './SeasonPhoto';
import { SpacePicker, type SpaceChoice } from './SpacePicker';

interface Props {
  store: Store;
  garden: Garden;
  prefs: Prefs;
  prefsStore: PrefsStore;
  go: (v: View) => void;
}

type Step = 'space' | 'look' | 'garden';

/** First run: welcome, where you're growing, choose a look, name the garden. Every step can be skipped. */
export function Onboarding({ store, garden, prefs, prefsStore, go }: Props) {
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; lines: string[] } | null>(null);
  const [choice, setChoice] = useState<SpaceChoice | null>(null);
  /** The garden as it was before a space was made, so going back and choosing again replaces it. */
  const [before] = useState(garden);
  /** The space made, and the name it gave the garden. */
  const [made, setMade] = useState<{ key: string; name: string } | null>(null);
  const month = new Date().getMonth() + 1;
  // "Where are you growing?" is only asked of an empty garden (not one restored from a backup).
  const steps: Step[] = before.boundary.length === 0 && before.features.length === 0 ? ['space', 'look', 'garden'] : ['look', 'garden'];
  const current = steps[step - 1];
  const finish = () => {
    prefsStore.set({ onboarded: true });
    go('plan');
  };
  const makeIt = () => {
    if (!choice) return;
    const key = `${choice.space} ${choice.w} ${choice.d}`;
    if (key === made?.key) return;
    // A name the last space gave is replaced too; one you typed is kept.
    store.apply(updateGarden((g) => makeSpace({ ...g, boundary: before.boundary, features: before.features, name: g.name === made?.name ? before.name : g.name }, choice.space, choice.w, choice.d)));
    setMade({ key, name: store.get().garden.name });
  };
  const next = () => {
    if (current === 'space') makeIt();
    if (step < steps.length) setStep(step + 1);
    else finish();
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
        <p class="eyebrow">
          Step {step} of {steps.length}
        </p>
        {current === 'space' ? (
          <>
            <h1 class="title">Where are you growing?</h1>
            <p class="muted">Pick the nearest, then its size. It's laid out for you, ready for plants; you can move and change everything.</p>
            <SpacePicker value={choice} onChange={setChoice} />
          </>
        ) : current === 'look' ? (
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
          <button type="button" class="btn btn-primary" onClick={next}>
            {step < steps.length ? 'Next' : 'Start planning'}
          </button>
          <button type="button" class="btn btn-quiet" onClick={finish}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
