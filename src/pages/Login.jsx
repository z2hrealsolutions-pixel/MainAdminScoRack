import { useState } from 'react';
import { supabase } from '../supabaseClient';
import '../styles/login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus('sending');
    setErrorMessage('');

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: window.location.origin,
      },
    });

    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
      return;
    }
    setStatus('sent');
  }

  return (
    <div className="login-screen">
      <div className="login-rail" />
      <svg
        className="login-court-lines"
        viewBox="0 0 600 500"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <rect x="40" y="40" width="520" height="420" fill="none" />
        <line x1="300" y1="40" x2="300" y2="460" />
        <rect x="40" y="150" width="150" height="200" fill="none" />
        <rect x="410" y="150" width="150" height="200" fill="none" />
      </svg>
      <div className="login-content">
        <div className="login-wordmark mono">SCORACK</div>

        <h1 className="login-headline">Operator access</h1>
        <p className="login-sub">
          Sign in to manage tenants, divisions, and live brackets across
          every rented court.
        </p>

        {status === 'sent' ? (
          <div className="login-sent">
            <p>
              Check <strong>{email}</strong> for a link. Open it on this
              device to finish signing in.
            </p>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setStatus('idle')}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="login-form">
            <label className="field-label" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              autoFocus
              className="text-input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@yourteam.com"
            />

            {status === 'error' && (
              <div className="callout-error" role="alert">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={status === 'sending'}
            >
              {status === 'sending' ? 'Sending link…' : 'Send access link'}
            </button>
          </form>
        )}

        <p className="login-footnote">
          Access is limited to ScoRack operators. If your email isn't
          registered, the link will still arrive, but the console will stay
          locked.
        </p>
      </div>
    </div>
  );
}
