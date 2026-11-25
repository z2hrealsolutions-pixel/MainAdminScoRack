import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

// The override password of one venue. Only the ScoreIt team sets it. A venue's staff type it in to change a
// knockout after play has started, and nothing can read it back: only whether one is set.
export default function OverrideCodePanel({ tenantId }) {
  const [status, setStatus] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('override_code_status', { p_tenant_id: tenantId });
    if (err) {
      setError(err.message);
      return;
    }
    setStatus(data);
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setDone('');
    const { error: err } = await supabase.rpc('set_override_code', { p_tenant_id: tenantId, p_code: code });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setCode('');
    setDone('Override password saved. Give it to the tenant yourself.');
    load();
  }

  return (
    <form onSubmit={save} className="tenant-form">
      <p className="field-hint">
        {status
          ? status.is_set
            ? 'A password is set for this tenant.'
            : 'No password is set yet. Until one is set, a knockout that has been played cannot be changed.'
          : ' '}
        {status && status.locked ? ' It is locked for a few minutes after too many wrong tries.' : ''}
      </p>
      <div>
        <label className="field-label" htmlFor="override-new">
          {status && status.is_set ? 'New override password' : 'Override password'}
        </label>
        <input
          id="override-new"
          type="text"
          autoComplete="off"
          className="text-input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="At least 6 characters"
        />
        <p className="field-hint">It is stored scrambled and cannot be shown again, so note it down before saving.</p>
      </div>
      {error && (
        <div className="callout-error" role="alert">
          {error}
        </div>
      )}
      {done && <p className="field-hint">{done}</p>}
      <button type="submit" className="btn-primary tenant-form-submit" disabled={busy || code.trim().length < 6}>
        {busy ? 'Saving…' : status && status.is_set ? 'Change password' : 'Set password'}
      </button>
    </form>
  );
}
