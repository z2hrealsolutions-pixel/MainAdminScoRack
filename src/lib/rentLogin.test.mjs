import { eventList, noAccessMessage, linkErrorMessage, sentMessage } from './rentLogin.js';
import { readFileSync } from 'node:fs';
const login = readFileSync(new URL('../pages/Login.jsx', import.meta.url), 'utf8');
let passed = 0, failed = 0;
const check = (label, ok) => { if (ok) { passed++; console.log('PASS:', label); } else { failed++; console.log('FAIL:', label); } };

check('one event', eventList(['Dinking Divas']) === 'Dinking Divas');
check('two events', eventList(['A', 'B']) === 'A and B');
check('three events', eventList(['A', 'B', 'C']) === 'A, B and C');
check('no events', eventList([]) === '' && eventList(null) === '');
check('no access says so plainly', /hasn't been given access to an event/.test(noAccessMessage('no_access')) && /hasn't been given access/.test(noAccessMessage(undefined)));
check('blocked says to contact the team', /blocked/.test(noAccessMessage('blocked')) && /ScoreIt team/.test(noAccessMessage('blocked')));
check('slow down is explained', /Too many tries/.test(noAccessMessage('slow_down')));
check('an account that is not set up points to resending the invitation', /resend your invitation/.test(linkErrorMessage({ message: 'Signups not allowed for otp' })));
check('other link errors are passed on', linkErrorMessage({ message: 'boom' }) === 'boom' && linkErrorMessage(null).length > 0);
check('the sent message names the event', sentMessage(['Dinking Divas'], 'a@b.co').found === 'Found: Dinking Divas.' && /a@b\.co/.test(sentMessage(['X'], 'a@b.co').body));
check('the page asks the database before sending a link', /rpc\('rent_login_check'/.test(login) && login.indexOf("rpc('rent_login_check'") < login.indexOf('signInWithOtp'));
check('the page says "Log in to your event"', /Log in to your event/.test(login) && !/Send access link/.test(login));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
