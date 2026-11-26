import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { ownSignInUrl } from '../lib/consoleUrl';
import '../styles/login.css';
import Brand from '../components/Brand';
import { pickLoginMode, passwordErrorMessage } from '../lib/loginMode';
import { noAccessMessage, linkErrorMessage, sentMessage } from '../lib/rentLogin';

export default function Login() {
  // the address decides the door: rent.* is the tenants' door (email link), everything else is the ScoreIt team's (password)
  const which = pickLoginMode(window.location.hostname);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('idle'); // idle | sending | sent | error
  const [errorMessage, setErrorMessage] = useState('');

  async function handleLink(event) {
    event.preventDefault();
    setStatus('sending');
    setErrorMessage('');

    const address = email.trim();

    // first: does this email already have access to an event? (given by the ScoreIt team or by the event's owner)
    const check = await supabase.rpc('rent_login_check', { p_email: address });
    if (check.error || !check.data) {
      setStatus('error');
      setErrorMessage((check.error && check.error.message) || 'Could not check this email. Try again.');
      return;
    }
    if (!check.data.ok) {
      setStatus('error');
      setErrorMessage(noAccessMessage(check.data.error));
      return;
    }

    // it has: send the one-time link that opens the event
    const { error } = await supabase.auth.signInWithOtp({
      email: address,
      options: {
        emailRedirectTo: ownSignInUrl(),
        // an account is made by an invitation, never by asking for a link
        shouldCreateUser: false,
      },
    });

    if (error) {
      setStatus('error');
      setErrorMessage(linkErrorMessage(error));
      return;
    }
    setEvents(check.data.events || []);
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

        <h1 className="login-headline">{which === 'rent' ? 'Log in' : 'Sign in'}</h1>

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
              For tenant owners and staff. Enter the email address that was given access to your event and
              we'll email you a one-time link that opens it. No password needed.
            </p>

            {status === 'sent' ? (
              <div className="login-sent">
                {sentMessage(events, email.trim()).found && (
                  <p>
                    <strong>{sentMessage(events, email.trim()).found}</strong>
                  </p>
                )}
                <p>{sentMessage(events, email.trim()).body} If nothing arrives, tell whoever gave you access.</p>
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
                  {status === 'sending' ? 'Checking…' : 'Log in to your event'}
                </button>
              </form>
            )}

            <p className="login-footnote">
              Access is given by the event owner or the ScoreIt team.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
