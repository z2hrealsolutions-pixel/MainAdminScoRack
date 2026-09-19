import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';

export default function RosterSection({ tenantId, divisionId, category }) {
  const [teams, setTeams] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;
    supabase
      .from('teams')
      .select('id, name, captain_name, seed, players(count)')
      .eq('division_id', divisionId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          setLoadError(error.message);
          return;
        }
        setTeams(data);
      });
    return () => {
      isMounted = false;
    };
  }, [divisionId]);

  const addLabel =
    category === 'league' ? 'Add team' : category === 'doubles' ? 'Add pair' : 'Add player';

  if (loadError) {
    return <div className="callout-error">Couldn't load teams: {loadError}</div>;
  }

  return (
    <div>
      {teams === null && <p className="tenants-empty mono">Loading…</p>}

      {teams?.length === 0 && <p className="tenants-empty">No entrants yet.</p>}

      {teams && teams.length > 0 && (
        <ul className="division-list">
          {teams.map((team) => (
            <li key={team.id}>
              <Link
                to={`/tenants/${tenantId}/divisions/${divisionId}/teams/${team.id}`}
                className="division-row"
              >
                <div className="division-row-main">
                  <span className="division-row-name">{team.name}</span>
                  <span className="division-row-meta">
                    {team.players[0]?.count ?? 0} player
                    {team.players[0]?.count === 1 ? '' : 's'}
                    {team.captain_name ? ` · Captain: ${team.captain_name}` : ''}
                    {team.seed ? ` · Seed ${team.seed}` : ''}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="roster-actions">
        <Link
          to={`/tenants/${tenantId}/divisions/${divisionId}/teams/new`}
          className="btn-ghost"
        >
          {addLabel}
        </Link>
        <Link
          to={`/tenants/${tenantId}/divisions/${divisionId}/import`}
          className="btn-ghost"
        >
          Import CSV
        </Link>
      </div>
    </div>
  );
}
