import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useVenueAccess } from '../lib/access';
import { isHex, normalizeHex } from '../lib/brandTheme';
import { BUCKET, IMAGE_ERRORS, brandFilePath, brandSaveErrorText, checkImageFile, prepareImage } from '../lib/brandKit';
import BrandPreview from './BrandPreview';
import '../styles/brandkit.css';

const publicUrl = (path) => (path ? supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl : null);

function when(ts) {
  try {
    return new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return ts;
  }
}

const ACTION_TEXT = {
  saved: 'Saved the brand kit',
  access_on: 'Switched Brand Customisation on',
  access_off: 'Switched Brand Customisation off',
};

// One picture slot: what is saved, what is waiting to be saved, and the buttons.
function PictureField({ id, label, hint, savedUrl, pendingUrl, removed, disabled, onPick, onRemove, onUndo, error }) {
  const input = useRef(null);
  const shown = removed ? null : pendingUrl || savedUrl;
  return (
    <div className="bk-field">
      <span className="field-label">{label}</span>
      <p className="field-hint">{hint}</p>
      <div className={`bk-slot bk-slot-${id}`}>
        {shown ? <img src={shown} alt={`${label} as it will be saved`} /> : <span className="bk-empty">{removed ? 'Will be removed' : 'None yet'}</span>}
      </div>
      {!disabled && (
        <div className="bk-buttons">
          <input
            ref={input}
            id={`bk-file-${id}`}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="bk-file"
            onChange={(e) => {
              const f = e.target.files && e.target.files[0];
              e.target.value = '';
              if (f) onPick(f);
            }}
          />
          <button type="button" className="btn-ghost" onClick={() => input.current && input.current.click()}>
            {shown ? 'Change picture' : 'Choose a picture'}
          </button>
          {(savedUrl || pendingUrl) && !removed && (
            <button type="button" className="btn-ghost" onClick={onRemove}>
              Remove
            </button>
          )}
          {removed && (
            <button type="button" className="btn-ghost" onClick={onUndo}>
              Keep it
            </button>
          )}
        </div>
      )}
      {error && (
        <div className="callout-error" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

function ColourField({ id, label, hint, value, disabled, onChange }) {
  const valid = !value || isHex(value);
  return (
    <div className="bk-field">
      <label className="field-label" htmlFor={`bk-hex-${id}`}>
        {label}
      </label>
      <p className="field-hint">{hint}</p>
      <div className="bk-colour-row">
        <input
          type="color"
          aria-label={`${label}, pick`}
          className="bk-swatch"
          value={normalizeHex(value) || '#0097b2'}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          id={`bk-hex-${id}`}
          type="text"
          className="text-input bk-hex mono"
          value={value}
          disabled={disabled}
          placeholder="#1a7f5a"
          maxLength={7}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => onChange(e.target.value.trim())}
        />
        {!disabled && value && (
          <button type="button" className="btn-ghost" onClick={() => onChange('')}>
            Clear
          </button>
        )}
      </div>
      {!valid && <p className="field-hint bk-bad">Use a colour like #1a7f5a (a # and six letters or numbers).</p>}
    </div>
  );
}

export default function BrandKitSection({ tenantId, tenantName }) {
  const access = useVenueAccess(tenantId);
  const [row, setRow] = useState(undefined); // undefined loading, null none saved yet
  const [log, setLog] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [primary, setPrimary] = useState('');
  const [accent, setAccent] = useState('');
  const [logo, setLogo] = useState(null); // { blob, ext, url }
  const [banner, setBanner] = useState(null);
  const [logoGone, setLogoGone] = useState(false);
  const [bannerGone, setBannerGone] = useState(false);
  const [logoErr, setLogoErr] = useState('');
  const [bannerErr, setBannerErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const load = useCallback(async () => {
    const [b, l] = await Promise.all([
      supabase.from('tenant_brand').select('*').eq('tenant_id', tenantId).maybeSingle(),
      supabase.from('tenant_brand_log').select('action, by_email, at').eq('tenant_id', tenantId).order('at', { ascending: false }).limit(5),
    ]);
    if (b.error) {
      setLoadError(b.error.message);
      return;
    }
    setRow(b.data);
    setLog(l.data || []);
    setPrimary(b.data && b.data.primary_color ? b.data.primary_color : '');
    setAccent(b.data && b.data.accent_color ? b.data.accent_color : '');
  }, [tenantId]);

  useEffect(() => {
    load();
  }, [load]);

  // free the preview pictures
  useEffect(() => () => {
    if (logo) URL.revokeObjectURL(logo.url);
  }, [logo]);
  useEffect(() => () => {
    if (banner) URL.revokeObjectURL(banner.url);
  }, [banner]);

  if (!access.isOperator && !access.isOwner) return null;

  const allowed = access.isOperator || (access.isOwner && row && row.brand_access);
  const savedLogo = row && row.logo_path ? publicUrl(row.logo_path) : null;
  const savedBanner = row && row.banner_path ? publicUrl(row.banner_path) : null;
  const logoShown = logoGone ? null : (logo && logo.url) || savedLogo;
  const bannerShown = bannerGone ? null : (banner && banner.url) || savedBanner;
  const colourBad = (primary && !isHex(primary)) || (accent && !isHex(accent));

  const changed =
    !!logo || !!banner || logoGone || bannerGone ||
    (normalizeHex(primary) || null) !== ((row && row.primary_color) || null) ||
    (normalizeHex(accent) || null) !== ((row && row.accent_color) || null);

  async function pick(kind, file) {
    const setErr = kind === 'logo' ? setLogoErr : setBannerErr;
    setErr('');
    setDone('');
    const check = checkImageFile(file);
    if (!check.ok) {
      setErr(IMAGE_ERRORS[check.error]);
      return;
    }
    try {
      const prepared = await prepareImage(file, kind);
      const url = URL.createObjectURL(prepared.blob);
      if (kind === 'logo') {
        setLogo({ ...prepared, url });
        setLogoGone(false);
      } else {
        setBanner({ ...prepared, url });
        setBannerGone(false);
      }
    } catch (e) {
      setErr(IMAGE_ERRORS[e.message] || IMAGE_ERRORS.unreadable);
    }
  }

  async function removeFiles(paths) {
    const list = paths.filter(Boolean);
    if (list.length) await supabase.storage.from(BUCKET).remove(list);
  }

  async function save(patchOverride) {
    setBusy(true);
    setError('');
    setDone('');
    const uploaded = [];
    try {
      const patch = patchOverride || {
        primary_color: normalizeHex(primary),
        accent_color: normalizeHex(accent),
      };
      if (!patchOverride) {
        for (const [kind, pending, gone] of [['logo', logo, logoGone], ['banner', banner, bannerGone]]) {
          if (pending) {
            const path = brandFilePath(tenantId, kind, pending.ext);
            const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, pending.blob, {
              contentType: pending.type,
              cacheControl: '31536000',
              upsert: false,
            });
            if (upErr) throw new Error(upErr.message);
            uploaded.push(path);
            patch[`${kind}_path`] = path;
          } else if (gone) {
            patch[`${kind}_path`] = null;
          }
        }
      }
      const { data, error: rpcErr } = await supabase.rpc('set_tenant_brand', { p_tenant_id: tenantId, p_patch: patch });
      if (rpcErr) throw new Error(rpcErr.message);
      if (!data || !data.ok) {
        await removeFiles(uploaded);
        setError(brandSaveErrorText(data && data.error));
        setBusy(false);
        return;
      }
      // the pictures that were replaced or removed are no longer needed
      const old = [];
      if ('logo_path' in patch && data.old_logo_path && data.old_logo_path !== patch.logo_path) old.push(data.old_logo_path);
      if ('banner_path' in patch && data.old_banner_path && data.old_banner_path !== patch.banner_path) old.push(data.old_banner_path);
      await removeFiles(old);
      setLogo(null);
      setBanner(null);
      setLogoGone(false);
      setBannerGone(false);
      setConfirmReset(false);
      setDone('Saved. The live, referee and TV pages for this tenant now use it.');
      await load();
    } catch (e) {
      await removeFiles(uploaded);
      setError(e.message || 'The brand kit could not be saved. Try again.');
    }
    setBusy(false);
  }

  async function setAccess(enabled) {
    setBusy(true);
    setError('');
    setDone('');
    const { error: err } = await supabase.rpc('set_brand_access', { p_tenant_id: tenantId, p_enabled: enabled });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    await load();
  }

  const status = row === undefined ? null : row;
  const hasAnything = !!(status && (status.logo_path || status.banner_path || status.primary_color || status.accent_color));

  return (
    <section className="tenant-section brand-kit">
      <h2 className="tenant-section-title">Brand kit</h2>
      <p className="field-hint">
        The tenant's logo, banner and two colours, shown on its live, referee and TV pages. The ScoreIt logo always stays
        where it is, and this admin site is not changed.
      </p>

      {loadError && (
        <div className="callout-error" role="alert">
          {loadError}
        </div>
      )}

      {access.isOperator && row !== undefined && (
        <div className="bk-access">
          <div>
            <strong>Brand Customisation</strong>
            <p className="field-hint">
              {row && row.brand_access
                ? "On: the tenant's owner can edit this brand kit."
                : "Off: only the ScoreIt team can edit this brand kit. Switch it on to let the tenant's owner do it."}
            </p>
          </div>
          <button type="button" className="btn-ghost" disabled={busy} onClick={() => setAccess(!(row && row.brand_access))}>
            {row && row.brand_access ? 'Switch off' : 'Switch on'}
          </button>
        </div>
      )}

      {!access.isOperator && row !== undefined && !allowed && (
        <p className="callout-note bk-locked">
          Brand Customisation is not switched on for your venue. You can see the brand kit below. To change it, ask the
          ScoreIt team to switch it on.
        </p>
      )}

      {row !== undefined && (
        <>
          <div className="bk-grid">
            <PictureField
              id="logo"
              label="Logo"
              hint="Shown next to the tenant's name at the top of every live, referee and TV page, on a white plate. PNG, JPG or WebP. A wide picture with a clear background works best."
              savedUrl={savedLogo}
              pendingUrl={logo && logo.url}
              removed={logoGone}
              disabled={!allowed}
              onPick={(f) => pick('logo', f)}
              onRemove={() => {
                if (logo) setLogo(null);
                else setLogoGone(true);
              }}
              onUndo={() => setLogoGone(false)}
              error={logoErr}
            />
            <PictureField
              id="banner"
              label="Banner image"
              hint="Shown across the top of the live page, as a strip on the TV board while matches are on, and large on the TV board between matches. About 1800 × 600 (three times wider than tall). Keep the important part (text, faces) in the middle: the edges are trimmed on a phone and on the TV."
              savedUrl={savedBanner}
              pendingUrl={banner && banner.url}
              removed={bannerGone}
              disabled={!allowed}
              onPick={(f) => pick('banner', f)}
              onRemove={() => {
                if (banner) setBanner(null);
                else setBannerGone(true);
              }}
              onUndo={() => setBannerGone(false)}
              error={bannerErr}
            />
            <ColourField
              id="primary"
              label="Main colour"
              hint="Buttons, scores and highlights."
              value={primary}
              disabled={!allowed}
              onChange={setPrimary}
            />
            <ColourField
              id="accent"
              label="Second colour"
              hint="The line under the top bar and the soft glow behind the page."
              value={accent}
              disabled={!allowed}
              onChange={setAccent}
            />
          </div>

          <h3 className="bk-subtitle">How it will look</h3>
          <p className="field-hint">
            Colours are adjusted automatically so text stays easy to read, in the light and the dark theme. What you see here
            is what the tenant's pages will show.
          </p>
          <BrandPreview name={tenantName} logoUrl={logoShown} bannerUrl={bannerShown} primary={primary} accent={accent} />

          {error && (
            <div className="callout-error" role="alert">
              {error}
            </div>
          )}
          {done && <p className="callout-note bk-done" role="status">{done}</p>}

          {allowed && (
            <div className="bk-save-row">
              <button type="button" className="btn-primary" disabled={busy || !changed || colourBad} onClick={() => save()}>
                {busy ? 'Saving…' : 'Save brand kit'}
              </button>
              {changed && !busy && (
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setLogo(null);
                    setBanner(null);
                    setLogoGone(false);
                    setBannerGone(false);
                    setPrimary((row && row.primary_color) || '');
                    setAccent((row && row.accent_color) || '');
                    setError('');
                  }}
                >
                  Undo changes
                </button>
              )}
              {hasAnything && !confirmReset && (
                <button type="button" className="btn-ghost bk-reset" disabled={busy} onClick={() => setConfirmReset(true)}>
                  Remove the whole brand kit
                </button>
              )}
              {hasAnything && confirmReset && (
                <span className="bk-confirm">
                  Back to the ScoreIt look for this tenant?{' '}
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={busy}
                    onClick={() => save({ logo_path: null, banner_path: null, primary_color: null, accent_color: null })}
                  >
                    Yes, remove it
                  </button>{' '}
                  <button type="button" className="btn-ghost" onClick={() => setConfirmReset(false)}>
                    Cancel
                  </button>
                </span>
              )}
            </div>
          )}

          {log.length > 0 && (
            <div className="bk-log">
              <h3 className="bk-subtitle">Recent changes</h3>
              <ul>
                {log.map((entry, i) => (
                  <li key={`${entry.at}-${i}`}>
                    {ACTION_TEXT[entry.action] || entry.action} · {entry.by_email || 'someone'} · <span className="mono">{when(entry.at)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
