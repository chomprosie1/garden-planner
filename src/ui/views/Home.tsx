import { photoForMonth } from '../../content/photos';
import { seasonFor } from '../../content/seasons';
import type { Store } from '../../model/store';
import type { Garden, Plant } from '../../model/types';
import { jobsFor } from '../../calendar/jobs';
import { usePlants } from '../usePlants';
import { spacingStyle } from '../../planting/place';
import { LOOKS } from '../../theme/looks';
import type { Prefs, PrefsStore, View } from '../../theme/prefs';
import { BackupCard, GardenCard, GardenName, JournalCard, MomentCard, SaveIndicator, SetupCard, WhatsNewCard } from '../HomeCards';
import { FrostCard, UvCard } from '../WeatherCards';
import { WeekCard } from '../WeekCard';
import { KitchenCard } from '../Kitchen';
import { InspireCard } from '../Inspire';
import { SeasonCard } from '../Wrapped';
import { InstallCard } from '../Install';
import { Icon } from '../icons';
import { doneOf, JobList, jobsDoneCount, PlantJobs } from '../Jobs';
import { PhotoCredit, SeasonPhoto } from '../SeasonPhoto';
import { ReadyCard } from '../ShedCards';
import { BehindCard } from '../BehindCard';

interface Props {
  store: Store;
  garden: Garden;
  userPlants: Plant[];
  prefs: Prefs;
  prefsStore: PrefsStore;
  go: (v: View) => void;
  now?: Date;
}

export function Home({ store, garden, userPlants, prefs, prefsStore, go, now = new Date() }: Props) {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const season = seasonFor(month);
  const photoMonth = prefs.photoMonth === 'auto' ? month : prefs.photoMonth;
  const photo = photoForMonth(photoMonth);
  // Subtle or no photos: every look uses the quiet band layout.
  const layout = prefs.photos === 'full' ? LOOKS[prefs.look].home : 'band';
  // Jobs for your own plants when you have any; otherwise the general UK jobs.
  const { plants, plantOf } = usePlants(userPlants, spacingStyle(garden));
  const mine = plants ? jobsFor(garden, plantOf, month, year, { weeding: prefs.weeding, feeding: prefs.feeding }) : [];
  const total = mine.length || seasonFor(month).jobs.length;
  const doneCount = mine.length ? doneOf(garden, mine) : jobsDoneCount(garden, month, year);

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
            <GardenName name={garden.name} class="garden-label" />
            {settingsButton}
          </div>
          <div class="home-hero-text on-photo">{monthTitle}</div>
        </header>
      ) : layout === 'framed' ? (
        <header class="home-framed">
          <div class="home-top">
            <GardenName name={garden.name} class="masthead" />
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
            <GardenName name={garden.name} class="sign" />
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
            <GardenName name={garden.name} class="garden-label" />
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
        {/* What needs you now first, in panels; then the week, the month and the rest, as a page. */}
        {plants && <MomentCard garden={garden} plantOf={plantOf} />}
        {plants && <FrostCard garden={garden} plantOf={plantOf} />}
        <UvCard garden={garden} />
        {plants && <ReadyCard store={store} garden={garden} plantOf={plantOf} />}
        {plants && <WeekCard garden={garden} plantOf={plantOf} />}
        {plants && <KitchenCard garden={garden} plantOf={plantOf} />}
        <SetupCard store={store} garden={garden} prefs={prefs} prefsStore={prefsStore} />
        <InspireCard store={store} garden={garden} />
        {plants && <BehindCard store={store} garden={garden} plantOf={plantOf} />}
        <section class="card">
          <div class="card-head">
            <h2>{layout === 'packet' ? 'Jobs on the plot' : layout === 'framed' ? 'Jobs for the month' : 'This month'}</h2>
            <span class="muted small">
              {doneCount} of {total} done
            </span>
          </div>
          {layout === 'sheet' && (
            <div class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={doneCount}>
              <div style={{ width: `${(doneCount / total) * 100}%` }} />
            </div>
          )}
          {mine.length > 0 ? <PlantJobs jobs={mine} garden={garden} store={store} limit={4} plantOf={plantOf} /> : <JobList store={store} garden={garden} month={month} year={year} limit={3} />}
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
            {mine.length === 0 && <span class="muted small"> · general UK jobs until you add plants</span>}
          </p>
        </section>

        {plants && <SeasonCard garden={garden} plantOf={plantOf} />}
        <JournalCard store={store} garden={garden} plantOf={plantOf} />
        <WhatsNewCard prefs={prefs} prefsStore={prefsStore} />
        <InstallCard hidden={prefs.installHidden} prefsStore={prefsStore} />
        <GardenCard garden={garden} prefs={prefs} plants={plants} plantOf={plantOf} />
        <BackupCard store={store} garden={garden} prefs={prefs} prefsStore={prefsStore} now={now} />
        <SaveIndicator />
      </div>
    </div>
  );
}
