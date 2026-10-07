// Fetching the weather from Open-Meteo (open-meteo.com): free for personal,
// non-commercial use, with no key. Only the garden's place, rounded to about a
// kilometre, is sent. Two requests: the past year from the archive (it runs a
// few days behind), and the last week with the next fortnight's forecast.
// Weather data by Open-Meteo.com, CC BY 4.0.

import { addDays } from '../model/dates';
import { makeWeather, parseDaily, roundPlace, type Weather } from './weather';

const DAILY = 'temperature_2m_max,temperature_2m_min,precipitation_sum';
const ZONE = 'Europe%2FLondon';

/** How far back the archive goes: a year and a bit, for plantings that went in last summer. */
export const PAST_DAYS = 400;
export const FORECAST_DAYS = 16;

export function weatherUrls(lat: number, lon: number, today: string): { archive: string; forecast: string } {
  const at = `latitude=${roundPlace(lat)}&longitude=${roundPlace(lon)}`;
  return {
    archive: `https://archive-api.open-meteo.com/v1/archive?${at}&start_date=${addDays(today, -PAST_DAYS)}&end_date=${addDays(today, -6)}&daily=${DAILY}&timezone=${ZONE}`,
    forecast: `https://api.open-meteo.com/v1/forecast?${at}&daily=${DAILY}&timezone=${ZONE}&past_days=10&forecast_days=${FORECAST_DAYS}`,
  };
}

export const ATTRIBUTION = 'Weather data by Open-Meteo.com';

/**
 * This year's weather for a place. The forecast is the one that matters most: if the archive fails, the forecast is
 * enough; if the forecast fails, it throws.
 */
export async function fetchWeather(lat: number, lon: number, today: string, now: Date = new Date(), get: typeof fetch = fetch): Promise<Weather> {
  const urls = weatherUrls(lat, lon, today);
  const load = async (url: string) => {
    const res = await get(url);
    if (!res.ok) throw new Error(`Open-Meteo said ${res.status}.`);
    return parseDaily(await res.json());
  };
  const [archive, forecast] = await Promise.allSettled([load(urls.archive), load(urls.forecast)]);
  if (forecast.status === 'rejected') throw forecast.reason instanceof Error ? forecast.reason : new Error('No forecast.');
  const replies = archive.status === 'fulfilled' ? [archive.value, forecast.value] : [forecast.value];
  const w = makeWeather(replies, today, now.toISOString(), roundPlace(lat), roundPlace(lon));
  if (!w) throw new Error('The forecast was empty.');
  return w;
}
