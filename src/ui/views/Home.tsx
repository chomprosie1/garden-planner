import { useEffect, useMemo, useState } from 'preact/hooks';
import { photoForMonth } from '../../content/photos';
import { monthLine, seasonFor } from '../../content/seasons';
import type { Store } from '../../model/store';
import type { Garden, Plant } from '../../model/types';
import { jobsFor } from '../../calendar/jobs';
import { usePlants } from '../usePlants';
import { spacingStyle } from '../../planting/place';
import { LOOKS } from '../../theme/looks';
import type { Prefs, PrefsStore, View } from '../../theme/prefs';
import { BackupCard, GardenCard, GardenName, JournalCard, MomentCard, SaveIndicator, SetupCard, WhatsNewCard } from '../HomeCards';
import { FrostCard, UvCard } from '../WeatherCards';
import { seasonReady } from '../Wrapped';
import { canInstall, InstallCard } from '../Install';
import { MoreMenu, type MenuItem } from '../MoreMenu';
import { useApp } from '../appContext';
import { SettingsButton } from '../SettingsButton';
import { HelpButton } from '../HelpLink';
import { PhotoCredit, SeasonPhoto } from '../SeasonPhoto';
import { ReadyCard } from '../ShedCards';
import { BehindCard } from '../BehindCard';
import { useWeatherNow } from '../useWeather';
import { todayIso } from '../../model/ids';
import { PLAN_AHEAD_MONTHS, PlanAheadCard } from '../PlanAhead';
import { TodayJobs } from '../TodayJobs';
import { setupShowing } from '../setup';

interface Props {
  store: Store;
  garden: Garden;
  userPlants: Plant[];
  prefs: Prefs;
  prefsStore: PrefsStore;
  go: (v: View) => void;
  /** Just set up: the first job is picked out. */
  startHere?: boolean;
  now?: Date;
}

/** Cards shown on Today once, the first time they would be, then kept under its ···: this visit, they stay. */
const shownThisVisit = new Set<string>();

function useShownOnce(id: string, wouldShow: boolean, prefs: Prefs, prefsStore: PrefsStore): boolean {
  const seen = prefs.stuckSeen.includes(id);
  const show = wouldShow && (!seen || shownThisVisit.has(id));
  useEffect(() => {
    if (!show || seen) return;
    shownThisVisit.add(id);
    prefsStore.set({ stuckSeen: [...new Set([...prefsStore.get().stuckSeen, id])] });
  }, [show, seen]);
  return show;
}

/**
 * Today is the jobs: the month in a short band, then one list of jobs to tick, then at most two things that need you
 * now (frost, seedlings ready, something running behind), then planning ahead in autumn and winter, and the garden at a
 * glance. The journal and installing show once, then live under the ···, with your season wrapped and What's new.
 */
export function Home({ store, garden, userPlants, prefs, prefsStore, startHere = false, now = new Date() }: Props) {
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const season = seasonFor(month);
  const photoMonth = prefs.photoMonth === 'auto' ? month : prefs.photoMonth;
  const photo = photoForMonth(photoMonth, now.getDate());
  // Subtle or no photos: every look uses the quiet band layout.
  const layout = prefs.photos === 'full' ? LOOKS[prefs.look].home : 'band';
  // Jobs for your own plants when you have any; otherwise the general UK jobs.
  const app = useApp();
  const { plants, plantOf } = usePlants(userPlants, spacingStyle(garden));
  const { weather } = useWeatherNow();
  const today = todayIso(now);
  const installable = !prefs.installHidden && canInstall();
  const journalOnce = useShownOnce('today:journal', true, prefs, prefsStore);
  const installOnce = useShownOnce('today:install', installable, prefs, prefsStore);
  // Asked for from the ···.
  const [installAsked, setInstallAsked] = useState(false);
  const wrapped = !!plants && seasonReady(garden, plantOf, today);
  const more: MenuItem[] = [
    { label: 'Garden journal', icon: 'notes', onSelect: () => app.go('notes') },
    ...(wrapped ? [{ label: 'Your season, wrapped', onSelect: () => app.openWrapped() }] : []),
    ...(canInstall() ? [{ label: 'Put it on your home screen', onSelect: () => setInstallAsked(true) }] : []),
    { label: 'What’s new', onSelect: () => app.go('new') },
  ];
  const mine = useMemo(
    () => (plants ? jobsFor(garden, plantOf, month, year, { weeding: prefs.weeding, feeding: prefs.feeding, today, weather }) : []),
    [garden, plants, plantOf, month, year, prefs.weeding, prefs.feeding, today, weather],
  );
  // The month's line fits the garden: nobody's told to lift dahlias they don't have.
  const line = plants ? monthLine(month, garden, plantOf) : season.line;
  // Help for Today, and Settings: the same two buttons as every tab.
  const settingsButton = (
    <span class="home-top-actions">
      <HelpButton topic="this-week" class="home-settings" />
      <MoreMenu items={more} label="More on Today" />
      <SettingsButton class="home-settings" />
    </span>
  );

  const monthTitle = (
    <>
      <h1 class="title month-title">{season.name}</h1>
      <p class="month-line">{line}</p>
    </>
  );

  return (
    <div class={`home home-${layout}`}>
      {layout === 'hero' || layout === 'sheet' ? (
        <header class="home-hero">
          <SeasonPhoto month={photoMonth} day={now.getDate()} sizes="(max-width: 700px) 100vw, 900px" class="home-hero-photo" />
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
              <SeasonPhoto month={photoMonth} day={now.getDate()} sizes="(max-width: 700px) 92vw, 640px" credit={false} />
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
          <p class="month-line">{line}</p>
        </header>
      ) : layout === 'packet' ? (
        <header class="home-packet">
          <SeasonPhoto month={photoMonth} day={now.getDate()} sizes="(max-width: 700px) 100vw, 900px" class="packet-photo" credit={false} />
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
              <p class="month-line">{line}</p>
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
          {monthTitle}
          {prefs.photos !== 'off' && photo && (
            <>
              <SeasonPhoto month={photoMonth} day={now.getDate()} sizes="(max-width: 700px) 92vw, 640px" class="band-photo" credit={false} />
              <PhotoCredit photo={photo} inline />
            </>
          )}
        </header>
      )}

      <div class="home-body">
        {/* One list to tick, first. */}
        <TodayJobs store={store} garden={garden} plantOf={plants ? plantOf : null} jobs={mine} month={month} year={year} startHere={startHere} />

        {/* What needs you now, two at most: the rest wait their turn (the CSS shows only the first two that have anything to say). */}
        {plants && (
          <div class="home-now">
            <FrostCard garden={garden} plantOf={plantOf} />
            <ReadyCard store={store} garden={garden} plantOf={plantOf} />
            <BehindCard store={store} garden={garden} plantOf={plantOf} />
            <MomentCard garden={garden} plantOf={plantOf} />
            {prefs.uvOnToday && <UvCard garden={garden} />}
          </div>
        )}

        {plants && PLAN_AHEAD_MONTHS.includes(month) && <PlanAheadCard store={store} garden={garden} plantOf={plantOf} feeding={prefs.feeding} />}
        <SetupCard store={store} garden={garden} prefs={prefs} prefsStore={prefsStore} />
        {journalOnce && <JournalCard store={store} garden={garden} plantOf={plantOf} />}

        {/* Below: news, installing (once, or when asked), the garden at a glance, and a line about a copy (asked here only when Getting started isn't asking). */}
        <WhatsNewCard prefs={prefs} prefsStore={prefsStore} />
        {(installOnce || installAsked) && <InstallCard hidden={false} prefsStore={prefsStore} />}
        <GardenCard garden={garden} prefs={prefs} plants={plants} plantOf={plantOf} />
        {!setupShowing(garden, prefs) && <BackupCard store={store} garden={garden} prefs={prefs} prefsStore={prefsStore} now={now} />}
        <SaveIndicator />
      </div>
    </div>
  );
}
