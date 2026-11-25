import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { downloadText } from '../lib/download';
import { parseGroupsCsv } from '../lib/groupsCsv';

const EXAMPLE = '﻿team_name,group_name\r\nAsha Perera / Mira Silva,Pool A\r\nNila Fernando / Sue Wijesinghe,Pool A\r\nRuwi Jayasuriya / Thaara Hassan,Pool A\r\nKay Silva / Lee Perera,Pool B\r\nDee Fernando / Fay Hassan,Pool B\r\nGia Wickrama / Hana Perera,Pool B\r\n';

// One file with every team and its pool: the teams are created and the pools made in one step. A doubles team
// is written "Name / Name". Teams already in the division are matched by name, not made twice.
export default function TeamsPoolsImport({ divisionId, existingTeams, hasResults, onImported }) {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState(null);
  const [fatal, setFatal] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  function handleFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setDone('');
    setError('');
    setRows(null);
    setFatal('');
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseGroupsCsv(String(reader.result || ''));
      if (parsed.missingColumns.length > 0) {
        setFatal(`The file needs a ${parsed.missingColumns.join(' and a ')} column. Download the example to see the layout.`);
      } else if (parsed.rows.length === 0) {
        setFatal('The file has no rows.');
      } else {
        const problems = [];
        const seen = new Map();
        parsed.rows.forEach((r) => {
          if (!r.team_name) problems.push(`Row ${r.rowNumber}: there is no team name.`);
          else if (!r.group_name) problems.push(`Row ${r.rowNumber}: "${r.team_name}" has no pool.`);
          else if (seen.has(r.team_name.toLowerCase())) problems.push(`Row ${r.rowNumber}: "${r.team_name}" is listed again, it is already on row ${seen.get(r.team_name.toLowerCase())}.`);
          else seen.set(r.team_name.toLowerCase(), r.rowNumber);
        });
        const byGroup = new Map();
        parsed.rows.forEach((r) => {
          if (!r.team_name || !r.group_name) return;
          const k = r.group_name.toLowerCase();
          if (!byGroup.has(k)) byGroup.set(k, { name: r.group_name, teams: [] });
          byGroup.get(k).teams.push(r.team_name);
        });
        byGroup.forEach((g) => {
          if (g.teams.length < 2) problems.push(`Pool "${g.name}" has only ${g.teams.length} team, a pool needs at least 2.`);
        });
        const known = new Set(existingTeams.map((t) => t.name.replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ').trim().toLowerCase()));
        const missing = existingTeams.filter((t) => !seen.has(t.name.replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ').trim().toLowerCase()));
        if (missing.length > 0) {
          problems.push(`${missing.length} team${missing.length === 1 ? '' : 's'} already in this division ${missing.length === 1 ? 'is' : 'are'} not in the file: ${missing.slice(0, 6).map((t) => t.name).join(', ')}${missing.length > 6 ? '…' : ''}. Every team has to be in a pool.`);
        }
        setRows({
          list: parsed.rows.map((r) => ({ team_name: r.team_name, group_name: r.group_name })),
          groups: [...byGroup.values()],
          newCount: parsed.rows.filter((r) => r.team_name && !known.has(r.team_name.toLowerCase())).length,
          problems,
        });
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  async function run() {
    setBusy(true);
    setError('');
    const { data, error: err } = await supabase.rpc('import_teams_with_groups', { p_division_id: divisionId, p_rows: rows.list });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setRows(null);
    setFileName('');
    setDone(`Done: ${data.created_teams} team${data.created_teams === 1 ? '' : 's'} added, ${data.groups} pools, ${data.matches} pool matches made. Make the referee codes next.`);
    if (onImported) onImported();
  }

  return (
    <div className="groups-import">
      <h3 className="group-card-title">Upload teams and pools</h3>
      <p className="field-hint">
        One file with every team and its pool, two columns: team_name and group_name. Write a doubles team as
        "Name / Name". The teams are created and the pools and their matches are made in one step. It replaces the
        pools below, which is only possible while no pool match has a result.
      </p>
      <div className="bracket-gen-row">
        <button type="button" className="btn-ghost" onClick={() => downloadText('scoreit-teams-and-pools-example.csv', EXAMPLE)}>
          Download an example
        </button>
        <label className={`btn-primary file-pick ${hasResults ? 'disabled' : ''}`}>
          Upload teams and pools CSV
          <input type="file" accept=".csv,text/csv" disabled={hasResults} onChange={handleFile} className="file-input-hidden" aria-label="Upload teams and pools CSV" />
        </label>
      </div>
      {fileName && rows && <p className="field-hint mono">{fileName}</p>}
      {fatal && <div className="callout-error" role="alert">{fatal}</div>}
      {rows && rows.problems.length > 0 && (
        <div className="callout-error" role="alert">
          Fix these in the file, then upload it again:
          <ul className="groups-errors">
            {rows.problems.slice(0, 12).map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          {rows.problems.length > 12 && <p>and {rows.problems.length - 12} more.</p>}
        </div>
      )}
      {rows && rows.problems.length === 0 && (
        <div className="groups-preview">
          <p className="groups-preview-title">
            {rows.groups.length} pool{rows.groups.length === 1 ? '' : 's'}, {rows.list.length} teams ({rows.newCount} new). Looks right?
          </p>
          <ul>
            {rows.groups.map((g) => (
              <li key={g.name}>
                <strong>{g.name}</strong> <span className="mono mist">({g.teams.length})</span> {g.teams.join(', ')}
              </li>
            ))}
          </ul>
          <button type="button" className="btn-primary" disabled={busy} onClick={run}>
            {busy ? 'Importing…' : `Create ${rows.newCount} teams and ${rows.groups.length} pools`}
          </button>
        </div>
      )}
      {error && <div className="callout-error" role="alert">{error}</div>}
      {done && <p className="field-hint groups-done">{done}</p>}
    </div>
  );
}
