// Release 19: help. Every topic leads somewhere real, reads for a phone and for
// a computer, and can be found by the words someone stuck would type. The words
// themselves are checked by words.test.ts.

import { describe, expect, it } from 'vitest';
import { HELP, helpByTier, helpTopic, stepText } from '../src/content/help';
import { newAppState } from '../src/model/defaults';
import { unknownPlant } from '../src/planting/place';
import { defaultPrefs, sanitisePrefs, VIEWS, viewForHash } from '../src/theme/prefs';
import { helpWords, queryWords, search } from '../src/ui/search';

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

describe('help for the rest (release 36)', () => {
  const top = (q: string) => search(q, ctx).find((r) => r.group === 'Help')?.command;
  const topic = (id: string) => ({ kind: 'help', id });

  it('says neither tap nor click in what both a phone and a computer read', () => {
    for (const t of HELP) for (const s of [...t.steps.filter((x): x is string => typeof x === 'string'), ...(t.notes ?? [])]) expect(s, t.id).not.toMatch(/\b(tap|taps|tapping|click|clicks|clicking)\b/i);
  });

  it('has the first week’s topics, and the ones for going further', () => {
    const tiers = Object.fromEntries(helpByTier().map((g) => [g.tier, g.topics.map((t) => t.id)]));
    for (const id of ['whats-happened', 'seed-tin', 'journal', 'reminders', 'backups']) expect(tiers[2], id).toContain(id);
    for (const id of ['climate', 'sun-and-shade', 'greenhouse', 'year-and-3d', 'sharing', 'gardens', 'your-own-plant', 'inspire']) expect(tiers[3], id).toContain(id);
  });

  it('finds them by the questions people type', () => {
    expect(top('how do I back up my garden')).toEqual(topic('backups'));
    expect(top('move to a new phone')).toEqual(topic('backups'));
    expect(top('my seedlings haven’t come up')).toEqual(topic('whats-happened'));
    expect(top('what does running behind mean')).toEqual(topic('whats-happened'));
    expect(top('seed packets')).toEqual(topic('seed-tin'));
    expect(top('frost warning')).toEqual(topic('reminders'));
    expect(top('when is the last frost')).toEqual(topic('climate'));
    expect(top('diary')).toEqual(topic('journal'));
    expect(top('which corner is shady')).toEqual(topic('sun-and-shade'));
    expect(top('polytunnel')).toEqual(topic('greenhouse'));
    expect(top('walk round in 3d')).toEqual(topic('year-and-3d'));
    expect(top('share on instagram')).toEqual(topic('sharing'));
    expect(top('second garden for my allotment')).toEqual(topic('gardens'));
    expect(top('my plant isn’t listed')).toEqual(topic('your-own-plant'));
    expect(top('what should I grow in my empty bed')).toEqual(topic('inspire'));
  });

  it('still needs the words that matter, and keeps a query that’s all filler', () => {
    expect(top('back up my piano')).toBeUndefined();
    expect(helpWords(['what', 'is', 'mulch'])).toEqual(['mulch']);
    expect(helpWords(['what'])).toEqual(['what']);
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
