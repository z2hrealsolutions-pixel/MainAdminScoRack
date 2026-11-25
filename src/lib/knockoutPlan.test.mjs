import assert from 'node:assert/strict';
import {
  roundName, matchShort, winnerLabel, toRpcPlan, planProblems, firstRoundClashes, dropFirstRound,
  swapSides, placeInSlot, freeWinners, planErrorText,
} from './knockoutPlan.js';
import { PRESETS, presetByKey, describeRule } from './presets.js';

const t = (id, name) => ({ team: id, name });
const w = (r, m) => ({ w: [r, m] });
const playful = () => ({
  rounds: [
    [{ a: t('a1', 'A1'), b: t('b3', 'B3') }, { a: t('b1', 'B1'), b: t('a3', 'A3') }, { a: t('c1', 'C1'), b: t('b2', 'B2') }, { a: t('a2', 'A2'), b: t('c2', 'C2') }],
    [{ a: w(0, 0), b: w(0, 2) }, { a: w(0, 1), b: w(0, 3) }],
    [{ a: w(1, 0), b: w(1, 1) }],
  ],
});

assert.equal(roundName(0, 3), 'Quarterfinal');
assert.equal(roundName(1, 3), 'Semifinal');
assert.equal(roundName(2, 3), 'Final');
assert.equal(roundName(0, 2), 'Semifinal');
assert.equal(matchShort(0, 0, 3), 'QF1');
assert.equal(matchShort(1, 1, 3), 'SF2');
assert.equal(matchShort(2, 0, 3), 'Final');
assert.equal(winnerLabel(w(0, 2), 3), 'Winner QF3');

assert.deepEqual(planProblems(playful()), []);
{
  const bad = playful();
  bad.rounds[0][1].a = t('a1', 'A1');
  assert.ok(planProblems(bad).some((p) => /A1 is in two places/.test(p)));
  const empty = playful();
  empty.rounds[0][0].b = { team: null };
  assert.ok(planProblems(empty).some((p) => /QF1 still needs a team/.test(p)));
  const orphan = playful();
  orphan.rounds[1][1].b = t('zz', 'ZZ');
  assert.ok(planProblems(orphan).some((p) => /winner of QF4 goes nowhere/.test(p)));
}

assert.deepEqual(firstRoundClashes(playful(), { a1: 'A', b3: 'B', b1: 'B', a3: 'A', c1: 'C', b2: 'B', a2: 'A', c2: 'C' }), []);
assert.deepEqual(
  firstRoundClashes(playful(), { a1: 'A', b3: 'A', b1: 'B', a3: 'A', c1: 'C', b2: 'B', a2: 'A', c2: 'C' }),
  [{ match: 0, group: 'A' }]
);

// no quarter finals: the semis now need two teams each, picked by hand
{
  const sf = dropFirstRound(playful());
  assert.equal(sf.rounds.length, 2);
  assert.deepEqual(sf.rounds[0][0], { a: { team: null }, b: { team: null } });
  assert.deepEqual(sf.rounds[1][0], { a: w(0, 0), b: w(0, 1) });
  assert.equal(planProblems(sf).length, 2, 'one line per match that is missing teams');
  assert.ok(planProblems(sf).every((p) => /needs two teams/.test(p)));
  assert.equal(roundName(0, 2), 'Semifinal');
}

// swapping and placing teams
{
  const s = swapSides(playful(), 0, 0);
  assert.equal(s.rounds[0][0].a.team, 'b3');
  const moved = placeInSlot(playful(), 0, 0, 'b', t('c2', 'C2'));
  assert.equal(moved.rounds[0][0].b.team, 'c2');
  assert.equal(moved.rounds[0][3].b.team, 'b3', 'the team that was displaced takes the other seat');
  assert.deepEqual(planProblems(moved), []);
  const w2 = placeInSlot(playful(), 1, 0, 'a', w(0, 1));
  assert.deepEqual(w2.rounds[1][0].a, w(0, 1));
  assert.deepEqual(freeWinners(playful(), 1, 0, 'a'), [[0, 0]], 'only the winner already in this seat is free');
}

assert.deepEqual(toRpcPlan({ rounds: [[{ a: { team: 'x', name: 'X', group: 'A' }, b: w(0, 0) }]] }), { rounds: [[{ a: { team: 'x' }, b: { w: [0, 0] } }]] });
assert.deepEqual(toRpcPlan({ rounds: [[{ a: { team: null }, b: { team: undefined } }]] }), { rounds: [[{ a: { team: null }, b: { team: null } }]] });

assert.match(planErrorText({ ok: false, error: 'groups_unfinished', left: 3 }), /3 still/);
assert.match(planErrorText({ ok: false, error: 'override_invalid', attempts_left: 4 }), /4 tries/);
assert.match(planErrorText({ ok: false, error: 'override_invalid', attempts_left: 1 }), /1 try /);
assert.match(planErrorText({ ok: false, error: 'override_locked', retry_after_seconds: 540 }), /9 minutes/);
assert.match(planErrorText({ ok: false, error: 'override_not_set' }), /none has been set/);
assert.equal(planErrorText({ ok: true }), '');

// the six presets
assert.equal(PRESETS.length, 6);
PRESETS.forEach((p) => {
  const rounds = p.template.rounds;
  const last = rounds[rounds.length - 1];
  assert.equal(last.length, 1, `${p.key} ends in one final`);
  const fed = new Set();
  rounds.forEach((round, r) => round.forEach((match) => ['a', 'b'].forEach((s) => {
    const x = match[s];
    if (x && x.w) { assert.ok(x.w[0] < r, `${p.key} winners come from earlier rounds`); fed.add(`${x.w[0]}:${x.w[1]}`); }
    else assert.match(x, /^(g\d+p\d+|best\d+r\d+)$/, `${p.key} token ${x}`);
  })));
  rounds.slice(0, -1).forEach((round, r) => round.forEach((_, m) => assert.ok(fed.has(`${r}:${m}`), `${p.key} ${r}:${m} is used`)));
  assert.equal(p.tiebreak, 'points');
  assert.equal(p.rules.final.best_of, 3);
  assert.equal(p.rules.sf.best_of, 3);
  assert.equal(p.rules.sf.target, 11);
  assert.equal(p.rules.group.best_of, 1);
  Object.values(p.rules).forEach((r) => assert.equal(r.win_by, 2));
});
assert.equal(presetByKey('playful').rules.qf.target, 15);
assert.equal(presetByKey('playful').rules.group.target, 11);
assert.equal(presetByKey('power').rules.group.target, 15);
assert.equal(presetByKey('solo').rules.group.target, 11);
assert.equal(presetByKey('rising').rules.group.target, 11);
assert.equal(presetByKey('timeless').rules.group.target, 15);
assert.equal(presetByKey('precision').rules.group.target, 15);
assert.equal(presetByKey('nope'), null);
assert.equal(describeRule({ target: 11, win_by: 2, best_of: 3 }), 'Best of 3 sets, each set to 11, win by 2');
assert.equal(describeRule({ target: 15, win_by: 2, best_of: 1 }), 'One game to 15, win by 2');
assert.match(describeRule(null), /Not set/);
console.log('knockoutPlan ok');
