import { useEffect } from 'preact/hooks';
import { seasonFor } from '../content/seasons';
import { resolveMode } from '../theme/apply';
import { loadLookFonts } from '../theme/fonts';
import { LOOK_IDS, LOOKS, themeVars } from '../theme/looks';
import type { Prefs, PrefsStore } from '../theme/prefs';
import { SeasonPhoto } from './SeasonPhoto';

/** The looks as live preview cards. Choosing one applies it at once. */
export function LookPicker({ prefs, prefsStore, now = new Date() }: { prefs: Prefs; prefsStore: PrefsStore; now?: Date }) {
  useEffect(() => {
    LOOK_IDS.forEach((id) => void loadLookFonts(id));
  }, []);
  const mode = resolveMode(prefs, matchMedia('(prefers-color-scheme: dark)').matches);
  const month = now.getMonth() + 1;
  const season = seasonFor(month);

  // The look you have, and the others folded under More looks.
  const card = (id: (typeof LOOK_IDS)[number]) => {
    const look = LOOKS[id];
    const vars = themeVars(look, mode);
    return (
      <label key={id} class="look-card">
        <input type="radio" name="look" value={id} checked={prefs.look === id} onChange={() => prefsStore.set({ look: id })} />
        <div class="look-preview" data-preview={id} style={vars} aria-hidden="true">
          {prefs.photos !== 'off' && <SeasonPhoto month={month} sizes="240px" class="look-preview-photo" credit={false} />}
          <div class="look-preview-body">
            <span class="look-preview-title">{season.name}</span>
            <span class="look-preview-line" />
            <span class="look-preview-line short" />
            <span class="look-preview-button">Add plants</span>
          </div>
        </div>
        <span class="look-name">
          {look.name}
          {prefs.look === id && <span class="look-chosen"> · chosen</span>}
        </span>
        <span class="look-summary">{look.summary}</span>
      </label>
    );
  };
  const others = LOOK_IDS.filter((id) => id !== prefs.look);
  return (
    <fieldset class="look-choice">
      <legend class="visually-hidden">Look</legend>
      <div class="look-picker">{card(prefs.look)}</div>
      <details class="advanced more-looks">
        <summary>More looks ({others.length})</summary>
        <div class="look-picker">{others.map(card)}</div>
      </details>
    </fieldset>
  );
}

/** Text size and high contrast: the first thing in Settings, and offered first of all on a first visit. */
export function EasyToRead({ prefs, prefsStore }: { prefs: Prefs; prefsStore: PrefsStore }) {
  return (
    <div class="easy-read" id="text-size">
      <Choice
        legend="Text size"
        name="text"
        value={prefs.textSize}
        options={[
          { value: 'standard', label: 'Standard' },
          { value: 'large', label: 'Large' },
          { value: 'xlarge', label: 'Extra large' },
        ]}
        onChange={(textSize) => {
          // It stays where it is on the screen as the text grows.
          const card = document.getElementById('text-size');
          const before = card?.getBoundingClientRect().top;
          prefsStore.set({ textSize });
          requestAnimationFrame(() => {
            const after = card?.getBoundingClientRect().top;
            if (card && before !== undefined && after !== undefined && after !== before) (card.closest('.screen') ?? document.scrollingElement)?.scrollBy(0, after - before);
          });
        }}
      />
      <label class="switch-row">
        <input type="checkbox" checked={prefs.look === 'contrast'} onChange={(e) => prefsStore.set({ look: (e.currentTarget as HTMLInputElement).checked ? 'contrast' : 'cottage' })} />
        <span>High contrast: strong black and white, with no photos</span>
      </label>
    </div>
  );
}

interface ChoiceProps<T extends string> {
  legend: string;
  name: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}

/** A row of mutually exclusive choices built from real radio buttons. */
export function Choice<T extends string>({ legend, name, value, options, onChange }: ChoiceProps<T>) {
  return (
    <fieldset class="choice">
      <legend>{legend}</legend>
      <div class="choice-row">
        {options.map((o) => (
          <label key={o.value} class="choice-option">
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
            <span>{o.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
