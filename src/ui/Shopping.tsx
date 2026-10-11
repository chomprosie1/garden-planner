// The shopping list: seed, plants, compost and feed for what's planned and
// wanted, less what's in the seed tin and on the feed shelf. Tick things off as
// you buy them, and share what's left as text.

import { useEffect, useMemo, useRef } from 'preact/hooks';
import { todayIso } from '../model/ids';
import { updateGarden, type Store } from '../model/store';
import type { Garden, Plant } from '../model/types';
import { SHOP_KINDS, SHOP_LABEL, shoppingList, shoppingText, toggleBought, type ShopItem } from '../planting/shopping';
import { useApp } from './appContext';

export function ShoppingDialog({ garden, store, plantOf, feeding, close }: { garden: Garden; store: Store; plantOf: (id: string) => Plant; feeding: boolean; close: () => void }) {
  const app = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  const today = todayIso();
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  const items = useMemo(() => shoppingList(garden, plantOf, today, { feeding }), [garden, plantOf, today, feeding]);
  const toBuy = items.filter((i) => !i.bought);
  const groups = [...SHOP_KINDS.map((k) => ({ label: SHOP_LABEL[k], list: toBuy.filter((i) => i.kind === k) })), { label: 'Bought', list: items.filter((i) => i.bought) }].filter((g) => g.list.length);

  const tick = (i: ShopItem) => store.apply(updateGarden((g) => toggleBought(g, i.key, today)));
  const share = async () => {
    const text = shoppingText(items, garden.name);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Shopping list', text });
        return;
      } catch (e) {
        if ((e as Error).name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      app.notify('List copied: paste it into a message or a note.');
    } catch {
      app.notify('The list couldn’t be copied here.');
    }
  };

  return (
    <dialog ref={ref} class="dialog clear-dialog shop-dialog" aria-labelledby="shop-title" onClose={close}>
      <div class="dialog-body">
        <h2 id="shop-title" class="title">
          Shopping list
        </h2>
        {items.length === 0 ? (
          <p>Nothing to buy: everything planned has seed in the tin. Plan something, or tap the heart on plants you want to grow, and what you need shows here.</p>
        ) : (
          <>
            {groups.map((g) => (
              <fieldset key={g.label} class="clear-group">
                <legend>{g.label}</legend>
                <ul class="plain-list">
                  {g.list.map((i) => (
                    <li key={i.key}>
                      <label class={`clear-option shop-item${i.bought ? ' shop-bought' : ''}`}>
                        <input type="checkbox" checked={i.bought} onChange={() => tick(i)} />
                        <span>
                          <strong>{i.name}</strong>
                          {i.amount && <span>, {i.amount}</span>}
                          {i.note && <span class="muted small shop-note">{i.note}</span>}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            ))}
            <p class="muted small">From what’s planned and your Want to grow list, less the seed in your tin and what’s sown already{feeding ? ', and the feeds on your shelf' : ''}. A tick lasts until next August, when the new season’s shopping starts.</p>
          </>
        )}
        <div class="button-row">
          {toBuy.length > 0 && (
            <button type="button" class="btn btn-primary" onClick={share}>
              Share the list
            </button>
          )}
          <button type="button" class="btn" onClick={() => ref.current?.close()}>
            Close
          </button>
        </div>
      </div>
    </dialog>
  );
}
