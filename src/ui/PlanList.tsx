// Everything on the plan as a list, each thing a button that picks it on the
// plan: the way in for a screen reader, or for anyone who finds small beds and
// pots hard to hit. It opens from a button just after the plan, and from its ···.

import { useEffect, useRef } from 'preact/hooks';
import { featureLabel, type Target } from '../model/features';
import type { Garden, Plant } from '../model/types';
import { currentStage, stageNow } from '../lifecycle/stages';
import { todayIso } from '../model/ids';
import { listBeds } from '../planting/listPlant';
import { isActive, plantCount } from '../planting/place';

interface Props {
  garden: Garden;
  plantOf: (id: string) => Plant;
  select: (t: Target) => void;
  close: () => void;
}

export function PlanList({ garden, plantOf, select, close }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const pick = (t: Target) => {
    select(t);
    ref.current?.close();
  };
  const beds = listBeds(garden);
  return (
    <dialog ref={ref} class="dialog" aria-labelledby="plan-list-title" onClose={close}>
      <div class="dialog-body">
        <h2 id="plan-list-title" class="title">
          Beds and plants
        </h2>
        {beds.length === 0 && <p class="muted">Nothing on the plan yet.</p>}
        <ul class="plan-list-beds">
          {beds.map((bed) => (
            <li key={bed.id}>
              <button type="button" class="btn" onClick={() => pick({ type: 'feature', id: bed.id })}>
                {featureLabel(bed)}
              </button>
              <ul>
                {garden.plantings
                  .filter((p) => p.featureId === bed.id && isActive(p))
                  .map((p) => {
                    const plant = plantOf(p.plantId);
                    const n = plantCount(p, plant);
                    return (
                      <li key={p.id}>
                        <button type="button" class="link-btn" onClick={() => pick({ type: 'planting', id: p.id })}>
                          {plant.commonName}
                          {n > 1 ? ` × ${n}` : ''}, {stageNow(plant, currentStage(p), p, todayIso()).toLowerCase()}
                        </button>
                      </li>
                    );
                  })}
              </ul>
            </li>
          ))}
        </ul>
        <div class="button-row">
          <button type="button" class="btn" onClick={() => ref.current?.close()}>
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
