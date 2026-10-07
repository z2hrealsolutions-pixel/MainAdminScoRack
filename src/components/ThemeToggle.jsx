import { useEffect, useState } from 'react';
import { applyTheme, normalizePreference, readPreference, savePreference } from '../lib/theme';

const OPTIONS = [
  { value: 'auto', label: 'Match my device', icon: 'M12 3a9 9 0 1 0 0 18V3z M12 3a9 9 0 0 1 0 18' },
  { value: 'light', label: 'Light', icon: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z M12 2v2 M12 20v2 M2 12h2 M20 12h2 M5 5l1.5 1.5 M17.5 17.5L19 19 M5 19l1.5-1.5 M17.5 6.5L19 5' },
  { value: 'dark', label: 'Dark', icon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z' },
];

// Three buttons: follow the device, light, dark. Saved on this device.
export default function ThemeToggle() {
  const [preference, setPreference] = useState(() => readPreference());

  useEffect(() => {
    applyTheme(preference);
    if (preference !== 'auto' || !window.matchMedia) return undefined;
    // while on "match my device", follow the device if it changes (sunset, a setting)
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('auto');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [preference]);

  function choose(value) {
    const next = normalizePreference(value);
    savePreference(next);
    setPreference(next);
  }

  return (
    <div className="theme-toggle" role="radiogroup" aria-label="Appearance">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={preference === o.value}
          aria-label={o.label}
          title={o.label}
          className={`theme-toggle-btn${preference === o.value ? ' theme-toggle-on' : ''}`}
          onClick={() => choose(o.value)}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d={o.icon} />
          </svg>
        </button>
      ))}
    </div>
  );
}
