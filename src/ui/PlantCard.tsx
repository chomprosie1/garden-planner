import { monthRanges, varietiesOf } from '../library/library';
import { growthText } from '../lifecycle/growth';
import type { Light, Plant, Pollinators, Sowing } from '../model/types';
import { formatLength } from '../canvas/viewport';
import { Icon } from './icons';
import { PlantIcon } from './PlantIcon';
import { PlantKitchen } from './Kitchen';
import { PlantFeeding } from './FeedShelf';
import { unknownPlant } from '../planting/place';
import { useApp } from './appContext';

/** A new issue on the app's GitHub page, about this plant. */
export const reportUrl = (p: Plant) =>
  `https://github.com/chomprosie1/garden-planner/issues/new?title=${encodeURIComponent(`Plant notes: ${p.commonName}`)}&body=${encodeURIComponent(`What's wrong in the notes for ${p.commonName} (${p.id})?

`)}`;

export const LIGHT_LABEL: Record<Light, string> = { 'full-sun': 'Full sun', 'part-shade': 'Part shade', shade: 'Shade' };
export const METHOD_LABEL: Record<Sowing['method'], string> = {
  indoors: 'Sow indoors',
  direct: 'Sow outside',
  'cold-frame': 'Sow to plant out later',
};
export const WINTER_LABEL: Record<NonNullable<Plant['wintering']>['type'], string> = {
  hardy: 'Hardy: can stay out over winter',
  protect: 'Needs protecting over winter',
  'lift-and-store': 'Lift and store',
  annual: 'Annual: clear after cropping',
};
export const CATEGORY_LABEL: Record<Plant['category'], string> = {
  vegetable: 'Vegetable',
  herb: 'Herb',
  fruit: 'Fruit',
  flower: 'Flower',
  shrub: 'Shrub',
  tree: 'Tree',
  weed: 'Weed',
};

/** Everyday names for the families crop rotation and most gardeners talk about. */
const FAMILY_NAME: Record<string, string> = {
  Brassicaceae: 'the cabbage family',
  Fabaceae: 'the pea and bean family',
  Solanaceae: 'the potato and tomato family',
  Amaryllidaceae: 'the onion family',
  Apiaceae: 'the carrot family',
  Cucurbitaceae: 'the squash family',
  Amaranthaceae: 'the beet and spinach family',
  Asteraceae: 'the daisy family',
  Lamiaceae: 'the mint family',
  Rosaceae: 'the rose family',
  Poaceae: 'the grass family',
  Ericaceae: 'the heather family',
};

/** "Good for bees and hoverflies, June to August." */
export function pollinatorText(x: Pollinators): string {
  if (x.rating === 'none') return 'Little for pollinators: picked before it flowers, or flowers they can’t get into.';
  const who = x.visitors ?? [];
  const list = who.length > 1 ? `${who.slice(0, -1).join(', ')} and ${who.at(-1)}` : who[0];
  return `${x.rating === 'good' ? 'Good' : 'Some food'} for ${list}, ${monthRanges(x.months ?? [], true).replaceAll('–', ' to ')}.`;
}

const LETTERS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/** A row of twelve months with the active ones filled. Screen readers get the range in words. */
export function MonthStrip({ label, months, kind, current }: { label: string; months: number[]; kind: 'sow' | 'plant' | 'harvest'; current?: number }) {
  const set = new Set(months);
  return (
    <div class="month-row">
      <span class="month-row-label">{label}</span>
      <span class="month-strip" role="img" aria-label={`${label}: ${monthRanges(months, true)}`}>
        {LETTERS.map((l, i) => (
          <span key={i} class={`month-cell ${set.has(i + 1) ? `on on-${kind}` : ''} ${current === i + 1 ? 'now' : ''}`}>
            {l}
          </span>
        ))}
      </span>
      <span class="month-row-text">{monthRanges(months)}</span>
    </div>
  );
}

interface Props {
  plant: Plant;
  byId: Map<string, Plant>;
  open: (id: string) => void;
  onCopy?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  /** Opens the plan to put this plant in a bed. */
  onPlant?: () => void;
  /** Whether it's on your Want to grow list, and a way to change that. */
  sowing?: { listed: boolean; toggle: () => void };
  /** Plantings of this plant on the plan, to jump to. */
  where?: { id: string; label: string }[];
  onShow?: (plantingId: string) => void;
  /** Packets in your seed tin for it, in words. */
  seeds?: string[];
  /** Opens the one-at-a-time plant check at this plant. */
  onCheck?: () => void;
  /** Show whether the notes are checked, the draft warning and the source: for whoever keeps the plant data. */
  editor?: boolean;
  month: number;
}

export function PlantCard({ plant: p, byId, open, onCopy, onEdit, onDelete, onPlant, sowing, where, onShow, onCheck, month, seeds, editor = false }: Props) {
  const app = useApp();
  const c = p.conditions;
  const s = p.size;
  const growth = growthText(p);
  const parent = p.varietyOf ? byId.get(p.varietyOf) : undefined;
  const kinds = p.varietyOf ? [] : varietiesOf([...byId.values()], p.id);
  const neighbours = (ids: string[]) =>
    ids.map((id) => byId.get(id)).filter((x): x is Plant => !!x);

  return (
    <article class="plant-card" aria-labelledby={`plant-${p.id}`}>
      <header class="plant-card-head">
        <div class="plant-card-art">
          <PlantIcon plant={p} size={120} />
        </div>
        <div class="plant-card-title">
          <h1 id={`plant-${p.id}`} class="plant-name">
            {p.commonName}
          </h1>
          {p.latinName && <p class="latin">{p.latinName}</p>}
          {parent && (
            <p class="small variety-of">
              A kind of{' '}
              <button type="button" class="link-btn" onClick={() => open(parent.id)}>
                {parent.commonName.toLowerCase()}
              </button>
            </p>
          )}
        </div>
        <div class="badges">
          <span class="badge">{CATEGORY_LABEL[p.category]}</span>
          {p.userAdded ? (
            <span class="badge badge-own">Your plant</span>
          ) : !editor ? null : p.verified ? (
            <span class="badge badge-ok">Checked{p.lastChecked ? ` ${p.lastChecked}` : ''}</span>
          ) : (
            <span class="badge badge-warn">Not yet checked</span>
          )}
        </div>
      </header>

      {editor && !p.userAdded && !p.verified && (
        <p class="message">
          These notes are a draft. Check them against the source at the bottom before relying on them.{' '}
          {onCheck && (
            <button type="button" class="link-btn" onClick={onCheck}>
              Check this plant
            </button>
          )}
        </p>
      )}
      <div class="button-row">
        {onPlant && (
          <button type="button" class="btn btn-primary" onClick={onPlant}>
            {p.category === 'weed' ? 'Mark where it grows' : 'Plant in a bed'}
          </button>
        )}
        {sowing && p.category !== 'weed' && (
          <button type="button" class={`btn heart${sowing.listed ? ' heart-on' : ''}`} aria-pressed={sowing.listed} title={sowing.listed ? 'On your Want to grow list' : 'Want to grow'} onClick={sowing.toggle}>
            <Icon name="heart" size={18} filled={sowing.listed} />
            {sowing.listed ? 'Want to grow' : 'Want to grow it?'}
          </button>
        )}
        {p.sowing?.some((s) => s.method !== 'direct') && (
          <button type="button" class="btn" onClick={() => app.sowInShed(p.id)}>
            Sow in the shed
          </button>
        )}
        {onCopy && (
          <button type="button" class="btn" onClick={onCopy}>
            Make my own version
          </button>
        )}
        {onEdit && (
          <button type="button" class="btn" onClick={onEdit}>
            Edit
          </button>
        )}
        {onDelete && (
          <button type="button" class="btn btn-danger" onClick={onDelete}>
            Delete
          </button>
        )}
      </div>

      {where && where.length > 0 && (
        <p class="where-growing">
          <span class="muted">Growing in </span>
          {where.map((w, i) => (
            <span key={w.id}>
              <button type="button" class="link-btn" onClick={() => onShow?.(w.id)}>
                {w.label}
              </button>
              {i < where.length - 2 ? ', ' : i === where.length - 2 ? ' and ' : ''}
            </span>
          ))}
        </p>
      )}

      {seeds && seeds.length > 0 && (
        <p class="seed-have">
          <span class="muted">In your seed tin: </span>
          {seeds.join('; ')}.
        </p>
      )}

      <section class="plant-section">
        <h2>At a glance</h2>
        <dl class="glance">
          <div>
            <dt>Light</dt>
            <dd>
              {LIGHT_LABEL[c.light]}
              {c.minSunHours ? `, ${c.minSunHours}+ hours of sun` : ''}
            </dd>
          </div>
          {c.soil && (
            <div>
              <dt>Soil</dt>
              <dd>{c.soil}</dd>
            </div>
          )}
          {c.moisture && (
            <div>
              <dt>Water</dt>
              <dd>{{ dry: 'Copes with dry soil', moderate: 'Moderate', moist: 'Keep moist' }[c.moisture]}</dd>
            </div>
          )}
          {c.hardiness && (
            <div>
              <dt>Hardiness</dt>
              <dd>{c.hardiness}</dd>
            </div>
          )}
          <div>
            <dt>Spacing</dt>
            <dd>
              {s.closeSpacingMm ? (
                <>
                  In a bed: {formatLength(s.closeSpacingMm)} each way
                  <br />
                  <span class="muted">
                    In rows: {formatLength(s.spacingMm)} apart{s.rowSpacingMm ? `, rows ${formatLength(s.rowSpacingMm)} apart` : ''}
                  </span>
                </>
              ) : (
                <>
                  {formatLength(s.spacingMm)} apart{s.rowSpacingMm ? `, rows ${formatLength(s.rowSpacingMm)}` : ''}
                </>
              )}
            </dd>
          </div>
          {p.family && (
            <div>
              <dt>Family</dt>
              <dd>
                {p.family}
                {FAMILY_NAME[p.family] ? `, ${FAMILY_NAME[p.family]}` : ''}
              </dd>
            </div>
          )}
          {p.pollinators && (
            <div>
              <dt>Pollinators</dt>
              <dd>{pollinatorText(p.pollinators)}</dd>
            </div>
          )}
          {(s.heightMm || s.spreadMm) && (
            <div>
              <dt>Size</dt>
              <dd>
                {s.heightMm ? `${formatLength(s.heightMm)} tall` : ''}
                {s.heightMm && s.spreadMm ? ', ' : ''}
                {s.spreadMm ? `${formatLength(s.spreadMm)} across` : ''}
              </dd>
            </div>
          )}
        </dl>
      </section>

      {(p.sowing?.length || p.plantOutMonths?.length || p.cropping || p.flowerMonths?.length) && (
        <section class="plant-section">
          <h2>Through the year</h2>
          <div class="month-rows">
            {p.sowing?.map((sw, i) => <MonthStrip key={i} label={METHOD_LABEL[sw.method]} months={sw.months} kind="sow" current={month} />)}
            {p.plantOutMonths?.length ? <MonthStrip label="Plant out" months={p.plantOutMonths} kind="plant" current={month} /> : null}
            {p.cropping && <MonthStrip label="Harvest" months={p.cropping.harvestMonths} kind="harvest" current={month} />}
            {p.flowerMonths?.length ? <MonthStrip label="In flower" months={p.flowerMonths} kind="harvest" current={month} /> : null}
          </div>
          <ul class="plain-list notes-list">
            {p.sowing?.map((sw, i) =>
              sw.notes || sw.depthMm ? (
                <li key={i}>
                  <strong>{METHOD_LABEL[sw.method]}</strong>
                  {sw.depthMm ? ` ${sw.depthMm} mm deep.` : '.'} {sw.notes}
                </li>
              ) : null,
            )}
            {p.cropping?.notes && (
              <li>
                <strong>Harvest.</strong> {p.cropping.notes}
              </li>
            )}
            {growth && (
              <li>
                <strong>{growth.label}.</strong> {growth.text}
              </li>
            )}
          </ul>
        </section>
      )}

      {kinds.length > 0 && (
        <section class="plant-section" aria-labelledby="plant-kinds-title">
          <h2 id="plant-kinds-title">Kinds to grow</h2>
          <ul class="plain-list kinds-list">
            {kinds.map((k) => (
              <li key={k.id}>
                <button type="button" class="link-btn" onClick={() => open(k.id)}>
                  {k.variety}
                </button>
                {k.lookOutFor?.[0] && k.lookOutFor[0] !== p.lookOutFor?.[0] ? <span class="muted">: {k.lookOutFor[0]}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      )}

      <PlantFeeding plant={p} />

      <PlantKitchen plant={p} plantOf={(id) => byId.get(id) ?? unknownPlant(id)} />

      {p.weed && (
        <section class="plant-section">
          <h2>A weed</h2>
          <ul class="plain-list">
            <li>Spreads {p.weed.spreads === 'seed' ? 'by seed' : p.weed.spreads === 'roots' ? 'by its roots' : 'by seed and by its roots'}.</li>
            {p.weed.wildlife && <li>{p.weed.wildlife}</li>}
            <li>{p.weed.removal}</li>
          </ul>
        </section>
      )}

      {p.lookOutFor?.length ? (
        <section class="plant-section">
          <h2>Look out for</h2>
          <ul class="plain-list">
            {p.lookOutFor.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {p.pests?.length ? (
        <section class="plant-section">
          <h2>Pests and problems</h2>
          <dl class="pests">
            {p.pests.map((x) => (
              <div key={x.name}>
                <dt>{x.name}</dt>
                <dd>
                  <span class="muted">Signs: </span>
                  {x.signs}
                </dd>
                <dd>
                  <span class="muted">What to do: </span>
                  {x.control}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      {p.companions && (p.companions.good.length > 0 || p.companions.avoid.length > 0) && (
        <section class="plant-section">
          <h2>Neighbours</h2>
          {p.companions.good.length > 0 && (
            <p>
              <span class="muted">Grows well with </span>
              {neighbours(p.companions.good).map((n, i, all) => (
                <span key={n.id}>
                  <button type="button" class="link-btn" onClick={() => open(n.id)}>
                    {n.commonName.toLowerCase()}
                  </button>
                  {i < all.length - 2 ? ', ' : i === all.length - 2 ? ' and ' : ''}
                </span>
              ))}
            </p>
          )}
          {p.companions.avoid.length > 0 && (
            <p>
              <span class="muted">Keep apart from </span>
              {neighbours(p.companions.avoid).map((n, i, all) => (
                <span key={n.id}>
                  <button type="button" class="link-btn" onClick={() => open(n.id)}>
                    {n.commonName.toLowerCase()}
                  </button>
                  {i < all.length - 2 ? ', ' : i === all.length - 2 ? ' and ' : ''}
                </span>
              ))}
            </p>
          )}
          <p class="muted small">Companion planting is partly garden lore. Treat it as a guide.</p>
        </section>
      )}

      {p.wintering && (
        <section class="plant-section">
          <h2>Winter</h2>
          <p>
            <strong>{WINTER_LABEL[p.wintering.type]}.</strong> {p.wintering.notes}
          </p>
        </section>
      )}

      {editor ? (
        <section class="plant-section">
          <h2>Where this comes from</h2>
          <p class="small">{p.source || (p.userAdded ? 'Added by you.' : 'No source recorded.')}</p>
        </section>
      ) : (
        !p.userAdded && (
          <p class="small muted report-mistake">
            Spotted something wrong?{' '}
            <a href={reportUrl(p)} target="_blank" rel="noopener">
              Report a mistake
            </a>
          </p>
        )
      )}

    </article>
  );
}
