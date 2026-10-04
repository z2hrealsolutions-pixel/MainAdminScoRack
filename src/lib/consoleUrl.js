// The one public address of this console, used in links and messages that are
// sent to OTHER people (sign-in emails, invitation text).
//
// It must not be "whatever address the sender happened to have open". Vercel puts
// its own login in front of every address of a project except the short production
// one, so a link built from a long auto-generated address sends the invited
// person to Vercel's login page instead of ScoRack.
//
// In order of preference:
//   1. VITE_CONSOLE_URL, set by hand in the project's environment variables
//   2. on a vercel.app address, the project's production address, which Vercel
//      supplies at build time when its system variables are exposed
//   3. the address the page is open on (local development, or a custom domain)
export function pickConsoleUrl({ explicit, vercelProduction, origin, hostname }) {
  const clean = (value) => String(value || '').trim().replace(/\/+$/, '');
  const withScheme = (value) => (/^https?:\/\//i.test(value) ? value : `https://${value}`);

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
