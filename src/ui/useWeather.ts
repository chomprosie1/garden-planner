// This year's weather for the screens: the kept copy at once, refreshed from
// Open-Meteo every few hours while it's turned on. Shared through a context so
// the plan, Home and the planting panel all use the same.

import { createContext } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { todayIso } from '../model/ids';
import type { Garden } from '../model/types';
import { clearWeather, loadWeather, saveWeather } from '../storage/weatherCache';
import { fetchWeather } from '../weather/openMeteo';
import { isFresh, usableFor, type Weather } from '../weather/weather';

export interface WeatherState {
  /** For this garden's place and still covering today; null when it's off or there's none yet. */
  weather: Weather | null;
  status: 'off' | 'loading' | 'ready' | 'error';
  /** Fetch it again now. */
  refresh: () => void;
}

const OFF: WeatherState = { weather: null, status: 'off', refresh: () => {} };

export const WeatherContext = createContext<WeatherState>(OFF);

/** The weather, wherever it's needed. */
export const useWeatherNow = (): WeatherState => useContext(WeatherContext);

/** Keeps the weather for a garden while it's on; forgets it when it's turned off. */
export function useWeatherFeed(garden: Garden, on: boolean): WeatherState {
  const { latitude: lat, longitude: lon } = garden;
  const [kept, setKept] = useState<Weather | null>(() => (on ? loadWeather() : null));
  const [status, setStatus] = useState<WeatherState['status']>(on ? 'ready' : 'off');
  const busy = useRef(false);

  const fetchNow = (force = false) => {
    if (!on || busy.current) return;
    const cached = kept ?? loadWeather();
    if (!force && isFresh(cached, lat, lon, new Date())) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    busy.current = true;
    setStatus('loading');
    fetchWeather(lat, lon, todayIso())
      .then((w) => {
        saveWeather(w);
        setKept(w);
        setStatus('ready');
      })
      .catch(() => setStatus('error'))
      .finally(() => {
        busy.current = false;
      });
  };

  useEffect(() => {
    if (!on) {
      clearWeather();
      setKept(null);
      setStatus('off');
      return;
    }
    setKept((k) => k ?? loadWeather());
    setStatus((s) => (s === 'off' ? 'ready' : s));
    fetchNow();
    // Back to the app after a while: fetch again if it's gone stale.
    const onShow = () => document.visibilityState === 'visible' && fetchNow();
    document.addEventListener('visibilitychange', onShow);
    return () => document.removeEventListener('visibilitychange', onShow);
  }, [on, lat, lon]);

  if (!on) return OFF;
  return { weather: usableFor(kept, lat, lon, todayIso()), status, refresh: () => fetchNow(true) };
}
