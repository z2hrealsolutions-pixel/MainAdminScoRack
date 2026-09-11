import { supabase } from '../supabaseClient';
import '../styles/login.css';

export default function NotAuthorized({ email }) {
  return (
    <div className="login-screen">
      <div className="login-rail" style={{ background: 'var(--line)' }} />
      <div className="login-content">
        <div className="login-wordmark mono">SCORACK</div>
        <h1 className="login-headline">Not on the operator list</h1>
        <p className="login-sub">
          <strong>{email}</strong> signed in successfully, but isn't
          registered as a ScoRack operator yet. Ask an existing operator to
          add you, or sign in with a different account.
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
