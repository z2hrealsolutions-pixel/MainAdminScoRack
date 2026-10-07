import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Both themes have to be readable. This reads the colour settings and measures every pairing that text is
// drawn in, so a colour that is too faint cannot be added to either theme without this failing.
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(join(root, 'styles/tokens.css'), 'utf8');

let passed = 0, failed = 0;
const check = (label, ok, extra) => { if (ok) { passed++; console.log('PASS:', label); } else { failed++; console.log('FAIL:', label, extra ?? ''); } };

const block = (selector) => { const m = new RegExp(`${selector.replace(/[[\]'.]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css); return m ? m[1] : ''; };
const vars = (b) => Object.fromEntries([...b.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
const dark = vars(block(":root,\n:root[data-theme='dark']"));
const light = { ...dark, ...vars(block(":root[data-theme='light']")) };
const lightOnly = vars(block(":root[data-theme='light']"));

const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const isHex = (v) => /^#[0-9a-fA-F]{6}$/.test(v);

for (const [name, t] of [['dark', dark], ['light', light]]) {
  const surfaces = ['ink', 'panel', 'panel-raised', 'page'].filter((k) => isHex(t[k]));
  const worst = (fg) => Math.min(...surfaces.map((s) => ratio(t[fg], t[s])));
  check(`${name}: main text reads on every surface (needs 4.5, worst is ${worst('paper').toFixed(1)})`, worst('paper') >= 4.5);
  check(`${name}: secondary text reads on every surface (worst ${worst('mist').toFixed(1)})`, worst('mist') >= 4.5);
  check(`${name}: the faintest text, hints and placeholders, still reads (worst ${worst('mist-dim').toFixed(1)})`, worst('mist-dim') >= 4.5);
  check(`${name}: turquoise text reads on every surface (worst ${worst('lamp-text').toFixed(1)})`, worst('lamp-text') >= 4.5);
  check(`${name}: a winner's large score numeral reads on every surface (worst ${worst('lamp-score').toFixed(1)}, large text needs 3)`, worst('lamp-score') >= 3);
  check(`${name}: small finished-score text reads on every surface (worst ${worst('lamp-small').toFixed(1)})`, worst('lamp-small') >= 4.5);
  check(`${name}: the exact brand turquoise is fine for large numerals on a panel (worst ${Math.min(ratio(t.lamp, t.panel), ratio(t.lamp, t.ink)).toFixed(1)}, large text needs 3)`, Math.min(ratio(t.lamp, t.panel), ratio(t.lamp, t.ink)) >= 3);
  check(`${name}: text on a turquoise button reads (${ratio(t['on-lamp'], t.lamp).toFixed(1)}) and on its hover shade (${ratio(t['on-lamp'], t['lamp-strong']).toFixed(1)})`, ratio(t['on-lamp'], t.lamp) >= 4.5 && ratio(t['on-lamp'], t['lamp-strong']) >= 4.5);
  check(`${name}: an error colour reads on the panel (${ratio(t.danger, t.panel).toFixed(1)})`, ratio(t.danger, t.panel) >= 4.5);
}
check('the exact brand turquoise #0097b2 is used for fills in both themes', dark.lamp === '#0097b2' && light.lamp === '#0097b2');

// the two themes have to define the same things, or part of a screen would keep the other theme's colour
const darkKeys = Object.keys(vars(block(":root,\n:root[data-theme='dark']"))).filter((k) => !k.startsWith('font') && !k.startsWith('radius') && !k.startsWith('space'));
const missing = darkKeys.filter((k) => !(k in lightOnly));
check('the light theme sets every colour the dark theme sets', missing.length === 0, missing.join(', '));
check('the page can be told apart from a card in both themes', dark.page !== dark.panel && light.page !== light.panel);
check('no colour is written outside the settings: stylesheets use var(--...) only', (() => {
  const dir = join(root, 'styles'); const bad = [];
  for (const f of ['global.css', 'app.css', 'public.css', 'shell.css', 'tenants.css', 'bracket.css', 'roster.css', 'login.css', 'dashboard.css', 'arena.css', 'soft.css'].filter((f) => { try { readFileSync(join(dir, f)); return true; } catch { return false; } })) {
    const text = readFileSync(join(dir, f), 'utf8');
    for (const m of text.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g)) bad.push(`${f} ${m[0]}`);
  }
  return bad.length === 0 ? true : bad.slice(0, 6).join('; ');
})() === true, '');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
