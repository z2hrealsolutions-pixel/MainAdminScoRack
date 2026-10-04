import { isOwnDomain, pickConsoleUrl, pickTenantConsoleUrl } from './consoleUrl.js';

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

// ---- your own domain: admin.<domain> and rent.<domain> share one console ----
const admin = { origin: 'https://admin.scoreit.today', hostname: 'admin.scoreit.today' };
const rent = { origin: 'https://rent.scoreit.today', hostname: 'rent.scoreit.today' };
check('on admin.<domain> a sign-in link comes back to admin.<domain>, even with the old vercel address set by hand',
  pickConsoleUrl({ explicit: 'https://main-admin-sco-rack.vercel.app', vercelProduction: 'main-admin-sco-rack.vercel.app', ...admin }) === 'https://admin.scoreit.today');
check('on rent.<domain> it comes back to rent.<domain>, so one console can have two addresses',
  pickConsoleUrl({ explicit: 'https://admin.scoreit.today', ...rent }) === 'https://rent.scoreit.today');
check('a vercel.app address is not an own domain, nor localhost, nor an IP address, nor a bare name',
  !isOwnDomain('x-y-z.vercel.app') && !isOwnDomain('localhost') && !isOwnDomain('app.localhost') && !isOwnDomain('192.168.1.20') && !isOwnDomain('') && !isOwnDomain(undefined));
check('admin.scoreit.today, rent.scoreit.today and a plain domain are', isOwnDomain('admin.scoreit.today') && isOwnDomain('rent.scoreit.today') && isOwnDomain('console.example.com') && isOwnDomain('Admin.ScoreIt.Today'));
check('on local development the address set by hand is still used', pickConsoleUrl({ explicit: 'https://admin.scoreit.today', origin: 'http://localhost:5173', hostname: 'localhost' }) === 'https://admin.scoreit.today');

// ---- the address invitations point at ----
check('the tenant address is VITE_RENT_URL when set', pickTenantConsoleUrl({ rent: 'https://rent.scoreit.today/', console: 'https://admin.scoreit.today' }) === 'https://rent.scoreit.today');
check('a tenant address without https:// gets one', pickTenantConsoleUrl({ rent: 'rent.scoreit.today', console: 'x' }) === 'https://rent.scoreit.today');
check('with no tenant address set, invitations point at the console\'s own address', pickTenantConsoleUrl({ rent: '', console: 'https://admin.scoreit.today' }) === 'https://admin.scoreit.today' && pickTenantConsoleUrl({ console: 'https://c.test' }) === 'https://c.test');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
