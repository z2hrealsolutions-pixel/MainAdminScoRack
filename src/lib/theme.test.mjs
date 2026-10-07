import { PREFERENCES, STORAGE_KEY, applyTheme, lockTheme, normalizePreference, readPreference, resolveTheme, savePreference } from './theme.js';

let passed = 0, failed = 0;
const check = (label, ok, extra) => { if (ok) { passed++; console.log('PASS:', label); } else { failed++; console.log('FAIL:', label, extra ?? ''); } };
const memory = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), m }; };
const root = () => ({ dataset: {} });

check('there are three choices: auto, light, dark', PREFERENCES.join() === 'auto,light,dark');
check('anything else is treated as auto', ['', 'blue', null, undefined, 42, 'DARK', 'Light'].every((v) => normalizePreference(v) === 'auto'));
check('light and dark stay as chosen, whatever the device says', resolveTheme('light', true) === 'light' && resolveTheme('dark', false) === 'dark' && resolveTheme('light', false) === 'light' && resolveTheme('dark', true) === 'dark');
check('auto follows the device', resolveTheme('auto', true) === 'dark' && resolveTheme('auto', false) === 'light');
check('auto with a device that cannot say is dark, as the apps always were', resolveTheme('auto', undefined) === 'dark' && resolveTheme('auto', null) === 'dark');
check('a nonsense choice follows the device too', resolveTheme('rainbow', false) === 'light' && resolveTheme(undefined, true) === 'dark');

{
  const s = memory();
  check('nothing saved means auto', readPreference(s) === 'auto');
  savePreference('light', s);
  check('a saved choice is read back, under the one key', readPreference(s) === 'light' && s.m.get(STORAGE_KEY) === 'light' && STORAGE_KEY === 'scoreit-theme');
  savePreference('dark', s);
  check('a new choice replaces it', readPreference(s) === 'dark');
  savePreference('nonsense', s);
  check('a nonsense choice is saved as auto, never as nonsense', s.m.get(STORAGE_KEY) === 'auto' && readPreference(s) === 'auto');
  s.m.set(STORAGE_KEY, 'neon');
  check('a damaged saved value reads as auto', readPreference(s) === 'auto');
}
{
  const broken = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  check('a device that blocks storage still works: reads auto, saving does not crash', readPreference(broken) === 'auto' && (() => { try { savePreference('dark', broken); return true; } catch { return false; } })());
}
{
  const r = root();
  // with no browser around, the device cannot say, so auto is dark
  check('applying a theme puts it on the page', applyTheme('light', r) === 'light' && r.dataset.theme === 'light' && r.dataset.themePref === 'light');
  check('applying auto records both the choice and what it came to', applyTheme('auto', r) === 'dark' && r.dataset.theme === 'dark' && r.dataset.themePref === 'auto');
  check('applying a nonsense choice records auto', (applyTheme('wild', r), r.dataset.themePref === 'auto'));
}
{
  const r = root();
  applyTheme('light', r);
  const release = lockTheme('dark', r);
  check('a page that must be dark holds the page dark and says so', r.dataset.theme === 'dark' && r.dataset.themeLocked === 'true');
  release();
  check('and gives it back when it goes: the lock is gone', r.dataset.themeLocked === undefined);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
