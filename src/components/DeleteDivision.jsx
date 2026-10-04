import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useVenueAccess } from '../lib/access';

// Permanent. Owners and operators only, and CONFIRM has to be typed.
export default function DeleteDivision({ tenantId, divisionId }) {
  const navigate = useNavigate();
  const access = useVenueAccess(tenantId);
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!access.isOwner) {
    return <p className="field-hint">Only an owner of the venue can delete a division.</p>;
  }

  async function openPanel() {
    setOpen(true);
    setError('');
    setTyped('');
    const { data, error: err } = await supabase.rpc('division_deletion_preview', { p_division_id: divisionId });
    if (err) {
      setError(err.message);
      return;
    }
    setPreview(data);
  }

  async function remove() {
    setBusy(true);
    setError('');
    const { error: err } = await supabase.rpc('delete_division', { p_division_id: divisionId, p_confirm: typed });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    navigate(`/tenants/${tenantId}`);
  }

  if (!open) {
    return (
      <button type="button" className="btn-danger" onClick={openPanel}>
        Delete this division…
      </button>
    );
  }

  const c = preview ? preview.counts : null;
  return (
    <div className="danger-panel">
      {c && (
        <p>
          This permanently deletes <strong>{preview.name}</strong> with {c.teams} team{c.teams === 1 ? '' : 's'},{' '}
          {c.players} player{c.players === 1 ? '' : 's'}, {c.matches} match{c.matches === 1 ? '' : 'es'} and{' '}
          {c.scores} recorded result{c.scores === 1 ? '' : 's'}. This cannot be undone.
        </p>
      )}
      <label className="field-label" htmlFor="confirmDivision">
        Type CONFIRM to delete it
      </label>
      <input
        id="confirmDivision"
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
          {busy ? 'Deleting…' : 'Delete division'}
        </button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </div>
  );
}
