import Papa from 'papaparse';
import { csvEscape } from './duprCsv.js';

// Importing a venue's own groups. The file has two columns, a team and the group it
// goes in. The reading and checking happens here, on the screen, so a mistake is
// explained before anything is sent. The database checks everything again.

export const GROUPS_COLUMNS = ['team_name', 'group_name'];
export const MAX_GROUP_NAME = 40;

// "Ann  Silva", "ann silva " and "ANN SILVA" are the same team
const key = (v) => String(v || '').trim().replace(/\s+/g, ' ').toLowerCase();
const tidy = (v) => String(v || '').trim().replace(/\s+/g, ' ');

function headerName(h) {
  const k = String(h || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['team_name', 'team', 'name', 'team_names'].includes(k)) return 'team_name';
  if (['group_name', 'group', 'pool', 'group_names'].includes(k)) return 'group_name';
  return k;
}

export function parseGroupsCsv(text) {
  const clean = String(text || '').replace(/^\uFEFF/, '');
  const res = Papa.parse(clean, { header: true, skipEmptyLines: 'greedy', transformHeader: headerName });
  const fields = (res.meta && res.meta.fields) || [];
  const missingColumns = GROUPS_COLUMNS.filter((c) => !fields.includes(c));
  const rows = res.data.map((r, i) => ({
    rowNumber: i + 2, // the header is row 1
    team_name: tidy(r.team_name),
    group_name: tidy(r.group_name),
  }));
  return { rows, missingColumns };
}

// Turns the rows into groups of this division's real teams, or says what is wrong,
// by row where it can. Every team has to be placed exactly once, and every group
// needs at least two teams, the same rules the database applies.
export function matchGroups(rows, teams) {
  const errors = [];
  const byKey = new Map();
  teams.forEach((t) => {
    const k = key(t.name);
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(t);
  });
  const ambiguous = new Set([...byKey].filter(([, list]) => list.length > 1).map(([k]) => k));
  const placed = new Map();
  const groups = new Map();

  rows.forEach((r) => {
    if (!r.team_name) {
      errors.push(`Row ${r.rowNumber}: there is no team name.`);
      return;
    }
    if (!r.group_name) {
      errors.push(`Row ${r.rowNumber}: "${r.team_name}" has no group.`);
      return;
    }
    const k = key(r.team_name);
    if (ambiguous.has(k)) {
      errors.push(`Row ${r.rowNumber}: "${r.team_name}" matches more than one team in this division, give those teams different names first.`);
      return;
    }
    const team = (byKey.get(k) || [])[0];
    if (!team) {
      errors.push(`Row ${r.rowNumber}: there is no team called "${r.team_name}" in this division.`);
      return;
    }
    if (placed.has(team.id)) {
      errors.push(`Row ${r.rowNumber}: "${team.name}" is listed again, it is already on row ${placed.get(team.id)}.`);
      return;
    }
    placed.set(team.id, r.rowNumber);
    const gk = key(r.group_name);
    if (!groups.has(gk)) groups.set(gk, { name: r.group_name, teams: [] });
    groups.get(gk).teams.push({ id: team.id, name: team.name });
  });

  groups.forEach((g) => {
    if (g.name.length > MAX_GROUP_NAME) errors.push(`The group name "${g.name}" is longer than ${MAX_GROUP_NAME} characters.`);
    if (key(g.name) === 'playoff') errors.push('The name "Playoff" is kept for the playoff stage, choose another group name.');
    if (g.teams.length < 2) errors.push(`Group "${g.name}" has only ${g.teams.length} team, a group needs at least 2.`);
  });

  const missing = teams.filter((t) => !placed.has(t.id));
  if (missing.length > 0) {
    const shown = missing.slice(0, 8).map((t) => t.name).join(', ');
    const more = missing.length > 8 ? ` and ${missing.length - 8} more` : '';
    errors.push(`${missing.length} team${missing.length === 1 ? ' is' : 's are'} not in the file: ${shown}${more}. Every team has to be in a group.`);
  }

  const list = [...groups.values()];
  return { groups: list, errors, ok: errors.length === 0 && list.length > 0 };
}

const withExcelMarks = (lines) => '\uFEFF' + lines.join('\r\n') + '\r\n';

// The division's own teams, one per row, with the group column filled in from the
// current groups (or empty) so it can be edited and uploaded straight back.
export function buildGroupsTemplate(teams, groups) {
  const groupName = new Map(groups.filter((g) => !g.is_playoff).map((g) => [g.id, g.name]));
  const rows = [...teams].sort(
    (a, b) =>
      (groupName.get(a.group_id) || '\uffff').localeCompare(groupName.get(b.group_id) || '\uffff') ||
      (a.seed ?? 99999) - (b.seed ?? 99999) ||
      a.name.localeCompare(b.name)
  );
  return withExcelMarks([
    GROUPS_COLUMNS.join(','),
    ...rows.map((t) => [t.name, groupName.get(t.group_id) || ''].map(csvEscape).join(',')),
  ]);
}

export const GROUPS_EXAMPLE_CSV = withExcelMarks([
  GROUPS_COLUMNS.join(','),
  'Ann Silva,Group A',
  'Ben Perera,Group A',
  'Cara Fernando,Group A',
  'Dev Jayasuriya,Group B',
  'Esha Wickrama,Group B',
  'Farid Hassan,Group B',
]);

export function groupsFileName(division) {
  const slug = String(division || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${slug || 'division'}-groups-template.csv`;
}
