import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import StatusPill from './StatusPill';
import { categoryLabel, formatLabel } from '../lib/divisions';

export default function DivisionList({ tenantId }) {
  const [divisions, setDivisions] = useState(null);
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
      });
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
                <StatusPill status={division.status} />
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
