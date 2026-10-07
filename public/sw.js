// The app's service worker: it opens offline, and (where the browser allows,
// for an installed app) checks the forecast now and then and warns of frost,
// and once a week says what there is to do.
// Plain JavaScript, served as it is from public/.

const APP = 'garden-planner-app-v1';
const STATE = 'garden-planner-state';
/** What the app last said to watch for: where the garden is, and what's tender and outside. */
const SNAPSHOT = 'reminder.json';
/** Files kept for offline use, at most: older ones from past versions go first. */
const MAX_FILES = 150;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) if (name !== APP && name !== STATE) await caches.delete(name);
      await self.clients.claim();
    })(),
  );
});

async function keep(cache, request, response) {
  await cache.put(request, response);
  const keys = await cache.keys();
  for (const old of keys.slice(0, Math.max(0, keys.length - MAX_FILES))) await cache.delete(old);
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // The weather and place searches go straight to the network.
  if (url.origin !== self.location.origin) return;
  const scope = self.registration.scope;

  if (request.mode === 'navigate') {
    // The page: the newest when online, the last one kept when not.
    event.respondWith(
      (async () => {
        const cache = await caches.open(APP);
        try {
          const fresh = await fetch(request);
          if (fresh.ok) await cache.put(scope, fresh.clone());
          return fresh;
        } catch {
          return (await cache.match(scope)) || Response.error();
        }
      })(),
    );
    return;
  }

  // Everything else (scripts, styles, photos of the seasons, plant lists): the kept copy at once, refreshed behind.
  event.respondWith(
    (async () => {
      const cache = await caches.open(APP);
      const kept = await cache.match(request);
      const fresh = fetch(request)
        .then(async (response) => {
          if (response.ok) await keep(cache, request, response.clone());
          return response;
        })
        .catch(() => kept || Response.error());
      return kept || fresh;
    })(),
  );
});

// The first time the app opens, it hands over what it loaded before this was running, to keep for offline.
self.addEventListener('message', (event) => {
  const keepList = event.data && event.data.keep;
  if (!Array.isArray(keepList)) return;
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP);
      for (const url of keepList.slice(0, MAX_FILES)) {
        if (typeof url !== 'string' || !url.startsWith(self.location.origin)) continue;
        // The page is kept under the app's address, as the fetch handler looks for it.
        const key = url === self.registration.scope || url === self.registration.scope + 'index.html' ? self.registration.scope : url;
        if (await cache.match(key)) continue;
        try {
          const response = await fetch(url);
          if (response.ok) await cache.put(key, response);
        } catch {
          // offline already: it's kept next time
        }
      }
    })(),
  );
});

// ---------- Reminders ----------

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

async function frostCheck() {
  const state = await caches.open(STATE);
  const saved = await state.match(SNAPSHOT);
  if (!saved) return;
  const snap = await saved.json();
  if (!snap.on || !Array.isArray(snap.items) || !snap.items.length) return;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${snap.lat}&longitude=${snap.lon}&daily=temperature_2m_min&timezone=Europe%2FLondon&forecast_days=3`;
  const reply = await (await fetch(url)).json();
  const days = reply?.daily?.time || [];
  const mins = reply?.daily?.temperature_2m_min || [];
  for (let i = 0; i < days.length; i++) {
    const min = mins[i];
    if (typeof min !== 'number') continue;
    // Outside, a ground frost will do; under glass, only a real frost once its night warmth is added.
    const atRisk = snap.items.filter((it) => (it.nightGain > 0 ? min + it.nightGain <= 1 : min <= 3));
    if (!atRisk.length) continue;
    const told = `told-${days[i]}`;
    if (await state.match(told)) return;
    await state.put(told, new Response('1'));
    const names = [...new Set(atRisk.map((a) => a.name))];
    const day = DAYS[new Date(`${days[i]}T12:00:00Z`).getUTCDay()];
    await self.registration.showNotification(min <= 1 ? 'Frost likely' : 'A ground frost is possible', {
      body: `About ${Math.round(min)} °C early on ${day}. At risk: ${names.slice(0, 3).join(', ')}${names.length > 3 ? ` and ${names.length - 3} more` : ''}.`,
      icon: 'icons/icon-192.png',
      tag: `frost-${days[i]}`,
      data: { url: './#/today' },
    });
    return;
  }
}

/** The date as YYYY-MM-DD, here. */
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Once a week, in the daytime: the jobs the app worked out for this week, if there are any. */
async function weekCheck() {
  const now = new Date();
  if (now.getHours() < 8 || now.getHours() >= 20) return;
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const week = iso(monday);
  const state = await caches.open(STATE);
  const saved = await state.match(SNAPSHOT);
  if (!saved) return;
  const snap = await saved.json();
  const nudge = Array.isArray(snap.weeks) && snap.weeks.find((w) => w.week === week);
  if (!nudge) return;
  const told = `told-week-${week}`;
  if (await state.match(told)) return;
  await state.put(told, new Response('1'));
  await self.registration.showNotification(nudge.title, { body: nudge.body, icon: 'icons/icon-192.png', tag: 'week', data: { url: './#/today' } });
}

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'frost-check') event.waitUntil(Promise.all([frostCheck().catch(() => undefined), weekCheck().catch(() => undefined)]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  event.waitUntil(
    (async () => {
      for (const c of await self.clients.matchAll({ type: 'window' })) {
        if (c.url.startsWith(self.registration.scope)) {
          await c.focus();
          return c.navigate(target);
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
