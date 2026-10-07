// Phone controls for the plan: a bar for each part of the plan, a drawing bar that works with the
// crosshair, and a bottom sheet for details.

import { useState } from 'preact/hooks';
import { parseLength } from '../canvas/snap';
import { KINDS } from '../model/features';
import type { FeatureKind } from '../model/types';
import type { ComponentChildren } from 'preact';
import { canDrawByHand, geometryForTool, type CanvasApi, type Placing, type Tool } from './PlanCanvas';

/** Sizes offered when placing a rectangle by size. */
const DEFAULT_SIZE: Partial<Record<Tool, [number, number]>> = {
  boundary: [10000, 15000],
  bed: [2400, 1200],
  building: [2400, 1800],
  greenhouse: [2400, 1800],
  'cold-frame': [1200, 600],
  compost: [1000, 1000],
  surface: [3000, 2000],
  water: [1500, 1000],
  other: [1000, 1000],
};

/** Drawing a shape with a finger: one finger draws, two move the plan. */
export function PhoneHandBar({ tool, message, useCorners, cancel }: { tool: Tool; message: string | null; useCorners: () => void; cancel: () => void }) {
  const name = KINDS[tool as FeatureKind]?.label.toLowerCase() ?? '';
  const area = geometryForTool(tool) === 'area';
  return (
    <div class="draw-bar">
      <p class="draw-hint" role="status">
        {message ?? `Draw the ${name} with one finger${area ? ', all the way round its edge' : ', along its middle'}. Two fingers move and zoom the plan.`}
      </p>
      <div class="draw-buttons">
        <button type="button" class="btn" onClick={cancel}>
          Cancel
        </button>
        <button type="button" class="btn" onClick={useCorners}>
          Use corners instead
        </button>
      </div>
    </div>
  );
}

interface DrawBarProps {
  tool: Tool;
  corners: number;
  api: { current: CanvasApi | null };
  /** Switches to drawing this shape by hand. */
  byHand?: () => void;
}

type Panel = 'main' | 'length' | 'size';

/** Buttons for drawing with the crosshair. */
export function PhoneDrawBar({ tool, corners, api, byHand }: DrawBarProps) {
  const geometry = geometryForTool(tool);
  const [panel, setPanel] = useState<Panel>('main');
  const [length, setLength] = useState('');
  const [w, setW] = useState(String(DEFAULT_SIZE[tool]?.[0] ?? 2000));
  const [h, setH] = useState(String(DEFAULT_SIZE[tool]?.[1] ?? 1000));
  const [spread, setSpread] = useState(String((KINDS[tool as FeatureKind]?.radiusMm ?? 2000) * 2));
  const [error, setError] = useState('');
  const name = tool === 'boundary' ? 'boundary' : KINDS[tool as FeatureKind]?.label.toLowerCase() ?? '';
  const minCorners = geometry === 'area' ? 3 : 2;

  const placeLength = (e: Event) => {
    e.preventDefault();
    const mm = parseLength(length);
    if (!mm) return setError('Type a length, such as 3450 or 3.45 m.');
    const problem = api.current?.typeLength(mm);
    if (problem) return setError(problem);
    setLength('');
    setError('');
    setPanel('main');
  };

  const placeSize = (e: Event) => {
    e.preventDefault();
    const W = parseLength(w);
    const H = parseLength(h);
    if (!W || !H) return setError('Type a width and a depth, such as 2400 and 1200.');
    api.current?.placeRect(W, H);
  };

  const hint =
    geometry === 'circle'
      ? `Drag the plan to put the crosshair on the middle of the ${name}, then place it.`
      : corners === 0
        ? `Drag the plan to put the crosshair on the first corner of the ${name}, then tap Add corner.`
        : `Move the crosshair to the next corner and tap Add corner, or type the length of this side.`;

  if (geometry === 'circle')
    return (
      <form class="draw-bar" onSubmit={(e) => {
        e.preventDefault();
        const mm = parseLength(spread);
        if (!mm) return setError('Type the spread across, such as 4000 or 4 m.');
        api.current?.placeCircle(mm / 2);
      }}>
        <p class="draw-hint">{hint}</p>
        <label class="field">
          Spread across
          <input inputMode="decimal" value={spread} onInput={(e) => setSpread((e.currentTarget as HTMLInputElement).value)} />
        </label>
        {error && <p class="message">{error}</p>}
        <div class="draw-buttons">
          <button type="button" class="btn" onClick={() => api.current?.cancel()}>
            Cancel
          </button>
          <button type="submit" class="btn btn-primary">
            Place {name} here
          </button>
        </div>
      </form>
    );

  if (panel === 'length')
    return (
      <form class="draw-bar" onSubmit={placeLength}>
        <label class="field">
          Length of this side, towards the crosshair
          <input autoFocus inputMode="decimal" placeholder="e.g. 3450 or 3.45 m" value={length} onInput={(e) => setLength((e.currentTarget as HTMLInputElement).value)} />
        </label>
        {error && <p class="message">{error}</p>}
        <div class="draw-buttons">
          <button type="button" class="btn" onClick={() => { setPanel('main'); setError(''); }}>
            Back
          </button>
          <button type="submit" class="btn btn-primary">
            Place corner
          </button>
        </div>
      </form>
    );

  if (panel === 'size')
    return (
      <form class="draw-bar" onSubmit={placeSize}>
        <p class="draw-hint">The {name} is placed centred on the crosshair. You can adjust it afterwards.</p>
        <div class="field-row">
          <label class="field">
            Width (mm)
            <input inputMode="decimal" value={w} onInput={(e) => setW((e.currentTarget as HTMLInputElement).value)} />
          </label>
          <label class="field">
            Depth (mm)
            <input inputMode="decimal" value={h} onInput={(e) => setH((e.currentTarget as HTMLInputElement).value)} />
          </label>
        </div>
        {error && <p class="message">{error}</p>}
        <div class="draw-buttons">
          <button type="button" class="btn" onClick={() => { setPanel('main'); setError(''); }}>
            Back
          </button>
          <button type="submit" class="btn btn-primary">
            Place here
          </button>
        </div>
      </form>
    );

  return (
    <div class="draw-bar">
      <p class="draw-hint">{hint}</p>
      {error && <p class="message">{error}</p>}
      <div class="draw-buttons">
        <button type="button" class="btn" onClick={() => api.current?.cancel()}>
          Cancel
        </button>
        <button type="button" class="btn" disabled={corners === 0} onClick={() => api.current?.undoCorner()}>
          Undo corner
        </button>
        {geometry === 'area' && corners === 0 && (
          <button type="button" class="btn" onClick={() => { setError(''); setPanel('size'); }}>
            By size
          </button>
        )}
        {byHand && canDrawByHand(tool) && corners === 0 && (
          <button type="button" class="btn" onClick={byHand}>
            By hand
          </button>
        )}
        <button type="button" class="btn" disabled={corners === 0} onClick={() => { setError(''); setPanel('length'); }}>
          Type length
        </button>
        <button type="button" class="btn btn-primary" onClick={() => { setError(''); api.current?.addCorner(); }}>
          Add corner
        </button>
        <button type="button" class="btn btn-primary" disabled={corners < minCorners} onClick={() => api.current?.finish()}>
          Done
        </button>
      </div>
    </div>
  );
}

/** A sheet along the bottom of the plan; tap its header to expand or collapse. */
export function PhoneSheet({ title, open, setOpen, onClose, children, fixed = false }: { title: string; open: boolean; setOpen: (o: boolean) => void; onClose: () => void; children: ComponentChildren; /** Always open: no expand or collapse. */ fixed?: boolean }) {
  return (
    <section class={`phone-sheet ${open ? 'open' : ''}`} aria-label={title}>
      <header class="phone-sheet-head">
        <button type="button" class="phone-sheet-toggle" aria-expanded={fixed ? undefined : open} disabled={fixed} onClick={() => setOpen(!open)}>
          <span class="phone-sheet-grip" aria-hidden="true" />
          <span class="phone-sheet-title">{title}</span>
          {!fixed && <span class="muted small">{open ? 'Hide details' : 'Details'}</span>}
        </button>
        <button type="button" class="icon-btn" aria-label="Close" onClick={onClose}>
          ✕
        </button>
      </header>
      {open && <div class="phone-sheet-body">{children}</div>}
    </section>
  );
}

interface PlantingBarProps {
  placing: Placing;
  setLayout: (l: Placing['layout']) => void;
  growing: boolean;
  setGrowing: (g: boolean) => void;
  /** Points placed so far: the start of a row or block. */
  points: number;
  api: { current: CanvasApi | null };
  message: string | null;
  changePlant: () => void;
  done: () => void;
  phone: boolean;
}

const LAYOUT_NAMES: [Placing['layout'], string][] = [
  ['auto', 'Fill for me'],
  ['single', 'One'],
  ['row', 'Row'],
  ['block', 'Block'],
];

/** Placing a plant: tap (or click) a bed. "Fill for me" plants it the usual way for the plant. */
export function PlantingBar({ placing, setLayout, growing, setGrowing, points, api, message, changePlant, done, phone }: PlantingBarProps) {
  const { plant, layout } = placing;
  const name = plant.commonName.toLowerCase();
  const tap = phone ? 'Tap' : 'Click';
  const started = points > 0 && (layout === 'row' || layout === 'block');
  const hint =
    layout === 'auto' || layout === 'single'
      ? `${tap} a bed, pot or planter to plant ${name}${layout === 'auto' ? ', filled the usual way' : ''}.`
      : layout === 'row'
        ? started
          ? `${tap} the other end of the row.`
          : `${tap} where the row of ${name} starts${phone ? '' : ', or drag along it'}.`
        : started
          ? `${tap} the opposite corner of the block.`
          : `${tap} one corner of the block${phone ? '' : ', or drag across it'}.`;
  return (
    <div class="draw-bar planting-bar">
      <div class="plant-bar-head">
        <strong>{plant.commonName}</strong>
        <div class="choice-row choice-small" role="radiogroup" aria-label="Lay out as">
          {LAYOUT_NAMES.map(([value, label]) => (
            <label key={value} class="choice-option">
              <input type="radio" name="planting-layout" value={value} checked={layout === value} onChange={() => setLayout(value)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <label class="check small">
          <input type="checkbox" checked={growing} onChange={(e) => setGrowing((e.currentTarget as HTMLInputElement).checked)} />
          Already in the ground
        </label>
      </div>
      <p class="draw-hint" role="status">
        {message ?? hint}
      </p>
      <div class="draw-buttons">
        <button type="button" class="btn" onClick={changePlant}>
          Change plant
        </button>
        {started && (
          <button type="button" class="btn" onClick={() => api.current?.undoCorner()}>
            Undo
          </button>
        )}
        <button type="button" class="btn btn-primary" onClick={done}>
          Done
        </button>
      </div>
    </div>
  );
}
