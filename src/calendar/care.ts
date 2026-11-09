// Looking after what's already growing: tidying and pruning fruit and herbs that
// have settled in, as the rest of the jobs look after what's being planted. From
// the RHS's growing guides, checked 30 Oct 2026:
// - strawberries (rhs.org.uk/fruit/strawberries/grow-your-own): summer-fruiting
//   kinds cut to about 10 cm above the crown once cropping's over, perpetual
//   kinds only tidied, the strongest runners kept and the rest taken off;
// - blackcurrants: every winter, up to a third of the oldest stems at the base;
// - red and white currants and gooseberries: late winter to early spring, while
//   dormant, with February the best month ("Winter pruning soft fruit bushes");
// - apples: free-standing trees in winter, trained ones in late summer;
// - chives: after flowering, the flower stalks or the clump cut to about 5 cm;
// - rosemary and thyme: a light trim after flowering, not into old wood.
// Pure: a plant and a month in, what to do out.

import { runEnds } from '../library/library';
import type { Plant } from '../model/types';

export interface Care {
  /** What the job says: "Prune", "Tidy". */
  verb: string;
  /** The months for it. Absent: the month its flowers finish. */
  months?: number[];
  text: string;
}

const CURRANT: Care = { verb: 'Prune', months: [2, 3], text: 'While it’s dormant, before the buds move: February’s best. Take out anything dead or damaged, cut last year’s growth on the main branches back by a quarter to a half, and side-shoots to one or two buds.' };
const APPLE: Care = { verb: 'Prune', months: [12, 1, 2], text: 'A free-standing tree is pruned in winter, while it’s bare. Take out dead, damaged and crossing wood first. A trained tree, such as a cordon, waits for late summer instead.' };

const CARE: Record<string, Care[]> = {
  strawberry: [
    { verb: 'Tidy', months: [8], text: 'Cropping’s over: cut the old leaves off about 10 cm above the crown, so fresh ones can grow. Clear away any straw or matting.' },
    { verb: 'Tidy', months: [10], text: 'Keep the strongest runners to fill gaps or replace tired plants, and take off the rest. Weed round the plants.' },
  ],
  // Perpetual kinds crop on: no cutting back.
  'strawberry-everbearer': [{ verb: 'Tidy', months: [10], text: 'Pull off dead, damaged or diseased leaves. There’s no need to cut it back, as you would a summer-fruiting kind. Keep the strongest runners to replace tired plants, and take off the rest.' }],
  blackcurrant: [{ verb: 'Prune', months: [11, 12, 1, 2], text: 'Cut up to a third of the oldest, darkest stems out at the base: blackcurrants fruit best on strong young growth.' }],
  redcurrant: [CURRANT],
  whitecurrant: [CURRANT],
  gooseberry: [{ ...CURRANT, text: 'While it’s dormant, before the buds move: February’s best. Take out anything dead or damaged, and one to three older branches, or cut last year’s growth on the main branches to three or four buds.' }],
  apple: [APPLE],
  pear: [{ ...APPLE, text: 'A free-standing tree is pruned in winter, while it’s bare. Take out dead, damaged and crossing wood first.' }],
  chives: [{ verb: 'Trim', text: 'Now it’s finished flowering, snip out the flower stalks at the base, or cut the clump to about 5 cm for a flush of fresh leaves.' }],
  rosemary: [{ verb: 'Trim', text: 'Now the flowers have faded, trim it lightly to keep it compact. Don’t cut back into old wood.' }],
  thyme: [{ verb: 'Trim', text: 'Now it’s finished flowering, trim it lightly. Don’t cut into old wood: it may not grow back.' }],
};

/** What wants doing this month for a plant that's settled in, by its own name or the plant it's a kind of. */
export function careFor(plant: Plant, month: number): Care[] {
  const list = CARE[plant.id] ?? (plant.varietyOf ? CARE[plant.varietyOf] : undefined) ?? (plant.basedOn ? CARE[plant.basedOn] : undefined) ?? [];
  return list.filter((c) => (c.months ?? runEnds(plant.flowerMonths ?? [])).includes(month));
}

/** Planted this long ago, a plant's settled in: a blackcurrant planted last month isn't pruned, days. */
export const SETTLED_DAYS = 180;
