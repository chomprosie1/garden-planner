import { render } from 'preact';
import { newAppState } from './model/defaults';
import { createStore } from './model/store';
import { autosave, loadSaved } from './storage/local';
import { tidyPhotos } from './storage/photos';
import { startServiceWorker } from './storage/reminders';
import { catchInstallPrompt } from './ui/Install';
import { startTheme } from './theme/apply';
import { createPrefsStore } from './theme/prefs';
import { App } from './ui/App';
import './styles.css';

catchInstallPrompt();
startServiceWorker();

const store = createStore(loadSaved() ?? newAppState());
autosave(store);

const prefsStore = createPrefsStore();
startTheme(prefsStore);

render(<App store={store} prefsStore={prefsStore} />, document.getElementById('app')!);

// Photos no note uses any more (deleted since the app was last open) are cleared away once it's settled.
setTimeout(() => void tidyPhotos(store.get().garden).catch(() => undefined), 5000);
