// "Where's your garden?": a postcode or a town, then pick from what matches.
// Sets the garden's place in words and the numbers behind it.

import { useState } from 'preact/hooks';
import { updateGarden, type Store } from '../model/store';
import { placeLabel, round4, searchPlaces, type Place } from '../weather/places';

export function PlaceSearch({ store, onSet }: { store: Store; onSet?: (label: string) => void }) {
  const [query, setQuery] = useState('');
  const [found, setFound] = useState<Place[] | null>(null);
  const [status, setStatus] = useState<'idle' | 'searching' | 'error'>('idle');

  const search = async (e: Event) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setStatus('searching');
    try {
      setFound(await searchPlaces(query));
      setStatus('idle');
    } catch {
      setFound(null);
      setStatus('error');
    }
  };

  const choose = (p: Place) => {
    const label = placeLabel(p);
    store.apply(updateGarden((g) => ({ ...g, latitude: round4(p.lat), longitude: round4(p.lon), placeName: label })));
    setFound(null);
    setQuery('');
    onSet?.(label);
  };

  return (
    <div class="place-search">
      <form class="place-search-form" onSubmit={search} role="search">
        <label class="field">
          Postcode or town
          <input type="search" value={query} placeholder="e.g. LS6 or Headingley" autoComplete="postal-code" onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <button type="submit" class="btn" disabled={query.trim().length < 2 || status === 'searching'}>
          {status === 'searching' ? 'Finding…' : 'Find'}
        </button>
      </form>
      {status === 'error' && <p class="message">Couldn’t search just now. Check your connection, or use this device’s location.</p>}
      {found && found.length === 0 && <p class="muted small">Nothing found for “{query.trim()}”. Try a nearby town, or the first half of your postcode.</p>}
      {found && found.length > 0 && (
        <ul class="plain-list place-results" aria-label="Places found">
          {found.map((p) => (
            <li key={`${p.name}${p.lat}${p.lon}`}>
              <button type="button" class="place-result" onClick={() => choose(p)}>
                <strong>{p.name}</strong>
                {p.detail && <span class="muted small"> {p.detail}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p class="muted small">What you type is sent to postcodes.io or Open-Meteo to find the place, and nothing else.</p>
    </div>
  );
}
