// Light, dark, or follow the device. The choice is kept on each device, not on an account.
export const STORAGE_KEY = 'scoreit-theme';
export const PREFERENCES = ['auto', 'light', 'dark'];

export function normalizePreference(value) {
  return PREFERENCES.includes(value) ? value : 'auto';
}

// "auto" means whatever the device is set to. With no way to tell, dark, the way the apps always were.
export function resolveTheme(preference, systemDark) {
  const p = normalizePreference(preference);
  if (p === 'auto') return systemDark === false ? 'light' : 'dark';
  return p;
}

export function readPreference(storage) {
  try {
    return normalizePreference((storage || window.localStorage).getItem(STORAGE_KEY));
  } catch {
    return 'auto';
  }
}

export function savePreference(preference, storage) {
  try {
    (storage || window.localStorage).setItem(STORAGE_KEY, normalizePreference(preference));
  } catch {
    /* a device that will not keep it still gets the choice for this visit */
  }
}

export function systemPrefersDark() {
  if (typeof window === 'undefined' || !window.matchMedia) return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

// puts the theme on the page. Returns the one that is showing.
export function applyTheme(preference, root) {
  const el = root || document.documentElement;
  const theme = resolveTheme(preference, systemPrefersDark());
  el.dataset.theme = theme;
  el.dataset.themePref = normalizePreference(preference);
  return theme;
}

// Pages that are always dark (the TV board, the landing page) hold the page dark while they are on screen,
// whatever was chosen, and hand it back after.
export function lockTheme(theme, root) {
  const el = root || document.documentElement;
  el.dataset.theme = theme;
  el.dataset.themeLocked = 'true';
  return () => {
    delete el.dataset.themeLocked;
    applyTheme(readPreference(), el);
  };
}
