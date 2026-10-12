// "Where's your garden?": a postcode or a town, then pick from what matches.
// Sets the garden's place in words and the numbers behind it.

import { useEffect, useRef, useState } from 'preact/hooks';
import { updateGarden, type Store } from '../model/store';
import { placeLabel, placeUrl, round4, searchPlaces, type Place } from '../weather/places';

interface Props {
  store: Store;
  onSet?: (label: string) => void;
  /** Told whether something's typed or found but not yet chosen, so Next can ask for it first. */
  onPending?: (pending: boolean) => void;
  /** Goes up when Next was pressed with something pending: search what's typed, or ask for a pick. */
  ask?: number;
}

export function PlaceSearch({ store, onSet, onPending, ask = 0 }: Props) {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Place[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'searching' | 'error'>('idle');
  const [asked, setAsked] = useState(false);
  const list = useRef<HTMLUListElement>(null);

  const choose = (p: Place) => {
    const label = placeLabel(p);
    store.apply(updateGarden((g) => ({ ...g, latitude: round4(p.lat), longitude: round4(p.lon), placeName: label })));
    setFound(null);
    setQuery('');
    setAsked(false);
    onSet?.(label);
  };

  const search = async (e?: Event) => {
    e?.preventDefault();
    if (query.trim().length < 2) return;
    setStatus('searching');
    try {
      const places = await searchPlaces(query);
      setStatus('idle');
      // A postcode finds one place: that's the garden, with nothing more to pick.
      if (places.length === 1 && placeUrl(query).kind !== 'name') return choose(places[0]!);
      setFound(places);
    } catch {
      setFound(null);
      setStatus('error');
    }
  };

  // Nothing found, or no connection, isn't pending: Next goes on with the place as it is.
  const pending = status !== 'error' && (found ? found.length > 0 : query.trim().length >= 2);
  useEffect(() => onPending?.(pending), [pending]);
  // Next pressed with a search typed: search it. With places found: ask which.
  useEffect(() => {
    if (!ask) return;
    if (found?.length) {
      setAsked(true);
      list.current?.querySelector('button')?.focus();
    } else if (query.trim().length >= 2) void search();
  }, [ask]);

  return (
    <div class="place-search">
      <form class="place-search-form" onSubmit={search} role="search">
        <label class="field">
          Postcode or town
          <input
            type="search"
            value={query}
            placeholder="e.g. LS6 or Headingley"
            autoComplete="postal-code"
            enterKeyHint="search"
            onInput={(e) => {
              setQuery((e.currentTarget as HTMLInputElement).value);
              if (found?.length === 0) setFound(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void search(e);
            }}
          />
        </label>
        <button type="submit" class="btn" disabled={query.trim().length < 2 || status === 'searching'}>
          {status === 'searching' ? 'Finding…' : 'Find'}
        </button>
      </form>
      {status === 'error' && <p class="message">Couldn’t search just now. Check your connection, or use this device’s location.</p>}
      {found && found.length === 0 && <p class="muted small">Nothing found in the UK for “{query.trim()}”. Try a nearby town, or the first half of your postcode.</p>}
      {found && found.length > 0 && (
        <>
          <p class={asked ? 'message' : 'muted small'} role={asked ? 'alert' : undefined}>
            {asked ? 'Which of these is your garden? Pick one to set it.' : 'Pick your garden’s place:'}
          </p>
          <ul ref={list} class="place-results" aria-label="Places found">
            {found.map((p) => (
              <li key={`${p.name}${p.lat}${p.lon}`}>
                <button type="button" class="place-result" onClick={() => choose(p)}>
                  <strong>{p.name}</strong>
                  {p.detail && <span class="muted small"> {p.detail}</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <p class="muted small">What you type is sent to postcodes.io or Open-Meteo to find the place, and nothing else.</p>
    </div>
  );
}
