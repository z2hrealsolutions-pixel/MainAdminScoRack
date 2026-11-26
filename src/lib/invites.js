import { supabase } from '../supabaseClient';
import { tenantConsoleUrl } from './consoleUrl';

// An invited person gets their account made and an email sent by the `invite-user` function in Supabase. Open
// sign-up is off, so a sign-in link alone can no longer create an account; the function only acts for the person who
// just added them (their invitation row must exist). Someone who already has an account gets the ordinary sign-in
// link. Whether the email ARRIVES depends on the project's email provider: Supabase's built-in sender only delivers to
// your own team, so a custom SMTP provider has to be set up for real invitees (see the README).
export function inviteErrorMessage(code, fallback) {
  const known = {
    not_signed_in: 'Your sign-in has expired. Sign in again.',
    no_pending_invitation: 'There is no pending invitation for that address.',
    bad_email: 'That does not look like an email address.',
    bad_redirect: 'The sign-in address is not one ScoreIt can send people to.',
  };
  return known[code] || fallback || 'The email could not be sent.';
}

export async function sendSignInLink(email) {
  try {
    const { data, error } = await supabase.functions.invoke('invite-user', {
      body: { email, redirectTo: tenantConsoleUrl() },
    });
    if (error) {
      let body = null;
      try { body = await error.context.json(); } catch { /* no readable body */ }
      return { ok: false, message: inviteErrorMessage(body && body.error, (body && body.message) || error.message) };
    }
    return data && data.ok ? { ok: true } : { ok: false, message: inviteErrorMessage(data && data.error) };
  } catch (e) {
    return { ok: false, message: (e && e.message) || 'The email could not be sent.' };
  }
}

// For sending by hand, over WhatsApp or anything else.
export function inviteMessage(venueName, email) {
  return (
    `You've been added to ${venueName} on ScoreIt. ` +
    `Open ${tenantConsoleUrl()} and sign in with ${email}, we'll send you a link, no password needed. ` +
    `Open the link on your phone or computer and the tenant appears.`
  );
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt('Copy this message:', text);
    return false;
  }
}
