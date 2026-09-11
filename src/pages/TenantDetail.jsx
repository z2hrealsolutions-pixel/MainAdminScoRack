import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Shell from '../components/Shell';
import StatusPill from '../components/StatusPill';
import { slugify, isValidSlug } from '../lib/slugify';
import { SPORTS } from '../lib/sports';
import '../styles/tenants.css';

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', hint: 'Visible and running normally.' },
  {
    value: 'suspended',
    label: 'Suspended',
    hint: 'Hidden from the public and referees, staff can still edit it.',
  },
  {
    value: 'blocked',
    label: 'Blocked',
    hint: 'Fully shut down. Use this to end a rental.',
  },
];

export default function TenantDetail({ email }) {
  const { tenantId } = useParams();
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
      <Link to="/tenants" className="tenants-back mono">
        ← All tenants
      </Link>

      <div className="tenant-detail-header">
        <h1 className="dash-headline">{tenant.name}</h1>
        <StatusPill status={tenant.status} />
      </div>
      <p className="dash-sub mono">scorack.app/{tenant.slug}</p>

      <section className="tenant-section">
        <h2 className="tenant-section-title">Status</h2>
        <div className="status-options">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`status-option ${
                tenant.status === option.value ? 'status-option-active' : ''
              }`}
              onClick={() => handleStatusChange(option.value)}
              disabled={tenant.status === option.value}
            >
              <span className="status-option-label">{option.label}</span>
              <span className="status-option-hint">{option.hint}</span>
            </button>
          ))}
        </div>
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
        <h2 className="tenant-section-title">Divisions</h2>
        <p className="tenants-empty">Division setup arrives in the next build.</p>
      </section>
    </Shell>
  );
}
