// Dated notes on the garden, a bed, or one planting.

import { newId } from './ids';
import type { Garden, Note } from './types';

export function makeNote(text: string, date: string, on: { featureId?: string; plantingId?: string } = {}): Note {
  const n: Note = { id: newId('n'), date, text: text.trim() };
  if (on.featureId) n.featureId = on.featureId;
  if (on.plantingId) n.plantingId = on.plantingId;
  return n;
}

export const addNote = (g: Garden, n: Note): Garden => (n.text ? { ...g, notes: [...g.notes, n] } : g);

export function updateNote(g: Garden, id: string, patch: Partial<Pick<Note, 'text' | 'date'>>): Garden {
  if (!g.notes.some((n) => n.id === id)) return g;
  return { ...g, notes: g.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) };
}

export function deleteNote(g: Garden, id: string): Garden {
  const notes = g.notes.filter((n) => n.id !== id);
  return notes.length === g.notes.length ? g : { ...g, notes };
}

/** Newest first; notes written on the same day keep the order they were added, latest first. */
export function newestFirst(notes: Note[]): Note[] {
  return notes
    .map((n, i) => [n, i] as const)
    .sort(([a, i], [b, j]) => b.date.localeCompare(a.date) || j - i)
    .map(([n]) => n);
}
