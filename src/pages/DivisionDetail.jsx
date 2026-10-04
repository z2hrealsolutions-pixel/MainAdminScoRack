import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Shell from '../components/Shell';
import StatusPill from '../components/StatusPill';
import StatusControl from '../components/StatusControl';
import RosterSection from '../components/RosterSection';
import GroupSchedule from '../components/GroupSchedule';
import KnockoutSection from '../components/KnockoutSection';
import DuprExport from '../components/DuprExport';
import DeleteDivision from '../components/DeleteDivision';
import RefereeCodes from '../components/RefereeCodes';
import { CATEGORIES, FORMATS } from '../lib/divisions';
import '../styles/tenants.css';
import '../styles/bracket.css';

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
  const [rosterKey, setRosterKey] = useState(0);
  const [seedState, setSeedState] = useState('idle'); // idle | seeding | done | error
  const [seedError, setSeedError] = useState('');

  useEffect(() => {
    let isMounted = true;
    supabase
      .from('divisions')
      .select('id, name, category, format_type, age_label, gender_label, status, group_win_points')
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
          group_win_points: String(data.group_win_points ?? 1),
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
      form.age_label !== (division.age_label ?? '') ||
      form.group_win_points !== String(division.group_win_points));

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
        group_win_points: Number(form.group_win_points),
      })
      .eq('id', divisionId)
      .select('id, name, category, format_type, age_label, gender_label, status, group_win_points')
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
      .select('id, name, category, format_type, age_label, gender_label, status, group_win_points')
      .single();

    if (error) {
      setSaveState('error');
      setSaveError(error.message);
      return;
    }
    setDivision(data);
  }

  async function handleSeed() {
    const confirmed = window.confirm(
      'Seed every team in this division by DUPR rating? Any seeds set by hand will be overwritten.'
    );
    if (!confirmed) return;

    setSeedState('seeding');
    setSeedError('');

    const { error } = await supabase.rpc('seed_division_by_rating', {
      p_division_id: divisionId,
    });

    if (error) {
      setSeedState('error');
      setSeedError(error.message);
      return;
    }

    setSeedState('done');
    setRosterKey((key) => key + 1);
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

          {form.category !== 'league' && (
            <div>
              <label className="field-label" htmlFor="winPoints">
                Standings points per group win
              </label>
              <input
                id="winPoints"
                className="text-input"
                inputMode="numeric"
                value={form.group_win_points}
                onChange={(event) => setForm({ ...form, group_win_points: event.target.value })}
              />
              <p className="field-hint">
                What a win is worth in the group stage table. League divisions set points per
                rubber instead.
              </p>
            </div>
          )}

          {saveState === 'error' && (
            <div className="callout-error" role="alert">
              {saveError}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary tenant-form-submit"
            disabled={!hasChanges || !/^\d+$/.test(form.group_win_points) || saveState === 'saving'}
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
        <RosterSection
          key={rosterKey}
          tenantId={tenantId}
          divisionId={divisionId}
          category={division.category}
        />
      </section>

      <section className="tenant-section">
        <h2 className="tenant-section-title">Seeding</h2>
        <p className="dash-sub" style={{ marginBottom: 'var(--space-3)' }}>
          Ranks every team by its roster's average DUPR rating, highest first.
          Teams with no rating on file sort last instead of breaking the order.
          Any seed already set by hand gets overwritten.
        </p>
        <button
          type="button"
          className="btn-primary"
          disabled={seedState === 'seeding'}
          onClick={handleSeed}
        >
          {seedState === 'seeding' ? 'Seeding…' : 'Seed by DUPR rating'}
        </button>
        {seedState === 'done' && (
          <span className="field-hint" style={{ marginLeft: 'var(--space-3)' }}>
            Done, seeds updated below.
          </span>
        )}
        {seedState === 'error' && (
          <div className="callout-error" style={{ marginTop: 'var(--space-3)' }}>
            {seedError}
          </div>
        )}
      </section>

      {division.format_type === 'group_then_knockout' && (
        <section className="tenant-section">
          <h2 className="tenant-section-title">Groups</h2>
          <GroupSchedule
            tenantId={tenantId}
            divisionId={divisionId}
            category={division.category}
          />
        </section>
      )}

      <section className="tenant-section">
        <h2 className="tenant-section-title">Bracket</h2>
        <KnockoutSection tenantId={tenantId} divisionId={divisionId} division={division} />
      </section>

      <section className="tenant-section">
        <h2 className="tenant-section-title">Referee codes</h2>
        <RefereeCodes tenantId={tenantId} divisionId={divisionId} divisionName={division.name} />
      </section>

      <section className="tenant-section">
        <h2 className="tenant-section-title">Export to DUPR</h2>
        <DuprExport tenantId={tenantId} division={division} />
      </section>

      <section className="tenant-section">
        <h2 className="tenant-section-title">Delete division</h2>
        <DeleteDivision tenantId={tenantId} divisionId={divisionId} />
      </section>
    </Shell>
  );
}
