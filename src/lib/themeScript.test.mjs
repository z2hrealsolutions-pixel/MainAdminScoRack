import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The page sets its theme before it is drawn, from a small script in index.html. If that script were wrong, or came
// after the page, a person on a light device would see a dark flash on every visit.
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const isUser = /scorack-user/.test(root);

let passed = 0, failed = 0;
const check = (label, ok, extra) => { if (ok) { passed++; console.log('PASS:', label); } else { failed++; console.log('FAIL:', label, extra ?? ''); } };

const script = (/<script>([\s\S]*?)<\/script>/.exec(html) || [])[1] || '';
check('index.html has a script that sets the theme', script.includes('dataset.theme'));
check('it reads the saved choice under the same key the app uses', script.includes("'scoreit-theme'"));
check('it follows the device when nothing is saved', script.includes('prefers-color-scheme: dark'));
check('it is in the head, before the page is drawn, and before the app\'s own script', html.indexOf('<script>') < html.indexOf('<div id="root"') && html.indexOf('<script>') < html.indexOf('type="module"'));
check('it cannot break the page: it is inside a try, and falls back to dark', /try\s*\{[\s\S]*\}\s*catch/.test(script) && /catch[\s\S]*dataset\.theme = 'dark'/.test(script));
check('it needs nothing from outside: no other script, no address', !/src=["']http/.test(script) && !/fetch\(|XMLHttp/.test(script));

// run it, on a device that is light and one that is dark, with each saved choice
const run = (saved, dark, path = '/') => {
  const root = { dataset: {} };
  const win = { matchMedia: (q) => ({ matches: q.includes('dark') ? dark : false }) };
  const store = { getItem: () => saved };
  new Function('document', 'window', 'localStorage', 'matchMedia', 'location', script)({ documentElement: root }, win, store, win.matchMedia, { pathname: path });
  return root.dataset;
};
check('nothing saved, a dark device: dark, and recorded as auto', (() => { const d = run(null, true); return d.theme === 'dark' && d.themePref === 'auto'; })());
check('nothing saved, a light device: light', run(null, false).theme === 'light');
check('light saved wins over a dark device, and dark over a light one', run('light', true).theme === 'light' && run('dark', false).theme === 'dark');
check('a damaged saved value is treated as nothing saved', run('purple', false).theme === 'light' && run('purple', false).themePref === 'auto');
check('storage that throws still gives a theme, dark', (() => { const root = { dataset: {} }; new Function('document', 'window', 'localStorage', 'matchMedia', 'location', script)({ documentElement: root }, {}, { getItem() { throw new Error('no'); } }, undefined, { pathname: '/' }); return root.dataset.theme === 'dark'; })());
if (isUser) {
  check('the TV board is dark from the first moment, whatever the device or the saved choice', run('light', false, '/venue-a/tv').theme === 'dark' && run(null, false, '/venue-a/tv/').theme === 'dark');
  check('a page whose address merely contains tv is not the TV board', run('light', false, '/venue-a/tv-guide').theme === 'light');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
