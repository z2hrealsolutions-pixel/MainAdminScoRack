import { supabase } from '../supabaseClient';
import '../styles/login.css';
import Brand from '../components/Brand';

export default function NotAuthorized({ email }) {
  return (
    <div className="login-screen">
      <div className="login-rail" style={{ background: 'var(--line)' }} />
      <div className="login-content">
        <div className="login-wordmark">
          <Brand />
        </div>
        <h1 className="login-headline">No access yet</h1>
        <p className="login-sub">
          <strong>{email}</strong> signed in successfully, but isn't linked
          to a venue or to the ScoreIt team yet. Ask the owner of your venue
          to add exactly this address from their Team section, then sign in
          again. Or sign in with a different email.
        </p>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => supabase.auth.signOut()}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
