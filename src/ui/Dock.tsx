// The dock along the bottom of the plan: plants, beds and pots, ground,
// structures, and precise drawing. Drag a sticker onto the plan, or tap it to
// drop it in the middle of the view.

import { useMemo, useState } from 'preact/hooks';
import { canSowIn } from '../library/library';
import { traysOf } from '../lifecycle/shed';
import { newAppState } from '../model/defaults';
import { KINDS } from '../model/features';
import { STICKERS, stickerFeature, type Sticker, type StickerGroup } from '../model/stickers';
import type { FeatureKind, Garden, Plant } from '../model/types';
import { Icon, type IconName } from './icons';
import { MiniPlan } from './MiniPlan';
import { canDrawByHand, PLANT_DRAG_TYPE, STICKER_DRAG_TYPE, TRAY_DRAG_TYPE, type Tool } from './PlanCanvas';
import { PlantIcon } from './PlantIcon';

export type Drawer = 'plants' | StickerGroup | 'draw';

const DRAWERS: { id: Drawer; label: string; icon: IconName }[] = [
  { id: 'plants', label: 'Plants', icon: 'plants' },
  { id: 'beds', label: 'Beds and pots', icon: 'pot' },
  { id: 'ground', label: 'Ground', icon: 'ground' },
  { id: 'build', label: 'Structures', icon: 'build' },
  { id: 'draw', label: 'Draw', icon: 'pencil' },
];

/** A sticker as it'll look on the plan, drawn by the plan's own renderer. */
function StickerIcon({ sticker, size = 52 }: { sticker: Sticker; size?: number }) {
  const garden = useMemo<Garden>(() => ({ ...newAppState().garden, features: [stickerFeature(sticker, [0, 0])] }), [sticker.id]);
  return <MiniPlan garden={garden} width={size} class="sticker-icon" />;
}

/** Precise drawing: click corners and type lengths, for boundaries and shapes of any size. */
const DRAW_TOOLS: { tool: Tool; label: string }[] = [
  { tool: 'boundary', label: 'Boundary' },
  { tool: 'bed', label: 'Bed' },
  { tool: 'surface', label: 'Surface' },
  { tool: 'path', label: 'Path' },
  { tool: 'fence', label: 'Fence' },
  { tool: 'wall', label: 'Wall' },
  { tool: 'hedge', label: 'Hedge' },
  { tool: 'building', label: 'Building' },
  { tool: 'greenhouse', label: 'Greenhouse' },
  { tool: 'cold-frame', label: 'Cold frame' },
  { tool: 'planter', label: 'Planter' },
  { tool: 'pot', label: 'Pot' },
  { tool: 'tree', label: 'Tree' },
  { tool: 'compost', label: 'Compost' },
  { tool: 'water', label: 'Water' },
  { tool: 'other', label: 'Other' },
];

type PlantFilter = 'now' | 'mine' | 'list' | 'shed' | 'all';

interface Props {
  open: Drawer | null;
  setOpen: (d: Drawer | null) => void;
  plants: Plant[] | null;
  plantOf: (id: string) => Plant;
  garden: Garden;
  month: number;
  /** Tap a plant: plant it with the next tap on a bed. */
  onPlant: (id: string) => void;
  onTray: (id: string) => void;
  /** Tap a sticker: drop it in the middle of the view. */
  onSticker: (id: string) => void;
  tool: Tool;
  setTool: (t: Tool) => void;
  byHand: boolean;
  setByHand: (b: boolean) => void;
  phone: boolean;
}

export function Dock({ open, setOpen, plants, plantOf, garden, month, onPlant, onTray, onSticker, tool, setTool, byHand, setByHand, phone }: Props) {
  const trays = traysOf(garden);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PlantFilter>('now');
  const shown = useMemo(() => {
    if (!plants) return [];
    const q = query.trim().toLowerCase();
    if (q) return plants.filter((p) => `${p.commonName} ${p.latinName ?? ''}`.toLowerCase().includes(q));
    if (filter === 'now') return plants.filter((p) => canSowIn(p, month));
    if (filter === 'mine') return plants.filter((p) => p.userAdded);
    if (filter === 'list') return [...new Set(garden.wishlist)].map(plantOf);
    if (filter === 'all') return plants;
    return [];
  }, [plants, query, filter, month, garden.wishlist]);
  const filters: [PlantFilter, string, number][] = [
    ['now', 'Sow or plant now', plants ? plants.filter((p) => canSowIn(p, month)).length : 0],
    ['shed', 'In the shed', trays.length],
    ['list', 'Want to grow', garden.wishlist.length],
    ['mine', 'Your plants', plants ? plants.filter((p) => p.userAdded).length : 0],
    ['all', 'All plants', plants?.length ?? 0],
  ];

  return (
    <div class={`dock ${open ? 'dock-open' : ''} ${phone ? 'dock-phone' : ''}`}>
      {open && (
        <div class="dock-drawer" role="region" aria-label={DRAWERS.find((d) => d.id === open)!.label}>
          {open === 'plants' && (
            <>
              <div class="dock-plant-head">
                <label class="dock-search">
                  <Icon name="search" size={16} />
                  <span class="visually-hidden">Find a plant</span>
                  <input value={query} placeholder="Find a plant" onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)} />
                </label>
                {!query && (
                  <div class="dock-filters" role="radiogroup" aria-label="Show">
                    {filters
                      .filter(([id, , n]) => n > 0 || id === 'now' || id === 'all')
                      .map(([id, label, n]) => (
                        <button key={id} type="button" role="radio" class="chip" aria-checked={filter === id} onClick={() => setFilter(id)}>
                          {label}
                          {id !== 'all' && n > 0 ? <span class="chip-count">{n}</span> : null}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <ul class="dock-grid" aria-label="Plants">
                {!query && filter === 'shed'
                  ? trays.map((t) => {
                      const p = plantOf(t.plantId);
                      return (
                        <li key={t.id}>
                          <button
                            type="button"
                            class="sticker"
                            draggable={!phone}
                            onDragStart={(e) => e.dataTransfer?.setData(TRAY_DRAG_TYPE, t.id)}
                            onClick={() => onTray(t.id)}
                            title={`Plant out ${p.commonName}`}
                          >
                            <PlantIcon plant={p} size={40} stage={t.stage === 'hardening' ? 'transplanted' : 'germinated'} />
                            <span class="sticker-label">{p.commonName}</span>
                            <span class="sticker-size">{t.count} from the shed</span>
                          </button>
                        </li>
                      );
                    })
                  : shown.slice(0, 80).map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          class="sticker"
                          draggable={!phone}
                          onDragStart={(e) => {
                            e.dataTransfer?.setData(PLANT_DRAG_TYPE, p.id);
                            if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
                          }}
                          onClick={() => onPlant(p.id)}
                          title={`${p.commonName}: drag onto a bed, or tap then tap a bed`}
                        >
                          <PlantIcon plant={p} size={40} />
                          <span class="sticker-label">{p.commonName}</span>
                        </button>
                      </li>
                    ))}
                {!plants && <li class="muted small">Loading plants…</li>}
                {plants && !query && filter === 'list' && garden.wishlist.length === 0 && <li class="muted small">Nothing here yet. Tap the heart on a plant you want to grow.</li>}
                {plants && query && shown.length === 0 && <li class="muted small">No plants match.</li>}
              </ul>
            </>
          )}
          {(open === 'beds' || open === 'ground' || open === 'build') && (
            <ul class="dock-grid" aria-label="Things to add">
              {STICKERS.filter((s) => s.group === open).map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    class="sticker"
                    draggable={!phone}
                    onDragStart={(e) => {
                      e.dataTransfer?.setData(STICKER_DRAG_TYPE, s.id);
                      if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => onSticker(s.id)}
                    title={`${s.label}, ${s.size}: drag onto the plan, or tap to add it in the middle`}
                  >
                    <StickerIcon sticker={s} />
                    <span class="sticker-label">{s.label}</span>
                    <span class="sticker-size">{s.size}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {open === 'draw' && (
            <div class="dock-draw">
              <p class="muted small">Precise drawing: click each corner, or {phone ? 'use the crosshair' : 'drag a rectangle'}, and type exact lengths as you go.</p>
              <div class="dock-tools">
                {DRAW_TOOLS.map((t) => (
                  <button key={t.tool} type="button" class="tool" aria-pressed={tool === t.tool} onClick={() => setTool(tool === t.tool ? 'select' : t.tool)}>
                    {t.label}
                  </button>
                ))}
              </div>
              <div class="dock-tools">
                <button type="button" class="tool" aria-pressed={byHand} title="Draw areas and lines by hand, as smooth curves" onClick={() => setByHand(!byHand)}>
                  By hand
                </button>
                <button type="button" class="tool" aria-pressed={tool === 'sketch'} onClick={() => setTool(tool === 'sketch' ? 'select' : 'sketch')}>
                  Sketch
                </button>
                {byHand && !canDrawByHand(tool) && tool !== 'select' && <span class="muted small">By hand works for areas and lines: {KINDS[tool as FeatureKind]?.label ?? 'this'} uses corners.</span>}
              </div>
            </div>
          )}
        </div>
      )}
      <nav class="dock-tabs" aria-label="Add to the plan">
        {DRAWERS.map((d) => (
          <button key={d.id} type="button" class="dock-tab" aria-expanded={open === d.id} onClick={() => setOpen(open === d.id ? null : d.id)}>
            <Icon name={d.icon} size={20} />
            <span>{d.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
