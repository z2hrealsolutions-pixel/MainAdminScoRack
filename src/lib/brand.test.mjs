import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
let passed = 0, failed = 0;
const check = (label, ok, extra) => { if (ok) { passed++; console.log('PASS:', label); } else { failed++; console.log('FAIL:', label, extra ?? ''); } };

const tokens = readFileSync(join(root, 'src/styles/tokens.css'), 'utf8');
const token = (name) => {
  const m = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`).exec(tokens);
  if (!m) throw new Error('missing token ' + name);
  return m[1].toLowerCase();
};
const lum = (hex) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

check('the accent is the logo turquoise, #0097b2 exactly', token('lamp') === '#0097b2');

const surfaces = ['ink', 'panel', 'panel-raised'].map((n) => [n, token(n)]);
for (const [n, hex] of surfaces) {
  check(`small accent text is readable on ${n} (needs 4.5, has ${ratio(token('lamp-text'), hex).toFixed(1)})`, ratio(token('lamp-text'), hex) >= 4.5);
}
// the exact logo turquoise is for fills, borders and big numerals (3:1 is the bar for those); small text uses --lamp-text, checked above
check(`the logo turquoise itself stays visible on the darkest surfaces (${ratio(token('lamp'), token('ink')).toFixed(1)} on ink, ${ratio(token('lamp'), token('panel')).toFixed(1)} on panel, needs 3)`, ratio(token('lamp'), token('ink')) >= 3 && ratio(token('lamp'), token('panel')) >= 3);
check(`button text is readable on the turquoise fill (${ratio(token('on-lamp'), token('lamp')).toFixed(1)}) and on its hover shade (${ratio(token('on-lamp'), token('lamp-strong')).toFixed(1)})`, ratio(token('on-lamp'), token('lamp')) >= 4.5 && ratio(token('on-lamp'), token('lamp-strong')) >= 4.5);
check(`accent borders can be seen against panels (${ratio(token('lamp-dim'), token('panel')).toFixed(1)}, needs 3)`, ratio(token('lamp-dim'), token('panel')) >= 3);

// no amber left anywhere in the styles, and the old name is nowhere a person can read it
const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]));
const src = walk(join(root, 'src')).filter((f) => !f.endsWith('.png') && !f.includes('.test.'));
const amber = src.filter((f) => /\.css$/.test(f) && /e3a857|f0bd74|8a6a3d|191008|227,\s*168,\s*87/i.test(readFileSync(f, 'utf8')));
check('no amber colour is left in any stylesheet', amber.length === 0, amber.join(', '));
const oldName = src.filter((f) => /\.(jsx?|html)$/.test(f)).filter((f) => /scorack/i.test(readFileSync(f, 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|import )/.test(l) && !/scorack[-_](code|mine|phase|admin|user)/i.test(l)).join('\n')));
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');
check('the old product name appears in no visible text', oldName.length === 0 && !/scorack/i.test(indexHtml), oldName.join(', '));
check('the browser tab says ScoreIt and has the favicon', /<title>ScoreIt/.test(indexHtml) && /rel="icon"/.test(indexHtml) && existsSync(join(root, 'public/favicon.png')));
check('the logo file is bundled', existsSync(join(root, 'src/assets/scoreit-logo-light.png')));

const brand = readFileSync(join(root, 'src/components/Brand.jsx'), 'utf8');
check('the banner reads: logo, then "by Z2HxRealSolutions", no separator and no "Developed"', /alt="ScoreIt"/.test(brand) && /by Z2HxRealSolutions/.test(brand) && !/>x</.test(brand) && !/Developed/.test(brand));
check('the browser tab title is "ScoreIt by Z2HxRealSolutions"', /<title>ScoreIt by Z2HxRealSolutions<\/title>/.test(indexHtml));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
