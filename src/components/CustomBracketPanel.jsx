import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useVenueAccess } from '../lib/access';
import { clampAdvance, defaultAdvance, roundLabel, summarize, toRpcAdvance } from '../lib/bracketChoice';

const signed = (n) => (n > 0 ? `+${n.toFixed(2)}` : n.toFixed(2));

// Choose how many teams go through from each group (groups can be any size), see the bracket
// that makes, then build it. The preview and the build are the same database function, so
// what is shown is exactly what is built.
export default function CustomBracketPanel({ tenantId, divisionId, groups, knockout, onChanged }) {
  const access = useVenueAccess(tenantId);
  const [advance, setAdvance] = useState(() => defaultAdvance(groups));
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [built, setBuilt] = useState(null);

  const summary = useMemo(() => summarize(groups, advance), [groups, advance]);

  useEffect(() => {
    if (!summary.valid) {
      setPreview(null);
      setPreviewError('');
      setLoading(false);
      return undefined;
    }
    let current = true;
    setLoading(true);
    const handle = setTimeout(async () => {
      const { data, error: err } = await supabase.rpc('generate_flexible_bracket', {
        p_division_id: divisionId,
        p_advance: toRpcAdvance(groups, advance),
        p_commit: false,
      });
      if (!current) return;
      setLoading(false);
      if (err) {
        setPreview(null);
        setPreviewError(err.message);
      } else {
        setPreview(data);
        setPreviewError('');
      }
    }, 300);
    return () => {
      current = false;
      clearTimeout(handle);
    };
  }, [divisionId, groups, advance, summary.valid]);

  function setCount(group, value) {
    setBuilt(null);
    setError('');
    setAdvance((a) => ({ ...a, [group.id]: clampAdvance(value, group.size) }));
  }

  async function build() {
    if (knockout.exists && !window.confirm('Replace the existing bracket with this one? It has no results yet, so nothing is lost.')) return;
    setBusy(true);
    setError('');
    const { data, error: err } = await supabase.rpc('generate_flexible_bracket', {
      p_division_id: divisionId,
      p_advance: toRpcAdvance(groups, advance),
      p_commit: true,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setBuilt(data);
    if (onChanged) onChanged();
  }

  const canBuild = access.canChange;
  const locked = knockout.hasResults;
  const waiting = preview && preview.provisional;

  return (
    <div className="adv-panel">
      <p className="field-hint">
        Choose how many teams go through from each group. Groups can be different sizes. The teams are seeded by
        the place they finished in their group, then by win percentage, then by point difference per match, so a
        group of 9 and a group of 5 are compared fairly. If the numbers do not fill the bracket, the top seeds get byes.
      </p>

      <ul className="adv-groups">
        {groups.map((g) => (
          <li className="adv-row" key={g.id}>
            <label className="adv-name" htmlFor={`adv-${g.id}`}>
              <strong>{g.name}</strong> <span className="mist">{g.size} team{g.size === 1 ? '' : 's'}</span>
            </label>
            <div className="adv-stepper">
              <button
                type="button"
                className="btn-ghost"
                aria-label={`One fewer from ${g.name}`}
                disabled={!canBuild || locked || Number(advance[g.id]) <= 0}
                onClick={() => setCount(g, Number(advance[g.id]) - 1)}
              >
                −
              </button>
              <input
                id={`adv-${g.id}`}
                className="adv-input"
                type="number"
                inputMode="numeric"
                min="0"
                max={g.size}
                value={advance[g.id]}
                disabled={!canBuild || locked}
                onChange={(e) => setCount(g, e.target.value)}
                // tapping the box selects what is in it, so typing a 3 over a 2 makes 3, not 23
                onFocus={(e) => e.target.select()}
                onMouseUp={(e) => e.preventDefault()}
              />
              <button
                type="button"
                className="btn-ghost"
                aria-label={`One more from ${g.name}`}
                disabled={!canBuild || locked || Number(advance[g.id]) >= g.size}
                onClick={() => setCount(g, Number(advance[g.id]) + 1)}
              >
                +
              </button>
            </div>
          </li>
        ))}
      </ul>

      <p className="adv-total" role="status" aria-live="polite">
        {summary.valid ? summary.sentence : summary.problems[0]}
      </p>
      {!summary.valid && summary.problems.length > 1 && (
        <ul className="adv-problems">
          {summary.problems.slice(1).map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      {locked && <p className="field-hint">The bracket has results, so it can no longer be rebuilt.</p>}

      {previewError && (
        <div className="callout-error" role="alert">
          {previewError}
        </div>
      )}

      {preview && (
        <div className="adv-preview" aria-busy={loading}>
          <h3 className="adv-h">
            Preview{loading ? ' (updating)' : ''}
          </h3>
          {waiting && (
            <p className="field-hint">
              Based on the standings so far. The group stage is not finished, so this may change. Building opens when
              every group match is finished.
            </p>
          )}

          <div className="adv-table-wrap">
            <table className="adv-table">
              <caption className="visually-hidden">Seeded teams</caption>
              <thead>
                <tr>
                  <th scope="col">Seed</th>
                  <th scope="col">Team</th>
                  <th scope="col" className="adv-col-group">Group</th>
                  <th scope="col">Place</th>
                  <th scope="col">Wins</th>
                  <th scope="col">Pts diff / match</th>
                </tr>
              </thead>
              <tbody>
                {preview.seeds.map((s) => (
                  <tr key={s.seed}>
                    <td className="mono">{s.seed}</td>
                    <th scope="row">
                      {s.name}
                      <span className="adv-sub">{s.group}</span>
                    </th>
                    <td className="adv-col-group">{s.group}</td>
                    <td className="mono">{s.group_position}</td>
                    <td className="mono">{s.win_pct}%</td>
                    <td className="mono">{signed(Number(s.pd_per_match))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h4 className="adv-h2">{roundLabel(preview.bracket_size)}</h4>
          <ul className="adv-pairs">
            {preview.pairs.map((p) => (
              <li key={p.position}>
                {p.bye ? (
                  <>
                    <span className="mono">#{(p.a || p.b).seed}</span> {(p.a || p.b).name}{' '}
                    <span className="mist">({(p.a || p.b).group})</span> <span className="adv-bye">has a bye</span>
                  </>
                ) : (
                  <>
                    <span className="mono">#{p.a.seed}</span> {p.a.name} <span className="mist">({p.a.group})</span>
                    {' v '}
                    <span className="mono">#{p.b.seed}</span> {p.b.name} <span className="mist">({p.b.group})</span>
                  </>
                )}
              </li>
            ))}
          </ul>

          {preview.swaps.length > 0 && (
            <p className="field-hint">
              To avoid two teams of one group meeting in the first round,{' '}
              {preview.swaps.map((s) => `seed ${s.moved_from_seed} was swapped with seed ${s.moved_to_seed}`).join('; ')}.
            </p>
          )}
          {preview.unresolved_clashes.length > 0 && (
            <div className="callout-error">
              {preview.unresolved_clashes.length} first round match(es) still pair teams from the same group and no safe swap
              exists: {preview.unresolved_clashes.map((c) => `match ${c.match} (seeds ${c.seeds.join(' v ')})`).join(', ')}.
            </div>
          )}
        </div>
      )}

      {canBuild && (
        <div className="adv-actions">
          <button type="button" className="btn-primary" disabled={!summary.valid || !preview || waiting || locked || busy} onClick={build}>
            {busy ? 'Building…' : knockout.exists ? 'Rebuild the bracket' : 'Build the bracket'}
          </button>
          {summary.valid && waiting && <span className="field-hint">Finish every group match first.</span>}
        </div>
      )}

      {error && (
        <div className="callout-error" role="alert">
          {error}
        </div>
      )}
      {built && (
        <p className="field-hint adv-built" role="status">
          Bracket built: {built.qualifiers} teams, {roundLabel(built.bracket_size)}
          {built.byes > 0 ? `, ${built.byes} bye${built.byes === 1 ? '' : 's'}` : ''}.
        </p>
      )}
    </div>
  );
}
