import { NavLink } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import '../styles/shell.css';

const NAV_SECTIONS = [
  { label: 'Tenants', to: '/tenants' },
  { label: 'Brackets', status: 'later' },
];

export default function Shell({ email, children }) {
  return (
    <div className="shell">
      <header className="shell-topbar">
        <NavLink to="/" className="shell-wordmark mono">
          SCORACK
        </NavLink>
        <div className="shell-topbar-right">
          <span className="shell-operator mono">{email}</span>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => supabase.auth.signOut()}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="shell-body">
        <nav className="shell-nav">
          {NAV_SECTIONS.map((section) =>
            section.to ? (
              <NavLink
                key={section.label}
                to={section.to}
                className={({ isActive }) =>
                  `shell-nav-item shell-nav-item-link${
                    isActive ? ' shell-nav-item-current' : ''
                  }`
                }
              >
                <span>{section.label}</span>
              </NavLink>
            ) : (
              <div key={section.label} className="shell-nav-item">
                <span>{section.label}</span>
                <span className="shell-nav-tag">later</span>
              </div>
            )
          )}
        </nav>

        <main className="shell-main">{children}</main>
      </div>
    </div>
  );
}
