import { render } from 'preact';
import { newGarden } from './model/defaults';
import { createStore } from './model/store';
import { startUp } from './storage/gardens';
import { autosave } from './storage/local';
import { tidyBlobs } from './storage/photos';
import { startServiceWorker } from './storage/reminders';
import { catchInstallPrompt } from './ui/Install';
import { startTheme } from './theme/apply';
import { createPrefsStore } from './theme/prefs';
import { App } from './ui/App';
import './styles.css';

catchInstallPrompt();
startServiceWorker();

// The garden you had open, or a new one. The first time, the garden kept before there could be several is moved across.
const store = createStore(startUp(newGarden));
autosave(store);

const prefsStore = createPrefsStore();
startTheme(prefsStore);

render(<App store={store} prefsStore={prefsStore} />, document.getElementById('app')!);

// Photos and trace photos no garden uses any more (deleted since the app was last open) are cleared away once it's settled.
setTimeout(() => void tidyBlobs().catch(() => undefined), 5000);
