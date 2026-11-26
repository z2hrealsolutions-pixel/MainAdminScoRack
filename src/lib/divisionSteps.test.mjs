import assert from 'node:assert/strict';
import { computeSteps, nextUp } from './divisionSteps.js';

const base = {
  status: 'draft', formatType: 'group_then_knockout',
  teams: 0, ungrouped: 0, groups: 0, poolMatches: 0, poolMatchesDone: 0, knockoutExists: false, knockoutDone: false,
};
const ids = (p) => computeSteps(p).map((s) => `${s.id}:${s.state}`).join(' ');

// nothing yet: the first step is the current one
assert.equal(ids(base), 'teams:current rules:todo live:todo matches:todo knockout:todo');
assert.equal(nextUp(base).title, 'Add the teams');

// teams but no pools
const teamsOnly = { ...base, teams: 6, ungrouped: 6 };
assert.equal(computeSteps(teamsOnly)[0].state, 'current');
assert.equal(nextUp(teamsOnly).title, 'Put the teams into pools');
assert.match(nextUp({ ...teamsOnly, groups: 2, ungrouped: 2 }).text, /2 teams are not in a pool/);
assert.match(nextUp({ ...teamsOnly, groups: 2, ungrouped: 1 }).text, /1 team is not in a pool/);

// pools made: teams and rules done, going live is next
const pooled = { ...base, teams: 6, groups: 2, poolMatches: 6 };
assert.equal(ids(pooled), 'teams:done rules:done live:current matches:todo knockout:todo');
assert.equal(nextUp(pooled).step, 'live');

// published: playing the pool matches
const playing = { ...pooled, status: 'active', poolMatchesDone: 2 };
assert.equal(ids(playing), 'teams:done rules:done live:done matches:current knockout:todo');
assert.equal(nextUp(playing).title, '4 pool matches left to play');
assert.equal(nextUp({ ...playing, poolMatchesDone: 5 }).title, '1 pool match left to play');

// pool matches done: build the knockout, then play it
const poolsDone = { ...playing, poolMatchesDone: 6 };
assert.equal(nextUp(poolsDone).title, 'Build the knockout');
const ko = { ...poolsDone, knockoutExists: true };
assert.equal(nextUp(ko).title, 'Play the knockout');

// all done
const finished = { ...ko, knockoutDone: true };
assert.ok(computeSteps(finished).every((s) => s.state === 'done'));
assert.equal(nextUp(finished).button, 'Open Go live');
assert.equal(nextUp({ ...finished, status: 'completed' }).button, null);

// a division with no pools has four steps and a bracket step
const single = { ...base, formatType: 'single_elimination', teams: 8 };
assert.equal(ids(single), 'teams:done rules:done live:current knockout:todo');
assert.equal(computeSteps(single)[3].label, 'Bracket');

// a draft with every match played is still waiting to go live: steps are not skipped
const odd = { ...base, teams: 4, groups: 1, poolMatches: 6, poolMatchesDone: 6 };
assert.equal(computeSteps(odd).find((s) => s.state === 'current').id, 'live');

console.log('divisionSteps tests passed');
