// Soil: the garden's, and each bed's, and plants it doesn't suit. Pure functions.
//
// What each soil is like is from the RHS's "Soil types" page (checked 10 Oct 2026): clay drains slowly and is slow to
// warm in spring; sandy soil drains quickly and is often acid; chalky soil is very alkaline, often shallow and
// free-draining, and won't suit ericaceous (acid-loving) plants, which want a pH under 7; peat is mainly organic
// matter and holds much moisture. What a plant wants is the soil line on its own card, so a check never says more
// than the card does.

import type { Feature, Garden, GroundSoil, Plant, Soil } from '../model/types';

export const SOIL_LABEL: Record<Soil, string> = {
  clay: 'Clay',
  loam: 'Loam',
  sandy: 'Sandy',
  chalky: 'Chalky',
  peaty: 'Peaty',
  compost: 'Compost',
  ericaceous: 'Ericaceous compost',
};

/** What each ground soil is like, to help tell which you have. From the RHS's "Soil types". */
export const SOIL_HINT: Record<GroundSoil, string> = {
  clay: 'Heavy and fertile; drains slowly, and is slow to warm up in spring. A damp handful squeezes into a sticky ball.',
  loam: 'A mix of clay, sand and silt, without the extremes of each.',
  sandy: 'Light; drains quickly after rain, and is often acid. A damp handful feels gritty and falls apart.',
  chalky: 'Very alkaline, often shallow and free-draining, sometimes with lumps of white stone.',
  peaty: 'Mainly organic matter: fertile, and holds a lot of moisture. Seldom found in gardens.',
};

/** Pots, planters and grow bags are filled with compost unless you say otherwise. */
const fillsWithCompost = (f: Feature) => f.kind === 'pot' || f.kind === 'planter';

/** What a bed, pot or patch of ground is: its own soil, compost in a pot, or the garden's. Null: not known. */
export function soilOf(g: Garden, f: Feature | undefined): Soil | null {
  if (f?.soil) return f.soil;
  if (f && fillsWithCompost(f)) return 'compost';
  return g.soil ?? null;
}

/** Its pH, if known: its own, or the garden's where it's the garden's soil. */
export function phOf(g: Garden, f: Feature | undefined): number | null {
  if (f?.ph !== undefined) return f.ph;
  if (f && (f.soil || fillsWithCompost(f))) return null;
  return g.soilPh ?? null;
}

/** What a plant's card says it wants, in the terms a check can use. */
export interface SoilNeeds {
  /** Acid soil: "acid" alone, or "slightly acid". */
  acid?: 'acid' | 'slightly';
  /** Not acid: limy, chalky, "not acid". */
  lime?: boolean;
  /** Free-draining, gritty, sandy or light soil. */
  drained?: boolean;
  /** Wet or boggy ground. */
  wet?: boolean;
  /** The card's own words. */
  words: string;
}

export function soilNeeds(p: Plant): SoilNeeds | null {
  const words = p.conditions.soil?.trim();
  if (!words) return null;
  const w = words.toLowerCase();
  const needs: SoilNeeds = { words };
  const notAcid = /not acid/.test(w);
  if (!notAcid && /slightly acid/.test(w)) needs.acid = 'slightly';
  else if (!notAcid && /\bacid\b|ericaceous/.test(w)) needs.acid = 'acid';
  if (notAcid || /\blimy\b|\bchalky\b/.test(w)) needs.lime = true;
  // "Any, even heavy clay" is happy anywhere, and "add grit to heavy soil" copes with clay given grit. "Light" alone
  // isn't counted: "Light, moist" wants it damp.
  if (!/heavy (clay|soil)/.test(w) && /free-draining|gritty|\bsandy\b|very well-drained/.test(w)) needs.drained = true;
  if (/\bboggy\b|^wet\b/.test(w)) needs.wet = true;
  return needs.acid || needs.lime || needs.drained || needs.wet ? needs : null;
}

const lower = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);

/**
 * Why this soil doesn't suit this plant, as the end of a sentence ("wants acid soil, and Bed 1 is chalky"), or null
 * when it does, or when nothing's known. `place` is how the bed is named in the sentence.
 */
export function soilClash(p: Plant, soil: Soil | null, ph: number | null, place: string): string | null {
  const n = soilNeeds(p);
  if (!n || (!soil && ph === null)) return null;
  const card = `(its card says "${lower(n.words)}")`;
  if (n.acid) {
    const tooLimy = soil === 'chalky' || (ph !== null && (n.acid === 'acid' ? ph >= 7 : ph > 7));
    if (tooLimy) return `wants ${n.acid === 'slightly' ? 'slightly ' : ''}acid soil ${card}, and ${place} is ${soil === 'chalky' ? "chalky, which can't be made acid" : `pH ${ph}`}. A pot or bed of ericaceous compost suits it`;
    if (n.acid === 'acid' && soil === 'compost') return `wants acid soil ${card}, and ${place} is ordinary compost. Ericaceous compost suits it`;
  }
  if (n.lime && (soil === 'ericaceous' || (ph !== null && ph < 6))) return `doesn't want acid soil ${card}, and ${place} is ${soil === 'ericaceous' ? 'ericaceous compost' : `pH ${ph}`}`;
  if (n.drained && soil === 'clay') return `wants free-draining soil ${card}, and ${place} is clay, which drains slowly`;
  if (n.wet && (soil === 'sandy' || soil === 'chalky')) return `wants wet ground ${card}, and ${place} is ${soil === 'sandy' ? 'sandy, which drains quickly' : 'chalky, which is often free-draining'}`;
  return null;
}
