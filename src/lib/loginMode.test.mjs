import { pickLoginMode, passwordErrorMessage, adminAddressFor, wrongDoor } from './loginMode.js';
import { readFileSync } from 'node:fs';
const app = readFileSync(new URL('../App.jsx', import.meta.url), 'utf8');
const login = readFileSync(new URL('../pages/Login.jsx', import.meta.url), 'utf8');
let passed = 0, failed = 0;
const check = (label, ok) => { if (ok) { passed++; console.log('PASS:', label); } else { failed++; console.log('FAIL:', label); } };

check('admin.scoreit.today is the admin door', pickLoginMode('admin.scoreit.today') === 'admin');
check('rent.scoreit.today is the rent door', pickLoginMode('rent.scoreit.today') === 'rent');
check('case does not matter', pickLoginMode('RENT.ScoreIt.today') === 'rent' && pickLoginMode('ADMIN.ScoreIt.today') === 'admin');
check('every vercel.app and preview address is the admin door', pickLoginMode('main-admin-sco-rack.vercel.app') === 'admin' && pickLoginMode('main-admin-sco-rack-git-x-z2hxrealsolutions.vercel.app') === 'admin' && pickLoginMode('rent-sco-rack.vercel.app') === 'admin');
check('local development is the admin door, rent.localhost is the rent door', pickLoginMode('localhost') === 'admin' && pickLoginMode('rent.localhost') === 'rent');
check('an address that only contains rent is not the rent door', pickLoginMode('current.example.com') === 'admin' && pickLoginMode('myrent.scoreit.today') === 'admin');
check('empty hostname is the admin door', pickLoginMode('') === 'admin' && pickLoginMode(undefined) === 'admin');
check('the admin twin of a rent address', adminAddressFor('rent.scoreit.today') === 'https://admin.scoreit.today');
check('a preview address has no twin', adminAddressFor('main-admin-sco-rack.vercel.app') === null && adminAddressFor('admin.scoreit.today') === null);
check('tenant person on the admin door is turned away', wrongDoor('admin', false) === 'team-only');
check('ScoreIt admin on the rent door is turned away', wrongDoor('rent', true) === 'tenants-only');
check('the right people on the right doors are let in', wrongDoor('admin', true) === null && wrongDoor('rent', false) === null);
check('wrong password does not say which half was wrong', /do not match/.test(passwordErrorMessage({ message: 'Invalid login credentials' })));
check('rate limit is explained', /Too many/.test(passwordErrorMessage({ message: 'email rate limit exceeded' })));
check('unknown error text is passed on', passwordErrorMessage({ message: 'boom' }) === 'boom');
check('no error text still gives a message', passwordErrorMessage(null).length > 0);

check('the app turns the wrong door away before showing any console screen', /wrongDoor\(pickLoginMode\(window\.location\.hostname\), access\.isOperator\)/.test(app) && app.indexOf('<WrongDoor') < app.indexOf('<AccessContext.Provider'));
check('the sign-in page picks its form from the address alone, no tabs', /pickLoginMode\(window\.location\.hostname\)/.test(login) && !/role="tab"/.test(login));
check('the link form never creates accounts', /shouldCreateUser: false/.test(login));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
