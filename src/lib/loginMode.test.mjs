import { pickLoginMode, passwordErrorMessage } from './loginMode.js';
let passed = 0, failed = 0;
const check = (label, ok) => { if (ok) { passed++; console.log('PASS:', label); } else { failed++; console.log('FAIL:', label); } };

check('admin.scoreit.today shows the password sign-in only', pickLoginMode('admin.scoreit.today') === 'admin');
check('rent.scoreit.today shows the email link only', pickLoginMode('rent.scoreit.today') === 'rent');
check('case does not matter', pickLoginMode('ADMIN.ScoreIt.today') === 'admin');
check('a preview address shows both', pickLoginMode('main-admin-sco-rack-git-x-z2hxrealsolutions.vercel.app') === 'both');
check('local development shows both', pickLoginMode('localhost') === 'both');
check('an address that only contains admin shows both', pickLoginMode('myadmin.example.com') === 'both');
check('empty hostname shows both', pickLoginMode('') === 'both' && pickLoginMode(undefined) === 'both');
check('wrong password does not say which half was wrong', /do not match/.test(passwordErrorMessage({ message: 'Invalid login credentials' })));
check('rate limit is explained', /Too many/.test(passwordErrorMessage({ message: 'email rate limit exceeded' })));
check('unknown error text is passed on', passwordErrorMessage({ message: 'boom' }) === 'boom');
check('no error text still gives a message', passwordErrorMessage(null).length > 0);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
