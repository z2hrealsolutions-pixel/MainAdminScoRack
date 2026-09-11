import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Shell from '../components/Shell';
import StatusPill from '../components/StatusPill';
import StatusControl from '../components/StatusControl';
import { CATEGORIES, FORMATS } from '../lib/divisions';
import '../styles/tenants.css';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', hint: 'Hidden from the public, even if the tenant is active.' },
  { value: 'active', label: 'Published', hint: 'Visible on the public view and open to referee scoring.' },
  { value: 'completed', label: 'Completed', hint: 'Tournament finished. Stays visible for the record.' },
];

export default function DivisionDetail({ email }) {
  const { tenantId, divisionId } = useParams();
  const [division, setDivision] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(null);
  const [saveState, setSaveState] = useState('idle');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    let isMounted = true;
    supabase
      .from('divisions')
      .select('id, name, category, format_type, age_label, gender_label, status')
      .eq('id', divisionId)
      .single()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          setLoadError(error.message);
          return;
        }
        setDivision(data);
        setForm({
          name: data.name,
          category: data.category,
          format_type: data.format_type,
          gender_label: data.gender_label ?? '',
          age_label: data.age_label ?? '',
        });
      });
    return () => {
      isMounted = false;
    };
  }, [divisionId]);

  const hasChanges =
    division &&
    form &&
    (form.name !== division.name ||
      form.category !== division.category ||
      form.format_type !== division.format_type ||
      form.gender_label !== (division.gender_label ?? '') ||
      form.age_label !== (division.age_label ?? ''));

  async function handleSave(event) {
    event.preventDefault();
    setSaveState('saving');
    setSaveError('');

    const { data, error } = await supabase
      .from('divisions')
      .update({
        name: form.name.trim(),
        category: form.category,
        format_type: form.format_type,
        gender_label: form.gender_label.trim() || null,
        age_label: form.age_label.trim() || null,
      })
      .eq('id', divisionId)
      .select('id, name, category, format_type, age_label, gender_label, status')
      .single();

    if (error) {
      setSaveState('error');
      setSaveError(error.message);
      return;
    }
    setDivision(data);
    setSaveState('saved');
  }

  async function handleStatusChange(nextStatus) {
    const { data, error } = await supabase
      .from('divisions')
      .update({ status: nextStatus })
      .eq('id', divisionId)
      .select('id, name, category, format_type, age_label, gender_label, status')
      .single();

    if (error) {
      setSaveState('error');
      setSaveError(error.message);
      return;
    }
    setDivision(data);
  }

  if (loadError) {
    return (
      <Shell email={email}>
        <div className="callout-error">Couldn't load this division: {loadError}</div>
      </Shell>
    );
  }

  if (!division || !form) {
    return (
      <Shell email={email}>
        <p className="tenants-empty mono">Loading…</p>
      </Shell>
    );
  }

  return (
    <Shell email={email}>
      <Link to={`/tenants/${tenantId}`} className="tenants-back mono">
        ← Back to tenant
      </Link>

      <div className="tenant-detail-header">
        <h1 className="dash-headline">{division.name}</h1>
        <StatusPill status={division.status} />
      </div>

      <section className="tenant-section" style={{ marginTop: 'var(--space-4)' }}>
        <h2 className="tenant-section-title">Status</h2>
        <StatusControl
          options={STATUS_OPTIONS}
          current={division.status}
          onChange={handleStatusChange}
        />
      </section>

      <section className="tenant-section">
        <h2 className="tenant-section-title">Details</h2>
        <form onSubmit={handleSave} className="tenant-form">
          <div>
            <label className="field-label" htmlFor="name">
              Division name
            </label>
            <input
              id="name"
              className="text-input"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="category">
              Category
            </label>
            <select
              id="category"
              className="text-input"
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            >
              {CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="format">
              Format
            </label>
            <select
              id="format"
              className="text-input"
              value={form.format_type}
              onChange={(event) => setForm({ ...form, format_type: event.target.value })}
            >
              {FORMATS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="gender">
              Gender label
            </label>
            <input
              id="gender"
              className="text-input"
              value={form.gender_label}
              onChange={(event) => setForm({ ...form, gender_label: event.target.value })}
              placeholder="Men's, Women's, Mixed, Open…"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="age">
              Age label
            </label>
            <input
              id="age"
              className="text-input"
              value={form.age_label}
              onChange={(event) => setForm({ ...form, age_label: event.target.value })}
              placeholder="Open, 40+, 50+…"
            />
          </div>

          {saveState === 'error' && (
            <div className="callout-error" role="alert">
              {saveError}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary tenant-form-submit"
            disabled={!hasChanges || saveState === 'saving'}
          >
            {saveState === 'saving' ? 'Saving…' : 'Save changes'}
          </button>
          {saveState === 'saved' && !hasChanges && (
            <span className="field-hint">Saved.</span>
          )}
        </form>
      </section>

      <section className="tenant-section">
        <h2 className="tenant-section-title">Rosters</h2>
        <p className="tenants-empty">Team and player entry arrives in the next build.</p>
      </section>
    </Shell>
  );
}
