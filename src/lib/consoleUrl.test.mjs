import { pickConsoleUrl } from './consoleUrl.js';

let passed = 0, failed = 0;
const check = (label, ok, extra) => { if (ok) { passed++; console.log('PASS:', label); } else { failed++; console.log('FAIL:', label, extra ?? ''); } };
const long = { origin: 'https://main-admin-sco-rack-abc123-z2hx.vercel.app', hostname: 'main-admin-sco-rack-abc123-z2hx.vercel.app' };

check('an address set by hand always wins, even when the page is open on a long address',
  pickConsoleUrl({ explicit: 'https://main-admin-sco-rack.vercel.app', vercelProduction: 'other.vercel.app', ...long }) === 'https://main-admin-sco-rack.vercel.app');
check('a trailing slash is removed', pickConsoleUrl({ explicit: 'https://main-admin-sco-rack.vercel.app/', ...long }) === 'https://main-admin-sco-rack.vercel.app');
check('an address with no https:// gets one', pickConsoleUrl({ explicit: 'console.example.com', ...long }) === 'https://console.example.com');
check('spaces around it are ignored', pickConsoleUrl({ explicit: '  https://a.vercel.app  ', ...long }) === 'https://a.vercel.app');
check('with nothing set, a long vercel address is swapped for the project production address',
  pickConsoleUrl({ explicit: '', vercelProduction: 'main-admin-sco-rack.vercel.app', ...long }) === 'https://main-admin-sco-rack.vercel.app');
check('local development keeps its own address, the production one is not used',
  pickConsoleUrl({ explicit: '', vercelProduction: 'main-admin-sco-rack.vercel.app', origin: 'http://localhost:5173', hostname: 'localhost' }) === 'http://localhost:5173');
check('a custom domain with nothing set keeps its own address',
  pickConsoleUrl({ explicit: undefined, vercelProduction: 'main-admin-sco-rack.vercel.app', origin: 'https://console.example.com', hostname: 'console.example.com' }) === 'https://console.example.com');
check('with nothing known, the page address is used',
  pickConsoleUrl({ origin: 'https://x.vercel.app', hostname: 'x.vercel.app' }) === 'https://x.vercel.app');
check('missing values do not crash', pickConsoleUrl({}) === '');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
