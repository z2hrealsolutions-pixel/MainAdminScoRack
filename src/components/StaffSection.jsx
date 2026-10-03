import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAccess, useVenueAccess } from '../lib/access';

// The venue's team: who has access, who is invited. Everyone on the team can
// see it, owners can change it.
export default function StaffSection({ tenantId }) {
  const { userId } = useAccess();
  const access = useVenueAccess(tenantId);
  const [rows, setRows] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('staff');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.rpc('list_tenant_staff', { p_tenant_id: tenantId });
    if (err) {
      setLoadError(err.message);
      return;
    }
    setLoadError('');
    setRows(data);
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  async function run(fn, params, done) {
    setBusy(true);
    setError('');
    setMessage('');
    const { error: err } = await supabase.rpc(fn, params);
    setBusy(false);
    if (err) {
      setError(err.message);
      return false;
    }
    if (done) setMessage(done);
    await load();
    return true;
  }

  async function invite(event) {
    event.preventDefault();
    const ok = await run(
      'invite_staff',
      { p_tenant_id: tenantId, p_email: email, p_role: role },
      `${email.trim().toLowerCase()} can now sign in at ${window.location.origin} with that email address.`
    );
    if (ok) {
      setEmail('');
      setRole('staff');
    }
  }

  const members = (rows || []).filter((r) => r.kind === 'member');
  const invites = (rows || []).filter((r) => r.kind === 'invite');

  return (
    <section className="tenant-section">
      <h2 className="tenant-section-title">Team</h2>

      {loadError && <div className="callout-error">{loadError}</div>}
      {!rows && !loadError && <p className="field-hint mono">Loading…</p>}

      {rows && (
        <ul className="staff-list">
          {members.map((m) => {
            const you = m.user_id === userId;
            return (
              <li key={m.user_id} className="staff-row">
                <span className="staff-email">
                  {m.email || 'Unknown account'}
                  {you && <span className="staff-tag mono">you</span>}
                </span>
                {access.isOwner ? (
                  <select
                    className="text-input staff-role"
                    aria-label={`Role for ${m.email}`}
                    value={m.role}
                    disabled={busy}
                    onChange={(event) =>
                      run('set_staff_role', {
                        p_tenant_id: tenantId,
                        p_user_id: m.user_id,
                        p_role: event.target.value,
                      })
                    }
                  >
                    <option value="owner">Owner</option>
                    <option value="staff">Staff</option>
                  </select>
                ) : (
                  <span className="staff-role-text mono">{m.role}</span>
                )}
                {access.isOwner && (
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          you
                            ? 'Leave this venue? You will lose access straight away.'
                            : `Remove ${m.email}? They lose access straight away.`
                        )
                      ) {
                        run('remove_staff', { p_tenant_id: tenantId, p_user_id: m.user_id });
                      }
                    }}
                  >
                    {you ? 'Leave' : 'Remove'}
                  </button>
                )}
              </li>
            );
          })}
          {invites.map((i) => (
            <li key={i.invite_id} className="staff-row staff-row-invite">
              <span className="staff-email">
                {i.email}
                <span className="staff-tag staff-tag-invite mono">invited</span>
              </span>
              <span className="staff-role-text mono">{i.role}</span>
              {access.isOwner && (
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={busy}
                  onClick={() => run('revoke_invite', { p_invite_id: i.invite_id })}
                >
                  Cancel
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <div className="callout-error" role="alert">
          {error}
        </div>
      )}
      {message && <p className="field-hint staff-message">{message}</p>}

      {access.isOwner ? (
        <form onSubmit={invite} className="invite-form">
          <div>
            <label className="field-label" htmlFor="inviteEmail">
              Add someone by email
            </label>
            <input
              id="inviteEmail"
              type="email"
              className="text-input"
              placeholder="name@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="off"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="inviteRole">
              Role
            </label>
            <select
              id="inviteRole"
              className="text-input"
              value={role}
              onChange={(event) => setRole(event.target.value)}
            >
              <option value="staff">Staff, runs the venue</option>
              <option value="owner">Owner, also manages the team</option>
            </select>
          </div>
          <button type="submit" className="btn-primary" disabled={busy || email.trim() === ''}>
            Add
          </button>
          <p className="field-hint invite-hint">
            Nothing is emailed. Tell them to open {window.location.origin} and sign in with exactly
            that address, their access appears as soon as they do.
          </p>
        </form>
      ) : (
        <p className="field-hint">Only an owner of an active venue can change the team.</p>
      )}
    </section>
  );
}
