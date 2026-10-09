// Release 19: help. Every topic leads somewhere real, reads for a phone and for
// a computer, and can be found by the words someone stuck would type. The words
// themselves are checked by words.test.ts.

import { describe, expect, it } from 'vitest';
import { HELP, helpByTier, helpTopic, stepText } from '../src/content/help';
import { newAppState } from '../src/model/defaults';
import { unknownPlant } from '../src/planting/place';
import { defaultPrefs, sanitisePrefs, VIEWS, viewForHash } from '../src/theme/prefs';
import { queryWords, search } from '../src/ui/search';

const ctx = { garden: newAppState().garden, plants: [], plantOf: unknownPlant, locked: false };

describe('help topics', () => {
  it('each has a unique id, a real screen and real related topics', () => {
    expect(new Set(HELP.map((t) => t.id)).size).toBe(HELP.length);
    for (const t of HELP) {
      expect(VIEWS, t.id).toContain(t.view);
      expect(t.steps.length, t.id).toBeGreaterThanOrEqual(3);
      expect(t.steps.length, t.id).toBeLessThanOrEqual(6);
      for (const id of t.related) {
        expect(helpTopic(id), `${t.id} → ${id}`).toBeTruthy();
        expect(id).not.toBe(t.id);
      }
    }
  });

  it('reads for a phone and for a computer, with neither left empty', () => {
    for (const t of HELP)
      for (const s of t.steps) {
        expect(stepText(s, true).trim().length, t.id).toBeGreaterThan(10);
        expect(stepText(s, false).trim().length, t.id).toBeGreaterThan(10);
      }
    // A computer's steps talk about clicking, a phone's about tapping, where they differ.
    for (const t of HELP)
      for (const s of t.steps)
        if (typeof s !== 'string') {
          expect(s.phone, t.id).not.toMatch(/\bclick/i);
          expect(s.computer, t.id).not.toMatch(/\btap\b/i);
        }
  });

  it('covers the first session first: setting up, drawing and adding plants', () => {
    const first = helpByTier()[0]!;
    expect(first.tier).toBe(1);
    for (const id of ['setting-up', 'drawing-the-plan', 'adding-plants', 'plants-in-pots']) expect(first.topics.map((t) => t.id)).toContain(id);
  });

  it('has the topics the "Stuck?" notes and links open', () => {
    for (const id of ['drawing-the-plan', 'adding-plants', 'sowing']) expect(helpTopic(id), id).toBeTruthy();
  });
});

describe('finding help', () => {
  const first = (q: string) => search(q, ctx).find((r) => r.group === 'Help');

  it('finds a topic by the words someone stuck would use', () => {
    expect(first('how do I trace a photo')?.command).toEqual({ kind: 'help', id: 'tracing-a-photo' });
    expect(first('plant won’t go in pot')?.command).toEqual({ kind: 'help', id: 'plants-in-pots' });
    expect(first('draw boundary')?.command).toEqual({ kind: 'help', id: 'drawing-the-plan' });
    expect(first('sow seeds')?.command).toEqual({ kind: 'help', id: 'sowing' });
  });

  it('opens at a topic from the address, and the list without one', () => {
    expect(viewForHash('help')).toBe('help');
    expect(search('help', ctx).some((r) => r.command.kind === 'go' && r.command.view === 'help')).toBe(true);
  });
});

describe('asking a question', () => {
  it('leaves off how a question starts, but not words in the middle', () => {
    expect(queryWords('How do I trace a photo?')).toEqual(['trace', 'photo']);
    expect(queryWords('why does it say nowhere to plant')).toEqual(['say', 'nowhere', 'plant']);
    expect(queryWords('when is it ready')).toEqual(['when', 'is', 'it', 'ready']);
    expect(queryWords('how')).toEqual(['how']);
  });
});

describe('“Stuck?” notes', () => {
  it('remembers which have been offered, and drops anything that isn’t a name', () => {
    expect(defaultPrefs().stuckSeen).toEqual([]);
    expect(sanitisePrefs({ ...defaultPrefs(), stuckSeen: ['plan-empty', 3, null] }).stuckSeen).toEqual(['plan-empty']);
    expect(sanitisePrefs({ ...defaultPrefs(), stuckSeen: 'plan-empty' }).stuckSeen).toEqual([]);
  });
});
