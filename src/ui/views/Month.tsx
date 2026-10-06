import { seasonFor } from '../../content/seasons';
import type { Store } from '../../model/store';
import type { Garden } from '../../model/types';
import type { Prefs, View } from '../../theme/prefs';
import { Icon } from '../icons';
import { JobList } from '../Jobs';
import { SeasonPhoto } from '../SeasonPhoto';

interface Props {
  store: Store;
  garden: Garden;
  prefs: Prefs;
  go: (v: View) => void;
  now?: Date;
}

export function Month({ store, garden, prefs, go, now = new Date() }: Props) {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const next = (month % 12) + 1;
  const season = seasonFor(month);
  const photoMonth = prefs.photoMonth === 'auto' ? month : prefs.photoMonth;

  return (
    <div class="page">
      {prefs.photos !== 'off' && <SeasonPhoto month={photoMonth} sizes="(max-width: 700px) 100vw, 900px" class="page-band" />}
      <header class="page-head">
        <h1 class="title">{season.name}</h1>
        <button type="button" class="icon-btn phone-only" aria-label="Settings" onClick={() => go('settings')}>
          <Icon name="settings" />
        </button>
      </header>
      <p class="month-line">{season.line}</p>

      <section class="card">
        <h2>Jobs this month</h2>
        <JobList store={store} garden={garden} month={month} year={year} />
      </section>

      <section class="card">
        <h2>Coming up in {seasonFor(next).name}</h2>
        <ul class="plain-list">
          {seasonFor(next).jobs.map((j) => (
            <li key={j}>{j}</li>
          ))}
        </ul>
      </section>

      <p class="assumption">
        These are general jobs for the UK. Dates are averages, so adjust for your area. Jobs for your own plants arrive in Stage 5.
      </p>
    </div>
  );
}
