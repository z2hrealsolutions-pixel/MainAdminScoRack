import { CSV_COLUMNS, parseRosterCsv } from './csv.js';
import { RUBBER_TYPES, rubberLabel } from './matchTypes.js';

let passed = 0, failed = 0;
const check = (label, ok, extra) => { if (ok) { passed++; console.log('PASS:', label); } else { failed++; console.log('FAIL:', label, extra ?? ''); } };

check('the roster CSV column is called is_40_plus, in the same place as before', CSV_COLUMNS.join() === 'team_name,player_name,gender,dupr_id,dupr_email,dupr_rating,is_40_plus');
check('the old name is gone from the column list', !CSV_COLUMNS.includes('is_45_plus'));

const head = 'team_name,player_name,gender,dupr_id,dupr_email,dupr_rating,';
const read = (header, row) => parseRosterCsv(`${header}\n${row}`)[0];
check('TRUE in is_40_plus is read', read(head + 'is_40_plus', ',Ann,F,,,4.1,TRUE').is_40_plus === true);
check('FALSE, blank and yes/1 are read the way they always were', read(head + 'is_40_plus', ',Ann,F,,,4.1,FALSE').is_40_plus === false && read(head + 'is_40_plus', ',Ann,F,,,4.1,').is_40_plus === false && read(head + 'is_40_plus', ',Ann,F,,,4.1,yes').is_40_plus === true && read(head + 'is_40_plus', ',Ann,F,,,4.1,1').is_40_plus === true);
check('an older file that still says is_45_plus is read, nothing is lost', read(head + 'is_45_plus', ',Ann,F,,,4.1,TRUE').is_40_plus === true && read(head + 'is_45_plus', ',Ann,F,,,4.1,FALSE').is_40_plus === false);
check('if a file has both, is_40_plus wins when it has a value', parseRosterCsv('player_name,gender,is_40_plus,is_45_plus\nAnn,F,TRUE,FALSE')[0].is_40_plus === true);
check('...and the old column is used when is_40_plus is empty', parseRosterCsv('player_name,gender,is_40_plus,is_45_plus\nAnn,F,,TRUE')[0].is_40_plus === true);
check('the rest of the row is unchanged', (() => { const r = read(head + 'is_40_plus', 'Team 1,Ann Silva,f,D1,a@b.c,4.25,TRUE'); return r.team_name === 'Team 1' && r.player_name === 'Ann Silva' && r.gender === 'F' && r.dupr_id === 'D1' && r.dupr_rating === '4.25'; })());

check('the rubber type says 40+ in the list a venue picks from', RUBBER_TYPES.some((t) => t.value === 'mixed_45_doubles' && t.label === 'Mixed 40+ doubles'));
check('...while the stored value keeps its name, so existing matches still work', rubberLabel('mixed_45_doubles') === 'Mixed 40+ doubles');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
