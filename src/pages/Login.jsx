import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { ownSignInUrl } from '../lib/consoleUrl';
import '../styles/login.css';
import Brand from '../components/Brand';
import { pickLoginMode, passwordErrorMessage } from '../lib/loginMode';

export default function Login() {
  // the address decides the door: rent.* is the tenants' door (email link), everything else is the ScoreIt team's (password)
  const which = pickLoginMode(window.location.hostname);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [errorMessage, setErrorMessage] = useState('');

  async function handleLink(event) {
    event.preventDefault();
    setStatus('sending');
    setErrorMessage('');

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: ownSignInUrl(),
        // an account is made by an invitation, never by asking for a link
        shouldCreateUser: false,
      },
    });

    if (error) {
      setStatus('error');
      // the same words whether or not the address has an account, so the page does not tell a stranger which addresses exist
      setErrorMessage(
        /signups not allowed|user not found/i.test(error.message)
          ? 'If that address has been invited, a link is on its way.'
          : error.message
      );
      return;
    }
    setStatus('sent');
  }

  async function handlePassword(event) {
    event.preventDefault();
    setStatus('sending');
    setErrorMessage('');

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setStatus('error');
      setErrorMessage(passwordErrorMessage(error));
      setPassword('');
      return;
    }
    // signed in: the app notices the session and opens the console
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
        <div className="login-wordmark">
          <Brand />
        </div>

        <h1 className="login-headline">Sign in</h1>

        {which === 'admin' ? (
          <>
            <p className="login-sub">For the ScoreIt team. Sign in with your email and password.</p>
            <form onSubmit={handlePassword} className="login-form">
              <label className="field-label" htmlFor="email">
                Email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoFocus
                autoComplete="username"
                className="text-input"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@yourteam.com"
              />

              <label className="field-label" htmlFor="password">
                Password
              </label>
              <div className="login-password">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  className="text-input"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  className="btn-ghost login-show"
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((v) => !v)}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>

              {status === 'error' && (
                <div className="callout-error" role="alert">
                  {errorMessage}
                </div>
              )}

              <button type="submit" className="btn-primary" disabled={status === 'sending'}>
                {status === 'sending' ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="login-sub">
              For tenant owners and staff. Enter the email address you were invited with and we'll send you a
              link, no password needed.
            </p>

            {status === 'sent' ? (
              <div className="login-sent">
                <p>
                  If <strong>{email}</strong> has been invited, a link is on its way. It can take a minute and
                  may land in spam. Links expire after an hour, ask for a new one if yours has. If nothing ever
                  arrives, tell whoever invited you.
                </p>
                <button type="button" className="btn-ghost" onClick={() => setStatus('idle')}>
                  Use a different email
                </button>
              </div>
            ) : (
              <form onSubmit={handleLink} className="login-form">
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

                <button type="submit" className="btn-primary" disabled={status === 'sending'}>
                  {status === 'sending' ? 'Sending link…' : 'Send access link'}
                </button>
              </form>
            )}

            <p className="login-footnote">
              Use the exact email address you were invited with. If you haven't been invited yet, ask whoever
              runs your tenant's ScoreIt account.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
