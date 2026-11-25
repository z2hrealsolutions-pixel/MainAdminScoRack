// Which rule applies to a match, worked out on the screen the same way the database does it
// (matchup_stage_key and division_rule), so the entry form knows whether to ask for sets.
// The database still has the last word.

export function stageKey(matchup, group) {
  if (matchup.group_id) return group && group.is_playoff ? 'playoff' : 'group';
  switch (matchup.stage) {
    case 'Final': return 'final';
    case 'Semifinal': return 'sf';
    case 'Quarterfinal': return 'qf';
    case 'Round of 16': return 'r16';
    case 'Round of 32': return 'r32';
    default: return 'final';
  }
}

export function ruleFor(rules, key) {
  const r = (rules && rules[key]) || {};
  const bestOf = [1, 3, 5].includes(Number(r.best_of)) ? Number(r.best_of) : 1;
  return {
    target: r.target ? Number(r.target) : null,
    win_by: r.win_by ? Number(r.win_by) : 1,
    best_of: bestOf,
    sets_to_win: Math.floor(bestOf / 2) + 1,
  };
}

export function scoreEnds(a, b, rule) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a === b) return false;
  if (!rule || !rule.target) return true;
  const hi = Math.max(a, b);
  return hi >= rule.target && hi - Math.min(a, b) >= (rule.win_by || 1);
}

// rows: [{ a: '11', b: '7' }, ...] as typed. Returns the sets that are filled in, who has won how many,
// and whether they decide the match, which is what the database insists on.
export function readSets(rows, rule) {
  const sets = [];
  let a = 0;
  let b = 0;
  let decided = false;
  const notes = [];
  for (let i = 0; i < rows.length; i += 1) {
    const x = rows[i].a;
    const y = rows[i].b;
    if (x === '' && y === '') continue;
    if (x === '' || y === '') {
      notes.push(`Set ${i + 1} needs both scores`);
      continue;
    }
    const sa = Number(x);
    const sb = Number(y);
    if (decided) {
      notes.push(`The match was already decided before set ${i + 1}`);
      continue;
    }
    if (sa === sb) {
      notes.push(`Set ${i + 1} cannot be level`);
      continue;
    }
    if (!scoreEnds(sa, sb, rule)) notes.push(`Set ${i + 1} (${sa}-${sb}) is not a finished set under this division's rules`);
    sets.push([sa, sb]);
    if (sa > sb) a += 1;
    else b += 1;
    if (a >= rule.sets_to_win || b >= rule.sets_to_win) decided = true;
  }
  return { sets, a, b, decided, notes };
}
