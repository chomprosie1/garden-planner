import { photoForMonth } from '../../content/photos';
import { seasonFor } from '../../content/seasons';
import type { Store } from '../../model/store';
import type { Garden } from '../../model/types';
import { LOOKS } from '../../theme/looks';
import type { Prefs, View } from '../../theme/prefs';
import { Icon } from '../icons';
import { JobList, jobsDoneCount } from '../Jobs';
import { PhotoCredit, SeasonPhoto } from '../SeasonPhoto';

interface Props {
  store: Store;
  garden: Garden;
  prefs: Prefs;
  go: (v: View) => void;
  now?: Date;
}

export function Home({ store, garden, prefs, go, now = new Date() }: Props) {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const season = seasonFor(month);
  const photoMonth = prefs.photoMonth === 'auto' ? month : prefs.photoMonth;
  const photo = photoForMonth(photoMonth);
  // Subtle or no photos: every look uses the quiet band layout.
  const layout = prefs.photos === 'full' ? LOOKS[prefs.look].home : 'band';
  const total = seasonFor(month).jobs.length;
  const doneCount = jobsDoneCount(garden, month, year);
  const latestNote = [...garden.notes].sort((a, b) => b.date.localeCompare(a.date))[0];

  const settingsButton = (
    <button type="button" class="icon-btn home-settings" aria-label="Settings" onClick={() => go('settings')}>
      <Icon name="settings" />
    </button>
  );

  const monthTitle = (
    <>
      <p class="eyebrow">This month</p>
      <h1 class="title month-title">{season.name}</h1>
      <p class="month-line">{season.line}</p>
    </>
  );

  return (
    <div class={`home home-${layout}`}>
      {layout === 'hero' || layout === 'sheet' ? (
        <header class="home-hero">
          <SeasonPhoto month={photoMonth} sizes="(max-width: 700px) 100vw, 900px" class="home-hero-photo" />
          <div class="home-top on-photo">
            <span class="garden-label">{garden.name}</span>
            {settingsButton}
          </div>
          <div class="home-hero-text on-photo">{monthTitle}</div>
        </header>
      ) : layout === 'framed' ? (
        <header class="home-framed">
          <div class="home-top">
            <span class="masthead">{garden.name}</span>
            {settingsButton}
          </div>
          {photo && (
            <figure class="print">
              <SeasonPhoto month={photoMonth} sizes="(max-width: 700px) 92vw, 640px" credit={false} />
              <figcaption>
                <PhotoCredit photo={photo} inline />
              </figcaption>
            </figure>
          )}
          <div class="ruled-title">
            <span class="rule" />
            <h1 class="title month-title">{season.name}</h1>
            <span class="rule" />
          </div>
          <p class="month-line">{season.line}</p>
        </header>
      ) : layout === 'packet' ? (
        <header class="home-packet">
          <SeasonPhoto month={photoMonth} sizes="(max-width: 700px) 100vw, 900px" class="packet-photo" credit={false} />
          <div class="home-top on-photo">
            <span class="sign">{garden.name}</span>
            {settingsButton}
          </div>
          <div class="packet">
            <div class="packet-inner">
              <div class="packet-head">
                <span>The month's sowing</span>
                <span>No. {month}</span>
              </div>
              <h1 class="title month-title">{season.name}</h1>
              <div class="packet-fold">
                <span>sow · plant · lift · store</span>
              </div>
              <p class="month-line">{season.line}</p>
            </div>
          </div>
          {photo && <PhotoCredit photo={photo} inline />}
        </header>
      ) : (
        <header class="home-band">
          <div class="home-top">
            <span class="garden-label">{garden.name}</span>
            {settingsButton}
          </div>
          <h1 class="title month-title">{season.name}</h1>
          <p class="month-line">{season.line}</p>
          {prefs.photos !== 'off' && photo && (
            <>
              <SeasonPhoto month={photoMonth} sizes="(max-width: 700px) 92vw, 640px" class="band-photo" credit={false} />
              <PhotoCredit photo={photo} inline />
            </>
          )}
        </header>
      )}

      <div class="home-body">
        <section class="card">
          <div class="card-head">
            <h2>{layout === 'packet' ? 'Jobs on the plot' : layout === 'framed' ? 'Tasks for the month' : 'This month'}</h2>
            <span class="muted small">
              {doneCount} of {total} done
            </span>
          </div>
          {layout === 'sheet' && (
            <div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={doneCount}>
              <div style={{ width: `${(doneCount / total) * 100}%` }} />
            </div>
          )}
          <JobList store={store} garden={garden} month={month} year={year} limit={3} />
          <p class="card-foot">
            <a
              href="#/month"
              onClick={(e) => {
                e.preventDefault();
                go('month');
              }}
            >
              All {season.name} jobs
            </a>
            <span class="muted small"> · general UK jobs until you add plants</span>
          </p>
        </section>

        <a
          href="#/plan"
          class="card card-link"
          onClick={(e) => {
            e.preventDefault();
            go('plan');
          }}
        >
          <span class="mini-plan" aria-hidden="true" />
          <span class="card-link-text">
            <strong>Your garden</strong>
            <span class="muted">
              {garden.features.length > 0 ? `${garden.features.length} features · open the plan` : 'Open the plan and start drawing'}
            </span>
          </span>
          <Icon name="chevron" />
        </a>

        {latestNote && (
          <section class="card">
            <h2>Latest note</h2>
            <p class="muted small">{latestNote.date}</p>
            <p>{latestNote.text}</p>
          </section>
        )}
      </div>
    </div>
  );
}
