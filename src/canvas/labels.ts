// Labels on the plan keep clear of each other: each takes its place in turn, and
// one that would land on another is left off rather than piled on top. Tapping
// says what's there, so a name left off isn't lost.

export interface LabelBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

const clash = (a: LabelBox, b: LabelBox) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** Takes a place for a label if it's free, and says whether it was. */
export function claim(taken: LabelBox[], box: LabelBox): boolean {
  if (taken.some((t) => clash(t, box))) return false;
  taken.push(box);
  return true;
}
