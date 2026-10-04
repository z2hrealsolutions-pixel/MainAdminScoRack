import { GROUPS_COLUMNS, GROUPS_EXAMPLE_CSV, buildGroupsTemplate, groupsFileName, matchGroups, parseGroupsCsv } from './groupsCsv.js';

let passed = 0, failed = 0;
const check = (label, ok, extra) => { if (ok) { passed++; console.log('PASS:', label); } else { failed++; console.log('FAIL:', label, extra ?? ''); } };
const teams = ['Ann', 'Ben', 'Cara', 'Dev', 'Esha', 'Farid'].map((n, i) => ({ id: 't' + i, name: n, seed: i + 1, group_id: null }));

// ---------- reading the file ----------
{
  const p = parseGroupsCsv('team_name,group_name\r\nAnn,Group A\r\nBen,Group A\r\n');
  check('a plain file is read, rows are numbered from the header', p.rows.length === 2 && p.rows[0].rowNumber === 2 && p.rows[1].team_name === 'Ben' && p.missingColumns.length === 0);
  const bom = parseGroupsCsv('\uFEFFteam_name,group_name\nAnn,A\nBen,A');
  check('a file saved by Excel with a byte order mark is read', bom.missingColumns.length === 0 && bom.rows[0].team_name === 'Ann');
  const quoted = parseGroupsCsv('team_name,group_name\n"Silva, Ann","Pool, North"\n');
  check('names with commas inside quotes stay whole', quoted.rows[0].team_name === 'Silva, Ann' && quoted.rows[0].group_name === 'Pool, North');
  const names = parseGroupsCsv('Team , Group \nAnn,A');
  check('other common headings are understood: Team and Group, spaces and capitals ignored', names.missingColumns.length === 0 && names.rows[0].group_name === 'A');
  const pool = parseGroupsCsv('TEAM_NAME,POOL\nAnn,A');
  check('"pool" works as the group column', pool.missingColumns.length === 0);
  const blanks = parseGroupsCsv('team_name,group_name\n\nAnn,A\n , \n\nBen,A\n');
  check('empty and comma-only lines are skipped', blanks.rows.length === 2 && blanks.rows[1].team_name === 'Ben');
  check('a file with the wrong columns says which are missing', parseGroupsCsv('player,team\nAnn,A').missingColumns.join(',') === 'group_name' || parseGroupsCsv('x,y\n1,2').missingColumns.join(',') === 'team_name,group_name');
  check('an empty file has no rows and both columns missing', parseGroupsCsv('').rows.length === 0 && parseGroupsCsv('').missingColumns.length === 2);
  check('extra columns are ignored', parseGroupsCsv('team_name,group_name,notes\nAnn,A,hello').rows[0].group_name === 'A');
}

// ---------- checking it against the division ----------
const ok = (text) => matchGroups(parseGroupsCsv(text).rows, teams);
{
  const r = ok('team_name,group_name\nAnn,North\nBen,North\nCara,North\nDev,South\nEsha,South\nFarid,South');
  check('a good file makes two groups of three, in the order they first appear', r.ok && r.groups.map((g) => g.name).join() === 'North,South' && r.groups[0].teams.map((t) => t.name).join() === 'Ann,Ben,Cara' && r.errors.length === 0);
  check('the teams carry their ids, ready to send', r.groups[1].teams[0].id === 't3');
}
{
  const r = ok('team_name,group_name\n ann  ,  pool   one\nBEN,Pool One\nCara,POOL ONE\nDev,B\nesha,b\nFarid,B');
  check('team and group names match whatever the spaces and capitals, and group names merge', r.ok && r.groups.length === 2 && r.groups[0].name === 'pool one' && r.groups[0].teams.length === 3, JSON.stringify(r.errors));
}
{
  const r = ok('team_name,group_name\nAnn,A\nBen,A\nCara,A\nDev,B\nEsha,B\nFarid,B\nZed,B');
  check('a team that is not in the division is named with its row', !r.ok && r.errors.some((e) => e === 'Row 8: there is no team called "Zed" in this division.'));
}
{
  const r = ok('team_name,group_name\nAnn,A\nBen,A\nCara,A\nDev,B\nEsha,B\nFarid,B\nAnn,B');
  check('a team listed twice points to its first row', !r.ok && r.errors.some((e) => e === 'Row 8: "Ann" is listed again, it is already on row 2.'));
}
{
  const r = ok('team_name,group_name\nAnn,A\nBen,A\nCara,A\nDev,B\nEsha,B');
  check('a team left out is named, and every team must be placed', !r.ok && r.errors.length === 1 && r.errors[0].startsWith('1 team is not in the file: Farid.'));
  const many = matchGroups(parseGroupsCsv('team_name,group_name\nAnn,A\nBen,A').rows, Array.from({ length: 14 }, (_, i) => ({ id: 'x' + i, name: i === 0 ? 'Ann' : i === 1 ? 'Ben' : 'Team ' + i, seed: i })));
  check('a long list of missing teams shows eight and counts the rest', many.errors.some((e) => e.startsWith('12 teams are not in the file:') && e.includes('and 4 more')));
}
{
  const r = ok('team_name,group_name\nAnn,A\nBen,B\nCara,B\nDev,B\nEsha,B\nFarid,B');
  check('a group of one is refused', !r.ok && r.errors.includes('Group "A" has only 1 team, a group needs at least 2.'));
}
{
  const r = ok('team_name,group_name\nAnn,\n,A\nBen,A\nCara,A\nDev,A\nEsha,A\nFarid,A');
  check('a missing group and a missing team name are each reported on their row', r.errors.includes('Row 2: "Ann" has no group.') && r.errors.includes('Row 3: there is no team name.'));
}
{
  const r = ok('team_name,group_name\nAnn,Playoff\nBen,playoff\nCara,A\nDev,A\nEsha,A\nFarid,A');
  check('the name Playoff is refused', r.errors.some((e) => e.includes('"Playoff" is kept for the playoff stage')));
  const long = ok('team_name,group_name\nAnn,' + 'x'.repeat(41) + '\nBen,' + 'x'.repeat(41) + '\nCara,A\nDev,A\nEsha,A\nFarid,A');
  check('a group name over 40 characters is refused', long.errors.some((e) => e.includes('longer than 40 characters')));
}
{
  const dup = [...teams.slice(0, 5), { id: 'dupe', name: ' ann', seed: 9 }];
  const r = matchGroups(parseGroupsCsv('team_name,group_name\nAnn,A\nBen,A\nCara,A\nDev,B\nEsha,B').rows, dup);
  check('two teams with the same name make the file ambiguous and say so', !r.ok && r.errors.some((e) => e.includes('"Ann" matches more than one team')));
}
check('no rows is not ok', !matchGroups([], teams).ok);

// ---------- the templates ----------
{
  const t = buildGroupsTemplate(teams, []);
  check('the template lists every team of the division with an empty group, with the Excel marks', t.startsWith('\uFEFFteam_name,group_name\r\n') && t.split('\r\n').length === 8 && t.includes('Ann,\r\n') && t.endsWith('\r\n'));
  const groups = [{ id: 'g1', name: 'Pool 1', is_playoff: false }, { id: 'g2', name: 'Pool, 2', is_playoff: false }, { id: 'gp', name: 'Playoff', is_playoff: true }];
  const placed = teams.map((x, i) => ({ ...x, group_id: i < 3 ? 'g2' : 'g1' }));
  const t2 = buildGroupsTemplate(placed, groups);
  check('the current groups are filled in, in group order, and a comma in a name is quoted', t2.split('\r\n')[1] === 'Dev,Pool 1' && t2.includes('Ann,"Pool, 2"'));
  const round = matchGroups(parseGroupsCsv(t2).rows, placed);
  check('a template with the groups filled in reads back as the same two groups', round.ok && round.groups.length === 2 && round.groups.map((g) => g.teams.length).join() === '3,3', JSON.stringify(round.errors));
  check('the playoff group is never written into the template', !t2.includes('Playoff'));
}
{
  const ex = parseGroupsCsv(GROUPS_EXAMPLE_CSV);
  check('the example file reads cleanly: 6 rows, 2 groups', ex.missingColumns.length === 0 && ex.rows.length === 6 && new Set(ex.rows.map((r) => r.group_name)).size === 2);
  check('the columns are exactly team_name and group_name', GROUPS_COLUMNS.join() === 'team_name,group_name');
  check('template file names are tidy', groupsFileName("Men's Singles 3.0+") === 'men-s-singles-3-0-groups-template.csv' && groupsFileName('') === 'division-groups-template.csv');
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
