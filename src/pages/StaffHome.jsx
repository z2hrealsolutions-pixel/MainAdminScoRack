import { Link, Navigate } from 'react-router-dom';
import Shell from '../components/Shell';
import StatusPill from '../components/StatusPill';
import { useAccess } from '../lib/access';
import '../styles/tenants.css';

// Where venue staff land. One venue that is open goes straight to it,
// otherwise they pick, and a blocked venue says why it can't be opened.
export default function StaffHome({ email }) {
  const { venues } = useAccess();
  const open = venues.filter((v) => v.status !== 'blocked');
  const blocked = venues.filter((v) => v.status === 'blocked');

  if (open.length === 1 && blocked.length === 0) {
    return <Navigate to={`/tenants/${open[0].tenant_id}`} replace />;
  }

  return (
    <Shell email={email}>
      <h1 className="dash-headline">{open.length > 0 ? 'Your venues' : 'Access blocked'}</h1>
      {open.length === 0 && (
        <p className="dash-sub">
          Access to {blocked.length === 1 ? 'your venue' : 'your venues'} has been blocked, so there
          is nothing to open right now. Contact the ScoRack team if you think this is a mistake.
        </p>
      )}

      <div className="venue-list">
        {open.map((v) => (
          <Link key={v.tenant_id} to={`/tenants/${v.tenant_id}`} className="venue-row">
            <span className="venue-name">{v.name}</span>
            <span className="venue-meta mono">
              {v.role}
              {v.status === 'suspended' ? ' · view only' : ''}
            </span>
            <StatusPill status={v.status} />
          </Link>
        ))}
        {blocked.map((v) => (
          <div key={v.tenant_id} className="venue-row venue-row-blocked">
            <span className="venue-name">{v.name}</span>
            <span className="venue-meta mono">{v.role}</span>
            <StatusPill status={v.status} />
            <span className="venue-note">Access to this venue is blocked. Contact the ScoRack team.</span>
          </div>
        ))}
      </div>
    </Shell>
  );
}
