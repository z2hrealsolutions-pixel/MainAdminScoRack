import { useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Shell from '../components/Shell';
import { CATEGORIES, FORMATS } from '../lib/divisions';
import '../styles/tenants.css';

export default function DivisionCreate({ email }) {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [format, setFormat] = useState(FORMATS[0].value);
  const [genderLabel, setGenderLabel] = useState('');
  const [ageLabel, setAgeLabel] = useState('');
  const [status, setStatus] = useState('idle'); // idle | saving | error
  const [errorMessage, setErrorMessage] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus('saving');
    setErrorMessage('');

    const { data, error } = await supabase
      .from('divisions')
      .insert({
        tenant_id: tenantId,
        name: name.trim(),
        category,
        format_type: format,
        gender_label: genderLabel.trim() || null,
        age_label: ageLabel.trim() || null,
      })
      .select('id')
      .single();

    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
      return;
    }

    navigate(`/tenants/${tenantId}/divisions/${data.id}`);
  }

  return (
    <Shell email={email}>
      <Link to={`/tenants/${tenantId}`} className="tenants-back mono">
        ← Back to tenant
      </Link>
      <h1 className="dash-headline">Add division</h1>
      <p className="dash-sub">
        Starts as a draft, invisible to the public until you publish it
        from the division page.
      </p>

      <form onSubmit={handleSubmit} className="tenant-form">
        <div>
          <label className="field-label" htmlFor="name">
            Division name
          </label>
          <input
            id="name"
            required
            autoFocus
            className="text-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Mixed Doubles 40+"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="category">
            Category
          </label>
          <select
            id="category"
            className="text-input"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
          >
            {CATEGORIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <p className="field-hint">
            How many players make up one competing team: one for singles,
            two for doubles, a full roster for a league.
          </p>
        </div>

        <div>
          <label className="field-label" htmlFor="format">
            Format
          </label>
          <select
            id="format"
            className="text-input"
            value={format}
            onChange={(event) => setFormat(event.target.value)}
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
            value={genderLabel}
            onChange={(event) => setGenderLabel(event.target.value)}
            placeholder="Men's, Women's, Mixed, Open…"
          />
          <p className="field-hint">
            Descriptive only, staff self-police eligibility.
          </p>
        </div>

        <div>
          <label className="field-label" htmlFor="age">
            Age label
          </label>
          <input
            id="age"
            className="text-input"
            value={ageLabel}
            onChange={(event) => setAgeLabel(event.target.value)}
            placeholder="Open, 40+, 50+…"
          />
        </div>

        {status === 'error' && (
          <div className="callout-error" role="alert">
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          className="btn-primary tenant-form-submit"
          disabled={status === 'saving' || !name.trim()}
        >
          {status === 'saving' ? 'Creating…' : 'Create division'}
        </button>
      </form>
    </Shell>
  );
}
