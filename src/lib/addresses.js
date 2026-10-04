// The addresses a venue shares, one for each kind of person. Each can live on its own
// address (live. for spectators, reff. for referees, display. for the TV), or all of
// them can share one address with the old paths (/slug, /slug/referee, /slug/tv).
//
//   VITE_PUBLIC_URL   spectators        -> <it>/<slug>
//   VITE_REFEREE_URL  referees          -> <it>/<slug>      (that address goes straight to scoring)
//   VITE_TV_URL       the TV board      -> <it>/<slug>      (that address goes straight to the board)
//   VITE_USER_APP_URL the one shared address, used for whichever of the three is not set
const clean = (value) => {
  const v = String(value || '').trim().replace(/\/+$/, '');
  if (!v) return '';
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
};

export function pickAddresses({ publicUrl, refereeUrl, tvUrl, userAppUrl }, slug) {
  if (!slug) return { spectators: '', tv: '', referees: '' };
  const pub = clean(publicUrl);
  const ref = clean(refereeUrl);
  const tv = clean(tvUrl);
  const shared = clean(userAppUrl);
  return {
    spectators: pub ? `${pub}/${slug}` : shared ? `${shared}/${slug}` : '',
    tv: tv ? `${tv}/${slug}` : shared ? `${shared}/${slug}/tv` : '',
    referees: ref ? `${ref}/${slug}` : shared ? `${shared}/${slug}/referee` : '',
  };
}

export function addressesFor(slug) {
  return pickAddresses(
    {
      publicUrl: import.meta.env.VITE_PUBLIC_URL,
      refereeUrl: import.meta.env.VITE_REFEREE_URL,
      tvUrl: import.meta.env.VITE_TV_URL,
      userAppUrl: import.meta.env.VITE_USER_APP_URL,
    },
    slug
  );
}
