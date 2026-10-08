// Cards from this year's weather (opt-in): a frost warning on Home when a cold
// night this week puts tender plants or seedlings at risk, and the day's UV.

import { frostAdvice, frostHeadline, frostWarning } from '../lifecycle/frostWatch';
import { todayIso } from '../model/ids';
import type { Garden, Plant } from '../model/types';
import { ATTRIBUTION } from '../weather/openMeteo';
import { showsUv, UV_ADVICE, UV_LABEL, uvOn } from '../weather/uv';
import { useApp } from './appContext';
import { useWeatherNow } from './useWeather';

/** Up to this many plants named; the rest are counted. */
const NAMED = 4;

export function FrostCard({ garden, plantOf }: { garden: Garden; plantOf: (id: string) => Plant }) {
  const app = useApp();
  const { weather } = useWeatherNow();
  const today = todayIso();
  const warning = frostWarning(garden, plantOf, weather, today);
  if (!warning) return null;
  const names = warning.atRisk.map((a) => `${plantOf(a.plantId).commonName} ${a.where}`);
  const shown = [...new Set(names)];
  const rest = shown.length - NAMED;
  return (
    <section class={`card frost-card frost-${warning.night.level}`} aria-labelledby="frost-title" role="status">
      <h2 id="frost-title">{frostHeadline(warning, today)}</h2>
      <p>{frostAdvice(warning)}</p>
      <p class="muted small">
        At risk: {shown.slice(0, NAMED).join(', ')}
        {rest > 0 ? `, and ${rest} more` : ''}.
      </p>
      <p class="muted small">
        {ATTRIBUTION}.{' '}
        <button type="button" class="link-btn" onClick={() => app.go('plan')}>
          See the plan
        </button>
      </p>
    </section>
  );
}

/** The day's UV from April to September, when it's Moderate or above: live with the weather on, otherwise a sunny day's. */
export function UvCard({ garden }: { garden: Garden }) {
  const { weather } = useWeatherNow();
  const today = todayIso();
  const uv = uvOn(weather, today, garden.latitude, garden.longitude);
  if (!showsUv(uv, today)) return null;
  return (
    <section class={`card uv-card uv-${uv.band}`} aria-labelledby="uv-title">
      <h2 id="uv-title">
        UV {UV_LABEL[uv.band].toLowerCase()} today ({uv.index})
      </h2>
      <p>{UV_ADVICE[uv.band]}</p>
      <p class="muted small">{uv.live ? `The forecast’s highest for today. ${ATTRIBUTION}.` : 'On a sunny day at this time of year; cloud brings it down. Turn on this year’s weather in Your garden for the forecast’s.'}</p>
    </section>
  );
}
