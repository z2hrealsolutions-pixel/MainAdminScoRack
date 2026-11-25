import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useVenueAccess } from '../lib/access';
import {
  dropFirstRound, firstRoundClashes, freeWinners, matchShort, placeInSlot, planErrorText, planProblems,
  roundName, swapSides, toRpcPlan, winnerLabel,
} from '../lib/knockoutPlan';

const BLANKS = [
  { key: 'sf', label: 'Semi finals and final (4 teams)', shape: [2, 1] },
  { key: 'qf', label: 'Quarter finals, semi finals, final (8 teams)', shape: [4, 2, 1] },
  { key: 'f', label: 'Final only (2 teams)', shape: [1] },
];

function blankPlan(shape) {
  return {
    rounds: shape.map((count, r) =>
      Array.from({ length: count }, (_, m) =>
        r === 0
          ? { a: { team: null }, b: { team: null } }
          : { a: { w: [r - 1, m * 2] }, b: { w: [r - 1, m * 2 + 1] } }
      )
    ),
  };
}

const valueOf = (slot) => (slot && slot.w ? `w:${slot.w[0]}:${slot.w[1]}` : slot && slot.team ? `t:${slot.team}` : '');

// The knockout, planned: who plays whom. The database proposes it from the pool tables and the division's
// template (a ready made format sets one), and every place in it can be changed by hand, including which 3rd
// placed team goes to which quarter final, whether there are quarter finals at all, and who meets whom later.
export default function KnockoutPlanPanel({ tenantId, divisionId, division, groups, knockout, onChanged }) {
  const access = useVenueAccess(tenantId);
  const [teams, setTeams] = useState([]);
  const [plan, setPlan] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [edited, setEdited] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [built, setBuilt] = useState(null);

  const template = division.knockout_template;
  // a new object each time the division reloads, so compare by content or an edit would be thrown away
  const templateKey = template ? JSON.stringify(template) : '';
  const teamGroup = useMemo(() => {
    const byGroup = Object.fromEntries(groups.map((g) => [g.id, g.name]));
    return Object.fromEntries(teams.map((t) => [t.id, byGroup[t.group_id] || '']));
  }, [teams, groups]);

  const propose = useCallback(async () => {
    setLoading(true);
    setError('');
    const [tRes, pRes] = await Promise.all([
      supabase.from('teams').select('id, name, group_id').eq('division_id', divisionId).order('name'),
      templateKey
        ? supabase.rpc('propose_knockout_plan', { p_division_id: divisionId, p_template: JSON.parse(templateKey) })
        : Promise.resolve({ data: null, error: null }),
    ]);
    setLoading(false);
    if (tRes.error || pRes.error) {
      setError((tRes.error || pRes.error).message);
      return;
    }
    setTeams(tRes.data);
    if (pRes.data) {
      setPlan({ rounds: pRes.data.rounds });
      setMeta(pRes.data);
      setEdited(false);
    }
  }, [divisionId, templateKey]);

  useEffect(() => {
    propose();
  }, [propose]);

  const problems = useMemo(() => (plan ? planProblems(plan) : []), [plan]);
  const clashes = useMemo(() => (plan ? firstRoundClashes(plan, teamGroup) : []), [plan, teamGroup]);
  const provisional = Boolean(meta && meta.provisional);
  const locked = knockout.hasResults;
  const canBuild = access.canChange;

  function change(next) {
    setPlan(next);
    setEdited(true);
    setBuilt(null);
    setError('');
  }

  function pick(r, m, side, value) {
    let choice = { team: null };
    if (value.startsWith('t:')) {
      const id = value.slice(2);
      const t = teams.find((x) => x.id === id);
      choice = { team: id, name: t ? t.name : '', group: teamGroup[id] || '' };
    } else if (value.startsWith('w:')) {
      const [, rr, mm] = value.split(':');
      choice = { w: [Number(rr), Number(mm)] };
    }
    change(placeInSlot(plan, r, m, side, choice));
  }

  async function build() {
    if (!plan) return;
    if (knockout.exists && !locked && !window.confirm('Replace the existing knockout with this plan? It has no results yet, so nothing is lost.')) return;
    setBusy(true);
    setError('');
    const { data, error: err } = await supabase.rpc('commit_knockout_plan', {
      p_division_id: divisionId,
      p_plan: toRpcPlan(plan),
      p_override_code: locked ? code : null,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (!data || !data.ok) {
      setError(planErrorText(data));
      return;
    }
    setBuilt(data);
    setCode('');
    setEdited(false);
    if (onChanged) onChanged();
  }

  if (!template && !plan) {
    return (
      <div className="plan-panel">
        <p className="field-hint">
          This division has no knockout format yet. Choose a ready made one under Scoring rules, or start from an empty plan
          here and pick every team by hand.
        </p>
        <div className="plan-blanks">
          {BLANKS.map((b) => (
            <button
              key={b.key}
              type="button"
              className="btn-ghost"
              disabled={!canBuild}
              onClick={() => {
                setPlan(blankPlan(b.shape));
                setMeta({ provisional: false, swaps: [], qualifiers: [] });
                setEdited(true);
              }}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (!plan) {
    return <p className="field-hint">{loading ? 'Working out the knockout…' : error || ' '}</p>;
  }

  const n = plan.rounds.length;
  const byGroup = groups.map((g) => ({ ...g, teams: teams.filter((t) => t.group_id === g.id) }));

  return (
    <div className="plan-panel">
      <p className="field-hint">
        This is how the knockout will look. It is worked out from the pool tables with this division's format, and it
        updates as results come in. Change any place yourself with the lists, then build it.
      </p>

      {template && (
        <div>
          <button type="button" className="btn-ghost" disabled={loading} onClick={propose}>
            {loading ? 'Refreshing…' : 'Refresh from the latest pool results'}
          </button>
        </div>
      )}

      {provisional && (
        <div className="plan-note" role="status">
          The pool games are not all finished, so this is how it would look today. Building opens when every pool game is finished.
        </div>
      )}
      {meta && meta.swaps && meta.swaps.length > 0 && (
        <div className="plan-note" role="status">
          {meta.swaps.map((s, i) => (
            <span key={i}>
              {s.moved} and {s.with} swapped places so a pool does not play itself in round one.{' '}
            </span>
          ))}
          Change it back below if you want it the other way.
        </div>
      )}
      {clashes.map((c) => (
        <div key={c.match} className="plan-warn" role="alert">
          {matchShort(0, c.match, n)} is two teams from pool {c.group}: they have already met.
        </div>
      ))}
      {edited && (
        <div className="plan-note">
          You have changed this plan by hand.{' '}
          <button type="button" className="link-button" onClick={propose}>
            Put it back the way the rules make it
          </button>
        </div>
      )}

      {plan.rounds.map((round, r) => (
        <section key={r} className="plan-round">
          <h3 className="adv-h">{roundName(r, n)}</h3>
          {round.map((match, m) => (
            <div key={m} className="plan-match">
              <span className="plan-tag mono">{matchShort(r, m, n)}</span>
              {['a', 'b'].map((side, i) => (
                <span key={side} className="plan-slotwrap">
                  {i === 1 && <span className="plan-v">v</span>}
                  <select
                    className="text-input plan-slot"
                    aria-label={`${matchShort(r, m, n)} ${side === 'a' ? 'first' : 'second'} team`}
                    value={valueOf(match[side])}
                    disabled={!canBuild}
                    onChange={(e) => pick(r, m, side, e.target.value)}
                  >
                    <option value="">Choose…</option>
                    {r > 0 && (
                      <optgroup label="Winner of">
                        {freeWinners(plan, r, m, side).map(([rr, mm]) => (
                          <option key={`${rr}:${mm}`} value={`w:${rr}:${mm}`}>
                            {winnerLabel({ w: [rr, mm] }, n)}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {byGroup.map((g) => (
                      <optgroup key={g.id} label={g.name}>
                        {g.teams.map((t) => (
                          <option key={t.id} value={`t:${t.id}`}>
                            {t.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </span>
              ))}
              {r === 0 && (
                <button type="button" className="btn-ghost plan-swap" disabled={!canBuild} onClick={() => change(swapSides(plan, r, m))}>
                  Swap sides
                </button>
              )}
              <PlanWhy match={match} />
            </div>
          ))}
        </section>
      ))}

      {n >= 2 && (
        <div className="plan-extra">
          <button type="button" className="btn-ghost" disabled={!canBuild} onClick={() => change(dropFirstRound(plan))}>
            Skip the {roundName(0, n).toLowerCase()}s: start at the {roundName(1, n).toLowerCase()}s
          </button>
          <p className="field-hint">You then choose the teams for the {roundName(1, n).toLowerCase()}s yourself.</p>
        </div>
      )}

      {problems.length > 0 && (
        <ul className="adv-problems">
          {problems.map((p, i) => (
            <li key={`${i}-${p}`}>{p}</li>
          ))}
        </ul>
      )}

      {locked && (
        <div className="plan-lock">
          <p className="plan-lock-title">This knockout has already been played</p>
          <p className="field-hint">
            Changing it needs the override password from the ScoreIt team. Matches already played that come out exactly the
            same are kept. A played match whose teams change loses its result.
          </p>
          <label className="field-label" htmlFor="override">
            Override password
          </label>
          <input
            id="override"
            type="password"
            autoComplete="off"
            className="text-input plan-code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>
      )}

      {error && (
        <div className="callout-error" role="alert">
          {error}
        </div>
      )}
      {built && (
        <div className="plan-done" role="status">
          Knockout built: {built.matches} matches
          {built.kept > 0 ? `, ${built.kept} played match${built.kept === 1 ? '' : 'es'} kept` : ''}
          {built.erased > 0 ? `, ${built.erased} result${built.erased === 1 ? '' : 's'} removed because the teams changed` : ''}.
        </div>
      )}

      <div className="rules-actions">
        <button
          type="button"
          className="btn-primary"
          disabled={!canBuild || busy || provisional || problems.length > 0 || (locked && code.length < 6)}
          onClick={build}
        >
          {busy ? 'Building…' : knockout.exists ? 'Rebuild the knockout' : 'Build the knockout'}
        </button>
      </div>
    </div>
  );
}

// a line under a match saying where its teams came from, for the places the rules picked
function PlanWhy({ match }) {
  const bits = ['a', 'b']
    .map((s) => match[s])
    .filter((x) => x && x.token && x.token.startsWith('best') && x.team)
    .map((x) => {
      const [, place, rank] = /^best(\d+)r(\d+)$/.exec(x.token);
      const nth = ['', 'best', '2nd best', '3rd best', '4th best'][Number(rank)] || `no. ${rank}`;
      const ord = ['', '1st', '2nd', '3rd'][Number(place)] || `${place}th`;
      return `${x.name} is the ${nth} ${ord} placed team: ${x.wins} win${x.wins === 1 ? '' : 's'}, point difference ${x.pd > 0 ? `+${x.pd}` : x.pd}, ${x.ps} points scored`;
    });
  if (bits.length === 0) return null;
  return <span className="plan-why mono">{bits.join(' · ')}</span>;
}
