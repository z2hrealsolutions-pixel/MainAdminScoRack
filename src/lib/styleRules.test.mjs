import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Soft Bento, the console's look: solid, calm tiles. No glass and no glow, because this is where forms and tables
// live. A text check on the stylesheet, the look itself was checked in a real browser, both themes.
const here = dirname(fileURLToPath(import.meta.url));
const soft = readFileSync(join(here, '..', 'styles', 'soft.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const main = readFileSync(join(here, '..', 'main.jsx'), 'utf8');
const detail = readFileSync(join(here, '..', 'pages', 'TenantDetail.jsx'), 'utf8');
const knockout = readFileSync(join(here, '..', 'components', 'KnockoutSection.jsx'), 'utf8');

let passed = 0, failed = 0;
const check = (label, ok, extra) => { if (ok) { passed++; console.log('PASS:', label); } else { failed++; console.log('FAIL:', label, extra ?? ''); } };

check('there is no glass in the console: no blur, no backdrop filter', !/backdrop-filter|blur\(/.test(soft));
check('there is no glow or gradient in the console, only solid tiles', !/gradient|glow/.test(soft));
check('tiles take their colours and shadow from the theme settings', /\.tenant-section,[\s\S]*?background:\s*var\(--soft-tile\)[\s\S]*?box-shadow:\s*var\(--soft-shadow\)/.test(soft));
check('things inside a tile are a shade apart, from the theme settings', /\.division-row,[\s\S]*?background:\s*var\(--soft-inner\)/.test(soft));
check('a tenant page section opens on its own, not squeezed beside another', /\.tenant-open > \.tenant-section\s*\{[^}]*max-width:\s*none/.test(soft));
check('the tenant page opens with a grid of cards, and each section opens from one', /<TenantCards /.test(detail) && ['divisions', 'share', 'venue', 'team', 'brand', 'advanced'].every((id) => detail.includes(`open === '${id}'`)) && !/bento-grid/.test(detail));
check('every way of building the bracket sits in a fold that starts closed', (knockout.match(/<details className="tool-fold">\s*<summary>(\{exists \?|Build or rebuild)/g) || []).length === 2 && !/tool-fold" open=\{!exists\}/.test(knockout));
check('soft.css is loaded after the other stylesheets, so it can restyle them', main.indexOf("soft.css") > main.indexOf("global.css"));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
