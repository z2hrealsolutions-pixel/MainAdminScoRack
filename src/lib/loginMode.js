// The console has two doors, told apart by the ADDRESS the page is open on.
//   rent.*   -> 'rent'  : tenant owners and staff. Email link sign-in only, and only tenants' own screens.
//   anything else (admin.scoreit.today, vercel.app and preview addresses, local) -> 'admin' : the ScoreIt team.
//                          Email + password only. There is no email link on this door, so nobody can have a
//                          sign-in link sent to themselves here.
// The address decides the door. What a person can DO is still decided by the database, whatever door they use.
export function pickLoginMode(hostname) {
  const h = String(hostname || '').toLowerCase();
  return h.startsWith('rent.') ? 'rent' : 'admin';
}

// the matching address of the other door, for the "wrong door" page: rent.scoreit.today <-> admin.scoreit.today.
// null when the address does not follow that pattern (a preview address has no twin).
export function adminAddressFor(hostname, protocol = 'https:') {
  const h = String(hostname || '').toLowerCase();
  if (!h.startsWith('rent.')) return null;
  return `${protocol}//admin.${h.slice('rent.'.length)}`;
}

// what a failed password sign-in says. It never says which half was wrong.
export function passwordErrorMessage(error) {
  const text = String((error && error.message) || '');
  if (/invalid login credentials|invalid_credentials/i.test(text)) return 'That email and password do not match.';
  if (/email not confirmed/i.test(text)) return 'This account has not been confirmed yet.';
  if (/rate limit|too many/i.test(text)) return 'Too many attempts. Wait a few minutes and try again.';
  return text || 'Could not sign in. Try again.';
}

// Is this person on the wrong door? 'team-only' (a tenant person on the admin door), 'tenants-only' (a ScoreIt admin on
// the rent door), or null when they are where they belong.
export function wrongDoor(mode, isOperator) {
  if (mode === 'admin' && !isOperator) return 'team-only';
  if (mode === 'rent' && isOperator) return 'tenants-only';
  return null;
}
