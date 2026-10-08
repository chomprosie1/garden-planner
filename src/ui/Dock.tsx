// The dock along the bottom of the plan: plants, beds and pots, ground,
// structures, and precise drawing. Drag a sticker onto the plan, or tap it to
// drop it in the middle of the view.

import { useMemo, useRef, useState } from 'preact/hooks';
import { canSowIn } from '../library/library';
import { traysOf } from '../lifecycle/shed';
import { newAppState } from '../model/defaults';
import { KINDS } from '../model/features';
import { STICKERS, stickerById, stickerFeature, treeStickerId, type Sticker, type StickerGroup } from '../model/stickers';
import { findTrees, FRUIT_TREE_PLANTS, treeSizeText } from '../model/trees';
import { PLANT_SIZES, type FeatureKind, type Garden, type Plant, type PlantSize } from '../model/types';
import { SIZE_LABEL } from '../planting/place';
import { DRAWERS_IN, showsSticker, type PlanMode } from './planMode';
import { Icon, type IconName } from './icons';
import { MiniPlan } from './MiniPlan';
import { canDrawByHand, PLANT_DRAG_TYPE, STICKER_DRAG_TYPE, TRAY_DRAG_TYPE, type Tool } from './PlanCanvas';
import { PlantIcon } from './PlantIcon';

export type Drawer = 'plants' | StickerGroup | 'draw';

const DRAWERS: { id: Drawer; label: string; icon: IconName }[] = [
  { id: 'plants', label: 'Plants', icon: 'plants' },
  { id: 'beds', label: 'Beds and pots', icon: 'pot' },
  { id: 'ground', label: 'Ground', icon: 'ground' },
  { id: 'build', label: 'Trees and structures', icon: 'build' },
  { id: 'draw', label: 'Draw', icon: 'pencil' },
];

/** A sticker as it'll look on the plan, drawn by the plan's own renderer. */
function StickerIcon({ sticker, size = 52 }: { sticker: Sticker; size?: number }) {
  const garden = useMemo<Garden>(() => ({ ...newAppState().garden, features: [stickerFeature(sticker, [0, 0])] }), [sticker.id]);
  return <MiniPlan garden={garden} width={size} class="sticker-icon" />;
}

/**
 * Trees: about fifty kinds, favourites first, at a small, medium or large size. Fruit trees are plants, so they're
 * dropped as plants (on a lawn or in a bed) and keep their jobs and harvests.
 */
function TreeList({ phone, plants, onSticker, onPlant }: { phone: boolean; plants: Plant[] | null; onSticker: (id: string) => void; onPlant: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [size, setSize] = useState<PlantSize>('medium');
  const trees = findTrees(query);
  const q = query.trim().toLowerCase();
  const fruit = (plants ?? []).filter((p) => FRUIT_TREE_PLANTS.includes(p.id) && (!q || `${p.commonName} ${p.latinName ?? ''} fruit`.toLowerCase().includes(q)));
  return (
    <section class="dock-trees" aria-label="Trees">
      <h3 class="dock-subhead">Trees</h3>
      <div class="dock-plant-head">
        <label class="dock-search">
          <Icon name="search" size={16} />
          <span class="visually-hidden">Find a tree</span>
          <input value={query} placeholder="Find a tree" onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)} />
        </label>
        <div class="dock-filters" role="radiogroup" aria-label="Size">
          {PLANT_SIZES.map((s) => (
            <button key={s} type="button" role="radio" class="chip" aria-checked={size === s} onClick={() => setSize(s)}>
              {SIZE_LABEL[s]}
            </button>
          ))}
        </div>
      </div>
      <ul class="dock-grid" aria-label="Trees">
        {trees.map((tt) => {
          const id = treeStickerId(tt.id, size);
          const st = stickerById(id)!;
          return (
            <li key={tt.id}>
              <button
                type="button"
                class="sticker"
                draggable={!phone}
                onDragStart={(e) => {
                  e.dataTransfer?.setData(STICKER_DRAG_TYPE, id);
                  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => onSticker(id)}
                title={`${tt.name} (${tt.latinName}), ${treeSizeText(tt, size)}${tt.evergreen ? ', evergreen' : ''}: drag onto the plan, or tap to add it in the middle`}
              >
                <StickerIcon sticker={st} />
                <span class="sticker-label">{tt.name}</span>
                <span class="sticker-size">{st.size}</span>
              </button>
            </li>
          );
        })}
        {fruit.map((p) => (
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
              title={`${p.commonName}: a fruit tree, with its jobs and harvests. Drag onto a lawn or bed, or tap then tap where it goes. Choose its size once it's planted.`}
            >
              <PlantIcon plant={p} size={40} />
              <span class="sticker-label">{p.commonName}</span>
              <span class="sticker-size">Fruit tree</span>
            </button>
          </li>
        ))}
        {trees.length === 0 && fruit.length === 0 && <li class="muted small">No trees match.</li>}
      </ul>
    </section>
  );
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

type PlantFilter = 'now' | 'mine' | 'list' | 'shed' | 'all' | 'weeds';

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
  /** Simple: no Draw drawer, and the usual things in the others. */
  mode: PlanMode;
}

export function Dock({ open, setOpen, plants, plantOf, garden, month, onPlant, onTray, onSticker, tool, setTool, byHand, setByHand, phone, mode }: Props) {
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
    if (filter === 'all') return plants.filter((p) => p.category !== 'weed');
    if (filter === 'weeds') return plants.filter((p) => p.category === 'weed');
    return [];
  }, [plants, query, filter, month, garden.wishlist]);
  const filters: [PlantFilter, string, number][] = [
    ['now', 'Sow or plant now', plants ? plants.filter((p) => canSowIn(p, month)).length : 0],
    ['shed', 'In the shed', trays.length],
    ['list', 'Want to grow', garden.wishlist.length],
    ['mine', 'Your plants', plants ? plants.filter((p) => p.userAdded).length : 0],
    ['all', 'All plants', plants?.length ?? 0],
    ['weeds', 'Weeds', plants ? plants.filter((p) => p.category === 'weed').length : 0],
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
                          {id !== 'all' && id !== 'weeds' && n > 0 ? <span class="chip-count">{n}</span> : null}
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
              {STICKERS.filter((s) => s.group === open && showsSticker(mode, s.id)).map((s) => (
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
          {open === 'build' && <TreeList phone={phone} plants={plants} onSticker={onSticker} onPlant={onPlant} />}
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
        {DRAWERS.filter((d) => DRAWERS_IN[mode].includes(d.id)).map((d) => (
          <button key={d.id} type="button" class="dock-tab" aria-expanded={open === d.id} onClick={() => setOpen(open === d.id ? null : d.id)}>
            <Icon name={d.icon} size={20} />
            <span>{d.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

/**
 * While sun or shade is on, the dock folds to this handle along the bottom: tap it or pull it up for the tools, and
 * tap or pull it down to tuck them away again.
 */
export function ToolsHandle({ up, down }: { up?: () => void; down?: () => void }) {
  const start = useRef<number | null>(null);
  const pulled = useRef(false);
  const act = up ?? down!;
  return (
    <button
      type="button"
      class={`tools-handle ${up ? '' : 'tools-handle-open'}`}
      aria-expanded={!up}
      onPointerDown={(e) => {
        start.current = e.clientY;
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerUp={(e) => {
        const from = start.current;
        start.current = null;
        // A pull of a finger's width the right way counts; anything else is a tap, handled by the click.
        if (from !== null && Math.abs(e.clientY - from) > 24 && (up ? e.clientY < from : e.clientY > from)) {
          pulled.current = true;
          act();
        }
      }}
      onClick={() => {
        if (pulled.current) return void (pulled.current = false);
        act();
      }}
    >
      <span class="tools-handle-grip" aria-hidden="true" />
      {up ? 'Tools ▴' : 'Tuck the tools away ▾'}
    </button>
  );
}
