import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Shell from '../components/Shell';
import '../styles/dashboard.css';

// The operator's front page: how many venues, in what state, and where to go next.
export default function Dashboard({ email }) {
  const [counts, setCounts] = useState(null);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function load() {
      const { data, error } = await supabase.from('tenants').select('status');
      if (!isMounted) return;
      if (error) {
        setLoadError(error.message || 'Could not reach the database.');
        return;
      }
      const by = { active: 0, suspended: 0, blocked: 0 };
      data.forEach((t) => {
        by[t.status] = (by[t.status] || 0) + 1;
      });
      setCounts({ total: data.length, ...by });
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const value = (n) => (loadError ? '\u2014' : (n ?? '\u2026'));

  return (
    <Shell email={email}>
      <div className="dash-status">
        <span className="status-dot" />
        <span>Connected as an operator</span>
      </div>

      <h1 className="dash-headline">Console online</h1>
      <p className="dash-sub">Every venue rented out through ScoreIt, and the state each one is in.</p>

      <div className="dash-stats">
        <Link to="/tenants" className="dash-stat dash-stat-link">
          <span className="dash-stat-value mono">{value(counts?.total)}</span>
          <span className="dash-stat-label">venues in total</span>
        </Link>
        <Link to="/tenants" className="dash-stat dash-stat-link">
          <span className="dash-stat-value mono">{value(counts?.active)}</span>
          <span className="dash-stat-label">active</span>
        </Link>
        <Link to="/tenants" className="dash-stat dash-stat-link">
          <span className="dash-stat-value mono">{value(counts?.suspended)}</span>
          <span className="dash-stat-label">suspended, view only</span>
        </Link>
        <Link to="/tenants" className="dash-stat dash-stat-link">
          <span className="dash-stat-value mono">{value(counts?.blocked)}</span>
          <span className="dash-stat-label">blocked</span>
        </Link>
      </div>

      <div className="dash-actions">
        <Link to="/tenants/new" className="btn-primary">
          Create a venue
        </Link>
        <Link to="/tenants" className="btn-ghost">
          See all venues
        </Link>
      </div>

      {loadError && (
        <div className="callout-error" style={{ marginTop: 24 }}>
          Signed in fine, but reading from the database failed: {loadError}
        </div>
      )}
    </Shell>
  );
}
