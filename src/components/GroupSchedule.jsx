import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import GroupsImport from './GroupsImport';
import TeamsPoolsImport from './TeamsPoolsImport';

export default function GroupSchedule({ tenantId, divisionId, divisionName, category, tiebreak = 'classic', onGenerated, view = 'pools' }) {
  const [onlyToPlay, setOnlyToPlay] = useState(false);
  const [groupCount, setGroupCount] = useState(4);
  const [genState, setGenState] = useState('idle'); // idle | generating | error
  const [genError, setGenError] = useState('');
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [swapA, setSwapA] = useState('');
  const [swapB, setSwapB] = useState('');
  const [swapBusy, setSwapBusy] = useState(false);
  const [swapError, setSwapError] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function load() {
      const [groupsRes, teamsRes, matchupsRes, rankingRes] = await Promise.all([
        supabase.from('groups').select('id, name, is_playoff').eq('division_id', divisionId).order('name'),
        supabase.from('teams').select('id, name, seed, group_id').eq('division_id', divisionId),
        supabase
          .from('matchups')
          .select('id, group_id, team_a_id, team_b_id, status, court, scheduled_date, scheduled_time')
          .eq('division_id', divisionId)
          .not('group_id', 'is', null),
        supabase.rpc('division_ranking', { p_division_id: divisionId }),
      ]);
      if (!isMounted) return;
      // If the new ranking function isn't in the database yet, fall back to the old
      // standings so this section keeps working until the SQL has been run.
      let rankingRows = rankingRes.data;
      const rankingMissing =
        rankingRes.error && /could not find the function|does not exist|schema cache/i.test(rankingRes.error.message);
      if (rankingMissing) {
        const old = await supabase
          .from('standings')
          .select('team_id, team_name, cumulative_points, matches_played')
          .eq('division_id', divisionId);
        if (!isMounted) return;
        if (old.error) {
          setLoadError(old.error.message);
          return;
        }
        const byGroup = {};
        teamsRes.data.forEach((t) => {
          const st = old.data.find((x) => x.team_id === t.id);
          if (t.group_id) {
            (byGroup[t.group_id] ??= []).push({
              scope_group_id: t.group_id, team_id: t.id, team_name: t.name,
              points: st ? st.cumulative_points : 0, played: st ? st.matches_played : 0,
              wins: 0, losses: 0, point_diff: 0, seed: t.seed,
            });
          }
        });
        rankingRows = Object.values(byGroup).flatMap((list) =>
          list
            .sort((a, b) => b.points - a.points || (a.seed ?? 999) - (b.seed ?? 999))
            .map((r, i) => ({ ...r, rank_position: i + 1 }))
        );
      }
      const err = groupsRes.error || teamsRes.error || matchupsRes.error || (!rankingMissing && rankingRes.error);
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
      // the database's own ranking: wins, then head to head, then point difference
      const rankRows = {};
      rankingRows.forEach((r) => {
        (rankRows[r.scope_group_id] ??= []).push(r);
      });

      const resultLabel = (matchupId) => {
        const done = subs.filter((s) => s.matchup_id === matchupId && s.done);
        if (done.length === 0) return '';
        if (category === 'league') return `${done.length} rubber${done.length === 1 ? '' : 's'}`;
        return `${done[0].team_a_score}-${done[0].team_b_score}`;
      };

      const groups = groupsRes.data.map((g) => ({
        ...g,
        teams: (rankRows[g.id] ?? [])
          .slice()
          .sort((a, b) => a.rank_position - b.rank_position)
          .map((r) => {
            const t = teamsRes.data.find((x) => x.id === r.team_id);
            return {
              id: r.team_id,
              name: r.team_name,
              seed: t ? t.seed : null,
              position: r.rank_position,
              points: Number(r.points),
              played: Number(r.played),
              wins: Number(r.wins),
              losses: Number(r.losses),
              pointDiff: Number(r.point_diff),
            };
          }),
        matchups: matchupsRes.data
          .filter((m) => m.group_id === g.id)
          .map((m) => ({
            ...m,
            teamAName: teamName(m.team_a_id),
            teamBName: teamName(m.team_b_id),
            result: resultLabel(m.id),
            when: [m.court, m.scheduled_date, m.scheduled_time].filter(Boolean).join(' · '),
          })),
      }));
      setData({ groups, allTeams: teamsRes.data });
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

  async function handleSwap() {
    const teamList = data.groups.filter((g) => !g.is_playoff).flatMap((g) => g.teams.map((t) => ({ ...t, groupId: g.id })));
    const a = teamList.find((t) => t.id === swapA);
    const b = teamList.find((t) => t.id === swapB);
    setSwapError('');
    if (!a || !b) return;
    if (a.groupId === b.groupId) {
      setSwapError('Pick two teams from different groups.');
      return;
    }
    const confirmed = window.confirm(
      `Swap ${a.name} and ${b.name} between their groups? Each takes over the other's matches, and court and time stay on those matches. Each group keeps its own referee code.`
    );
    if (!confirmed) return;

    setSwapBusy(true);
    const { error } = await supabase.rpc('swap_team_groups', { p_team_a: a.id, p_team_b: b.id });
    setSwapBusy(false);
    if (error) {
      setSwapError(error.message);
      return;
    }
    setSwapA('');
    setSwapB('');
    setReloadKey((k) => k + 1);
  }

  if (loadError) {
    return <div className="callout-error">Couldn't load groups: {loadError}</div>;
  }

  const pools = data ? data.groups.filter((g) => !g.is_playoff) : [];
  const teamLink = (id) => `/tenants/${tenantId}/divisions/${divisionId}/teams/${id}`;
  const matchLink = (id) => `/tenants/${tenantId}/divisions/${divisionId}/matchups/${id}`;
  const statusInfo = (status) =>
    status === 'complete' ? { text: 'Done', cls: 'chip-done' } : status === 'live' ? { text: 'Live', cls: 'chip-live' } : { text: 'To play', cls: 'chip-todo' };

  // ---- the matches, pool by pool ----
  if (view === 'matches') {
    if (!data) return <p className="tenants-empty mono">Loading…</p>;
    if (pools.length === 0) {
      return <p className="tenants-empty">No pool matches yet. Set up the pools in step 1 and the matches are made for you.</p>;
    }
    return (
      <div>
        <label className="check-row">
          <input type="checkbox" checked={onlyToPlay} onChange={(event) => setOnlyToPlay(event.target.checked)} />
          <span>Only show matches still to play</span>
        </label>
        <div className="pool-grid">
          {pools.map((group) => {
            const total = group.matchups.length;
            const done = group.matchups.filter((m) => m.status === 'complete').length;
            const shown = group.matchups.filter((m) => !onlyToPlay || m.status !== 'complete');
            return (
              <section key={group.id} className="pool-card">
                <header className="pool-head">
                  <h3 className="pool-title">{group.name}</h3>
                  <span className="pool-count">{done} of {total} played</span>
                </header>
                <div className="pool-progress" aria-hidden="true">
                  <span style={{ width: total ? `${(done / total) * 100}%` : '0%' }} />
                </div>
                <div className="match-list">
                  {shown.length === 0 && <p className="field-hint">All played.</p>}
                  {shown.map((m) => {
                    const info = statusInfo(m.status);
                    return (
                      <Link key={m.id} to={matchLink(m.id)} className="match-row">
                        <span className="match-teams">
                          <span>{m.teamAName}</span>
                          <span className="match-vs">vs</span>
                          <span>{m.teamBName}</span>
                        </span>
                        <span className="match-side">
                          {m.result && <span className="match-score">{m.result}</span>}
                          <span className={`match-chip ${info.cls}`}>{info.text}</span>
                          <span className="match-when">{m.when || 'No court or time yet'}</span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    );
  }

  // ---- the pools and who is in them ----
  const hasPools = pools.length > 0;
  return (
    <div>
      {data && !hasPools && (
        <div className="empty-card">
          <h3 className="empty-card-title">No pools yet</h3>
          <p className="field-hint">
            Split the teams into pools in one go, or import a file that lists every team with its pool. The pool matches are made for you.
          </p>
        </div>
      )}

      {hasPools && (
        <div className="pool-grid">
          {pools.map((group) => (
            <section key={group.id} className="pool-card">
              <header className="pool-head">
                <h3 className="pool-title">{group.name}</h3>
                <span className="pool-count">{group.teams.length} teams</span>
              </header>
              <div className="pool-table-wrap">
                <table className="pool-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Team</th>
                      <th title="Played">P</th>
                      <th title="Won">W</th>
                      <th title="Lost">L</th>
                      <th title="Point difference">+/-</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.teams.map((team) => (
                      <tr key={team.id}>
                        <td className="pool-rank">{team.position}</td>
                        <td className="pool-team"><Link to={teamLink(team.id)}>{team.name}</Link></td>
                        <td>{team.played}</td>
                        <td>{team.wins}</td>
                        <td>{team.losses}</td>
                        <td>{team.pointDiff > 0 ? `+${team.pointDiff}` : team.pointDiff}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </div>
      )}
      {hasPools && (
        <p className="field-hint">
          {tiebreak === 'points'
            ? 'Order: most wins, then point difference, then points scored, then head to head.'
            : 'Order: most wins, then head to head, then point difference.'}{' '}
          Tap a team to correct its name.
        </p>
      )}

      <details className="tool-fold" open={data ? !hasPools : false}>
        <summary>{hasPools ? 'Change the pools' : 'Set up the pools'}</summary>
        <div className="tool-fold-body">
          <div className="tool-block">
            <h4 className="tool-title">Split the teams into pools automatically</h4>
            <div className="bracket-gen-row">
              <label className="field-label" htmlFor="groupCount">
                Number of pools
              </label>
              <input
                id="groupCount"
                type="number"
                min="1"
                className="text-input bracket-gen-input"
                value={groupCount}
                onChange={(event) => setGroupCount(event.target.value)}
              />
              <button type="button" className="btn-primary" disabled={genState === 'generating'} onClick={handleGenerate}>
                {genState === 'generating' ? 'Working…' : 'Make pools'}
              </button>
            </div>
            {genState === 'error' && <div className="callout-error">{genError}</div>}
          </div>

          {data && (
            <div className="tool-block">
              <h4 className="tool-title">Import teams and pools from a file</h4>
              <TeamsPoolsImport
                divisionId={divisionId}
                existingTeams={data.allTeams}
                hasResults={false}
                onImported={() => {
                  setReloadKey((k) => k + 1);
                  if (onGenerated) onGenerated();
                }}
              />
            </div>
          )}

          {data && (
            <div className="tool-block">
              <h4 className="tool-title">Move existing teams into pools with a file</h4>
              <GroupsImport
                divisionId={divisionId}
                divisionName={divisionName}
                teams={data.allTeams}
                groups={data.groups}
                onImported={() => {
                  setReloadKey((k) => k + 1);
                  if (onGenerated) onGenerated();
                }}
              />
            </div>
          )}

          {pools.length > 1 && (
            <div className="tool-block">
              <h4 className="tool-title">Swap two teams between pools</h4>
              <p className="field-hint">
                Not possible once either team has a result. If the bracket is already built, build it again afterwards.
              </p>
              <div className="swap-row">
                {[
                  [swapA, setSwapA, 'First team'],
                  [swapB, setSwapB, 'Second team'],
                ].map(([value, setter, label]) => (
                  <select key={label} className="text-input" aria-label={label} value={value} onChange={(event) => setter(event.target.value)}>
                    <option value="">{label}</option>
                    {pools.map((g) =>
                      g.teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} ({g.name})
                        </option>
                      ))
                    )}
                  </select>
                ))}
                <button type="button" className="btn-ghost" disabled={!swapA || !swapB || swapA === swapB || swapBusy} onClick={handleSwap}>
                  {swapBusy ? 'Swapping…' : 'Swap pools'}
                </button>
              </div>
              {swapError && <div className="callout-error">{swapError}</div>}
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
