import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export default function MatchupCode({ matchupId, teamsKnown }) {
  const [status, setStatus] = useState(undefined); // undefined = loading, null = no code
  const [reloadKey, setReloadKey] = useState(0);
  const [revealed, setRevealed] = useState('');
  const [custom, setCustom] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let isMounted = true;
    supabase
      .from('matchup_otps')
      .select('failed_attempts, locked_until, updated_at')
      .eq('matchup_id', matchupId)
      .maybeSingle()
      .then(({ data, error: loadError }) => {
        if (!isMounted) return;
        if (loadError) {
          setError(loadError.message);
          return;
        }
        setStatus(data);
      });
    return () => {
      isMounted = false;
    };
  }, [matchupId, reloadKey]);

  async function run(rpcName, params) {
    setBusy(true);
    setError('');
    const result = await supabase.rpc(rpcName, params);
    setBusy(false);
    if (result.error) {
      setError(result.error.message);
      return null;
    }
    setReloadKey((key) => key + 1);
    return result;
  }

  async function handleGenerate() {
    const result = await run('generate_matchup_otp', { p_matchup_id: matchupId });
    if (result) setRevealed(result.data);
  }

  async function handleSetCustom() {
    const result = await run('set_matchup_otp', { p_matchup_id: matchupId, p_otp: custom.trim() });
    if (result) {
      setCustom('');
      setRevealed('');
    }
  }

  async function handleClear() {
    if (!window.confirm('Remove this match\'s code? Its referee can no longer score it.')) return;
    const result = await run('clear_matchup_otp', { p_matchup_id: matchupId });
    if (result) setRevealed('');
  }

  const locked = status?.locked_until && new Date(status.locked_until) > new Date();

  return (
    <div>
      {status === undefined && <p className="tenants-empty mono">Loading…</p>}

      {status === null && <p className="field-hint">No code yet. Referees can't score this match.</p>}

      {status && !locked && (
        <p className="field-hint">
          A code is set. It's stored scrambled, so it can't be shown again. Generate a new one if it
          gets lost.
        </p>
      )}

      {locked && (
        <div className="callout-error" style={{ marginBottom: 'var(--space-3)' }}>
          Locked until {new Date(status.locked_until).toLocaleTimeString()} after too many wrong
          guesses. Generating a new code unlocks it straight away.
        </div>
      )}

      {revealed && (
        <div className="code-reveal">
          <span className="code-reveal-code mono">{revealed}</span>
          <span className="field-hint">
            Note this down now. It won't be shown again.
          </span>
        </div>
      )}

      {error && <div className="callout-error">{error}</div>}

      {!teamsKnown && (
        <p className="field-hint">Both teams need to be known before a code can be made.</p>
      )}

      {teamsKnown && (
        <>
          <div className="roster-actions">
            <button type="button" className="btn-primary" disabled={busy} onClick={handleGenerate}>
              {status ? 'Generate a new code' : 'Generate code'}
            </button>
            {status && (
              <button type="button" className="btn-ghost" disabled={busy} onClick={handleClear}>
                Remove code
              </button>
            )}
          </div>
          <div className="code-custom-row">
            <input
              className="text-input mono"
              inputMode="numeric"
              placeholder="Or choose 4 to 8 digits"
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
            />
            <button
              type="button"
              className="btn-ghost"
              disabled={busy || !/^[0-9]{4,8}$/.test(custom.trim())}
              onClick={handleSetCustom}
            >
              Use this code
            </button>
          </div>
        </>
      )}
    </div>
  );
}
