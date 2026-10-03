import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Shell from '../components/Shell';
import StatusPill from '../components/StatusPill';
import { sportLabel } from '../lib/sports';
import '../styles/tenants.css';

export default function TenantList({ email }) {
  const [tenants, setTenants] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;
    supabase
      .from('tenants')
      .select('id, slug, name, sport, status, created_at')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          setLoadError(error.message);
          return;
        }
        setTenants(data);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Shell email={email}>
      <div className="tenants-header">
        <div>
          <h1 className="dash-headline">Tenants</h1>
          <p className="dash-sub">
            Every sub-platform rented out through ScoRack.
          </p>
        </div>
        <Link to="/tenants/new" className="btn-primary tenants-new-link">
          Create tenant
        </Link>
      </div>

      {loadError && (
        <div className="callout-error">
          Couldn't load tenants: {loadError}
        </div>
      )}

      {!loadError && tenants === null && (
        <p className="tenants-empty mono">Loading…</p>
      )}

      {tenants?.length === 0 && (
        <div className="tenants-empty">
          <p>No tenants yet.</p>
          <Link to="/tenants/new" className="btn-ghost">
            Create the first one
          </Link>
        </div>
      )}

      {tenants && tenants.length > 0 && (
        <table className="tenants-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Slug</th>
              <th>Sport</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.id}>
                <td>
                  <Link to={`/tenants/${tenant.id}`} className="tenants-row-link">
                    {tenant.name}
                  </Link>
                </td>
                <td className="mono tenants-slug">{tenant.slug}</td>
                <td>{sportLabel(tenant.sport)}</td>
                <td>
                  <StatusPill status={tenant.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Shell>
  );
}
