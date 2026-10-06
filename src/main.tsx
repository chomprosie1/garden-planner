import { render } from 'preact';
import { newAppState } from './model/defaults';
import { createStore } from './model/store';
import { autosave, loadSaved } from './storage/local';
import { startTheme } from './theme/apply';
import { createPrefsStore } from './theme/prefs';
import { App } from './ui/App';
import './styles.css';

const store = createStore(loadSaved() ?? newAppState());
autosave(store);

const prefsStore = createPrefsStore();
startTheme(prefsStore);

render(<App store={store} prefsStore={prefsStore} />, document.getElementById('app')!);
