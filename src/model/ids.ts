/** A new unique id, e.g. "f-1b9d6bcd". */
export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

/** Ids for plants you add yourself, so they never collide with library ids. */
export function newUserPlantId(): string {
  return newId('user');
}

/** Today's date as an ISO date string (YYYY-MM-DD), in local time. */
export function todayIso(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
