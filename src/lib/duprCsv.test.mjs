import { DUPR_HEADERS, buildDuprCsv, csvEscape, defaultExternalId, duprFileName, missingDuprPlayers } from './duprCsv.js';

let passed = 0, failed = 0;
const check = (label, ok, extra) => { if (ok) { passed++; console.log('PASS:', label); } else { failed++; console.log('FAIL:', label, extra ?? ''); } };

// header and two data rows copied from DNL's sample file, exactly as it is
const SAMPLE_HEADER = "matchType,event,date,playerA1,playerA1DuprId,playerA1ExternalId,playerA2,playerA2DuprId,playerA2ExternalId,playerB1,playerB1DuprId,playerB1ExternalId,playerB2,playerB2DuprId,playerB2ExternalId,teamAGame1,teamBGame1,teamAGame2,teamBGame2,teamAGame3,teamBGame3,teamAGame4,teamBGame4,teamAGame5,teamBGame5,location,scoreType";
const SAMPLE_DOUBLES = "D,DNL Qualifier 2 Stage Black Stingers vs Hive Aces - Men's Doubles 3,,Randika Weerasinghe,OW55O2,DNL-f0f8dbec-mens_doubles-3-A1,Mirantha Jayathilake,NNRQM7,DNL-f0f8dbec-mens_doubles-3-A2,Danushka Thilakarathna,4QV7EG,DNL-f0f8dbec-mens_doubles-3-B1,Zihab Aakkeel,4QPZV2,DNL-f0f8dbec-mens_doubles-3-B2,11,9,,,,,,,,,\"Picklebee by 71, 980/2, E W, Perera Mawatha, Colombo 10100\",SIDEOUT";
const SAMPLE_SINGLES = "S,DNL Qualifier 2 Stage Black Stingers vs Hive Aces - Men's Singles 1,,Sankha Atukorale,EWZLEJ,DNL-f0f8dbec-mens_singles-1-A1,,,,Venuja Wijekoon,WZZPPL,DNL-f0f8dbec-mens_singles-1-B1,,,,11,1,,,,,,,,,\"Picklebee by 71, 980/2, E W, Perera Mawatha, Colombo 10100\",SIDEOUT";
const LOCATION = 'Picklebee by 71, 980/2, E W, Perera Mawatha, Colombo 10100';

check('the header is exactly the sample\'s', DUPR_HEADERS.join(',') === SAMPLE_HEADER && DUPR_HEADERS.length === 27);

const doublesRow = { matchup_id: 'x', match_type: 'D', match_date: null, team_a_score: 11, team_b_score: 9, complete: true,
  a1_name: 'Randika Weerasinghe', a1_dupr_id: 'OW55O2', a2_name: 'Mirantha Jayathilake', a2_dupr_id: 'NNRQM7',
  b1_name: 'Danushka Thilakarathna', b1_dupr_id: '4QV7EG', b2_name: 'Zihab Aakkeel', b2_dupr_id: '4QPZV2' };
const singlesRow = { matchup_id: 'y', match_type: 'S', match_date: null, team_a_score: 11, team_b_score: 1, complete: true,
  a1_name: 'Sankha Atukorale', a1_dupr_id: 'EWZLEJ', a2_name: null, a2_dupr_id: null,
  b1_name: 'Venuja Wijekoon', b1_dupr_id: 'WZZPPL', b2_name: null, b2_dupr_id: null };

// with the sample's own event name, blank date and external ids, the output must be the sample's line, byte for byte
const sampleExt = (prefix) => (r, slot) => `DNL-f0f8dbec-${prefix}-${slot}`;
{
  const out = buildDuprCsv([doublesRow], { event: "DNL Qualifier 2 Stage Black Stingers vs Hive Aces - Men's Doubles 3", location: LOCATION, scoreType: 'SIDEOUT', dateMode: 'one', dateValue: '', externalId: sampleExt('mens_doubles-3') });
  check('a doubles row comes out identical to the sample\'s doubles line', out.csv === SAMPLE_HEADER + '\r\n' + SAMPLE_DOUBLES + '\r\n', out.csv);
  const s = buildDuprCsv([singlesRow], { event: "DNL Qualifier 2 Stage Black Stingers vs Hive Aces - Men's Singles 1", location: LOCATION, scoreType: 'SIDEOUT', dateMode: 'one', dateValue: '', externalId: sampleExt('mens_singles-1') });
  check('a singles row comes out identical to the sample\'s singles line, no second players', s.csv === SAMPLE_HEADER + '\r\n' + SAMPLE_SINGLES + '\r\n', s.csv);
  check('every row has 27 columns once the quoted address is respected', out.csv.split('\r\n')[1].match(/("[^"]*"|[^,]*)(,|$)/g).length >= 27);
}

check('values with a comma, a quote or a line break are quoted, quotes doubled', csvEscape('a, b') === '"a, b"' && csvEscape('say "hi"') === '"say ""hi"""' && csvEscape('x\ny') === '"x\ny"' && csvEscape('plain') === 'plain');
check('empty and missing values are empty, zero is kept', csvEscape(null) === '' && csvEscape(undefined) === '' && csvEscape(0) === '0');

// dates
{
  const dated = { ...singlesRow, match_date: '2026-10-04' };
  const each = buildDuprCsv([dated], { dateMode: 'each' }).csv.split('\r\n')[1].split(',');
  const one = buildDuprCsv([dated], { dateMode: 'one', dateValue: '2026-12-25' }).csv.split('\r\n')[1].split(',');
  check('each match carries its own date, or one date for all when chosen', each[2] === '2026-10-04' && one[2] === '2026-12-25');
}

// external ids
{
  const id = defaultExternalId({ matchup_id: '3a6f3ccf-1111-2222-3333-444455556666' }, 'A1', 'f0f8dbec-aaaa-bbbb-cccc-ddddeeeeffff');
  check('default external ids are SCR-division-match-slot, like the sample\'s DNL ones', id === 'SCR-f0f8dbec-3a6f3ccf-A1');
  const cells = buildDuprCsv([doublesRow], { divisionId: 'f0f8dbec-aaaa' }).csv.split('\r\n')[1].split(',');
  check('every player in a match gets a different external id, singles leave the second slots blank', new Set([cells[5], cells[8], cells[11], cells[14]]).size === 4
    && buildDuprCsv([singlesRow], {}).csv.split('\r\n')[1].split(',').slice(6, 9).join('') === '');
}

// leaving rows out
{
  const noDupr = { ...doublesRow, matchup_id: 'z', a2_dupr_id: null };
  const incomplete = { ...singlesRow, matchup_id: 'w', complete: false, b1_name: null, b1_dupr_id: null };
  const rows = [doublesRow, singlesRow, noDupr, incomplete];
  const all = buildDuprCsv(rows, { skipMissingDuprIds: false });
  const skip = buildDuprCsv(rows, { skipMissingDuprIds: true });
  check('a match with a missing player is always left out, and reported', all.included === 3 && all.skippedIncomplete === 1 && all.skippedNoDupr === 0);
  check('a missing DUPR id is exported blank unless the user chooses to skip those matches', all.csv.includes(',Mirantha Jayathilake,,SCR-') === true && skip.included === 2 && skip.skippedNoDupr === 1);
  const m = missingDuprPlayers(rows);
  check('the warning lists exactly who is missing an id and in how many matches', m.players.join(',') === 'Mirantha Jayathilake' && m.matches === 1);
}

check('the file ends with a line break and uses Windows line endings throughout', buildDuprCsv([singlesRow], {}).csv.endsWith('\r\n') && !/[^\r]\n/.test(buildDuprCsv([singlesRow], {}).csv));
check('an empty export is just the header', buildDuprCsv([], {}).csv === SAMPLE_HEADER + '\r\n');
check('file names are tidy', duprFileName('Picklebee by 71', "Men's Singles 3.0+") === 'picklebee-by-71-men-s-singles-3-0-dupr.csv' && duprFileName('', '') === 'venue-division-dupr.csv');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
