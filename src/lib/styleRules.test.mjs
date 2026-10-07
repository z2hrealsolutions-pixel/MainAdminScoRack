import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Soft Bento, the console's look: solid, calm tiles. No glass and no glow, because this is where forms and tables
// live. A text check on the stylesheet, the look itself was checked in a real browser, both themes.
const here = dirname(fileURLToPath(import.meta.url));
const soft = readFileSync(join(here, '..', 'styles', 'soft.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const main = readFileSync(join(here, '..', 'main.jsx'), 'utf8');
const detail = readFileSync(join(here, '..', 'pages', 'TenantDetail.jsx'), 'utf8');

let passed = 0, failed = 0;
const check = (label, ok, extra) => { if (ok) { passed++; console.log('PASS:', label); } else { failed++; console.log('FAIL:', label, extra ?? ''); } };

check('there is no glass in the console: no blur, no backdrop filter', !/backdrop-filter|blur\(/.test(soft));
check('there is no glow or gradient in the console, only solid tiles', !/gradient|glow/.test(soft));
check('tiles take their colours and shadow from the theme settings', /\.tenant-section,[\s\S]*?background:\s*var\(--soft-tile\)[\s\S]*?box-shadow:\s*var\(--soft-shadow\)/.test(soft));
check('things inside a tile are a shade apart, from the theme settings', /\.division-row,[\s\S]*?background:\s*var\(--soft-inner\)/.test(soft));
check('the venue page is a 12 column bento from 1000 pixels: 7 and 5, then 5 and 7, the rest full width', /repeat\(12, minmax\(0, 1fr\)\)/.test(soft) && /:nth-child\(1\)\s*\{\s*grid-column:\s*span 7/.test(soft) && /:nth-child\(2\)\s*\{\s*grid-column:\s*span 5/.test(soft) && /:nth-child\(4\)\s*\{\s*grid-column:\s*span 7/.test(soft) && /:nth-child\(n \+ 5\)\s*\{\s*grid-column:\s*1 \/ -1/.test(soft));
check('the venue page wraps its sections in the bento grid, and the bento is closed again', /<div className="bento-grid">/.test(detail) && (detail.match(/<div className="bento-grid">/g) || []).length === 1 && detail.lastIndexOf('</div>') > detail.indexOf('bento-grid'));
check('soft.css is loaded after the other stylesheets, so it can restyle them', main.indexOf("soft.css") > main.indexOf("global.css"));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
