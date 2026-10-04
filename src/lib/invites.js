import { supabase } from '../supabaseClient';
import { consoleUrl } from './consoleUrl';

// The email an invited person gets is the normal sign-in link, sent to their
// address. Opening it signs them in, and the console turns the invitation into
// access. Whether it ARRIVES depends on the project's email provider: Supabase's
// built-in sender only delivers to your own team, so a custom SMTP provider has
// to be set up for real invitees (see the README).
export async function sendSignInLink(email) {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: consoleUrl() },
  });
  return error ? { ok: false, message: error.message } : { ok: true };
}

// For sending by hand, over WhatsApp or anything else.
export function inviteMessage(venueName, email) {
  return (
    `You've been added to ${venueName} on ScoRack. ` +
    `Open ${consoleUrl()} and sign in with ${email}, we'll send you a link, no password needed. ` +
    `Open the link on your phone or computer and the venue appears.`
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
