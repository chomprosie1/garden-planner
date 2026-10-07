// Three tips the first time you open the garden plan: picking and moving, the
// lock, and the timeline. Each one lights up what it's about. Dismissed for good
// with "Got it" or "Skip tips".

import { useEffect, useState } from 'preact/hooks';

interface Tip {
  title: string;
  text: (phone: boolean) => string;
  /** What it's about, to light up. */
  target: string;
}

export const TIPS: Tip[] = [
  {
    title: 'Pick and move',
    text: (phone) => `${phone ? 'Tap' : 'Click'} anything to pick it, and drag it to move it. Add beds, pots and plants from the bar along the bottom.`,
    target: '.plan-stage .sheet',
  },
  {
    title: 'The lock',
    text: () => 'Lock the layout and beds and paths stay put while you plant. Plants can still be moved.',
    target: '.lock-btn',
  },
  {
    title: 'Your garden through the year',
    text: (phone) => `${phone ? 'Drag' : 'Drag or press play on'} the timeline to see what’s growing, what’s ready and when beds stand empty, week by week.`,
    target: '.year-scrubber',
  },
];

export function PlanTips({ phone, done }: { phone: boolean; done: () => void }) {
  const [i, setI] = useState(0);
  const tip = TIPS[i]!;
  useEffect(() => {
    const el = document.querySelector(tip.target);
    el?.classList.add('tip-target');
    return () => el?.classList.remove('tip-target');
  }, [i]);
  const last = i === TIPS.length - 1;
  return (
    <div class="plan-tips" role="dialog" aria-label={`Tip ${i + 1} of ${TIPS.length}: ${tip.title}`}>
      <p class="eyebrow">
        Tip {i + 1} of {TIPS.length}
      </p>
      <p class="plan-tips-title">{tip.title}</p>
      <p>{tip.text(phone)}</p>
      <div class="button-row">
        <button type="button" class="btn btn-primary" onClick={() => (last ? done() : setI(i + 1))}>
          {last ? 'Got it' : 'Next'}
        </button>
        {!last && (
          <button type="button" class="btn btn-quiet" onClick={done}>
            Skip tips
          </button>
        )}
      </div>
    </div>
  );
}
