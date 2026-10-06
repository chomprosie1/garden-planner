import { monthRanges } from '../library/library';
import type { Light, Plant, Sowing } from '../model/types';
import { formatLength } from '../canvas/viewport';

export const LIGHT_LABEL: Record<Light, string> = { 'full-sun': 'Full sun', 'part-shade': 'Part shade', shade: 'Shade' };
export const METHOD_LABEL: Record<Sowing['method'], string> = {
  indoors: 'Sow indoors',
  direct: 'Sow outside',
  'cold-frame': 'Sow to transplant',
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
};

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
  month: number;
}

export function PlantCard({ plant: p, byId, open, onCopy, onEdit, onDelete, onPlant, month }: Props) {
  const c = p.conditions;
  const s = p.size;
  const neighbours = (ids: string[]) =>
    ids.map((id) => byId.get(id)).filter((x): x is Plant => !!x);

  return (
    <article class="plant-card" aria-labelledby={`plant-${p.id}`}>
      <header class="plant-card-head">
        <div>
          <h1 id={`plant-${p.id}`} class="plant-name">
            {p.commonName}
          </h1>
          {p.latinName && <p class="latin">{p.latinName}</p>}
        </div>
        <div class="badges">
          <span class="badge">{CATEGORY_LABEL[p.category]}</span>
          {p.userAdded ? (
            <span class="badge badge-own">Your plant</span>
          ) : p.verified ? (
            <span class="badge badge-ok">Checked{p.lastChecked ? ` ${p.lastChecked}` : ''}</span>
          ) : (
            <span class="badge badge-warn">Not yet checked</span>
          )}
        </div>
      </header>

      {!p.userAdded && !p.verified && (
        <p class="message">These notes are a draft. Check them against the source below before relying on them.</p>
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
              {formatLength(s.spacingMm)} apart{s.rowSpacingMm ? `, rows ${formatLength(s.rowSpacingMm)}` : ''}
            </dd>
          </div>
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

      {(p.sowing?.length || p.plantOutMonths?.length || p.cropping) && (
        <section class="plant-section">
          <h2>Through the year</h2>
          <div class="month-rows">
            {p.sowing?.map((sw, i) => <MonthStrip key={i} label={METHOD_LABEL[sw.method]} months={sw.months} kind="sow" current={month} />)}
            {p.plantOutMonths?.length ? <MonthStrip label="Plant out" months={p.plantOutMonths} kind="plant" current={month} /> : null}
            {p.cropping && <MonthStrip label="Harvest" months={p.cropping.harvestMonths} kind="harvest" current={month} />}
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

      <section class="plant-section">
        <h2>Where this comes from</h2>
        <p class="small">{p.source || (p.userAdded ? 'Added by you.' : 'No source recorded.')}</p>
      </section>

      <div class="button-row">
        {onPlant && (
          <button type="button" class="btn btn-primary" onClick={onPlant}>
            Plant in a bed
          </button>
        )}
        {onCopy && (
          <button type="button" class="btn" onClick={onCopy}>
            Make my own version
          </button>
        )}
        {onEdit && (
          <button type="button" class="btn btn-primary" onClick={onEdit}>
            Edit
          </button>
        )}
        {onDelete && (
          <button type="button" class="btn btn-danger" onClick={onDelete}>
            Delete
          </button>
        )}
      </div>
    </article>
  );
}
