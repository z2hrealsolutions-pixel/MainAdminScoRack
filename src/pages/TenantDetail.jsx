import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Shell from '../components/Shell';
import StatusPill from '../components/StatusPill';
import StatusControl from '../components/StatusControl';
import DivisionList from '../components/DivisionList';
import StaffSection from '../components/StaffSection';
import { useVenueAccess } from '../lib/access';
import { slugify, isValidSlug } from '../lib/slugify';
import { SPORTS } from '../lib/sports';
import '../styles/tenants.css';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', hint: 'Visible and running normally.' },
  {
    value: 'suspended',
    label: 'Suspended',
    hint: 'Hidden from the public and referees. Venue staff can look around but change nothing.',
  },
  {
    value: 'blocked',
    label: 'Blocked',
    hint: 'Fully shut down, venue staff are locked out. Use this to end a rental.',
  },
];

export default function TenantDetail({ email }) {
  const userAppUrl = (import.meta.env.VITE_USER_APP_URL || '').replace(/\/$/, '');
  const { tenantId } = useParams();
  const access = useVenueAccess(tenantId);
  const [tenant, setTenant] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(null);
  const [saveState, setSaveState] = useState('idle'); // idle | saving | saved | error
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let isMounted = true;
    supabase
      .from('tenants')
      .select('id, slug, name, sport, status, created_at')
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

  async function handleSave(event) {
    event.preventDefault();
    if (!slugIsValid) return;
    setSaveState('saving');
    setSaveError('');

    const { data, error } = await supabase
      .from('tenants')
      .update({ name: form.name.trim(), slug: form.slug, sport: form.sport })
      .eq('id', tenantId)
      .select('id, slug, name, sport, status, created_at')
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
    setSaveState('saved');
  }

  async function handleRename(event) {
    event.preventDefault();
    setSaveState('saving');
    setSaveError('');
    const { error } = await supabase.rpc('update_tenant_name', {
      p_tenant_id: tenantId,
      p_name: form.name,
    });
    if (error) {
      setSaveState('error');
      setSaveError(error.message);
      return;
    }
    setTenant({ ...tenant, name: form.name.trim() });
    setForm({ ...form, name: form.name.trim() });
    setSaveState('saved');
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
      .select('id, slug, name, sport, status, created_at')
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

      <section className="tenant-section">
        <h2 className="tenant-section-title">Divisions</h2>
        <DivisionList tenantId={tenant.id} />
      </section>

      <StaffSection tenantId={tenant.id} />

      <section className="tenant-section">
        <h2 className="tenant-section-title">Addresses to share</h2>
        {userAppUrl ? (
          <dl className="address-list">
            {[
              ['Spectators', `${userAppUrl}/${tenant.slug}`, 'Live scores, standings and brackets'],
              ['TV board', `${userAppUrl}/${tenant.slug}/tv`, 'Full screen, for a TV at the venue'],
              ['Referees', `${userAppUrl}/${tenant.slug}/referee`, 'Scoring with a group code'],
            ].map(([label, href, note]) => (
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
            Set VITE_USER_APP_URL in this app's environment to the public app's address, and the
            spectator, TV and referee addresses for this tenant show here.
          </p>
        )}
      </section>

      {access.isOperator && (
        <>
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
        </>
      )}

      {!access.isOperator && access.isOwner && (
        <section className="tenant-section">
          <h2 className="tenant-section-title">Venue name</h2>
          <form onSubmit={handleRename} className="tenant-form">
            <div>
              <label className="field-label" htmlFor="venueName">
                Name shown to the public
              </label>
              <input
                id="venueName"
                className="text-input"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
              />
              <p className="field-hint">
                The address (slug) and sport are set by the ScoRack team.
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
              {saveState === 'saving' ? 'Saving…' : 'Save name'}
            </button>
            {saveState === 'saved' && form.name.trim() === tenant.name && (
              <span className="field-hint">Saved.</span>
            )}
          </form>
        </section>
      )}
    </Shell>
  );
}
