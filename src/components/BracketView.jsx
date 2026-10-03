import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

const ROUND_ORDER = ['Round of 32', 'Round of 16', 'Quarterfinal', 'Semifinal', 'Final'];

const STAGE_ABBR = {
  'Round of 32': 'R32',
  'Round of 16': 'R16',
  Quarterfinal: 'QF',
  Semifinal: 'SF',
};

function matchLabel(m) {
  if (m.stage === 'Final') return 'Final';
  return `${STAGE_ABBR[m.stage] ?? m.stage}${m.bracket_position ?? ''}`;
}

function sortRounds(stages) {
  return [...stages].sort((a, b) => {
    const ai = ROUND_ORDER.indexOf(a);
    const bi = ROUND_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

export default function BracketView({ tenantId, divisionId, format }) {
  const [advancePerGroup, setAdvancePerGroup] = useState(2);
  const [genState, setGenState] = useState('idle');
  const [genError, setGenError] = useState('');
  const [matchups, setMatchups] = useState(null);
  const [teams, setTeams] = useState({});
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function load() {
      const [matchupsRes, teamsRes] = await Promise.all([
        supabase
          .from('matchups')
          .select('id, stage, status, team_a_id, team_b_id, advances_to_matchup_id, advances_to_slot, winner_team_id_override, bracket_position, court, scheduled_date, scheduled_time')
          .eq('division_id', divisionId)
          .is('group_id', null),
        supabase.from('teams').select('id, name').eq('division_id', divisionId),
      ]);
      if (!isMounted) return;
      const err = matchupsRes.error || teamsRes.error;
      if (err) {
        setLoadError(err.message);
        return;
      }
      const teamMap = {};
      teamsRes.data.forEach((t) => {
        teamMap[t.id] = t.name;
      });
      setTeams(teamMap);
      setMatchups(matchupsRes.data);
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [divisionId, reloadKey]);

  async function handleGenerate() {
    let message = 'Generate the knockout bracket? This replaces any existing, unplayed bracket.';

    if (format === 'group_then_knockout') {
      const { count } = await supabase
        .from('matchups')
        .select('id', { count: 'exact', head: true })
        .eq('division_id', divisionId)
        .not('group_id', 'is', null)
        .neq('status', 'complete');
      if (count > 0) {
        message =
          `${count} group match${count === 1 ? ' is' : 'es are'} still unplayed. ` +
          'The bracket will be seeded from the standings exactly as they stand right now. ' +
          'Generate it anyway?';
      }
    }

    const confirmed = window.confirm(message);
    if (!confirmed) return;

    setGenState('generating');
    setGenError('');

    const { error } = await supabase.rpc('generate_knockout_bracket', {
      p_division_id: divisionId,
      p_advance_per_group: format === 'group_then_knockout' ? Number(advancePerGroup) : null,
    });

    if (error) {
      setGenState('error');
      setGenError(error.message);
      return;
    }
    setGenState('idle');
    setReloadKey((k) => k + 1);
  }

  async function handleDeclareWinner(matchupId, winnerId) {
    setActionError('');
    const { error } = await supabase.rpc('advance_matchup_winner', {
      p_matchup_id: matchupId,
      p_winner_team_id: winnerId,
    });
    if (error) {
      setActionError(error.message);
      return;
    }
    setReloadKey((k) => k + 1);
  }

  if (loadError) {
    return <div className="callout-error">Couldn't load the bracket: {loadError}</div>;
  }

  const rounds = matchups ? sortRounds([...new Set(matchups.map((m) => m.stage))]) : [];

  return (
    <div>
      <div className="bracket-gen-row">
        {format === 'group_then_knockout' && (
          <>
            <label className="field-label" htmlFor="advancePerGroup">
              Advance per group
            </label>
            <input
              id="advancePerGroup"
              type="number"
              min="1"
              className="text-input bracket-gen-input"
              value={advancePerGroup}
              onChange={(event) => setAdvancePerGroup(event.target.value)}
            />
          </>
        )}
        <button
          type="button"
          className="btn-primary"
          disabled={genState === 'generating'}
          onClick={handleGenerate}
        >
          {genState === 'generating' ? 'Generating…' : 'Generate bracket'}
        </button>
      </div>
      {genState === 'error' && <div className="callout-error">{genError}</div>}
      {actionError && <div className="callout-error">{actionError}</div>}

      {matchups?.length === 0 && (
        <p className="tenants-empty">No bracket yet, generate it above.</p>
      )}

      {rounds.length > 0 && (
        <div className="bracket-rounds">
          {rounds.map((stage) => (
            <div key={stage} className="bracket-round-col">
              <h3 className="bracket-round-title">{stage}</h3>
              {matchups
                .filter((m) => m.stage === stage)
                .sort((a, b) => (a.bracket_position ?? 0) - (b.bracket_position ?? 0))
                .map((m) => (
                  <div key={m.id} className="bracket-match-card">
                    <Link
                      to={`/tenants/${tenantId}/divisions/${divisionId}/matchups/${m.id}`}
                      className="bracket-match-label mono"
                    >
                      {matchLabel(m)}
                      {[m.court, m.scheduled_date, m.scheduled_time].filter(Boolean).length > 0
                        ? ` · ${[m.court, m.scheduled_date, m.scheduled_time].filter(Boolean).join(' · ')}`
                        : ''}
                    </Link>
                    {['team_a_id', 'team_b_id'].map((slotKey) => {
                      const teamId = m[slotKey];
                      const isWinner = m.winner_team_id_override === teamId && teamId;
                      const canDeclare =
                        teamId &&
                        m.team_a_id &&
                        m.team_b_id &&
                        m.status !== 'complete' &&
                        m.status !== 'bye';
                      return (
                        <button
                          key={slotKey}
                          type="button"
                          className={`bracket-slot ${isWinner ? 'bracket-slot-winner' : ''}`}
                          disabled={!canDeclare}
                          onClick={() => canDeclare && handleDeclareWinner(m.id, teamId)}
                        >
                          {teamId
                            ? teams[teamId] ?? 'Unknown'
                            : (() => {
                                const feeder = matchups.find(
                                  (f) =>
                                    f.advances_to_matchup_id === m.id &&
                                    f.advances_to_slot === (slotKey === 'team_a_id' ? 'team_a' : 'team_b')
                                );
                                return feeder ? `Winner ${matchLabel(feeder)}` : 'TBD';
                              })()}
                        </button>
                      );
                    })}
                    {m.status === 'bye' && <span className="bracket-bye-tag">bye</span>}
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
