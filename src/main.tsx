import { render } from 'preact';
import { newAppState } from './model/defaults';
import { createStore } from './model/store';
import { autosave, loadSaved } from './storage/local';
import { App } from './ui/App';
import './styles.css';

const store = createStore(loadSaved() ?? newAppState());
autosave(store);

render(<App store={store} />, document.getElementById('app')!);
