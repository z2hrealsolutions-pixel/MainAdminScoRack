import { supabase } from '../supabaseClient';
import '../styles/login.css';
import Brand from '../components/Brand';
import { tenantConsoleUrl } from '../lib/consoleUrl';
import { adminAddressFor } from '../lib/loginMode';

// Shown when someone is signed in on the other door's address: a tenant person on the ScoreIt team's address, or a
// ScoreIt admin on the tenants' address. They are not locked out, they are pointed to the right address.
export default function WrongDoor({ kind, email }) {
  const teamOnly = kind === 'team-only';
  const target = teamOnly
    ? tenantConsoleUrl()
    : adminAddressFor(window.location.hostname, window.location.protocol);

  async function leave() {
    // only this address's sign-in is ended, so a sign-in on the other address is not touched
    await supabase.auth.signOut({ scope: 'local' });
    if (target) window.location.assign(target);
  }

  return (
    <div className="login-screen">
      <div className="login-rail" style={{ background: 'var(--line)' }} />
      <div className="login-content">
        <div className="login-wordmark">
          <Brand />
        </div>
        <h1 className="login-headline">{teamOnly ? 'This address is for the ScoreIt team' : 'This address is for tenants'}</h1>
        <p className="login-sub">
          <strong>{email}</strong>{' '}
          {teamOnly
            ? 'is signed in, but tenant owners and staff use their own address.'
            : 'is a ScoreIt team account. The team signs in on its own address, with email and password.'}
        </p>
        <div className="login-form">
          {target && (
            <button type="button" className="btn-primary" onClick={leave}>
              {teamOnly ? 'Go to the tenants’ address' : 'Go to the team’s address'}
            </button>
          )}
          <button type="button" className="btn-ghost" onClick={() => supabase.auth.signOut({ scope: 'local' })}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
