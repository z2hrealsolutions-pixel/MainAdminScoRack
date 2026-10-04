import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAccess } from '../lib/access';

// Permanent, and for ScoRack operators only. CONFIRM has to be typed.
export default function DeleteTenant({ tenantId }) {
  const navigate = useNavigate();
  const { isOperator } = useAccess();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!isOperator) return null;

  async function openPanel() {
    setOpen(true);
    setError('');
    setTyped('');
    const { data, error: err } = await supabase.rpc('tenant_deletion_preview', { p_tenant_id: tenantId });
    if (err) {
      setError(err.message);
      return;
    }
    setPreview(data);
  }

  async function remove() {
    setBusy(true);
    setError('');
    const { error: err } = await supabase.rpc('delete_tenant', { p_tenant_id: tenantId, p_confirm: typed });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    navigate('/tenants');
  }

  if (!open) {
    return (
      <button type="button" className="btn-danger" onClick={openPanel}>
        Delete this tenant…
      </button>
    );
  }

  const c = preview ? preview.counts : null;
  return (
    <div className="danger-panel">
      {c && (
        <p>
          This permanently deletes <strong>{preview.name}</strong> (/{preview.slug}) and everything in it:{' '}
          {c.divisions} division{c.divisions === 1 ? '' : 's'}, {c.teams} team{c.teams === 1 ? '' : 's'},{' '}
          {c.players} player{c.players === 1 ? '' : 's'}, {c.matches} match{c.matches === 1 ? '' : 'es'},{' '}
          {c.scores} recorded result{c.scores === 1 ? '' : 's'}, {c.staff} staff access
          {c.pending_invites > 0 ? ` and ${c.pending_invites} pending invitation${c.pending_invites === 1 ? '' : 's'}` : ''}.
          Its public pages stop working at once. People's sign-in accounts are kept. This cannot be undone.
        </p>
      )}
      <label className="field-label" htmlFor="confirmTenant">
        Type CONFIRM to delete it
      </label>
      <input
        id="confirmTenant"
        className="text-input confirm-input mono"
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        autoComplete="off"
        placeholder="CONFIRM"
      />
      {error && (
        <div className="callout-error" role="alert">
          {error}
        </div>
      )}
      <div className="danger-actions">
        <button type="button" className="btn-danger" disabled={typed !== 'CONFIRM' || busy || !preview} onClick={remove}>
          {busy ? 'Deleting…' : 'Delete tenant'}
        </button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
