import { describe, expect, it } from 'vitest';
import { newAppState } from '../src/model/defaults';
import { createStore, updateGarden } from '../src/model/store';

const rename = (name: string) => updateGarden((g) => (g.name === name ? g : { ...g, name }));

describe('store', () => {
  it('applies changes and notifies subscribers', () => {
    const store = createStore(newAppState());
    const seen: string[] = [];
    store.subscribe((s) => seen.push(s.garden.name));
    store.apply(rename('Allotment'));
    expect(store.get().garden.name).toBe('Allotment');
    expect(seen).toEqual(['Allotment']);
  });

  it('ignores changes that change nothing', () => {
    const store = createStore(newAppState());
    store.apply(rename('My garden'));
    expect(store.canUndo()).toBe(false);
  });

  it('undoes and redoes, and a new change clears redo', () => {
    const store = createStore(newAppState());
    store.apply(rename('A'));
    store.apply(rename('B'));
    store.undo();
    expect(store.get().garden.name).toBe('A');
    store.redo();
    expect(store.get().garden.name).toBe('B');
    store.undo();
    store.apply(rename('C'));
    expect(store.canRedo()).toBe(false);
    store.undo();
    store.undo();
    expect(store.get().garden.name).toBe('My garden');
    expect(store.canUndo()).toBe(false);
  });

  it('keeps at most the history limit', () => {
    const store = createStore(newAppState(), 3);
    for (const n of ['1', '2', '3', '4', '5']) store.apply(rename(n));
    let undos = 0;
    while (store.canUndo()) {
      store.undo();
      undos++;
    }
    expect(undos).toBe(3);
    expect(store.get().garden.name).toBe('2');
  });

  it('replace clears history', () => {
    const store = createStore(newAppState());
    store.apply(rename('A'));
    store.replace(newAppState());
    expect(store.canUndo()).toBe(false);
  });
});
