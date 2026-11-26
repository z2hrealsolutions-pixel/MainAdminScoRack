import assert from 'node:assert/strict';
import { renameErrorText } from './teamRename.js';

assert.equal(renameErrorText({ ok: true }), '');
assert.equal(renameErrorText(null), '');
assert.match(renameErrorText({ ok: false, error: 'name_empty' }), /Type a name/);
assert.match(renameErrorText({ ok: false, error: 'name_taken' }), /already has that name/);
assert.match(renameErrorText({ ok: false, error: 'name_too_long' }), /too long/);
assert.match(renameErrorText({ ok: false, error: 'override_not_set' }), /ScoreIt team/);
assert.match(renameErrorText({ ok: false, error: 'override_invalid', attempts_left: 1 }), /1 try left/);
assert.match(renameErrorText({ ok: false, error: 'override_invalid', attempts_left: 3 }), /3 tries left/);
assert.match(renameErrorText({ ok: false, error: 'override_locked', retry_after_seconds: 599 }), /10 minutes/);
assert.match(renameErrorText({ ok: false, error: 'override_locked', retry_after_seconds: 30 }), /1 minute\b/);
assert.match(renameErrorText({ ok: false, error: 'weird' }), /Something went wrong/);
console.log('teamRename tests passed');
