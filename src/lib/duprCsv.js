// Builds the DUPR upload file. The column layout is the one in the sample file
// from DNL: 27 columns, one row per match, scores in the Game 1 columns only,
// Windows line endings, and any value containing a comma or a quote wrapped in
// quotes (the venue address always has commas).

export const DUPR_HEADERS = [
  'matchType', 'event', 'date',
  'playerA1', 'playerA1DuprId', 'playerA1ExternalId',
  'playerA2', 'playerA2DuprId', 'playerA2ExternalId',
  'playerB1', 'playerB1DuprId', 'playerB1ExternalId',
  'playerB2', 'playerB2DuprId', 'playerB2ExternalId',
  'teamAGame1', 'teamBGame1', 'teamAGame2', 'teamBGame2', 'teamAGame3', 'teamBGame3',
  'teamAGame4', 'teamBGame4', 'teamAGame5', 'teamBGame5',
  'location', 'scoreType',
];

export function csvEscape(value) {
  const s = value === null || value === undefined ? '' : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const short = (id) => String(id || '').replace(/-/g, '').slice(0, 8);

// An id for a player in a match, unique to that slot, like the sample's
// DNL-<event>-<rubber>-<n>-A1. DUPR uses it to tell apart players it can't
// identify by their DUPR id.
export function defaultExternalId(row, slot, divisionId) {
  return `SCR-${short(divisionId)}-${short(row.matchup_id)}-${slot}`;
}

// rows: what division_dupr_rows returns. options:
//   event, location, scoreType ('SIDEOUT' or 'RALLY')
//   dateMode: 'each' (the match's own date) or 'one' with dateValue
//   skipMissingDuprIds: leave out matches where a player has no DUPR id
//   divisionId, externalId (optional override)
// Matches with a side that is missing a player are always left out, they can't
// be described. Returns the file and what was left out and why.
export function buildDuprCsv(rows, options) {
  const {
    event = '', location = '', scoreType = 'SIDEOUT', dateMode = 'each', dateValue = '',
    skipMissingDuprIds = false, divisionId = '', externalId = defaultExternalId,
  } = options;

  const lines = [DUPR_HEADERS.join(',')];
  let included = 0;
  let skippedIncomplete = 0;
  let skippedNoDupr = 0;

  for (const r of rows) {
    if (!r.complete) {
      skippedIncomplete += 1;
      continue;
    }
    const players = [
      ['A1', r.a1_name, r.a1_dupr_id], ['A2', r.a2_name, r.a2_dupr_id],
      ['B1', r.b1_name, r.b1_dupr_id], ['B2', r.b2_name, r.b2_dupr_id],
    ];
    if (skipMissingDuprIds && players.some(([, name, id]) => name && !id)) {
      skippedNoDupr += 1;
      continue;
    }
    const cells = [
      r.match_type,
      event,
      dateMode === 'one' ? dateValue : r.match_date || '',
    ];
    for (const [slot, name, id] of players) {
      cells.push(name || '', name ? id || '' : '', name ? externalId(r, slot, divisionId) : '');
    }
    cells.push(r.team_a_score, r.team_b_score, '', '', '', '', '', '', '', '');
    cells.push(location, scoreType);
    lines.push(cells.map(csvEscape).join(','));
    included += 1;
  }

  return { csv: lines.join('\r\n') + '\r\n', included, skippedIncomplete, skippedNoDupr };
}

// Who is missing a DUPR id, for the warning before downloading.
export function missingDuprPlayers(rows) {
  const names = new Set();
  let matches = 0;
  for (const r of rows) {
    if (!r.complete) continue;
    const missing = [[r.a1_name, r.a1_dupr_id], [r.a2_name, r.a2_dupr_id], [r.b1_name, r.b1_dupr_id], [r.b2_name, r.b2_dupr_id]]
      .filter(([name, id]) => name && !id)
      .map(([name]) => name);
    if (missing.length > 0) matches += 1;
    missing.forEach((n) => names.add(n));
  }
  return { players: [...names].sort(), matches };
}

export function duprFileName(venue, division) {
  const slug = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return `${slug(venue) || 'venue'}-${slug(division) || 'division'}-dupr.csv`;
}
