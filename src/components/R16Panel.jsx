import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useVenueAccess } from '../lib/access';

// The seeded Round of 16, step by step: finish the group stage, (with 9 groups)
// play the Playoff, then build the bracket. The database does the work and
// refuses out of order, this shows where things stand and what to do next.
export default function R16Panel({ tenantId, divisionId, onChanged }) {
  const access = useVenueAccess(tenantId);
  const [status, setStatus] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [built, setBuilt] = useState(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('r16_status', { p_division_id: divisionId });
    if (err) {
      setLoadError(err.message);
      return;
    }
    setLoadError('');
    setStatus(data);
  }, [divisionId]);

  useEffect(() => {
    load();
  }, [load]);

  async function generate(kind) {
    const isPlayoff = kind === 'playoff';
    if (isPlayoff && status.playoff_exists && !window.confirm('Replace the existing playoff? It has no results yet, so nothing is lost.')) return;
    if (!isPlayoff && status.bracket_exists && !window.confirm('Replace the existing bracket with a new one built from the current results? It has no results yet.')) return;

    setBusy(kind);
    setError('');
    setNotice('');
    setBuilt(null);
    const { data, error: err } = isPlayoff
      ? await supabase.rpc('generate_playoff', { p_division_id: divisionId })
      : await supabase.rpc('generate_seeded_round_of_16', { p_division_id: divisionId });
    setBusy('');
    if (err) {
      setError(err.message);
      return;
    }
    if (isPlayoff) {
      setNotice('Playoff created: a round robin of 6 matches between the 4 lowest runners-up. Make a referee code for it under Referee codes, then enter the results.');
    } else {
      setBuilt(data);
    }
    await load();
    if (onChanged) onChanged();
  }

  if (loadError) return <div className="callout-error">{loadError}</div>;
  if (!status) return <p className="field-hint mono">Loading…</p>;
  if (!status.eligible) return <div className="callout-error">{status.reason}</div>;

  const canGenerate = access.canChange;
  const groupStageDone = status.group_stage_complete;
  const playoffOk = !status.needs_playoff || status.playoff_complete;
  const bracketLocked = status.bracket_has_results;

  return (
    <div className="r16-panel">
      <p className="field-hint">
        16 teams, seeded 1 to 16. Group winners take the top seeds, then the best runners-up
        {status.needs_playoff
          ? ', and the 4 lowest runners-up play off for the last two places (seeds 15 and 16).'
          : '.'}{' '}
        If two teams from the same group are paired, the runner-up is moved to a neighbouring seed.
      </p>

      <ol className="r16-steps">
        <li className={groupStageDone ? 'r16-done' : ''}>
          <strong>Group stage</strong>
          <span className="r16-state mono">
            {status.group_done} of {status.group_matches} matches finished
          </span>
        </li>

        {status.needs_playoff && (
          <li className={status.playoff_complete ? 'r16-done' : ''}>
            <strong>Playoff</strong>
            <span className="r16-state mono">
              {status.playoff_exists
                ? `${status.playoff_done} of ${status.playoff_matches} matches finished`
                : 'not created yet'}
            </span>
            {canGenerate && (
              <button
                type="button"
                className="btn-ghost"
                disabled={!groupStageDone || busy !== '' || (status.playoff_exists && status.playoff_done > 0)}
                onClick={() => generate('playoff')}
              >
                {busy === 'playoff' ? 'Creating…' : status.playoff_exists ? 'Recreate playoff' : 'Create playoff'}
              </button>
            )}
          </li>
        )}

        <li className={status.bracket_exists ? 'r16-done' : ''}>
          <strong>Round of 16</strong>
          <span className="r16-state mono">
            {status.bracket_exists ? (bracketLocked ? 'built, results recorded' : 'built') : 'not built yet'}
          </span>
          {canGenerate && (
            <button
              type="button"
              className="btn-primary"
              disabled={!groupStageDone || !playoffOk || bracketLocked || busy !== ''}
              onClick={() => generate('bracket')}
            >
              {busy === 'bracket' ? 'Building…' : status.bracket_exists ? 'Rebuild Round of 16' : 'Build Round of 16'}
            </button>
          )}
        </li>
      </ol>

      {!groupStageDone && (
        <p className="field-hint">Finish every group match first, the seeding comes from the group results.</p>
      )}
      {groupStageDone && !playoffOk && (
        <p className="field-hint">Finish the playoff first, its winners take seeds 15 and 16.</p>
      )}
      {bracketLocked && (
        <p className="field-hint">The bracket has results, so it can no longer be rebuilt.</p>
      )}

      {error && (
        <div className="callout-error" role="alert">
          {error}
        </div>
      )}
      {notice && <p className="field-hint r16-notice">{notice}</p>}

      {built && (
        <div className="r16-result">
          <p className="r16-result-title">Round of 16 built.</p>
          {built.swaps.length > 0 && (
            <p className="field-hint">
              To avoid same-group matches,{' '}
              {built.swaps.map((s) => `seed ${s.moved_from_seed} was swapped with seed ${s.moved_to_seed}`).join('; ')}.
            </p>
          )}
          {built.unresolved_clashes.length > 0 && (
            <div className="callout-error">
              {built.unresolved_clashes.length} match(es) still pair teams from the same group and no
              safe swap was found: {built.unresolved_clashes.map((c) => `M${c.match} (seeds ${c.seeds.join(' v ')})`).join(', ')}.
            </div>
          )}
          <ol className="r16-seeds mono">
            {built.seeds.map((s) => (
              <li key={s.seed}>
                <span className="r16-seed">{s.seed}</span> {s.name} <span className="mist">{s.group}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
