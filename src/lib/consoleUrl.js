// The one public address of this console, used in links and messages that are
// sent to OTHER people (sign-in emails, invitation text).
//
// It must not be "whatever address the sender happened to have open". Vercel puts
// its own login in front of every address of a project except the short production
// one, so a link built from a long auto-generated address sends the invited
// person to Vercel's login page instead of ScoreIt.
//
// In order of preference:
//   0. on your own domain (admin.example.com, rent.example.com), the address the page is
//      open on. It is the one the person typed, and it is never a Vercel preview address.
//      This is what lets two addresses share one console: whoever signs in on rent. gets a
//      link that comes back to rent., and on admin. back to admin.
//   1. VITE_CONSOLE_URL, set by hand in the project's environment variables
//   2. on a vercel.app address, the project's production address, which Vercel
//      supplies at build time when its system variables are exposed
//   3. the address the page is open on (local development)
export function isOwnDomain(hostname) {
  const h = String(hostname || '').toLowerCase();
  if (!h.includes('.')) return false;
  if (h.endsWith('.vercel.app') || h.endsWith('.localhost')) return false;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) return false;
  return true;
}

export function pickConsoleUrl({ explicit, vercelProduction, origin, hostname }) {
  const clean = (value) => String(value || '').trim().replace(/\/+$/, '');
  const withScheme = (value) => (/^https?:\/\//i.test(value) ? value : `https://${value}`);

  if (isOwnDomain(hostname) && clean(origin)) return clean(origin);

  const chosen = clean(explicit);
  if (chosen) return withScheme(chosen);

  const production = clean(vercelProduction);
  if (production && /\.vercel\.app$/i.test(hostname || '')) return withScheme(production);

  return clean(origin);
}

export function consoleUrl() {
  return pickConsoleUrl({
    explicit: import.meta.env.VITE_CONSOLE_URL,
    vercelProduction: import.meta.env.VITE_VERCEL_PROJECT_PRODUCTION_URL,
    origin: window.location.origin,
    hostname: window.location.hostname,
  });
}

// The address people who RENT the platform (venue owners and staff) use to sign in, which is
// what an invitation message and an invited person's sign-in link point to. It is
// VITE_RENT_URL, and the console's own address if that is not set.
export function pickTenantConsoleUrl({ rent, console: own }) {
  const v = String(rent || '').trim().replace(/\/+$/, '');
  if (!v) return own;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export function tenantConsoleUrl() {
  return pickTenantConsoleUrl({ rent: import.meta.env.VITE_RENT_URL, console: consoleUrl() });
}
