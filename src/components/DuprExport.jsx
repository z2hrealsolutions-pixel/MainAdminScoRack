import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { buildDuprCsv, duprFileName, missingDuprPlayers } from '../lib/duprCsv';

// Download a finished singles or doubles division as the CSV DUPR's upload takes.
export default function DuprExport({ tenantId, division }) {
  const exportable = division.status === 'completed' && division.category !== 'league';

  const [tenant, setTenant] = useState(null);
  const [rows, setRows] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [event, setEvent] = useState('');
  const [location, setLocation] = useState('');
  const [scoreType, setScoreType] = useState('SIDEOUT');
  const [dateMode, setDateMode] = useState('each');
  const [dateValue, setDateValue] = useState('');
  const [skipMissing, setSkipMissing] = useState(false);
  const [done, setDone] = useState('');

  useEffect(() => {
    if (!exportable) return undefined;
    let isMounted = true;
    async function load() {
      const [t, r] = await Promise.all([
        supabase.from('tenants').select('name, address').eq('id', tenantId).single(),
        supabase.rpc('division_dupr_rows', { p_division_id: division.id }),
      ]);
      if (!isMounted) return;
      if (t.error || r.error) {
        setLoadError((t.error || r.error).message);
        return;
      }
      setTenant(t.data);
      setRows(r.data);
      setEvent(`${t.data.name} - ${division.name}`);
      setLocation(t.data.address || '');
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [exportable, tenantId, division.id, division.name]);

  const missing = useMemo(() => (rows ? missingDuprPlayers(rows) : { players: [], matches: 0 }), [rows]);
  const options = { event, location, scoreType, dateMode, dateValue, skipMissingDuprIds: skipMissing, divisionId: division.id };
  const preview = useMemo(
    () => (rows ? buildDuprCsv(rows, options) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, event, location, scoreType, dateMode, dateValue, skipMissing, division.id]
  );

  function download() {
    const blob = new Blob([preview.csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = duprFileName(tenant.name, division.name);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDone(`Downloaded ${link.download} with ${preview.included} match${preview.included === 1 ? '' : 'es'}.`);
  }

  if (division.category === 'league') {
    return (
      <p className="field-hint">
        League divisions can't be exported yet, the console doesn't record which players played each
        rubber. Singles and doubles divisions can.
      </p>
    );
  }
  if (division.status !== 'completed') {
    return (
      <p className="field-hint">
        Mark this division <strong>Completed</strong> (under Status above) when the tournament is over,
        then its results can be exported for DUPR here.
      </p>
    );
  }
  if (loadError) return <div className="callout-error">{loadError}</div>;
  if (!rows) return <p className="field-hint mono">Loading…</p>;
  if (rows.length === 0) {
    return <p className="field-hint">This division has no finished matches to export.</p>;
  }

  const ready = preview.included;
  const left = preview.skippedIncomplete + preview.skippedNoDupr;

  return (
    <div className="dupr-form">
      <div>
        <label className="field-label" htmlFor="duprEvent">
          Event name
        </label>
        <input id="duprEvent" className="text-input" value={event} onChange={(e) => setEvent(e.target.value)} />
        <p className="field-hint">The same name on every row, it groups the matches as one event in DUPR.</p>
      </div>

      <div>
        <label className="field-label" htmlFor="duprLocation">
          Venue address
        </label>
        <input id="duprLocation" className="text-input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Venue name, street, city" />
        {!tenant.address && (
          <p className="field-hint">
            No address is saved for this venue. Type one here, or save it under the venue's details so
            it fills in by itself next time.
          </p>
        )}
      </div>

      <div className="dupr-row">
        <div>
          <label className="field-label" htmlFor="duprScore">
            Score type
          </label>
          <select id="duprScore" className="text-input" value={scoreType} onChange={(e) => setScoreType(e.target.value)}>
            <option value="SIDEOUT">Side-out</option>
            <option value="RALLY">Rally</option>
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="duprDateMode">
            Date
          </label>
          <select id="duprDateMode" className="text-input" value={dateMode} onChange={(e) => setDateMode(e.target.value)}>
            <option value="each">Each match's own date</option>
            <option value="one">One date for every match</option>
          </select>
        </div>
        {dateMode === 'one' && (
          <div>
            <label className="field-label" htmlFor="duprDate">
              Date for all
            </label>
            <input id="duprDate" type="date" className="text-input" value={dateValue} onChange={(e) => setDateValue(e.target.value)} />
          </div>
        )}
      </div>
      {dateMode === 'each' && (
        <p className="field-hint">
          Each match uses the date it was scheduled for, or the day its result was recorded if it had no
          date.
        </p>
      )}

      {preview.skippedIncomplete > 0 && (
        <div className="callout-error">
          {preview.skippedIncomplete} match(es) are left out because a team has no player recorded, they
          can't be described in the file.
        </div>
      )}
      {missing.matches > 0 && (
        <div className="callout-error dupr-missing">
          {missing.players.length} player{missing.players.length === 1 ? '' : 's'} in {missing.matches} match
          {missing.matches === 1 ? '' : 'es'} {missing.players.length === 1 ? 'has' : 'have'} no DUPR ID:{' '}
          {missing.players.join(', ')}.
          <label className="dupr-skip">
            <input type="checkbox" checked={skipMissing} onChange={(e) => setSkipMissing(e.target.checked)} />
            Leave those matches out of the file
          </label>
        </div>
      )}

      <button type="button" className="btn-primary" disabled={ready === 0 || !location.trim()} onClick={download}>
        Download CSV ({ready} match{ready === 1 ? '' : 'es'})
      </button>
      {!location.trim() && <p className="field-hint">Enter the venue address first, the file needs it.</p>}
      {left > 0 && ready > 0 && <p className="field-hint">{left} match(es) will not be in the file.</p>}
      {done && <p className="field-hint dupr-done">{done}</p>}
    </div>
  );
}
