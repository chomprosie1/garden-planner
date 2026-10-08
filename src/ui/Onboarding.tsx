import { useMemo, useState } from 'preact/hooks';
import { toggleWishlist } from '../calendar/jobs';
import { latestNews } from '../content/whatsNew';
import { seasonFor } from '../content/seasons';
import { todayIso } from '../model/ids';
import { makeSpace } from '../model/spaces';
import { updateGarden, type Store } from '../model/store';
import type { Garden } from '../model/types';
import { applyKit, kitsFor, type Kit } from '../planting/kits';
import { spacingStyle } from '../planting/place';
import type { Prefs, PrefsStore, View } from '../theme/prefs';
import { GardenNameField, placeText, UseLocationButton } from './GardenSettings';
import { KitPicker } from './KitPicker';
import { PlaceSearch } from './PlaceSearch';
import { PlantIcon } from './PlantIcon';
import { SeasonPhoto } from './SeasonPhoto';
import { SpacePicker, type SpaceChoice } from './SpacePicker';
import { usePlants } from './usePlants';

interface Props {
  store: Store;
  garden: Garden;
  prefs: Prefs;
  prefsStore: PrefsStore;
  go: (v: View) => void;
  /** Setting up another garden, or starting again: straight to the questions, with no welcome. */
  again?: boolean;
}

type Step = 'where' | 'space' | 'grow';

/** Popular, easy plants to pick from on the first run: things people most often want to grow first. */
export const FAVOURITES = ['tomato', 'lettuce', 'strawberry', 'basil', 'potato', 'courgette', 'carrot', 'radish', 'french-bean', 'pea', 'chilli', 'mint', 'sweet-pea', 'sunflower', 'cosmos', 'lavender'];

/**
 * First run: where your garden is, what you're growing in, and what you'd like to grow (a starter kit, and
 * favourites for your sowing list). Then Today, with real jobs. Every step can be skipped; the look is in Settings.
 */
export function Onboarding({ store, garden, prefs, prefsStore, go, again = false }: Props) {
  const [step, setStep] = useState(again ? 1 : 0);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; lines: string[] } | null>(null);
  const [choice, setChoice] = useState<SpaceChoice | null>(null);
  const [kit, setKit] = useState<Kit | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  /** The garden as it was before a space was made, so going back and choosing again replaces it. */
  const [before] = useState(garden);
  const { plants, plantOf } = usePlants([], spacingStyle(garden));
  const byId = useMemo(() => new Map((plants ?? []).map((p) => [p.id, p])), [plants]);
  const month = new Date().getMonth() + 1;
  // "What are you growing in?" is only asked of an empty garden (not one restored from a backup).
  const empty = before.boundary.length === 0 && before.features.length === 0;
  const steps: Step[] = empty ? ['where', 'space', 'grow'] : ['where', 'grow'];
  const current = steps[step - 1];
  const kits = choice ? kitsFor(choice.space) : [];

  const finish = (skipped = false) => {
    if (!skipped) {
      store.apply(
        updateGarden((g) => {
          let next = g;
          // The space, laid out fresh from the garden as it was, then the kit in its beds.
          if (empty && choice) next = makeSpace({ ...next, boundary: before.boundary, features: before.features, plantings: before.plantings }, choice.space, choice.w, choice.d);
          if (kit && plants) next = applyKit(next, kit, (id) => byId.get(id) ?? null, todayIso());
          for (const id of picked) if (!next.wishlist.includes(id)) next = toggleWishlist(next, id);
          return next;
        }),
      );
    }
    // Everything's new to someone just starting: no "What's new" until the next change. Someone setting up another garden has seen it.
    prefsStore.set({ onboarded: true, seenNews: again ? prefs.seenNews : latestNews().id });
    go(skipped ? 'plan' : 'home');
  };
  const next = () => (step < steps.length ? setStep(step + 1) : finish());
  const toggle = (id: string) => {
    const s = new Set(picked);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setPicked(s);
  };

  if (step === 0)
    return (
      <div class="welcome">
        <SeasonPhoto month={month} sizes="100vw" class="welcome-photo" />
        <div class="welcome-text on-photo">
          <p class="eyebrow">{seasonFor(month).name}</p>
          <h1 class="title welcome-title">Plan your garden, month by month.</h1>
          <p>Lay it out to scale, choose what to grow where, and see what to do each week.</p>
          <div class="button-row">
            <button type="button" class="btn btn-primary btn-large" onClick={() => setStep(1)}>
              Get started
            </button>
            <button type="button" class="btn btn-on-photo" onClick={() => finish(true)}>
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
        {current === 'where' ? (
          <>
            <h1 class="title">Where’s your garden?</h1>
            <p class="muted">A postcode or town is enough. It times the sun and shade, the frosts and the seasons.</p>
            <PlaceSearch store={store} />
            <UseLocationButton store={store} onMessage={setMessage} />
            <p class="place-now">{placeText(garden)}</p>
            {message && (
              <div class={`message ${message.kind}`} role="status">
                {message.lines.map((l) => (
                  <p key={l}>{l}</p>
                ))}
              </div>
            )}
            <GardenNameField store={store} garden={garden} />
          </>
        ) : current === 'space' ? (
          <>
            <h1 class="title">What are you growing in?</h1>
            <p class="muted">Pick the nearest, then its size. It’s laid out for you, ready for plants; you can move and change everything.</p>
            <SpacePicker
              value={choice}
              onChange={(c) => {
                if (c.space !== choice?.space) setKit(null);
                setChoice(c);
              }}
            />
          </>
        ) : (
          <>
            <h1 class="title">What would you like to grow?</h1>
            {kits.length > 0 && (
              <>
                <h2 class="onboarding-sub">Start from a kit</h2>
                <p class="muted small">Planted for you, ready to sow when the time comes. You can change anything.</p>
                <KitPicker kits={kits} value={kit} onChange={setKit} plantOf={plantOf} />
              </>
            )}
            <h2 class="onboarding-sub">{kits.length ? 'And anything else?' : 'Pick some favourites'}</h2>
            <p class="muted small">They go on your list to grow, with sowing jobs when it’s time.</p>
            <div class="favourites" role="group" aria-label="Plants you’d like to grow">
              {FAVOURITES.filter((id) => byId.has(id)).map((id) => (
                <button key={id} type="button" class="chip favourite" aria-pressed={picked.has(id)} onClick={() => toggle(id)}>
                  <PlantIcon plant={byId.get(id)!} size={22} />
                  {byId.get(id)!.commonName}
                </button>
              ))}
            </div>
          </>
        )}
        <div class="button-row onboarding-actions">
          {!(again && step === 1) && (
            <button type="button" class="btn" onClick={() => setStep(step - 1)}>
              Back
            </button>
          )}
          <button type="button" class="btn btn-primary" onClick={next} disabled={current === 'grow' && !plants}>
            {step < steps.length ? 'Next' : 'Start growing'}
          </button>
          <button type="button" class="btn btn-quiet" onClick={() => finish()}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
