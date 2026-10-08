// Small chips on the beds: the month's jobs (tap to tick one off) and, on a bed
// standing empty, when it's empty from and what could go in. The canvas keeps
// each group on its bed as the plan moves (data-world), and hides it when the
// bed is too small on screen to carry it (data-world-w).

import { JOB_LABEL, toggleJob, type Job, type JobKind } from '../calendar/jobs';
import { bounds } from '../geometry/polygon';
import { shortDate, type Gap } from '../lifecycle/projection';
import { todayIso } from '../model/ids';
import { updateGarden, type Store } from '../model/store';
import type { Feature, Garden, Plant } from '../model/types';
import { useApp } from './appContext';

const SHORT: Record<JobKind, string> = {
  'sow-indoors': 'Sow',
  'sow-direct': 'Sow',
  'plant-out': 'Plant out',
  check: 'Check',
  feed: 'Feed',
  harvest: 'Harvest',
  protect: 'Protect',
  lift: 'Lift',
  tidy: 'Clear',
  weed: 'Weed',
};

/** At most this many jobs on a bed; the rest are counted. */
const PER_BED = 2;

interface Props {
  garden: Garden;
  store: Store;
  plantOf: (id: string) => Plant;
  /** The month's jobs that aren't done, for the beds they're in. */
  jobs: Job[];
  /** Jobs can be ticked off in this month only: ticking dates plantings today. */
  canTick: boolean;
  gaps: Gap[];
  today: string;
  /** Plant this in the bed: the next tap on a bed plants it. */
  plant: (id: string) => void;
}

/** Where a bed's chips sit: the middle of its top edge, and how wide it is. Null for something with no shape. */
const anchor = (f: Feature) => {
  const c = f.circle;
  const b = c ? { minX: c.centre[0] - c.radiusMm, maxX: c.centre[0] + c.radiusMm, maxY: c.centre[1] + c.radiusMm } : bounds(f.footprint);
  return b ? { world: `${Math.round((b.minX + b.maxX) / 2)},${Math.round(b.maxY)}`, w: String(Math.round(b.maxX - b.minX)) } : null;
};

export function PlanChips({ garden, store, plantOf, jobs, canTick, gaps, today, plant }: Props) {
  const app = useApp();
  const byBed = new Map<string, Job[]>();
  const bedOf = new Map(garden.plantings.map((p) => [p.id, p.featureId]));
  for (const j of jobs) {
    const bed = j.featureId ?? (j.plantingIds[0] ? bedOf.get(j.plantingIds[0]) : undefined);
    if (bed) byBed.set(bed, [...(byBed.get(bed) ?? []), j]);
  }
  const gapBeds = new Set(gaps.map((g) => g.bed.id));
  const tick = (j: Job) => {
    store.apply(updateGarden((g) => toggleJob(g, j, todayIso(), plantOf)));
    app.notify(`Done: ${JOB_LABEL[j.kind].toLowerCase()}, ${j.plant.toLowerCase()}.`, { undo: true });
  };

  return (
    <>
      {[...byBed].map(([bedId, list]) => {
        const f = garden.features.find((x) => x.id === bedId);
        const a = f && !gapBeds.has(bedId) ? anchor(f) : null;
        if (!a) return null;
        const more = list.length - PER_BED;
        return (
          <div key={`jobs-${bedId}`} class="plan-chips" data-world={a.world} data-world-w={a.w}>
            {list.slice(0, PER_BED).map((j) => {
              const text = `${SHORT[j.kind]} ${j.plant.toLowerCase()}`;
              return canTick ? (
                <button key={j.key} type="button" class="plan-chip" title={`${JOB_LABEL[j.kind]}: ${j.plant}. Tap to tick it off.`} onClick={() => tick(j)}>
                  <span class="plan-chip-box" aria-hidden="true" />
                  {text}
                </button>
              ) : (
                <span key={j.key} class="plan-chip plan-chip-later" title={`${JOB_LABEL[j.kind]}: ${j.plant}. Tick it off in that month.`}>
                  {text}
                </span>
              );
            })}
            {more > 0 && (
              <button type="button" class="plan-chip plan-chip-more" title="All the month's jobs" onClick={() => app.go('month')}>
                +{more}
              </button>
            )}
          </div>
        );
      })}
      {gaps.map((gap) => {
        const a = anchor(gap.bed);
        if (!a) return null;
        const from = gap.emptyFrom && gap.emptyFrom > today ? `Empty from ${shortDate(gap.emptyFrom)}` : gap.until ? `Empty until ${shortDate(gap.until)}` : 'Empty';
        return (
          <div key={`gap-${gap.bed.id}`} class="plan-chips" data-world={a.world} data-world-w={a.w}>
            <span class="plan-chip plan-gap">
              {from}
              {gap.ideas.length > 0 && (
                <>
                  : sow{' '}
                  {gap.ideas.map((id, i) => (
                    <span key={id}>
                      {i > 0 && ' or '}
                      <button type="button" class="link-btn" title={`Plant ${plantOf(id).commonName.toLowerCase()} here`} onClick={() => plant(id)}>
                        {plantOf(id).commonName.toLowerCase()}
                      </button>
                    </span>
                  ))}
                  {gap.until ? ' first?' : '?'}
                </>
              )}
            </span>
          </div>
        );
      })}
    </>
  );
}
