// The knockout plan, as the screen edits it. The database makes the first proposal from the standings
// (propose_knockout_plan) and builds the matches from the final plan (commit_knockout_plan). Everything in
// between, who sits where and what is wrong with it, is decided here.
//
// plan: { rounds: [ [ { a: slot, b: slot } ... ] ... ] }, first round first, the final last.
// slot: { team: id, name?, group?, ... }  a team
//       { w: [round, match] }             the winner of an earlier match
//       { team: null }                    still to be chosen

export const ROUND_NAMES = ['Final', 'Semifinal', 'Quarterfinal', 'Round of 16', 'Round of 32'];

export function roundName(index, roundCount) {
  return ROUND_NAMES[roundCount - 1 - index] || `Round ${index + 1}`;
}

const SHORT = ['Final', 'SF', 'QF', 'R16', 'R32'];

// "QF1" for the first match of the quarter finals, "Final" for the last
export function matchShort(roundIndex, matchIndex, roundCount) {
  const short = SHORT[roundCount - 1 - roundIndex] || `R${roundIndex + 1}`;
  if (short === 'Final') return 'Final';
  return `${short}${/\d$/.test(short) ? '-' : ''}${matchIndex + 1}`;
}

export function winnerLabel(slot, roundCount) {
  return `Winner ${matchShort(slot.w[0], slot.w[1], roundCount)}`;
}

// keeps only what the database reads from a plan
export function toRpcPlan(plan) {
  return {
    rounds: plan.rounds.map((round) =>
      round.map((match) => ({ a: cleanSlot(match.a), b: cleanSlot(match.b) }))
    ),
  };
}

function cleanSlot(slot) {
  if (slot && slot.w) return { w: slot.w };
  return { team: slot && slot.team ? slot.team : null };
}

// What stops this plan being built. [] when it can be.
export function planProblems(plan) {
  const out = [];
  const seen = new Map();
  const fed = new Set();
  const n = plan.rounds.length;
  plan.rounds.forEach((round, r) => {
    round.forEach((match, m) => {
      let empty = 0;
      ['a', 'b'].forEach((side) => {
        const slot = match[side];
        const where = `${matchShort(r, m, n)}`;
        if (slot && slot.w) {
          fed.add(`${slot.w[0]}:${slot.w[1]}`);
        } else if (!slot || !slot.team) {
          empty += 1;
        } else if (seen.has(slot.team)) {
          out.push(`${slot.name || 'A team'} is in two places (${seen.get(slot.team)} and ${where})`);
        } else {
          seen.set(slot.team, where);
        }
      });
      if (empty > 0) out.push(`${matchShort(r, m, n)} still needs ${empty === 2 ? 'two teams' : 'a team'}`);
    });
  });
  plan.rounds.slice(0, -1).forEach((round, r) => {
    round.forEach((_, m) => {
      if (!fed.has(`${r}:${m}`)) out.push(`The winner of ${matchShort(r, m, n)} goes nowhere`);
    });
  });
  return out;
}

// Teams meeting in the first round that came out of the same group, as [{ match, group }].
// teamGroup: { teamId: groupName }
export function firstRoundClashes(plan, teamGroup) {
  const out = [];
  (plan.rounds[0] || []).forEach((match, m) => {
    const ga = match.a && match.a.team ? teamGroup[match.a.team] : null;
    const gb = match.b && match.b.team ? teamGroup[match.b.team] : null;
    if (ga && gb && ga === gb) out.push({ match: m, group: ga });
  });
  return out;
}

// Leave out the first round: the matches that were fed by it now need a team picked by hand.
// Winners from later rounds move one round down.
export function dropFirstRound(plan) {
  if (plan.rounds.length < 2) return plan;
  const rounds = plan.rounds.slice(1).map((round) =>
    round.map((match) => ({
      a: shiftSlot(match.a),
      b: shiftSlot(match.b),
    }))
  );
  return { ...plan, rounds };
}

function shiftSlot(slot) {
  if (slot && slot.w) {
    if (slot.w[0] === 0) return { team: null };
    return { w: [slot.w[0] - 1, slot.w[1]] };
  }
  return slot;
}

// swap the two sides of a match, which only changes who is team A on the scoreboard
export function swapSides(plan, r, m) {
  const rounds = plan.rounds.map((round) => round.slice());
  const match = rounds[r][m];
  rounds[r][m] = { ...match, a: match.b, b: match.a };
  return { ...plan, rounds };
}

// put a chosen team (or winner) into one slot. If the team sat somewhere else it swaps places with
// what was here, so a team is never in two places at once.
export function placeInSlot(plan, r, m, side, choice) {
  const rounds = plan.rounds.map((round) => round.map((match) => ({ ...match })));
  const here = rounds[r][m][side];
  if (choice && choice.team) {
    for (let rr = 0; rr < rounds.length; rr += 1) {
      for (let mm = 0; mm < rounds[rr].length; mm += 1) {
        ['a', 'b'].forEach((s) => {
          if (rr === r && mm === m && s === side) return;
          const other = rounds[rr][mm][s];
          if (other && other.team === choice.team) rounds[rr][mm][s] = here && here.team ? here : { team: null };
        });
      }
    }
  }
  rounds[r][m][side] = choice;
  return { ...plan, rounds };
}

// the winners the database may be asked to place in a slot of round r, the ones from earlier rounds
// that nothing else uses yet
export function freeWinners(plan, r, m, side) {
  const used = new Set();
  plan.rounds.forEach((round, rr) => {
    round.forEach((match, mm) => {
      ['a', 'b'].forEach((s) => {
        if (rr === r && mm === m && s === side) return;
        const slot = match[s];
        if (slot && slot.w) used.add(`${slot.w[0]}:${slot.w[1]}`);
      });
    });
  });
  const out = [];
  for (let rr = 0; rr < r; rr += 1) {
    plan.rounds[rr].forEach((_, mm) => {
      if (!used.has(`${rr}:${mm}`)) out.push([rr, mm]);
    });
  }
  return out;
}

// the words for an error the database hands back
export function planErrorText(res) {
  if (!res || res.ok) return '';
  switch (res.error) {
    case 'groups_unfinished':
      return `Finish the group matches first, ${res.left} still to play.`;
    case 'override_not_set':
      return 'This knockout has already been played. Changing it needs the override password, and none has been set for this venue yet. Ask the ScoreIt team.';
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
