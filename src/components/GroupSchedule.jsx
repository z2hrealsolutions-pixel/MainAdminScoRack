import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function GroupSchedule({ tenantId, divisionId, category, onGenerated }) {
  const [groupCount, setGroupCount] = useState(4);
  const [genState, setGenState] = useState('idle'); // idle | generating | error
  const [genError, setGenError] = useState('');
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      const [groupsRes, teamsRes, matchupsRes, standingsRes] = await Promise.all([
        supabase.from('groups').select('id, name').eq('division_id', divisionId).order('name'),
        supabase.from('teams').select('id, name, seed, group_id').eq('division_id', divisionId),
        supabase
          .from('matchups')
          .select('id, group_id, team_a_id, team_b_id, status')
          .eq('division_id', divisionId)
          .not('group_id', 'is', null),
        supabase
          .from('standings')
          .select('team_id, cumulative_points, matches_played')
          .eq('division_id', divisionId),
      ]);
      if (!isMounted) return;
      const err = groupsRes.error || teamsRes.error || matchupsRes.error || standingsRes.error;
      if (err) {
        setLoadError(err.message);
        return;
      }

      const matchupIds = matchupsRes.data.map((m) => m.id);
      let subs = [];
      if (matchupIds.length > 0) {
        const subsRes = await supabase
          .from('sub_matches')
          .select('matchup_id, team_a_score, team_b_score, done')
          .in('matchup_id', matchupIds);
        if (!isMounted) return;
        if (subsRes.error) {
          setLoadError(subsRes.error.message);
          return;
        }
        subs = subsRes.data;
      }

      const teamName = (id) => teamsRes.data.find((t) => t.id === id)?.name ?? 'Unknown';
      const stats = {};
      standingsRes.data.forEach((s) => {
        stats[s.team_id] = {
          points: Number(s.cumulative_points),
          played: Number(s.matches_played),
        };
      });

      const resultLabel = (matchupId) => {
        const done = subs.filter((s) => s.matchup_id === matchupId && s.done);
        if (done.length === 0) return '';
        if (category === 'league') return `${done.length} rubber${done.length === 1 ? '' : 's'}`;
        return `${done[0].team_a_score}-${done[0].team_b_score}`;
      };

      const groups = groupsRes.data.map((g) => ({
        ...g,
        teams: teamsRes.data
          .filter((t) => t.group_id === g.id)
          .map((t) => ({ ...t, ...(stats[t.id] ?? { points: 0, played: 0 }) }))
          .sort((a, b) => b.points - a.points || (a.seed ?? 999) - (b.seed ?? 999)),
        matchups: matchupsRes.data
          .filter((m) => m.group_id === g.id)
          .map((m) => ({
            ...m,
            teamAName: teamName(m.team_a_id),
            teamBName: teamName(m.team_b_id),
            result: resultLabel(m.id),
          })),
      }));
      setData({ groups });
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [divisionId, category, reloadKey]);

  async function handleGenerate() {
    const confirmed = window.confirm(
      `Split every team in this division into ${groupCount} groups and generate the round robin schedule? This replaces any existing, unplayed groups.`
    );
    if (!confirmed) return;

    setGenState('generating');
    setGenError('');

    const { error } = await supabase.rpc('assign_groups', {
      p_division_id: divisionId,
      p_group_count: Number(groupCount),
    });

    if (error) {
      setGenState('error');
      setGenError(error.message);
      return;
    }

    setGenState('idle');
    setReloadKey((k) => k + 1);
    onGenerated?.();
  }

  if (loadError) {
    return <div className="callout-error">Couldn't load groups: {loadError}</div>;
  }

  return (
    <div>
      <div className="bracket-gen-row">
        <label className="field-label" htmlFor="groupCount">
          Number of groups
        </label>
        <input
          id="groupCount"
          type="number"
          min="1"
          className="text-input bracket-gen-input"
          value={groupCount}
          onChange={(event) => setGroupCount(event.target.value)}
        />
        <button
          type="button"
          className="btn-primary"
          disabled={genState === 'generating'}
          onClick={handleGenerate}
        >
          {genState === 'generating' ? 'Generating…' : 'Generate groups'}
        </button>
      </div>
      {genState === 'error' && <div className="callout-error">{genError}</div>}

      {data?.groups.length === 0 && (
        <p className="tenants-empty">No groups yet, generate them above.</p>
      )}

      {data?.groups.map((group) => (
        <div key={group.id} className="group-card">
          <h3 className="group-card-title">{group.name}</h3>
          <ol className="group-team-list">
            {group.teams.map((team) => (
              <li key={team.id}>
                {team.name}
                {team.seed ? <span className="mono group-seed"> #{team.seed}</span> : null}
                <span className="group-team-points">
                  {team.points} pts · {team.played} played
                </span>
              </li>
            ))}
          </ol>
          <div className="group-matchups">
            {group.matchups.map((m) => (
              <Link
                key={m.id}
                to={`/tenants/${tenantId}/divisions/${divisionId}/matchups/${m.id}`}
                className="group-matchup-link"
              >
                <span>
                  {m.teamAName} <span className="mist">vs</span> {m.teamBName}
                </span>
                <span>
                  {m.result && <span className="group-matchup-result">{m.result} </span>}
                  <span className="group-matchup-status mono">{m.status}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
