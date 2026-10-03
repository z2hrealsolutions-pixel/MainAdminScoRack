import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Shell from '../components/Shell';
import { parseRosterCsv, validateRows, groupByTeam, CSV_COLUMNS } from '../lib/csv';
import '../styles/tenants.css';
import '../styles/roster.css';

export default function RosterImport({ email }) {
  const { tenantId, divisionId } = useParams();
  const [division, setDivision] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [groups, setGroups] = useState(null);
  const [fileName, setFileName] = useState('');
  const [importState, setImportState] = useState('idle'); // idle | importing | done
  const [results, setResults] = useState([]);

  useEffect(() => {
    let isMounted = true;
    supabase
      .from('divisions')
      .select('id, name, category')
      .eq('id', divisionId)
      .single()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          setLoadError(error.message);
          return;
        }
        setDivision(data);
      });
    return () => {
      isMounted = false;
    };
  }, [divisionId]);

  function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResults([]);
    setImportState('idle');

    const reader = new FileReader();
    reader.onload = () => {
      const rows = validateRows(parseRosterCsv(String(reader.result)), division.category);
      setGroups(groupByTeam(rows, division.category));
    };
    reader.readAsText(file);
  }

  const rowErrorCount = groups
    ? groups.reduce((sum, g) => sum + g.rows.filter((r) => r.errors.length > 0).length, 0)
    : 0;
  const groupErrorCount = groups ? groups.filter((g) => g.errors.length > 0).length : 0;
  const canImport = groups && groups.length > 0 && rowErrorCount === 0 && groupErrorCount === 0;

  async function handleImport() {
    setImportState('importing');
    const nextResults = [];

    for (const group of groups) {
      const { error } = await supabase.rpc('create_team_with_players', {
        p_division_id: divisionId,
        p_team_name: group.teamName,
        p_captain_name: null,
        p_players: group.rows.map((row) => ({
          name: row.player_name,
          gender: row.gender,
          dupr_id: row.dupr_id,
          dupr_email: row.dupr_email,
          dupr_rating: row.dupr_rating,
          is_45_plus: row.is_45_plus,
        })),
      });
      nextResults.push({
        teamName: group.teamName,
        ok: !error,
        message: error?.message,
      });
      setResults([...nextResults]);
    }

    setImportState('done');
  }

  if (loadError) {
    return (
      <Shell email={email}>
        <div className="callout-error">Couldn't load this division: {loadError}</div>
      </Shell>
    );
  }

  if (!division) {
    return (
      <Shell email={email}>
        <p className="tenants-empty mono">Loading…</p>
      </Shell>
    );
  }

  return (
    <Shell email={email}>
      <Link to={`/tenants/${tenantId}/divisions/${divisionId}`} className="tenants-back mono">
        ← Back to {division.name}
      </Link>
      <h1 className="dash-headline">Import roster</h1>
      <p className="dash-sub">
        One row per player. Every division type uses the same columns.
      </p>

      <div className="csv-format-hint">
        Columns, in this order: {CSV_COLUMNS.map((c) => <code key={c}>{c}</code>)}.{' '}
        {division.category === 'singles' &&
          'team_name is optional here, it defaults to the player name.'}
        {division.category === 'doubles' &&
          'team_name is required, the two players sharing a team_name become one pair.'}
        {division.category === 'league' &&
          'team_name is required, every player sharing a team_name lands on the same roster.'}
      </div>

      <div className="csv-dropzone">
        <input type="file" accept=".csv,text/csv" onChange={handleFile} />
        {fileName && <p style={{ marginTop: 8 }}>{fileName}</p>}
      </div>

      {groups && (
        <>
          <div className="csv-summary">
            <span className="csv-summary-ok">{groups.length - groupErrorCount} teams ready</span>
            {(rowErrorCount > 0 || groupErrorCount > 0) && (
              <span className="csv-summary-error">
                {rowErrorCount + groupErrorCount} problems need fixing before importing
              </span>
            )}
          </div>

          <table className="csv-preview-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Player</th>
                <th>Gender</th>
                <th>DUPR</th>
                <th>Issue</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) =>
                group.rows.map((row, i) => (
                  <tr
                    key={`${group.teamName}-${row.rowNumber}`}
                    className={
                      row.errors.length > 0 || group.errors.length > 0 ? 'csv-row-error' : ''
                    }
                  >
                    <td>{i === 0 ? group.teamName : ''}</td>
                    <td>{row.player_name || '—'}</td>
                    <td>{row.gender || '—'}</td>
                    <td>{row.dupr_rating || '—'}</td>
                    <td className="csv-row-error-msg">
                      {[...row.errors, ...(i === 0 ? group.errors : [])].join(', ')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <button
            type="button"
            className="btn-primary"
            disabled={!canImport || importState === 'importing'}
            onClick={handleImport}
          >
            {importState === 'importing'
              ? 'Importing…'
              : `Import ${groups.length} team${groups.length === 1 ? '' : 's'}`}
          </button>
        </>
      )}

      {results.length > 0 && (
        <div className="csv-import-results">
          {results.map((result) => (
            <div key={result.teamName}>
              {result.ok ? '✓' : '✗'} {result.teamName}
              {!result.ok && ` — ${result.message}`}
            </div>
          ))}
          {importState === 'done' && (
            <Link
              to={`/tenants/${tenantId}/divisions/${divisionId}`}
              className="btn-ghost"
              style={{ marginTop: 12, alignSelf: 'flex-start' }}
            >
              Back to division
            </Link>
          )}
        </div>
      )}
    </Shell>
  );
}
