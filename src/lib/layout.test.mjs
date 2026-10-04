import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// A guard for layout rules that once broke on a real screen. These are only text checks on the
// stylesheets, they cannot see a layout, but they stop the specific mistakes from coming back.
// The Team list once showed an email as a column of single letters: the role dropdown carries
// the shared .text-input class (width 100%), and the narrower rule meant to override it had
// the same strength, so it lost whenever the other stylesheet loaded later.

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'styles');
const tenants = readFileSync(join(root, 'tenants.css'), 'utf8');
const shell = readFileSync(join(root, 'shell.css'), 'utf8');
const global = readFileSync(join(root, 'global.css'), 'utf8');

let passed = 0, failed = 0;
const check = (label, ok, extra) => { if (ok) { passed++; console.log('PASS:', label); } else { failed++; console.log('FAIL:', label, extra ?? ''); } };

const body = (css, selector) => {
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(^|\\n)${esc}\\s*\\{([^}]*)\\}`).exec(css);
  return m ? m[2] : null;
};

check('the shared input rule still says 100% wide (so the Team dropdown rule must be stronger than one class)', /width:\s*100%/.test(body(global, '.text-input') || ''));
const role = body(tenants, '.staff-row .staff-role');
check('the Team role dropdown rule has two classes, so it wins whichever stylesheet loads last', role !== null);
check('...and makes the dropdown its natural width and keeps it from growing', role !== null && /width:\s*auto/.test(role) && /flex:\s*0 0 auto/.test(role));
check('there is no weaker single class .staff-role rule left that could lose again', body(tenants, '.staff-role') === null);
const email = body(tenants, '.staff-email') || '';
check('the address takes the spare room but has a readable minimum, so the controls wrap instead', /flex:\s*1 1 \d+px/.test(email) && /min-width:\s*0/.test(email) && /overflow-wrap:\s*anywhere/.test(email) && !/word-break:\s*break-all/.test(email));
check('a Team row wraps when it is too narrow', /flex-wrap:\s*wrap/.test(body(tenants, '.staff-row') || ''));
check('the "you" and "invited" tags never break into letters', /white-space:\s*nowrap/.test(body(tenants, '.staff-tag') || ''));

const bar = body(shell, '.shell-topbar') || '';
check('the top bar can grow and wrap instead of overlapping on a phone (min-height, not a fixed height)', /min-height:/.test(bar) && !/\n\s*height:\s*\d+px/.test(bar) && /flex-wrap:\s*wrap/.test(bar));
check('a long email is shortened with an ellipsis in the top bar', /text-overflow:\s*ellipsis/.test(body(shell, '.shell-operator') || ''));
const phone = /@media \(max-width:\s*760px\)\s*\{([\s\S]*)\}\s*$/.exec(shell);
check('on a phone the menu stacks above the content instead of taking 200px beside it', phone !== null && /\.shell-body\s*\{[^}]*flex-direction:\s*column/.test(phone[1]) && /\.shell-nav\s*\{[^}]*width:\s*auto/.test(phone[1]));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
