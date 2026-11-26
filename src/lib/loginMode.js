// Which sign-in a page address shows.
//   admin.*  -> 'admin'  : ScoreIt admins, email + password only. No email link, so nobody can have a sign-in
//                          link sent to themselves on this address.
//   rent.*   -> 'rent'   : tenant owners and staff, who sign in with an email link.
//   any other address (previews, vercel.app, local) -> 'both', two tabs, so every sign-in can be tried.
export function pickLoginMode(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (h.startsWith('admin.')) return 'admin';
  if (h.startsWith('rent.')) return 'rent';
  return 'both';
}

// what a failed password sign-in says. It never says which half was wrong.
export function passwordErrorMessage(error) {
  const text = String((error && error.message) || '');
  if (/invalid login credentials|invalid_credentials/i.test(text)) return 'That email and password do not match.';
  if (/email not confirmed/i.test(text)) return 'This account has not been confirmed yet.';
  if (/rate limit|too many/i.test(text)) return 'Too many attempts. Wait a few minutes and try again.';
  return text || 'Could not sign in. Try again.';
}
