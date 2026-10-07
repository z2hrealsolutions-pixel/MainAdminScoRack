import { MAX_ADVANCING, bracketSizeFor, clampAdvance, defaultAdvance, roundLabel, sizesDiffer, summarize, toRpcAdvance } from './bracketChoice.js';

let passed = 0, failed = 0;
const check = (label, ok, extra) => { if (ok) { passed++; console.log('PASS:', label); } else { failed++; console.log('FAIL:', label, extra ?? ''); } };

const groups = [{ id: 'a', name: 'Group A', size: 9 }, { id: 'b', name: 'Group B', size: 5 }, { id: 'c', name: 'Group C', size: 10 }];

check('the bracket is the next size up that holds everyone', [[2, 2], [3, 4], [4, 4], [5, 8], [8, 8], [9, 16], [10, 16], [16, 16], [17, 32], [33, 64], [64, 64]].every(([n, s]) => bracketSizeFor(n) === s));
check('the first round is named for its size', roundLabel(2) === 'Final' && roundLabel(4) === 'Semifinals' && roundLabel(8) === 'Quarterfinals' && roundLabel(16) === 'Round of 16' && roundLabel(32) === 'Round of 32' && roundLabel(64) === 'Round of 64');

{
  const s = summarize(groups, { a: 3, b: 2, c: 3 });
  check('your case: 9, 5 and 10 teams, 3, 2 and 3 through, makes 8 teams and quarterfinals', s.valid && s.total === 8 && s.bracketSize === 8 && s.byes === 0 && s.firstRound === 'Quarterfinals' && s.sentence === '8 teams go through: Quarterfinals.');
}
{
  const s = summarize(groups, { a: 4, b: 2, c: 4 });
  check('10 teams make a Round of 16 with 6 byes, said plainly', s.valid && s.total === 10 && s.bracketSize === 16 && s.byes === 6 && s.sentence === '10 teams go through: Round of 16, with 6 byes for the top seeds.');
  check('one bye is singular', summarize(groups, { a: 3, b: 2, c: 2 }).sentence === '7 teams go through: Quarterfinals, with 1 bye for the top seed.');
}
{
  const s = summarize(groups, { a: 1, b: 1, c: 0 });
  check('2 teams is just a final', s.valid && s.total === 2 && s.firstRound === 'Final' && s.byes === 0);
  check('3 teams are semifinals with one bye', (() => { const r = summarize(groups, { a: 2, b: 1, c: 0 }); return r.valid && r.firstRound === 'Semifinals' && r.byes === 1; })());
}
check('a group can send none, and that is not a problem', summarize(groups, { a: 0, b: 4, c: 4 }).valid);

check('more than a group has is explained for that group', summarize(groups, { a: 3, b: 6, c: 3 }).problems.join(' ') === 'Group B has only 5 teams, so 6 cannot advance.');
check('a group with one team says team, not teams', summarize([{ id: 'x', name: 'Solo', size: 1 }, { id: 'y', name: 'Y', size: 4 }], { x: 2, y: 2 }).problems[0] === 'Solo has only 1 team, so 2 cannot advance.');
check('an empty box, a negative or a fraction is asked for again, per group', ['', undefined, null, -1, 1.5, 'x'].every((v) => summarize(groups, { a: v, b: 2, c: 3 }).problems.length > 0 && !summarize(groups, { a: v, b: 2, c: 3 }).valid));
check('fewer than 2 teams, or none, is refused with the reason', summarize(groups, { a: 1, b: 0, c: 0 }).problems[0] === 'At least 2 teams have to advance.' && summarize(groups, { a: 0, b: 0, c: 0 }).problems[0] === 'At least 2 teams have to advance.');
check('more than 64 is refused', summarize([{ id: 'a', name: 'A', size: 40 }, { id: 'b', name: 'B', size: 40 }], { a: 33, b: 33 }).problems[0] === `The most that can advance is ${MAX_ADVANCING}, 66 are chosen.`);
check('exactly 64 is allowed', summarize([{ id: 'a', name: 'A', size: 40 }, { id: 'b', name: 'B', size: 40 }], { a: 32, b: 32 }).valid);
check('an invalid choice says nothing about the bracket', !summarize(groups, { a: 9, b: 9, c: 9 }).sentence && summarize(groups, { a: 9, b: 9, c: 9 }).bracketSize === 0);

check('a start makes sense: 2 from each group, or all of a tiny one', JSON.stringify(defaultAdvance([{ id: 'a', size: 9 }, { id: 'b', size: 1 }])) === '{"a":2,"b":1}');
check('equal and unequal groups are told apart', !sizesDiffer([{ size: 4 }, { size: 4 }]) && sizesDiffer(groups) && !sizesDiffer([]));
check('the database is given each group with a real number', JSON.stringify(toRpcAdvance(groups, { a: '3', b: 2, c: 3 })) === '[{"group_id":"a","advance":3},{"group_id":"b","advance":2},{"group_id":"c","advance":3}]');
check('typing is kept inside what the group can send', clampAdvance('12', 9) === 9 && clampAdvance('-3', 9) === 0 && clampAdvance('2.9', 9) === 2 && clampAdvance('', 9) === '' && clampAdvance('abc', 9) === '' && clampAdvance(5, 5) === 5);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
