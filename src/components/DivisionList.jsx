import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import StatusPill from './StatusPill';
import { categoryLabel, formatLabel } from '../lib/divisions';
import { computeSteps, nextUp } from '../lib/divisionSteps';
import '../styles/steps.css';

export default function DivisionList({ tenantId }) {
  const [divisions, setDivisions] = useState(null);
  const [progress, setProgress] = useState({});
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;
    supabase
      .from('divisions')
      .select('id, name, category, format_type, age_label, gender_label, status')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          setLoadError(error.message);
          return;
        }
        setDivisions(data);
        loadProgress(data);
      });

    // how far each division has got, from what already exists
    async function loadProgress(list) {
      if (!list || list.length === 0) return;
      const ids = list.map((d) => d.id);
      const [teamsRes, groupsRes, matchesRes] = await Promise.all([
        supabase.from('teams').select('id, division_id, group_id').in('division_id', ids),
        supabase.from('groups').select('id, division_id, is_playoff').in('division_id', ids),
        supabase.from('matchups').select('id, division_id, group_id, stage, status').in('division_id', ids),
      ]);
      if (!isMounted || teamsRes.error || groupsRes.error || matchesRes.error) return;
      const out = {};
      list.forEach((d) => {
        const teams = teamsRes.data.filter((t) => t.division_id === d.id);
        const pools = groupsRes.data.filter((g) => g.division_id === d.id && !g.is_playoff);
        const ms = matchesRes.data.filter((m) => m.division_id === d.id);
        const poolMatches = ms.filter((m) => m.group_id && m.stage === 'group');
        const knockout = ms.filter((m) => !m.group_id && m.stage !== 'group');
        const finals = knockout.filter((m) => m.stage === 'Final');
        const decider = finals.length > 0 ? finals : knockout;
        out[d.id] = {
          status: d.status,
          formatType: d.format_type,
          teams: teams.length,
          ungrouped: teams.filter((t) => !t.group_id).length,
          groups: pools.length,
          poolMatches: poolMatches.length,
          poolMatchesDone: poolMatches.filter((m) => m.status === 'complete').length,
          knockoutExists: knockout.length > 0,
          knockoutDone: decider.length > 0 && decider.every((m) => m.status === 'complete' || m.status === 'bye'),
        };
      });
      setProgress(out);
    }
    return () => {
      isMounted = false;
    };
  }, [tenantId]);

  if (loadError) {
    return <div className="callout-error">Couldn't load divisions: {loadError}</div>;
  }

  return (
    <div>
      {divisions === null && <p className="tenants-empty mono">Loading…</p>}

      {divisions?.length === 0 && (
        <p className="tenants-empty">No divisions yet.</p>
      )}

      {divisions && divisions.length > 0 && (
        <ul className="division-list">
          {divisions.map((division) => (
            <li key={division.id}>
              <Link
                to={`/tenants/${tenantId}/divisions/${division.id}`}
                className="division-row"
              >
                <div className="division-row-main">
                  <span className="division-row-name">{division.name}</span>
                  <span className="division-row-meta">
                    {categoryLabel(division.category)} · {formatLabel(division.format_type)}
                    {division.gender_label ? ` · ${division.gender_label}` : ''}
                    {division.age_label ? ` · ${division.age_label}` : ''}
                  </span>
                </div>
                <div className="division-row-side">
                  <StatusPill status={division.status} />
                  {progress[division.id] && <DivisionProgress p={progress[division.id]} />}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link
        to={`/tenants/${tenantId}/divisions/new`}
        className="btn-ghost division-new-link"
      >
        Add division
      </Link>
    </div>
  );
}

// a bar of finished steps, and the next thing to do
function DivisionProgress({ p }) {
  const steps = computeSteps(p);
  const done = steps.filter((x) => x.state === 'done').length;
  const next = nextUp(p);
  return (
    <span className="division-progress">
      <span className="division-progress-bar" aria-hidden="true">
        {steps.map((x) => (
          <span key={x.id} className={`division-progress-seg division-progress-${x.state}`} />
        ))}
      </span>
      <span className="division-progress-text">
        {p.teams} team{p.teams === 1 ? '' : 's'} · {done === steps.length ? 'All steps done' : `Next: ${next.title}`}
      </span>
    </span>
  );
}
