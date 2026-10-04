import { pickAddresses } from './addresses.js';

let passed = 0, failed = 0;
const check = (label, ok, extra) => { if (ok) { passed++; console.log('PASS:', label); } else { failed++; console.log('FAIL:', label, extra ?? ''); } };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const all = { publicUrl: 'https://live.scoreit.today', refereeUrl: 'https://reff.scoreit.today', tvUrl: 'https://display.scoreit.today', userAppUrl: 'https://old.vercel.app' };
check('with an address for each role, each venue address is that role\'s address and the venue name, nothing else',
  eq(pickAddresses(all, 'venue-a'), { spectators: 'https://live.scoreit.today/venue-a', tv: 'https://display.scoreit.today/venue-a', referees: 'https://reff.scoreit.today/venue-a' }));
check('with one shared address, the old paths are used: /slug, /slug/tv, /slug/referee',
  eq(pickAddresses({ userAppUrl: 'https://old.vercel.app' }, 'venue-a'), { spectators: 'https://old.vercel.app/venue-a', tv: 'https://old.vercel.app/venue-a/tv', referees: 'https://old.vercel.app/venue-a/referee' }));
check('a role with no address of its own falls back to the shared one, with its path',
  eq(pickAddresses({ publicUrl: 'https://live.scoreit.today', userAppUrl: 'https://old.vercel.app' }, 'v'), { spectators: 'https://live.scoreit.today/v', tv: 'https://old.vercel.app/v/tv', referees: 'https://old.vercel.app/v/referee' }));
check('a role with an address of its own and nothing shared still works, the others are empty',
  eq(pickAddresses({ refereeUrl: 'https://reff.scoreit.today' }, 'v'), { spectators: '', tv: '', referees: 'https://reff.scoreit.today/v' }));
check('nothing set gives nothing', eq(pickAddresses({}, 'v'), { spectators: '', tv: '', referees: '' }));
check('no venue name yet gives nothing, rather than an address ending in /undefined', eq(pickAddresses(all, ''), { spectators: '', tv: '', referees: '' }) && eq(pickAddresses(all, undefined), { spectators: '', tv: '', referees: '' }));
check('a trailing slash is removed and a missing https:// is added',
  pickAddresses({ publicUrl: 'live.scoreit.today/', tvUrl: ' https://display.scoreit.today// ' }, 'v').spectators === 'https://live.scoreit.today/v' && pickAddresses({ tvUrl: ' https://display.scoreit.today// ' }, 'v').tv === 'https://display.scoreit.today/v');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
