import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Rules a real-browser pass over every screen found were broken, kept from breaking again.
// These are text checks on the styles, the layout itself was checked in a real browser.
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'styles');
const files = readdirSync(root).filter((f) => f.endsWith('.css'));
const css = Object.fromEntries(files.map((f) => [f, readFileSync(join(root, f), 'utf8')]));

let passed = 0, failed = 0;
const check = (label, ok, extra) => { if (ok) { passed++; console.log('PASS:', label); } else { failed++; console.log('FAIL:', label, extra ?? ''); } };

const small = [];
for (const [f, text] of Object.entries(css)) for (const m of text.matchAll(/font-size:\s*([\d.]+)px/g)) if (Number(m[1]) < 12) small.push(`${f} ${m[0]}`);
check('no text is set smaller than 12 pixels anywhere', small.length === 0, small.join('; '));
const clamps = [];
for (const [f, text] of Object.entries(css)) for (const m of text.matchAll(/clamp\(\s*([\d.]+)px/g)) if (Number(m[1]) < 12) clamps.push(`${f} ${m[0]}`);
check('no text that scales with the screen starts smaller than 12 pixels', clamps.length === 0, clamps.join('; '));

const g = css['global.css'];
const touch = /@media \(max-width: 820px\), \(pointer: coarse\)\s*\{([\s\S]*?)\n\}\n/.exec(g);
check('there is a rule for touch screens: phones and anything that is touched', touch !== null);
const body = touch ? touch[1] : '';
check('buttons, fields and selects are at least 44 pixels tall on a touch screen', /\.btn-primary,\s*\.btn-ghost\s*\{[^}]*min-height:\s*44px/.test(body) && /select,[\s\S]*?input:not[\s\S]*?\{[^}]*min-height:\s*44px/.test(body));
check('so are the links and tabs people press: back links, the menu, the brand, match links, bracket buttons', ['.tenants-back', '.back-link', '.topbar-name', '.shell-brand', '.shell-nav-item', '.group-matchup-link', '.bracket-slot', '.bracket-match-label'].every((c) => body.includes(c)) && /\[role='tab'\]\s*\{[^}]*min-height:\s*44px/.test(body));

check('a section of the division page is wider than 620 pixels, so a laptop is used', /\.tenant-section\s*\{[^}]*max-width:\s*1000px/.test(css['tenants.css']) && !/\.tenant-section\s*\{[^}]*max-width:\s*620px/.test(css['tenants.css']));
check('group cards sit side by side where there is room', /\.group-cards\s*\{[^}]*display:\s*grid[^}]*repeat\(auto-fill/.test(css['tenants.css']));

const nav = /\.section-nav\s*\{([^}]*)\}/.exec(css['tenants.css']);
check('the page menu sticks to the top and scrolls sideways', nav && /position:\s*sticky/.test(nav[1]) && /overflow-x:\s*auto/.test(nav[1]));
check('the page menu has no negative margins, they pushed it past the edge of a phone', nav && !/margin:[^;]*(\s-\d|calc\(\s*-)/.test(nav[1]));

check('a player row stacks on a phone, and the rule comes after the row\'s own so it wins', (() => { const r = css['roster.css']; const own = r.indexOf('.roster-edit-row {'); const phone = r.indexOf('@media (max-width: 640px)'); return own !== -1 && phone > own && /grid-template-columns:\s*1fr 1fr/.test(r.slice(phone)); })());
check('the roster import column list wraps instead of running off the screen', /\.csv-format-hint\s*\{[^}]*overflow-wrap:\s*anywhere/.test(css['tenants.css']));
check('the venue table gives up its sport column on a phone', /\.tenants-table th:nth-child\(3\)[\s\S]*?display:\s*none/.test(css['tenants.css']));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
