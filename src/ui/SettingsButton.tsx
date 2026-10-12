// The one way into Settings, the same on every screen: a cog at the top right on
// a phone. On a wider screen the rail has Settings at its foot instead.

import { useApp } from './appContext';
import { Icon } from './icons';

export function SettingsButton({ class: cls = '' }: { class?: string }) {
  const app = useApp();
  return (
    <button type="button" class={`icon-btn settings-btn phone-only ${cls}`} aria-label="Settings" title="Settings: your garden, reminders, backups and text size" onClick={() => app.go('settings')}>
      <Icon name="settings" />
    </button>
  );
}
