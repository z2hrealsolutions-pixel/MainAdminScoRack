import { supabase } from '../supabaseClient';
import '../styles/shell.css';

const NAV_SECTIONS = [
  { label: 'Tenants', status: 'next' },
  { label: 'Divisions', status: 'later' },
  { label: 'Brackets', status: 'later' },
];

export default function Shell({ email, children }) {
  return (
    <div className="shell">
      <header className="shell-topbar">
        <div className="shell-wordmark mono">SCORACK</div>
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
          {NAV_SECTIONS.map((section) => (
            <div key={section.label} className="shell-nav-item">
              <span>{section.label}</span>
              {section.status === 'next' && (
                <span className="shell-nav-tag">next</span>
              )}
            </div>
          ))}
        </nav>

        <main className="shell-main">{children}</main>
      </div>
    </div>
  );
}
