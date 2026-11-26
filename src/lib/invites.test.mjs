// the invitation helper imports the Supabase client, so only its message mapping is checked here
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('./invites.js', import.meta.url), 'utf8');
const fn = src.match(/export function inviteErrorMessage[\s\S]*?\n}\n/)[0].replace('export ', '');
const inviteErrorMessage = new Function(`${fn}; return inviteErrorMessage;`)();
let passed = 0, failed = 0;
const check = (label, ok) => { if (ok) { passed++; console.log('PASS:', label); } else { failed++; console.log('FAIL:', label); } };
check('known codes read as plain words', /expired/.test(inviteErrorMessage('not_signed_in')) && /no pending/i.test(inviteErrorMessage('no_pending_invitation')));
check('an unknown code shows the server message', inviteErrorMessage('x', 'smtp down') === 'smtp down');
check('nothing known still gives a message', inviteErrorMessage().length > 0);
check('the invitation no longer asks Supabase for a link that creates accounts', !/signInWithOtp/.test(src) && /functions\.invoke\('invite-user'/.test(src));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
