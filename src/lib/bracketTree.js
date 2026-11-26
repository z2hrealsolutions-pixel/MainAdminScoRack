// The knockout as a tree. Pure, so it can be tested without a screen.
//
// Before the bracket exists the tree comes from the division's template: every place is still to be decided, so
// it reads "TBD" with where the team will come from ("1st in Group A", "Winner SF1").
// Once the matches exist the tree comes from them. A place with no team yet is still "TBD".
import { roundName, matchShort } from './knockoutPlan.js';

const ROUND_ORDER = ['Round of 32', 'Round of 16', 'Quarterfinal', 'Semifinal', 'Final'];
const STAGE_ABBR = { 'Round of 32': 'R32', 'Round of 16': 'R16', Quarterfinal: 'QF', Semifinal: 'SF' };

export function ordinal(n) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  return `${n}${({ 1: 'st', 2: 'nd', 3: 'rd' })[n % 10] || 'th'}`;
}

// "g1p1" -> "1st in Group A", "best3r1" -> "Best 3rd place", "best3r2" -> "2nd best 3rd place"
export function tokenLabel(token, groupNames = []) {
  const g = /^g(\d+)p(\d+)$/.exec(token || '');
  if (g) return `${ordinal(Number(g[2]))} in ${groupNames[Number(g[1]) - 1] || `Group ${g[1]}`}`;
  const b = /^best(\d+)r(\d+)$/.exec(token || '');
  if (b) {
    const k = Number(b[2]);
    return k === 1 ? `Best ${ordinal(Number(b[1]))} place` : `${ordinal(k)} best ${ordinal(Number(b[1]))} place`;
  }
  return '';
}

export function matchLabel(stage, position) {
  if (stage === 'Final') return 'Final';
  const abbr = STAGE_ABBR[stage] ?? stage;
  return `${abbr}${/\d$/.test(abbr) ? '-' : ''}${position ?? ''}`;
}

function sortStages(stages) {
  return [...stages].sort((a, b) => {
    const ai = ROUND_ORDER.indexOf(a);
    const bi = ROUND_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

// the tree before any match exists, from the template
export function treeFromTemplate(template, groupNames = []) {
  if (!template || !Array.isArray(template.rounds) || template.rounds.length === 0) return null;
  const n = template.rounds.length;
  const slot = (s) => {
    if (s && typeof s === 'object' && Array.isArray(s.w)) {
      return { name: null, sub: `Winner ${matchShort(s.w[0], s.w[1], n)}`, edit: null };
    }
    return { name: null, sub: tokenLabel(s, groupNames), edit: null };
  };
  return {
    exists: false,
    rounds: template.rounds.map((round, r) => ({
      name: roundName(r, n),
      matches: round.map((m, i) => ({
        key: `t${r}-${i}`,
        id: null,
        label: matchShort(r, i, n),
        status: 'scheduled',
        when: '',
        slots: [{ side: 'a', ...slot(m.a) }, { side: 'b', ...slot(m.b) }],
        editable: false,
      })),
    })),
  };
}

// the latest edit of each place, keyed "matchupId:team_a"
export function latestEdits(edits) {
  const out = {};
  (edits || []).forEach((e) => {
    const key = `${e.matchup_id}:${e.slot}`;
    if (!out[key] || new Date(e.edited_at) > new Date(out[key].edited_at)) out[key] = e;
  });
  return out;
}

// the tree from the real matches
// the latest hand-declared winner of each match, keyed by match id
export function latestDeclarations(list) {
  const out = {};
  (list || []).forEach((d) => {
    if (!out[d.matchup_id] || new Date(d.declared_at) > new Date(out[d.matchup_id].declared_at)) out[d.matchup_id] = d;
  });
  return out;
}

export function treeFromMatchups({ matchups, teams, edits, declarations, canEdit }) {
  if (!matchups || matchups.length === 0) return null;
  const latest = latestEdits(edits);
  const declared = latestDeclarations(declarations);
  const stages = sortStages([...new Set(matchups.map((m) => m.stage))]);
  const feederOf = (m, slotName) =>
    matchups.find((f) => f.advances_to_matchup_id === m.id && f.advances_to_slot === slotName);

  return {
    exists: true,
    rounds: stages.map((stage) => ({
      name: stage,
      matches: matchups
        .filter((m) => m.stage === stage)
        .sort((a, b) => (a.bracket_position ?? 0) - (b.bracket_position ?? 0))
        .map((m) => {
          const played = m.status === 'complete' || m.status === 'live' || m.winner_team_id_override || m.hasScores;
          const slots = [['a', 'team_a', m.team_a_id], ['b', 'team_b', m.team_b_id]].map(([side, slotName, teamId]) => {
            const feeder = feederOf(m, slotName);
            const e = latest[`${m.id}:${slotName}`];
            return {
              side,
              slot: slotName,
              teamId: teamId || null,
              name: teamId ? teams[teamId] ?? 'Unknown team' : null,
              sub: feeder ? `Winner ${matchLabel(feeder.stage, feeder.bracket_position)}` : '',
              edit: e
                ? { by: e.edited_by_email || 'Unknown', at: e.edited_at, from: e.old_team_name || null }
                : null,
            };
          });
          return {
            key: m.id,
            id: m.id,
            label: matchLabel(m.stage, m.bracket_position),
            status: m.status,
            when: [m.court, m.scheduled_date, m.scheduled_time].filter(Boolean).join(' · '),
            slots,
            editable: Boolean(canEdit) && m.status === 'scheduled' && !played,
            declarable: Boolean(canEdit) && Boolean(m.team_a_id) && Boolean(m.team_b_id) && m.status !== 'complete' && m.status !== 'bye',
            declared: declared[m.id]
              ? {
                  by: declared[m.id].declared_by_email || 'Unknown',
                  at: declared[m.id].declared_at,
                  winner: declared[m.id].winner_team_name,
                  reason: declared[m.id].reason || null,
                }
              : null,
          };
        }),
    })),
  };
}

// the words for what set_bracket_slot hands back
export function slotErrorText(res) {
  if (!res || res.ok) return '';
  switch (res.error) {
    case 'match_started':
      return 'This match has already started, so its teams cannot be changed.';
    case 'same_team':
      return 'That team is already in the other place of this match.';
    case 'unchanged':
      return 'That team is already in this place.';
    case 'team_not_in_division':
      return 'Pick a team from this division.';
    case 'not_knockout':
    case 'match_is_bye':
      return 'This place cannot be edited.';
    case 'override_not_set':
      return 'Editing the bracket needs the override password, and none has been set for this tenant yet. Ask the ScoreIt team.';
    case 'override_invalid':
      return `That override password is not right. ${res.attempts_left} ${res.attempts_left === 1 ? 'try' : 'tries'} left.`;
    case 'override_locked': {
      const mins = Math.max(1, Math.ceil((res.retry_after_seconds || 60) / 60));
      return `Too many wrong tries. Wait ${mins} minute${mins === 1 ? '' : 's'} and try again.`;
    }
    default:
      return 'Something went wrong. Try again.';
  }
}

// the words for what declare_bracket_winner hands back
export function declareErrorText(res) {
  if (!res || res.ok) return '';
  switch (res.error) {
    case 'already_complete':
      return 'A winner has already been recorded for this match.';
    case 'teams_not_set':
      return 'Both teams must be set before a winner can be declared.';
    case 'not_in_match':
      return 'The winner has to be one of the two teams in this match.';
    case 'reason_too_long':
      return 'The reason is too long. Keep it under 300 characters.';
    case 'not_knockout':
    case 'match_is_bye':
      return 'A winner cannot be declared for this match.';
    case 'override_not_set':
      return 'Declaring a winner by hand needs the override password, and none has been set for this tenant yet. Ask the ScoreIt team.';
    case 'override_invalid':
      return `That override password is not right. ${res.attempts_left} ${res.attempts_left === 1 ? 'try' : 'tries'} left.`;
    case 'override_locked': {
      const mins = Math.max(1, Math.ceil((res.retry_after_seconds || 60) / 60));
      return `Too many wrong tries. Wait ${mins} minute${mins === 1 ? '' : 's'} and try again.`;
    }
    default:
      return 'Something went wrong. Try again.';
  }
}
