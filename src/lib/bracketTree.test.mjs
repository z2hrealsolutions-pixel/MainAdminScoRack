import assert from 'node:assert/strict';
import { ordinal, tokenLabel, matchLabel, treeFromTemplate, treeFromMatchups, latestEdits, slotErrorText, latestDeclarations, declareErrorText } from './bracketTree.js';

assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd']);
assert.equal(tokenLabel('g1p1', ['Group A', 'Group B']), '1st in Group A');
assert.equal(tokenLabel('g2p2', ['Group A', 'Group B']), '2nd in Group B');
assert.equal(tokenLabel('g3p1'), '1st in Group 3');
assert.equal(tokenLabel('best3r1'), 'Best 3rd place');
assert.equal(tokenLabel('best3r2'), '2nd best 3rd place');
assert.equal(tokenLabel('nonsense'), '');
assert.equal(matchLabel('Final', 1), 'Final');
assert.equal(matchLabel('Semifinal', 2), 'SF2');
assert.equal(matchLabel('Round of 16', 3), 'R16-3');

// from a template: every place is TBD and says where it comes from
const w = (r, m) => ({ w: [r, m] });
const power = { rounds: [[{ a: 'g1p1', b: 'g1p4' }, { a: 'g1p2', b: 'g1p3' }], [{ a: w(0, 0), b: w(0, 1) }]] };
const t = treeFromTemplate(power, ['Group A']);
assert.equal(t.exists, false);
assert.deepEqual(t.rounds.map((r) => r.name), ['Semifinal', 'Final']);
assert.equal(t.rounds[0].matches[0].slots[0].name, null);
assert.equal(t.rounds[0].matches[0].slots[0].sub, '1st in Group A');
assert.equal(t.rounds[0].matches[0].slots[1].sub, '4th in Group A');
assert.equal(t.rounds[1].matches[0].slots[0].sub, 'Winner SF1');
assert.equal(t.rounds[1].matches[0].label, 'Final');
assert.equal(t.rounds[0].matches[0].editable, false);
assert.equal(treeFromTemplate(null), null);
assert.equal(treeFromTemplate({ rounds: [] }), null);

// from matches: names where there are teams, TBD where there are not, and who edited what
const teams = { t1: 'Tanya / Renuka', t2: 'Anusha / Annette', t3: 'Sachini / Erinee', t4: 'Amani / Ruqaiyah' };
const matchups = [
  { id: 'f', stage: 'Final', status: 'scheduled', team_a_id: 't3', team_b_id: null, bracket_position: 1 },
  { id: 's1', stage: 'Semifinal', status: 'complete', team_a_id: 't1', team_b_id: 't2', bracket_position: 1, advances_to_matchup_id: 'f', advances_to_slot: 'team_a' },
  { id: 's2', stage: 'Semifinal', status: 'scheduled', team_a_id: 't4', team_b_id: 't3', bracket_position: 2, advances_to_matchup_id: 'f', advances_to_slot: 'team_b' },
];
const edits = [
  { matchup_id: 'f', slot: 'team_a', old_team_name: 'Tanya / Renuka', edited_by_email: 'old@x.com', edited_at: '2026-11-26T05:00:00Z' },
  { matchup_id: 'f', slot: 'team_a', old_team_name: null, edited_by_email: 'z2hrealsolutions@gmail.com', edited_at: '2026-11-26T06:30:00Z' },
];
assert.equal(latestEdits(edits)['f:team_a'].edited_by_email, 'z2hrealsolutions@gmail.com');
const tree = treeFromMatchups({ matchups, teams, edits, canEdit: true });
assert.equal(tree.exists, true);
assert.deepEqual(tree.rounds.map((r) => r.name), ['Semifinal', 'Final']);
const [sf1, sf2] = tree.rounds[0].matches;
assert.equal(sf1.slots[0].name, 'Tanya / Renuka');
assert.equal(sf1.editable, false, 'a finished match cannot be edited');
assert.equal(sf2.editable, true);
const fin = tree.rounds[1].matches[0];
assert.equal(fin.slots[1].name, null, 'an empty place is TBD');
assert.equal(fin.slots[1].sub, 'Winner SF2');
assert.equal(fin.slots[0].sub, 'Winner SF1');
assert.equal(fin.slots[0].edit.by, 'z2hrealsolutions@gmail.com');
assert.equal(fin.slots[0].edit.at, '2026-11-26T06:30:00Z');
assert.equal(fin.slots[1].edit, null);
assert.equal(fin.editable, true);
assert.equal(treeFromMatchups({ matchups, teams, edits, canEdit: false }).rounds[1].matches[0].editable, false, 'no edit without the right');
assert.equal(treeFromMatchups({ matchups: [], teams, edits }), null);
// a match with scores is not editable even if it still says scheduled
const scored = treeFromMatchups({ matchups: [{ ...matchups[2], hasScores: true }], teams, edits: [], canEdit: true });
assert.equal(scored.rounds[0].matches[0].editable, false);

assert.match(slotErrorText({ ok: false, error: 'match_started' }), /already started/);
assert.match(slotErrorText({ ok: false, error: 'override_invalid', attempts_left: 2 }), /2 tries left/);
assert.match(slotErrorText({ ok: false, error: 'override_not_set' }), /ScoreIt team/);
assert.equal(slotErrorText({ ok: true }), '');

// declaring a winner by hand: who can, and the note that is kept
const decl = [
  { matchup_id: 's2', winner_team_name: 'Amani / Ruqaiyah', reason: 'old', declared_by_email: 'a@x.com', declared_at: '2026-11-26T05:00:00Z' },
  { matchup_id: 's2', winner_team_name: 'Amani / Ruqaiyah', reason: 'Opponents withdrew', declared_by_email: 'z2hrealsolutions@gmail.com', declared_at: '2026-11-26T07:00:00Z' },
];
assert.equal(latestDeclarations(decl).s2.reason, 'Opponents withdrew');
const dt = treeFromMatchups({ matchups, teams, edits: [], declarations: decl, canEdit: true });
const [d1, d2] = dt.rounds[0].matches;
assert.equal(d1.declarable, false, 'a finished match is not declarable');
assert.equal(d2.declarable, true);
assert.equal(d2.declared.by, 'z2hrealsolutions@gmail.com');
assert.equal(d2.declared.winner, 'Amani / Ruqaiyah');
assert.equal(d2.declared.reason, 'Opponents withdrew');
assert.equal(d1.declared, null);
assert.equal(dt.rounds[1].matches[0].declarable, false, 'both teams must be set');
assert.equal(treeFromMatchups({ matchups, teams, edits: [], declarations: [], canEdit: false }).rounds[0].matches[1].declarable, false, 'no declaring without the right');
assert.match(declareErrorText({ ok: false, error: 'already_complete' }), /already been recorded/);
assert.match(declareErrorText({ ok: false, error: 'override_locked', retry_after_seconds: 600 }), /10 minutes/);
assert.match(declareErrorText({ ok: false, error: 'override_invalid', attempts_left: 1 }), /1 try left/);
assert.equal(declareErrorText({ ok: true }), '');

console.log('bracketTree tests passed');
