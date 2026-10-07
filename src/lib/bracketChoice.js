// Choosing how many teams advance from each group. All the arithmetic is here, so what the
// screen says ("10 teams go through, a Round of 16 with 6 byes") is the same arithmetic the
// database does when it builds the bracket.

export const MAX_ADVANCING = 64;

// the bracket round a number of teams starts in
export function roundLabel(bracketSize) {
  const matches = bracketSize / 2;
  if (matches === 1) return 'Final';
  if (matches === 2) return 'Semifinals';
  if (matches === 4) return 'Quarterfinals';
  return `Round of ${bracketSize}`;
}

// the next size up that holds everyone: 4, 8, 16, 32, 64
export function bracketSizeFor(teams) {
  let size = 2;
  while (size < teams) size *= 2;
  return size;
}

// groups: [{ id, name, size }], advance: { [groupId]: number }
export function summarize(groups, advance) {
  const problems = [];
  let total = 0;
  for (const g of groups) {
    const raw = advance[g.id];
    const n = Number(raw);
    if (raw === '' || raw === undefined || raw === null || Number.isNaN(n) || !Number.isInteger(n) || n < 0) {
      problems.push(`Choose a whole number for ${g.name}, 0 if none of its teams advance.`);
      continue;
    }
    if (n > g.size) {
      problems.push(`${g.name} has only ${g.size} team${g.size === 1 ? '' : 's'}, so ${n} cannot advance.`);
      continue;
    }
    total += n;
  }
  if (problems.length === 0 && total < 2) problems.push('At least 2 teams have to advance.');
  if (problems.length === 0 && total > MAX_ADVANCING) problems.push(`The most that can advance is ${MAX_ADVANCING}, ${total} are chosen.`);
  const valid = problems.length === 0;
  const size = valid ? bracketSizeFor(total) : 0;
  const byes = valid ? size - total : 0;
  return {
    valid,
    problems,
    total,
    bracketSize: size,
    byes,
    firstRound: valid ? roundLabel(size) : '',
    sentence: valid
      ? `${total} team${total === 1 ? '' : 's'} go${total === 1 ? 'es' : ''} through: ${roundLabel(size)}${byes > 0 ? `, with ${byes} bye${byes === 1 ? '' : 's'} for the top seed${byes === 1 ? '' : 's'}` : ''}.`
      : '',
  };
}

// a start that makes sense: 2 from every group, or all of a small group
export function defaultAdvance(groups) {
  const out = {};
  groups.forEach((g) => {
    out[g.id] = Math.min(2, g.size);
  });
  return out;
}

export function sizesDiffer(groups) {
  return new Set(groups.map((g) => g.size)).size > 1;
}

// what the database is given
export function toRpcAdvance(groups, advance) {
  return groups.map((g) => ({ group_id: g.id, advance: Number(advance[g.id]) }));
}

// a number typed into a box, kept inside what the group can send
export function clampAdvance(value, size) {
  if (value === '') return '';
  const n = Math.floor(Number(value));
  if (Number.isNaN(n)) return '';
  return Math.max(0, Math.min(size, n));
}
