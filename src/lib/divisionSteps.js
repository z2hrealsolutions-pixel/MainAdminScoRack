// The path through a division, worked out from what already exists. Pure, so it can be tested.
//
// progress = {
//   status, formatType,
//   teams,            how many teams
//   ungrouped,        teams not in a pool yet
//   groups,           how many pools
//   poolMatches, poolMatchesDone,
//   knockoutExists, knockoutDone
// }

export function hasPools(formatType) {
  return formatType === 'group_then_knockout';
}

export function computeSteps(progress) {
  const p = progress;
  const pools = hasPools(p.formatType);

  const teamsDone = pools ? p.teams > 0 && p.groups > 0 && p.ungrouped === 0 : p.teams > 0;
  const live = p.status !== 'draft';
  const matchesDone = p.poolMatches > 0 && p.poolMatchesDone >= p.poolMatches;

  const raw = pools
    ? [
        { id: 'teams', label: 'Teams & pools', done: teamsDone },
        { id: 'rules', label: 'Rules', done: teamsDone },
        { id: 'live', label: 'Go live', done: live },
        { id: 'matches', label: 'Pool matches', done: matchesDone },
        { id: 'knockout', label: 'Knockout', done: p.knockoutExists && p.knockoutDone },
      ]
    : [
        { id: 'teams', label: 'Teams', done: teamsDone },
        { id: 'rules', label: 'Rules', done: teamsDone },
        { id: 'live', label: 'Go live', done: live },
        { id: 'knockout', label: 'Bracket', done: p.knockoutExists && p.knockoutDone },
      ];

  let currentSet = false;
  return raw.map((s, i) => {
    let state = 'todo';
    if (s.done) state = 'done';
    else if (!currentSet) {
      state = 'current';
      currentSet = true;
    }
    return { ...s, number: i + 1, state };
  });
}

// the one thing to do next, in plain words
export function nextUp(progress) {
  const p = progress;
  const steps = computeSteps(p);
  const current = steps.find((s) => s.state === 'current');
  if (!current) {
    return p.status === 'completed'
      ? { step: 'live', title: 'This division is finished', text: 'Everything has been played and it is marked completed.', button: null }
      : { step: 'live', title: 'Everything is played', text: 'Mark the division completed when you are ready.', button: 'Open Go live' };
  }
  switch (current.id) {
    case 'teams':
      if (p.teams === 0) {
        return { step: 'teams', title: 'Add the teams', text: 'Import the teams from a file, or add them one at a time.', button: 'Add teams' };
      }
      if (p.groups === 0) {
        return { step: 'teams', title: 'Put the teams into pools', text: `${p.teams} teams are added. Choose how many pools, or import the pools from a file.`, button: 'Set up pools' };
      }
      return { step: 'teams', title: 'Finish the pools', text: `${p.ungrouped} team${p.ungrouped === 1 ? ' is' : 's are'} not in a pool yet.`, button: 'Set up pools' };
    case 'live':
      return { step: 'live', title: 'Publish this division', text: 'It is a draft, so referees cannot score it and the public cannot see it. Publish it when the teams and rules are right.', button: 'Go live' };
    case 'matches': {
      const left = Math.max(0, p.poolMatches - p.poolMatchesDone);
      return { step: 'matches', title: `${left} pool match${left === 1 ? '' : 'es'} left to play`, text: 'Open a match to enter its score, or set its court and time.', button: 'See matches' };
    }
    case 'knockout':
      return p.knockoutExists
        ? { step: 'knockout', title: 'Play the knockout', text: 'Open a match to enter its score. Winners move on by themselves.', button: 'See the bracket' }
        : { step: 'knockout', title: 'Build the knockout', text: 'The pool matches are done. Check who plays whom, then create the bracket.', button: 'Build the knockout' };
    default:
      return { step: current.id, title: current.label, text: '', button: 'Open' };
  }
}
