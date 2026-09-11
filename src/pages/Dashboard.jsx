import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Shell from '../components/Shell';
import '../styles/dashboard.css';

export default function Dashboard({ email }) {
  const [counts, setCounts] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadCounts() {
      const [tenants, operators] = await Promise.all([
        supabase.from('tenants').select('*', { count: 'exact', head: true }),
        supabase
          .from('platform_admins')
          .select('*', { count: 'exact', head: true }),
      ]);

      if (!isMounted) return;

      if (tenants.error || operators.error) {
        setLoadError(
          (tenants.error || operators.error).message ||
            'Could not reach the database.'
        );
        return;
      }

      setCounts({
        tenants: tenants.count ?? 0,
        operators: operators.count ?? 0,
      });
    }

    loadCounts();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <Shell email={email}>
      <div className="dash-status">
        <span className="status-dot" />
        <span>Connected as an operator</span>
      </div>

      <h1 className="dash-headline">Console online</h1>
      <p className="dash-sub">
        Auth and the operator shell are wired up. Tenant creation is the
        next thing to build here.
      </p>

      <div className="dash-stats">
        <Link to="/tenants" className="dash-stat dash-stat-link">
          <span className="dash-stat-value mono">
            {loadError ? '—' : (counts?.tenants ?? '…')}
          </span>
          <span className="dash-stat-label">tenants provisioned</span>
        </Link>
        <div className="dash-stat">
          <span className="dash-stat-value mono">
            {loadError ? '—' : (counts?.operators ?? '…')}
          </span>
          <span className="dash-stat-label">registered operators</span>
        </div>
      </div>

      {loadError && (
        <div className="callout-error" style={{ marginTop: 24 }}>
          Signed in fine, but reading from the database failed: {loadError}
        </div>
      )}
    </Shell>
  );
}
