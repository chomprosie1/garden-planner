// Dates as ISO strings, "YYYY-MM-DD".
// Days are counted from 1 January 1970 with plain arithmetic (Howard Hinnant's civil calendar algorithms), not Date
// objects: the year's projections add days hundreds of thousands of times.

/** The day number of a date, ISO "YYYY-MM-DD…". */
export function dayNumber(iso: string): number {
  let y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  y -= m <= 2 ? 1 : 0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  return era * 146097 + yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy - 719468;
}

/** The ISO date of a day number. */
export function fromDayNumber(n: number): string {
  const z = n + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  return `${y}-${m < 10 ? '0' : ''}${m}-${d < 10 ? '0' : ''}${d}`;
}

export const addDays = (iso: string, days: number) => fromDayNumber(dayNumber(iso) + Math.round(days));
export const daysBetween = (from: string, to: string) => dayNumber(to) - dayNumber(from);
