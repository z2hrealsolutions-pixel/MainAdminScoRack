import { NavLink, useParams } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';
import { supabase } from '../supabaseClient';
import Brand from './Brand';
import { useAccess, useVenueAccess } from '../lib/access';
import '../styles/shell.css';

export default function Shell({ email, children }) {
  const { tenantId } = useParams();
  const { isOperator, venues } = useAccess();
  const access = useVenueAccess(tenantId);

  // operators manage tenants, venue staff see their own venues
  const sections = isOperator
    ? [{ label: 'Tenants', to: '/tenants' }]
    : venues
        .filter((v) => v.status !== 'blocked')
        .map((v) => ({ label: v.name, to: `/tenants/${v.tenant_id}` }));

  // a suspended venue can be looked at but not changed
  const readOnly = !isOperator && access.known && access.canView && !access.canChange;

  return (
    <div className="shell">
      <header className="shell-topbar">
        <NavLink to="/" className="shell-brand">
          <Brand />
        </NavLink>
        <div className="shell-topbar-right">
          <ThemeToggle />
          <span className="shell-operator mono">{email}</span>
          <button type="button" className="btn-ghost" onClick={() => supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </header>

      <div className="shell-body">
        <nav className="shell-nav">
          {sections.map((section) => (
            <NavLink
              key={section.to}
              to={section.to}
              end={section.to !== '/tenants'}
              className={({ isActive }) =>
                `shell-nav-item shell-nav-item-link${isActive ? ' shell-nav-item-current' : ''}`
              }
            >
              <span>{section.label}</span>
            </NavLink>
          ))}
        </nav>

        <main className="shell-main">
          {readOnly && (
            <div className="readonly-banner" role="status">
              <strong>This venue is suspended.</strong> You can look around, but nothing can be
              changed until it is reactivated. Contact the ScoreIt team.
            </div>
          )}
          {readOnly ? (
            <fieldset className="readonly-fieldset" disabled>
              {children}
            </fieldset>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
