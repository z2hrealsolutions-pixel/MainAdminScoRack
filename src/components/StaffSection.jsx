import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAccess, useVenueAccess } from '../lib/access';
import { tenantConsoleUrl } from '../lib/consoleUrl';
import { copyText, inviteMessage, sendSignInLink } from '../lib/invites';

// The venue's team: who has access, who is invited. Everyone on the team can
// see it, owners can change it.
export default function StaffSection({ tenantId, venueName }) {
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
    const address = email.trim().toLowerCase();
    setBusy(true);
    setError('');
    setMessage('');
    const { error: err } = await supabase.rpc('invite_staff', {
      p_tenant_id: tenantId,
      p_email: address,
      p_role: role,
    });
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    // the invitation is saved, now email it
    const mail = await sendSignInLink(address);
    setBusy(false);
    setMessage(
      mail.ok
        ? `Added. We emailed an invitation to ${address}, it can take a minute and may land in spam. After that they sign in at ${tenantConsoleUrl()}.`
        : `Added, but the invitation email could not be sent (${mail.message}). Use "Resend invitation" on their row to try again.`
    );
    setEmail('');
    setRole('staff');
    await load();
  }

  async function resendInvite(i) {
    setBusy(true);
    setError('');
    setMessage('');
    // saving the invitation again makes it yours and fresh, which is what lets the email go out
    const { error: err } = await supabase.rpc('invite_staff', {
      p_tenant_id: tenantId,
      p_email: i.email,
      p_role: i.role,
    });
    if (err) {
      setBusy(false);
      setError(err.message);
      return;
    }
    const mail = await sendSignInLink(i.email);
    setBusy(false);
    if (mail.ok) setMessage(`Invitation emailed again to ${i.email}. It can take a minute and may land in spam.`);
    else setError(`The invitation email could not be sent (${mail.message}).`);
  }

  async function copyInvite(address) {
    const copied = await copyText(inviteMessage(venueName || 'the tenant', address));
    setError('');
    setMessage(copied ? 'Copied. Paste it into WhatsApp, a text or an email.' : '');
  }

  const members = (rows || []).filter((r) => r.kind === 'member');
  const ownerCount = members.filter((m) => m.role === 'owner').length;
  // only a ScoreIt admin can take away the last owner, and is asked to be sure first
  const lastOwnerWarning =
    'This is the last owner of the tenant. After this the tenant has no owner until you add one, and only the ScoreIt team can manage its team. Continue?';
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
                    onChange={(event) => {
                      const next = event.target.value;
                      if (access.isOperator && m.role === 'owner' && next === 'staff' && ownerCount <= 1 && !window.confirm(lastOwnerWarning)) return;
                      run('set_staff_role', {
                        p_tenant_id: tenantId,
                        p_user_id: m.user_id,
                        p_role: next,
                      });
                    }}
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
                      const lastOwner = access.isOperator && m.role === 'owner' && ownerCount <= 1;
                      if (
                        window.confirm(
                          lastOwner
                            ? lastOwnerWarning
                            : you
                              ? 'Leave this tenant? You will lose access straight away.'
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
                <>
                  <button type="button" className="btn-ghost" disabled={busy} onClick={() => resendInvite(i)}>
                    Resend invitation
                  </button>
                  <button type="button" className="btn-ghost" onClick={() => copyInvite(i.email)}>
                    Copy message
                  </button>
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={busy}
                    onClick={() => run('revoke_invite', { p_invite_id: i.invite_id })}
                  >
                    Cancel
                  </button>
                </>
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
              <option value="staff">Staff, runs the tenant</option>
              <option value="owner">Owner, also manages the team</option>
            </select>
          </div>
          <button type="submit" className="btn-primary" disabled={busy || email.trim() === ''}>
            Add
          </button>
          <p className="field-hint invite-hint">
            They get an invitation email straight away. When they open it, their access appears.
            They must use exactly this address. If nothing arrives, use "Resend invitation" on their row.
          </p>
        </form>
      ) : (
        <p className="field-hint">Only an owner of an active tenant can change the team.</p>
      )}
    </section>
  );
}
