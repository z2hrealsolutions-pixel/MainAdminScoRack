import { useEffect, useState } from 'react';
import { addressesFor } from '../lib/addresses';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Shell from '../components/Shell';
import StatusPill from '../components/StatusPill';
import StatusControl from '../components/StatusControl';
import DivisionList from '../components/DivisionList';
import StaffSection from '../components/StaffSection';
import DeleteTenant from '../components/DeleteTenant';
import OverrideCodePanel from '../components/OverrideCodePanel';
import BrandKitSection from '../components/BrandKitSection';
import TenantCards from '../components/TenantCards';
import { useVenueAccess } from '../lib/access';
import { slugify, isValidSlug } from '../lib/slugify';
import { SPORTS } from '../lib/sports';
import '../styles/tenants.css';

const TENANT_COLUMNS = 'id, slug, name, sport, status, address, venue_name, venue_courts, created_at';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', hint: 'Visible and running normally.' },
  {
    value: 'suspended',
    label: 'Suspended',
    hint: 'Hidden from the public and referees. Tenant staff can look around but change nothing.',
  },
  {
    value: 'blocked',
    label: 'Blocked',
    hint: 'Fully shut down, tenant staff are locked out. Use this to end a rental.',
  },
];

function venueFrom(t) {
  return { name: t.venue_name || '', address: t.address || '', courts: t.venue_courts ? String(t.venue_courts) : '' };
}

export default function TenantDetail({ email }) {
  const { tenantId } = useParams();
  const access = useVenueAccess(tenantId);
  const [tenant, setTenant] = useState(null);
  const addresses = addressesFor(tenant ? tenant.slug : '');
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(null);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const [saveError, setSaveError] = useState('');
  const [venue, setVenue] = useState({ name: '', address: '', courts: '' });
  const [venueState, setVenueState] = useState('idle'); // idle | saving | saved | error
  const [venueError, setVenueError] = useState('');
  const [searchParams] = useSearchParams();
  const [divisionCount, setDivisionCount] = useState(null);
  const requested = searchParams.get('section');

  useEffect(() => {
    let isMounted = true;
    supabase
      .from('tenants')
      .select(TENANT_COLUMNS)
      .eq('id', tenantId)
      .single()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          setLoadError(error.message);
          return;
        }
        setTenant(data);
        setForm({ name: data.name, slug: data.slug, sport: data.sport });
        setVenue(venueFrom(data));
      });
    return () => {
      isMounted = false;
    };
  }, [tenantId]);

  useEffect(() => {
    let isMounted = true;
    supabase
      .from('divisions')
      .select('id')
      .eq('tenant_id', tenantId)
      .then(({ data }) => {
        if (isMounted && Array.isArray(data)) setDivisionCount(data.length);
      });
    return () => {
      isMounted = false;
    };
  }, [tenantId]);

  const slugIsValid = form ? isValidSlug(form.slug) : false;
  const hasChanges =
    tenant &&
    form &&
    (form.name !== tenant.name ||
      form.slug !== tenant.slug ||
      form.sport !== tenant.sport);

  const courtsNumber = venue.courts.trim() === '' ? null : Number(venue.courts);
  const courtsValid = courtsNumber === null || (Number.isInteger(courtsNumber) && courtsNumber >= 1 && courtsNumber <= 60);
  const venueChanged =
    tenant &&
    (venue.name.trim() !== (tenant.venue_name || '') ||
      venue.address.trim() !== (tenant.address || '') ||
      (courtsNumber || null) !== (tenant.venue_courts || null));

  async function handleSave(event) {
    event.preventDefault();
    if (!slugIsValid) return;
    setSaveState('saving');
    setSaveError('');

    const { data, error } = await supabase
      .from('tenants')
      .update({ name: form.name.trim(), slug: form.slug, sport: form.sport })
      .eq('id', tenantId)
      .select(TENANT_COLUMNS)
      .single();

    if (error) {
      setSaveState('error');
      setSaveError(
        error.code === '23505'
          ? `The slug "${form.slug}" is already taken. Try another.`
          : error.message
      );
      return;
    }

    setTenant(data);
    setForm({ ...form });
    setSaveState('saved');
  }

  async function handleRename(event) {
    event.preventDefault();
    setSaveState('saving');
    setSaveError('');
    const nextName = form.name.trim();
    if (nextName !== tenant.name) {
      const { error } = await supabase.rpc('update_tenant_name', { p_tenant_id: tenantId, p_name: form.name });
      if (error) {
        setSaveState('error');
        setSaveError(error.message);
        return;
      }
    }
    setTenant({ ...tenant, name: nextName });
    setForm({ ...form, name: nextName });
    setSaveState('saved');
  }

  // the venue: the place where this tenant's tournaments are played
  async function handleVenueSave(event) {
    event.preventDefault();
    if (!courtsValid) return;
    setVenueState('saving');
    setVenueError('');
    const { error } = await supabase.rpc('update_tenant_venue', {
      p_tenant_id: tenantId,
      p_venue_name: venue.name,
      p_address: venue.address,
      p_courts: courtsNumber,
    });
    if (error) {
      setVenueState('error');
      setVenueError(error.message);
      return;
    }
    const next = {
      ...tenant,
      venue_name: venue.name.trim() || null,
      address: venue.address.trim() || null,
      venue_courts: courtsNumber,
    };
    setTenant(next);
    setVenue(venueFrom(next));
    setVenueState('saved');
  }

  async function handleStatusChange(nextStatus) {
    if (nextStatus === 'blocked') {
      const confirmed = window.confirm(
        `Block ${tenant.name}? Its public view and referee scoring stop working immediately.`
      );
      if (!confirmed) return;
    }

    const { data, error } = await supabase
      .from('tenants')
      .update({ status: nextStatus })
      .eq('id', tenantId)
      .select(TENANT_COLUMNS)
      .single();

    if (error) {
      setSaveState('error');
      setSaveError(error.message);
      return;
    }
    setTenant(data);
  }

  if (loadError) {
    return (
      <Shell email={email}>
        <div className="callout-error">Couldn't load this tenant: {loadError}</div>
      </Shell>
    );
  }

  if (!tenant || !form) {
    return (
      <Shell email={email}>
        <p className="tenants-empty mono">Loading…</p>
      </Shell>
    );
  }

  const canBrand = access.isOperator || access.isOwner;
  const canAdvanced = access.isOperator || access.isOwner;
  const cards = [
    {
      id: 'divisions',
      title: 'Divisions',
      text: 'Teams, pools, rules and matches for each division.',
      note: divisionCount === null ? null : `${divisionCount} ${divisionCount === 1 ? 'division' : 'divisions'}`,
    },
    {
      id: 'share',
      title: 'Referee and public links',
      text: 'The addresses for spectators, the TV board and referees.',
    },
    {
      id: 'venue',
      title: 'Venue',
      text: 'Where the tournaments are played, and how many courts.',
      note: tenant.venue_name || 'Not set yet',
    },
    { id: 'team', title: 'Team', text: 'Who can sign in and run this tenant.' },
    ...(canBrand ? [{ id: 'brand', title: 'Brand kit', text: 'Logo, banner and colours on the live pages.' }] : []),
    ...(canAdvanced
      ? [
          {
            id: 'advanced',
            title: access.isOperator ? 'Advanced' : 'Tenant details',
            text: access.isOperator ? 'Override password, status, details and delete.' : 'The name shown to the public.',
          },
        ]
      : []),
  ];
  const allowed = new Set(cards.map((c) => c.id));
  const open = requested && allowed.has(requested) ? requested : null;

  return (
    <Shell email={email}>
      {access.isOperator && (
        <Link to="/tenants" className="tenants-back mono">
          ← All tenants
        </Link>
      )}

      <div className="tenant-detail-header">
        <h1 className="dash-headline">{tenant.name}</h1>
        <StatusPill status={tenant.status} />
      </div>
      <p className="dash-sub mono">/{tenant.slug}</p>

      {!open && <TenantCards tenantId={tenantId} cards={cards} />}

      {open && (
        <Link to={`/tenants/${tenantId}`} className="tenants-back mono tcard-back">
          ← All sections
        </Link>
      )}

      <div className="tenant-open">

      {open === 'divisions' && (
      <section className="tenant-section">
        <h2 className="tenant-section-title">Divisions</h2>
        <DivisionList tenantId={tenant.id} />
      </section>
      )}

      {open === 'share' && (
      <section className="tenant-section">
        <h2 className="tenant-section-title">Share with players and referees</h2>
        {addresses.spectators || addresses.tv || addresses.referees ? (
          <dl className="address-list">
            {[
              ['Spectators', addresses.spectators, 'Live scores, standings and brackets'],
              ['TV board', addresses.tv, 'Full screen, for a TV at the venue'],
              ['Referees', addresses.referees, 'Scoring with a group code'],
            ]
              .filter(([, href]) => href)
              .map(([label, href, note]) => (
                <div key={label} className="address-row">
                  <dt>{label}</dt>
                  <dd>
                    <a href={href} target="_blank" rel="noreferrer" className="mono">
                      {href}
                    </a>
                    <span className="field-hint"> {note}</span>
                  </dd>
                </div>
              ))}
          </dl>
        ) : (
          <p className="field-hint">
            Set VITE_PUBLIC_URL, VITE_REFEREE_URL and VITE_TV_URL in this app's environment (or just
            VITE_USER_APP_URL, if all three share one address), and the spectator, TV and referee
            addresses for this tenant show here.
          </p>
        )}
      </section>
      )}

      {open === 'venue' && (
      <section className="tenant-section">
        <h2 className="tenant-section-title">Venue</h2>
        <p className="field-hint">
          Where this tenant's tournaments are played. The address is used in the DUPR export.
        </p>
        {access.isOwner ? (
          <form onSubmit={handleVenueSave} className="tenant-form">
            <div>
              <label className="field-label" htmlFor="venueName">
                Venue name
              </label>
              <input
                id="venueName"
                className="text-input"
                value={venue.name}
                onChange={(event) => setVenue({ ...venue, name: event.target.value })}
                placeholder="Colombo Pickleball Arena"
                maxLength={120}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="venueAddress">
                Venue address
              </label>
              <input
                id="venueAddress"
                className="text-input"
                value={venue.address}
                onChange={(event) => setVenue({ ...venue, address: event.target.value })}
                placeholder="Venue name, street, city"
                maxLength={300}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="venueCourts">
                Number of courts
              </label>
              <input
                id="venueCourts"
                className="text-input"
                type="number"
                inputMode="numeric"
                min="1"
                max="60"
                value={venue.courts}
                onChange={(event) => setVenue({ ...venue, courts: event.target.value })}
                placeholder="3"
              />
              {!courtsValid && <p className="field-hint">Use a whole number from 1 to 60, or leave it empty.</p>}
            </div>
            {venueState === 'error' && (
              <div className="callout-error" role="alert">
                {venueError}
              </div>
            )}
            <button
              type="submit"
              className="btn-primary tenant-form-submit"
              disabled={!venueChanged || !courtsValid || venueState === 'saving'}
            >
              {venueState === 'saving' ? 'Saving…' : 'Save venue'}
            </button>
            {venueState === 'saved' && !venueChanged && <span className="field-hint">Saved.</span>}
          </form>
        ) : (
          <dl className="address-list">
            <div className="address-row">
              <dt>Venue</dt>
              <dd>{tenant.venue_name || <span className="field-hint">Not set</span>}</dd>
            </div>
            <div className="address-row">
              <dt>Address</dt>
              <dd>{tenant.address || <span className="field-hint">Not set</span>}</dd>
            </div>
            <div className="address-row">
              <dt>Courts</dt>
              <dd>{tenant.venue_courts || <span className="field-hint">Not set</span>}</dd>
            </div>
          </dl>
        )}
      </section>
      )}

      {open === 'team' && <StaffSection tenantId={tenant.id} venueName={tenant.name} />}

      {open === 'brand' && <BrandKitSection tenantId={tenant.id} tenantName={tenant.name} />}

      {open === 'advanced' && (
        <div className="adv-body">
      {access.isOperator && (
        <>
      <section className="tenant-section">
        <h2 className="tenant-section-title">Override password</h2>
        <OverrideCodePanel tenantId={tenantId} />
      </section>

      <section className="tenant-section">
        <h2 className="tenant-section-title">Status</h2>
        <StatusControl
          options={STATUS_OPTIONS}
          current={tenant.status}
          onChange={handleStatusChange}
        />
      </section>

      <section className="tenant-section">
        <h2 className="tenant-section-title">Details</h2>
        <form onSubmit={handleSave} className="tenant-form">
          <div>
            <label className="field-label" htmlFor="name">
              Tenant name
            </label>
            <input
              id="name"
              className="text-input"
              value={form.name}
              onChange={(event) =>
                setForm({ ...form, name: event.target.value })
              }
            />
          </div>

          <div>
            <label className="field-label" htmlFor="slug">
              Slug
            </label>
            <input
              id="slug"
              className="text-input mono"
              value={form.slug}
              onChange={(event) =>
                setForm({ ...form, slug: slugify(event.target.value) })
              }
            />
            {form.slug !== tenant.slug && (
              <p className="field-hint">
                Changing this breaks any link already shared with this
                slug.
              </p>
            )}
          </div>

          <div>
            <label className="field-label" htmlFor="sport">
              Sport
            </label>
            <select
              id="sport"
              className="text-input"
              value={form.sport}
              onChange={(event) =>
                setForm({ ...form, sport: event.target.value })
              }
            >
              {SPORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {saveState === 'error' && (
            <div className="callout-error" role="alert">
              {saveError}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary tenant-form-submit"
            disabled={!hasChanges || !slugIsValid || saveState === 'saving'}
          >
            {saveState === 'saving' ? 'Saving…' : 'Save changes'}
          </button>
          {saveState === 'saved' && !hasChanges && (
            <span className="field-hint">Saved.</span>
          )}
        </form>
      </section>

      <section className="tenant-section">
        <h2 className="tenant-section-title">Delete tenant</h2>
        <p className="field-hint">
          Removes this tenant and everything in it for good. Suspend or block it instead if you may
          want it back.
        </p>
        <DeleteTenant tenantId={tenant.id} />
      </section>
        </>
      )}

      {!access.isOperator && access.isOwner && (
        <section className="tenant-section">
          <h2 className="tenant-section-title">Tenant details</h2>
          <form onSubmit={handleRename} className="tenant-form">
            <div>
              <label className="field-label" htmlFor="tenantName">
                Tenant name shown to the public
              </label>
              <input
                id="tenantName"
                className="text-input"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
              <p className="field-hint">
                The web address (slug) and sport are set by the ScoreIt team.
              </p>
            </div>
            {saveState === 'error' && (
              <div className="callout-error" role="alert">
                {saveError}
              </div>
            )}
            <button
              type="submit"
              className="btn-primary tenant-form-submit"
              disabled={form.name.trim() === tenant.name || form.name.trim() === '' || saveState === 'saving'}
            >
              {saveState === 'saving' ? 'Saving…' : 'Save details'}
            </button>
            {saveState === 'saved' && form.name.trim() === tenant.name && (
              <span className="field-hint">Saved.</span>
            )}
          </form>
        </section>
      )}
        </div>
      )}
      </div>
    </Shell>
  );
}
