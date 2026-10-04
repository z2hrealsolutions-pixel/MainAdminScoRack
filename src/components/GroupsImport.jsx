import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { downloadText } from '../lib/download';
import { GROUPS_EXAMPLE_CSV, buildGroupsTemplate, groupsFileName, matchGroups, parseGroupsCsv } from '../lib/groupsCsv';

// Lets a venue decide its own groups instead of having the system split the
// teams: download a template with the division's teams in it, put each team in a
// group, upload it. The file is checked here and explained before anything is sent.
export default function GroupsImport({ divisionId, divisionName, teams, groups, onImported }) {
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const realGroups = groups.filter((g) => !g.is_playoff);

  function handleFile(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setDone('');
    setError('');
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseGroupsCsv(String(reader.result || ''));
      if (parsed.missingColumns.length > 0) {
        setResult({ fatal: `The file needs a ${parsed.missingColumns.join(' and a ')} column. Download the template to see the layout.` });
      } else if (parsed.rows.length === 0) {
        setResult({ fatal: 'The file has no rows.' });
      } else {
        setResult(matchGroups(parsed.rows, teams));
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }

  async function importGroups() {
    const count = result.groups.length;
    if (
      realGroups.length > 0 &&
      !window.confirm(
        `Replace the current ${realGroups.length} group${realGroups.length === 1 ? '' : 's'} with these ${count}? Their matches and referee codes are removed. This only works while no group match has a result.`
      )
    ) {
      return;
    }
    setBusy(true);
    setError('');
    const { data, error: err } = await supabase.rpc('import_groups', {
      p_division_id: divisionId,
      p_groups: result.groups.map((g) => ({ name: g.name, team_ids: g.teams.map((t) => t.id) })),
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setResult(null);
    setFileName('');
    setDone(
      `Imported ${data.groups} groups with ${data.teams} teams and ${data.matches} matches. Make new referee codes under Referee codes, and build the bracket again if you had one.`
    );
    if (onImported) onImported();
  }

  return (
    <div className="groups-import">
      <h3 className="group-card-title">Use your own groups</h3>
      <p className="field-hint">
        Decide the groups yourself instead of letting the system split the teams. Download the template,
        write each team's group next to it, and upload it. Every team has to be in a group of at least
        two. It replaces the groups below, which is only possible while no group match has a result.
      </p>

      {teams.length === 0 ? (
        <p className="field-hint">Add the teams first (under Rosters), then their groups can be set here.</p>
      ) : (
        <>
          <div className="bracket-gen-row">
            <button
              type="button"
              className="btn-ghost"
              onClick={() => downloadText(groupsFileName(divisionName), buildGroupsTemplate(teams, groups))}
            >
              Download template for this division
            </button>
            <button type="button" className="btn-ghost" onClick={() => downloadText('scoreit-groups-example.csv', GROUPS_EXAMPLE_CSV)}>
              Download an example
            </button>
            <label className="btn-primary file-pick">
              Upload groups CSV
              <input type="file" accept=".csv,text/csv" onChange={handleFile} className="file-input-hidden" aria-label="Upload groups CSV" />
            </label>
          </div>

          {fileName && result && <p className="field-hint mono">{fileName}</p>}

          {result && result.fatal && <div className="callout-error" role="alert">{result.fatal}</div>}

          {result && result.errors && result.errors.length > 0 && (
            <div className="callout-error" role="alert">
              Fix these in the file, then upload it again:
              <ul className="groups-errors">
                {result.errors.slice(0, 12).map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
              {result.errors.length > 12 && <p>and {result.errors.length - 12} more.</p>}
            </div>
          )}

          {result && result.ok && (
            <div className="groups-preview">
              <p className="groups-preview-title">
                {result.groups.length} group{result.groups.length === 1 ? '' : 's'},{' '}
                {result.groups.reduce((n, g) => n + g.teams.length, 0)} teams. Looks right?
              </p>
              <ul>
                {result.groups.map((g) => (
                  <li key={g.name}>
                    <strong>{g.name}</strong> <span className="mono mist">({g.teams.length})</span>{' '}
                    {g.teams.map((t) => t.name).join(', ')}
                  </li>
                ))}
              </ul>
              <button type="button" className="btn-primary" disabled={busy} onClick={importGroups}>
                {busy ? 'Importing…' : `Import ${result.groups.length} groups`}
              </button>
            </div>
          )}
        </>
      )}

      {error && (
        <div className="callout-error" role="alert">
          {error}
        </div>
      )}
      {done && <p className="field-hint groups-done">{done}</p>}
    </div>
  );
}
