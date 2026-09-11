import Papa from 'papaparse';

export const CSV_COLUMNS = [
  'team_name',
  'player_name',
  'gender',
  'dupr_id',
  'dupr_email',
  'dupr_rating',
  'is_45_plus',
];

export function parseRosterCsv(text) {
  const result = Papa.parse(text, { header: true, skipEmptyLines: true });
  return result.data.map((row, index) => normalizeRow(row, index));
}

function normalizeRow(row, index) {
  return {
    rowNumber: index + 2, // header is row 1
    team_name: (row.team_name || '').trim(),
    player_name: (row.player_name || '').trim(),
    gender: normalizeGender(row.gender),
    dupr_id: (row.dupr_id || '').trim(),
    dupr_email: (row.dupr_email || '').trim(),
    dupr_rating: (row.dupr_rating || '').trim(),
    is_45_plus: normalizeBoolean(row.is_45_plus),
  };
}

function normalizeGender(value) {
  const v = (value || '').trim().toUpperCase();
  if (v === 'M' || v === 'MALE') return 'M';
  if (v === 'F' || v === 'FEMALE') return 'F';
  return v;
}

function normalizeBoolean(value) {
  const v = (value || '').trim().toLowerCase();
  return ['true', '1', 'yes', 'y'].includes(v);
}

export function validateRows(rows, category) {
  return rows.map((row) => {
    const errors = [];
    if (!row.player_name) errors.push('Missing player name');
    if (row.gender !== 'M' && row.gender !== 'F') {
      errors.push('Gender must be M or F');
    }
    if (row.dupr_rating && Number.isNaN(Number(row.dupr_rating))) {
      errors.push('DUPR rating must be a number');
    }
    if ((category === 'doubles' || category === 'league') && !row.team_name) {
      errors.push('Team name required for this division');
    }
    return { ...row, errors };
  });
}

// Groups validated rows into teams. Singles rows without a team_name
// each become their own team, named after the player.
export function groupByTeam(rows, category) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.team_name || `__singles__${row.rowNumber}`;
    if (!groups.has(key)) {
      groups.set(key, { teamName: row.team_name || row.player_name, rows: [] });
    }
    groups.get(key).rows.push(row);
  }

  return Array.from(groups.values()).map((group) => {
    const errors = [];
    if (category === 'doubles' && group.rows.length !== 2) {
      errors.push(`Doubles teams need exactly 2 players, found ${group.rows.length}`);
    }
    if (category === 'singles' && group.rows.length !== 1) {
      errors.push(`Singles entrants need exactly 1 player, found ${group.rows.length}`);
    }
    return { ...group, errors };
  });
}
