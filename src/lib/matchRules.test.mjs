import assert from 'node:assert/strict';
import { stageKey, ruleFor, scoreEnds, readSets } from './matchRules.js';

assert.equal(stageKey({ group_id: 'g', stage: 'group' }, { is_playoff: false }), 'group');
assert.equal(stageKey({ group_id: 'g', stage: 'playoff' }, { is_playoff: true }), 'playoff');
assert.equal(stageKey({ group_id: null, stage: 'Semifinal' }), 'sf');
assert.equal(stageKey({ group_id: null, stage: 'Quarterfinal' }), 'qf');
assert.equal(stageKey({ group_id: null, stage: 'Final' }), 'final');
assert.equal(stageKey({ group_id: null, stage: 'Round of 16' }), 'r16');

const rules = { group: { target: 15, win_by: 2 }, sf: { target: 11, win_by: 2, best_of: 3 } };
assert.deepEqual(ruleFor(rules, 'sf'), { target: 11, win_by: 2, best_of: 3, sets_to_win: 2 });
assert.deepEqual(ruleFor(rules, 'group'), { target: 15, win_by: 2, best_of: 1, sets_to_win: 1 });
assert.deepEqual(ruleFor(rules, 'final'), { target: null, win_by: 1, best_of: 1, sets_to_win: 1 });
assert.deepEqual(ruleFor(null, 'sf'), { target: null, win_by: 1, best_of: 1, sets_to_win: 1 });

const sf = ruleFor(rules, 'sf');
assert.equal(scoreEnds(11, 9, sf), true);
assert.equal(scoreEnds(11, 10, sf), false);
assert.equal(scoreEnds(13, 11, sf), true);

let r = readSets([{ a: '11', b: '7' }, { a: '9', b: '11' }, { a: '11', b: '8' }], sf);
assert.deepEqual(r.sets, [[11, 7], [9, 11], [11, 8]]);
assert.equal(r.a, 2); assert.equal(r.b, 1); assert.equal(r.decided, true); assert.deepEqual(r.notes, []);

r = readSets([{ a: '11', b: '7' }, { a: '11', b: '5' }, { a: '', b: '' }], sf);
assert.equal(r.decided, true); assert.equal(r.sets.length, 2);

r = readSets([{ a: '11', b: '7' }, { a: '', b: '' }, { a: '', b: '' }], sf);
assert.equal(r.decided, false);

r = readSets([{ a: '11', b: '7' }, { a: '11', b: '5' }, { a: '11', b: '2' }], sf);
assert.equal(r.sets.length, 2);
assert.ok(r.notes[0].includes('already decided'));

r = readSets([{ a: '11', b: '10' }, { a: '11', b: '4' }], sf);
assert.equal(r.decided, true);
assert.ok(r.notes[0].includes('not a finished set'));

r = readSets([{ a: '11', b: '' }, { a: '', b: '' }, { a: '', b: '' }], sf);
assert.ok(r.notes[0].includes('needs both'));
r = readSets([{ a: '8', b: '8' }, { a: '', b: '' }, { a: '', b: '' }], sf);
assert.ok(r.notes[0].includes('level'));
console.log('matchRules ok');
