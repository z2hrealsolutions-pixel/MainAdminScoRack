import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Shell from '../components/Shell';
import { RUBBER_TYPES } from '../lib/matchTypes';
import '../styles/tenants.css';
import '../styles/bracket.css';

function toInt(value) {
  return value === '' || value === null ? null : Number(value);
}

function RubberRow({ rubber, matchupId, teamAName, teamBName, onChanged }) {
  const blank = {
    match_type: RUBBER_TYPES[0].value,
    points_value: 1,
    a: '',
    b: '',
  };
  const fromRubber = (r) => ({
    match_type: r.match_type,
    points_value: r.points_value,
    a: r.team_a_score ?? '',
    b: r.team_b_score ?? '',
  });

  const [form, setForm] = useState(rubber ? fromRubber(rubber) : blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dirty =
    !rubber ||
    form.match_type !== rubber.match_type ||
    Number(form.points_value) !== rubber.points_value ||
    String(form.a) !== String(rubber.team_a_score ?? '') ||
    String(form.b) !== String(rubber.team_b_score ?? '');

  async function handleSave() {
    setSaving(true);
    setError('');
    const { error: saveError } = await supabase.rpc('save_rubber', {
      p_matchup_id: matchupId,
      p_sub_match_id: rubber?.id ?? null,
      p_match_type: form.match_type,
      p_points_value: Number(form.points_value),
      p_team_a_score: toInt(form.a),
      p_team_b_score: toInt(form.b),
    });
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    if (!rubber) setForm(blank);
    onChanged();
  }

  async function handleRemove() {
    if (!window.confirm('Remove this rubber?')) return;
    const { error: removeError } = await supabase.from('sub_matches').delete().eq('id', rubber.id);
    if (removeError) {
      setError(removeError.message);
      return;
    }
    onChanged();
  }

  return (
    <div className="rubber-row">
      <select
        className="text-input"
        value={form.match_type}
        onChange={(event) => setForm({ ...form, match_type: event.target.value })}
      >
        {RUBBER_TYPES.map((type) => (
          <option key={type.value} value={type.value}>
            {type.label}
          </option>
        ))}
      </select>
      <input
        className="text-input"
        inputMode="numeric"
        title="Standings points for the winner"
        aria-label="Points"
        value={form.points_value}
        onChange={(event) => setForm({ ...form, points_value: event.target.value })}
      />
      <input
        className="text-input"
        inputMode="numeric"
        placeholder={teamAName}
        aria-label={`${teamAName} score`}
        value={form.a}
        onChange={(event) => setForm({ ...form, a: event.target.value })}
      />
      <input
        className="text-input"
        inputMode="numeric"
        placeholder={teamBName}
        aria-label={`${teamBName} score`}
        value={form.b}
        onChange={(event) => setForm({ ...form, b: event.target.value })}
      />
      <button
        type="button"
        className={rubber ? 'btn-ghost' : 'btn-primary'}
        disabled={!dirty || saving}
        onClick={handleSave}
      >
        {saving ? '…' : rubber ? 'Save' : 'Add rubber'}
      </button>
      {rubber && (
        <button type="button" className="btn-ghost roster-remove-btn" onClick={handleRemove}>
          Remove
        </button>
      )}
      {error && <span className="csv-row-error-msg rubber-row-error">{error}</span>}
    </div>
  );
}

export default function MatchupResult({ email }) {
  const { tenantId, divisionId, matchupId } = useParams();
  const [matchup, setMatchup] = useState(null);
  const [division, setDivision] = useState(null);
  const [teamNames, setTeamNames] = useState({});
  const [subs, setSubs] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [scoreA, setScoreA] = useState('');
  const [scoreB, setScoreB] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function load() {
      const matchupRes = await supabase
        .from('matchups')
        .select('id, division_id, group_id, stage, status, team_a_id, team_b_id')
        .eq('id', matchupId)
        .single();
      if (!isMounted) return;
      if (matchupRes.error) {
        setLoadError(matchupRes.error.message);
        return;
      }
      const m = matchupRes.data;
      const [divRes, teamsRes, subsRes] = await Promise.all([
        supabase
          .from('divisions')
          .select('id, name, category, group_win_points')
          .eq('id', m.division_id)
          .single(),
        supabase
          .from('teams')
          .select('id, name')
          .in('id', [m.team_a_id, m.team_b_id].filter(Boolean)),
        supabase
          .from('sub_matches')
          .select('id, match_type, slot_number, points_value, team_a_score, team_b_score, winner_team_id, done')
          .eq('matchup_id', matchupId)
          .order('slot_number'),
      ]);
      if (!isMounted) return;
      const err = divRes.error || teamsRes.error || subsRes.error;
      if (err) {
        setLoadError(err.message);
        return;
      }
      const names = {};
      teamsRes.data.forEach((t) => {
        names[t.id] = t.name;
      });
      setMatchup(m);
      setDivision(divRes.data);
      setTeamNames(names);
      setSubs(subsRes.data);
      const first = subsRes.data[0];
      setScoreA(first?.team_a_score != null ? String(first.team_a_score) : '');
      setScoreB(first?.team_b_score != null ? String(first.team_b_score) : '');
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [matchupId, reloadKey]);

  function reload() {
    setReloadKey((key) => key + 1);
  }

  async function run(rpcName, params) {
    setBusy(true);
    setActionError('');
    const { error } = await supabase.rpc(rpcName, params);
    setBusy(false);
    if (error) {
      setActionError(error.message);
      return;
    }
    reload();
  }

  if (loadError) {
    return (
      <Shell email={email}>
        <div className="callout-error">Couldn't load this match: {loadError}</div>
      </Shell>
    );
  }

  if (!matchup || !division) {
    return (
      <Shell email={email}>
        <p className="tenants-empty mono">Loading…</p>
      </Shell>
    );
  }

  const nameA = teamNames[matchup.team_a_id] ?? 'TBD';
  const nameB = teamNames[matchup.team_b_id] ?? 'TBD';
  const isLeague = division.category === 'league';
  const isGroupMatch = matchup.group_id !== null;
  const isComplete = matchup.status === 'complete';

  const pointsFor = (teamId) =>
    subs
      .filter((s) => s.done && s.winner_team_id === teamId)
      .reduce((sum, s) => sum + s.points_value, 0);

  const canSaveScore =
    scoreA !== '' &&
    scoreB !== '' &&
    Number(scoreA) >= 0 &&
    Number(scoreB) >= 0 &&
    Number(scoreA) !== Number(scoreB);

  return (
    <Shell email={email}>
      <Link to={`/tenants/${tenantId}/divisions/${divisionId}`} className="tenants-back mono">
        ← Back to {division.name}
      </Link>
      <h1 className="dash-headline">
        {nameA} <span className="mist">vs</span> {nameB}
      </h1>
      <p className="dash-sub mono">
        {matchup.stage} · {isComplete ? 'complete' : matchup.status}
      </p>

      {!isGroupMatch && (
        <p className="dash-sub">
          This is a bracket match. Declare its winner from the Bracket section of the division
          page, it places them straight into the next round.
        </p>
      )}

      {actionError && <div className="callout-error">{actionError}</div>}

      {isGroupMatch && !isLeague && (
        <section className="tenant-section" style={{ marginTop: 'var(--space-4)' }}>
          <h2 className="tenant-section-title">Result</h2>
          <p className="field-hint" style={{ marginBottom: 'var(--space-3)' }}>
            A win is worth {division.group_win_points} standings point
            {division.group_win_points === 1 ? '' : 's'} in this division.
          </p>
          <div className="result-score-row">
            <div>
              <label className="field-label" htmlFor="scoreA">
                {nameA}
              </label>
              <input
                id="scoreA"
                className="text-input"
                inputMode="numeric"
                value={scoreA}
                onChange={(event) => setScoreA(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="scoreB">
                {nameB}
              </label>
              <input
                id="scoreB"
                className="text-input"
                inputMode="numeric"
                value={scoreB}
                onChange={(event) => setScoreB(event.target.value)}
              />
            </div>
          </div>
          <div className="roster-actions" style={{ marginTop: 'var(--space-3)' }}>
            <button
              type="button"
              className="btn-primary"
              disabled={!canSaveScore || busy}
              onClick={() =>
                run('record_match_result', {
                  p_matchup_id: matchupId,
                  p_team_a_score: Number(scoreA),
                  p_team_b_score: Number(scoreB),
                })
              }
            >
              {isComplete ? 'Update result' : 'Save result'}
            </button>
            {isComplete && (
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('Clear this result and reopen the match?')) {
                    run('clear_match_result', { p_matchup_id: matchupId });
                  }
                }}
              >
                Clear result
              </button>
            )}
          </div>
          {scoreA !== '' && scoreB !== '' && Number(scoreA) === Number(scoreB) && (
            <p className="field-hint">The scores can't be equal, a match needs a winner.</p>
          )}
        </section>
      )}

      {isGroupMatch && isLeague && (
        <section className="tenant-section" style={{ marginTop: 'var(--space-4)' }}>
          <h2 className="tenant-section-title">Rubbers</h2>
          <p className="field-hint" style={{ marginBottom: 'var(--space-3)' }}>
            Columns: type, points for the winner, then each team's score. Leave both scores empty
            for a rubber that hasn't been played yet.
          </p>

          <div className="rubber-list">
            {subs.map((rubber) => (
              <RubberRow
                key={rubber.id}
                rubber={rubber}
                matchupId={matchupId}
                teamAName={nameA}
                teamBName={nameB}
                onChanged={reload}
              />
            ))}
            <RubberRow
              key={`new-${subs.length}`}
              rubber={null}
              matchupId={matchupId}
              teamAName={nameA}
              teamBName={nameB}
              onChanged={reload}
            />
          </div>

          <p className="rubber-tally mono">
            {nameA} {pointsFor(matchup.team_a_id)} - {pointsFor(matchup.team_b_id)} {nameB}
          </p>

          <div className="roster-actions" style={{ marginTop: 'var(--space-3)' }}>
            <button
              type="button"
              className={isComplete ? 'btn-ghost' : 'btn-primary'}
              disabled={busy}
              onClick={() =>
                run('set_matchup_complete', {
                  p_matchup_id: matchupId,
                  p_complete: !isComplete,
                })
              }
            >
              {isComplete ? 'Reopen tie' : 'Mark tie complete'}
            </button>
          </div>
        </section>
      )}
    </Shell>
  );
}
