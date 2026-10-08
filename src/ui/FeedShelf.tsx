// Feeding, on screen: the feed shelf on the Seedlings page (what you have in,
// and what this season's plants call for, with a rough cost), and how to feed a
// plant on its card.

import { Fragment } from 'preact';
import { useMemo } from 'preact/hooks';
import {
  amountText,
  FEED_KINDS,
  FEEDS,
  feedById,
  NEED_LABEL,
  NEED_TEXT,
  npkText,
  priceText,
  PRICES_WHEN,
  stepHeading,
  stepText,
  type Feed,
} from '../feeding/feeds';
import { costText, onShelf, seasonFeeding, toggleShelf, toBuy } from '../feeding/schedule';
import { updateGarden, type Store } from '../model/store';
import type { FeedStep, Garden, Plant } from '../model/types';

const KIND_TITLE: Record<Feed['kind'], string> = { organic: 'Organic', mineral: 'Mineral' };

/** "tomato, courgette and 3 more". */
function plantList(ids: string[], plantOf: (id: string) => Plant): string {
  const names = ids.map((id) => plantOf(id).commonName.toLowerCase());
  if (names.length <= 3) return names.length === 1 ? names[0]! : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
  return `${names.slice(0, 2).join(', ')} and ${names.length - 2} more`;
}

function FeedRow({ feed, have, toggle }: { feed: Feed; have: boolean; toggle: () => void }) {
  return (
    <li class="feed-row">
      <label class="feed-check">
        <input type="checkbox" checked={have} onChange={toggle} />
        <span>
          <strong>{feed.name}</strong>
          <span class="muted small"> · {npkText(feed)}</span>
        </span>
      </label>
      <p class="small feed-for">{feed.for}</p>
      <details class="feed-more">
        <summary class="small">How to use it</summary>
        <dl class="kitchen-facts">
          <dt>How</dt>
          <dd>{feed.how}</dd>
          <dt>When</dt>
          <dd>{feed.when}</dd>
          {feed.homeMade && (
            <>
              <dt>Making it</dt>
              <dd>{feed.homeMade}</dd>
            </>
          )}
          {feed.careful && (
            <>
              <dt>Careful</dt>
              <dd>{feed.careful}</dd>
            </>
          )}
          <dt>Price</dt>
          <dd>
            {priceText(feed)}
            {feed.pack ? ` (${PRICES_WHEN})` : ''}
          </dd>
        </dl>
      </details>
    </li>
  );
}

/** The feed shelf: this season's feeding for what's on the plan, then every feed, to tick off what you have. */
export function FeedShelf({ store, garden, plantOf }: { store: Store; garden: Garden; plantOf: (id: string) => Plant }) {
  const season = useMemo(() => seasonFeeding(garden, plantOf), [garden, plantOf]);
  const buy = toBuy(season);
  const toggle = (id: string) => store.apply(updateGarden((g) => toggleShelf(g, id)));
  const cost = costText(season.low, season.high);
  return (
    <>
      <section class="card feed-season" aria-labelledby="feed-season-title">
        <h2 id="feed-season-title">This season’s feeding</h2>
        {season.uses.length === 0 ? (
          <p class="muted">Nothing on the plan wants feeding yet. Add some plants, and what they’ll want shows here.</p>
        ) : (
          <>
            <p class="kitchen-worth">
              {cost === 'nothing' ? (
                'All home-made, so it costs nothing.'
              ) : (
                <>
                  <span class="kitchen-worth-big">{cost}</span> of feed for what’s on your plan, at shop prices.
                </>
              )}
            </p>
            <ul class="plain-list feed-uses">
              {season.uses.map((u) => (
                <li key={u.feed.id}>
                  <label class="feed-check">
                    <input type="checkbox" checked={onShelf(garden, u.feed.id)} onChange={() => toggle(u.feed.id)} />
                    <span>
                      <strong>{u.feed.name}</strong>
                      <span class="muted small">
                        {' '}
                        · about {amountText(u.feed, u.amount)} for {plantList(u.plantIds, plantOf)} · {u.feed.homeMade ? 'home-made' : costText(u.low, u.high)}
                      </span>
                    </span>
                  </label>
                  {u.have && u.have !== u.feed.id && <p class="small feed-for">Your {feedById(u.have)!.name.toLowerCase()} will do instead.</p>}
                </li>
              ))}
            </ul>
            {buy.length > 0 && (
              <p class="small">
                <span class="muted">Not on the shelf yet: </span>
                {buy.map((u) => u.feed.name.toLowerCase()).join(', ')}.
              </p>
            )}
          </>
        )}
      </section>

      <section class="card" aria-labelledby="feed-shelf-title">
        <h2 id="feed-shelf-title">The feed shelf</h2>
        <p class="muted small">Tick what you have in. Plain names only, never brands: any make will do.</p>
        {FEED_KINDS.map((kind) => (
          <div key={kind} class="feed-kind">
            <h3>{KIND_TITLE[kind]}</h3>
            <ul class="plain-list feed-list">
              {FEEDS.filter((f) => f.kind === kind).map((f) => (
                <FeedRow key={f.id} feed={f} have={onShelf(garden, f.id)} toggle={() => toggle(f.id)} />
              ))}
            </ul>
          </div>
        ))}
        <p class="assumption">
          Prices are rough, from {PRICES_WHEN}, for the amount used. Amounts are worked out from each plant’s spacing, so a big plan is only a guide.
        </p>
      </section>
    </>
  );
}

/** On a plant's card: how hungry it is, what to feed it when, and what to keep away from it. */
export function PlantFeeding({ plant }: { plant: Plant }) {
  const f = plant.feeding;
  if (!f) return null;
  // Steps under the same heading (three things in spring) share it.
  const groups: [string, FeedStep[]][] = [];
  for (const s of f.steps) {
    if (!feedById(s.feed)) continue;
    const h = stepHeading(plant, s);
    const g = groups.find(([x]) => x === h);
    if (g) g[1].push(s);
    else groups.push([h, [s]]);
  }
  return (
    <section class="plant-section" aria-labelledby="plant-feeding-title">
      <h2 id="plant-feeding-title">Feeding</h2>
      <p>
        <strong>{NEED_LABEL[f.need]}.</strong> {NEED_TEXT[f.need]}
      </p>
      {(groups.length > 0 || !!f.avoid?.length) && (
        <dl class="kitchen-facts">
          {groups.map(([h, steps]) => (
            <Fragment key={h}>
              <dt>{h}</dt>
              {steps.map((s, i) => (
                <dd key={`${h}${i}`}>{stepText(s)}</dd>
              ))}
            </Fragment>
          ))}
          {f.avoid?.length ? (
            <>
              <dt>Keep away</dt>
              {f.avoid.map((a) => (
                <dd key={a}>{a}</dd>
              ))}
            </>
          ) : null}
        </dl>
      )}
    </section>
  );
}
