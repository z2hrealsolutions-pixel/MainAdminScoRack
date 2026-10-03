import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Shell from '../components/Shell';
import { slugify, isValidSlug } from '../lib/slugify';
import { SPORTS } from '../lib/sports';
import '../styles/tenants.css';

export default function TenantCreate({ email }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [sport, setSport] = useState(SPORTS[0].value);
  const [status, setStatus] = useState('idle'); // idle | saving | error
  const [errorMessage, setErrorMessage] = useState('');

  function handleNameChange(value) {
    setName(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  }

  function handleSlugChange(value) {
    setSlugTouched(true);
    setSlug(value);
  }

  const slugIsValid = slug.length > 0 && isValidSlug(slug);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!slugIsValid) return;

    setStatus('saving');
    setErrorMessage('');

    const { data, error } = await supabase
      .from('tenants')
      .insert({ name: name.trim(), slug, sport })
      .select('id')
      .single();

    if (error) {
      setStatus('error');
      setErrorMessage(
        error.code === '23505'
          ? `The slug "${slug}" is already taken. Try another.`
          : error.message
      );
      return;
    }

    navigate(`/tenants/${data.id}`);
  }

  return (
    <Shell email={email}>
      <Link to="/tenants" className="tenants-back mono">
        ← All tenants
      </Link>
      <h1 className="dash-headline">Create tenant</h1>
      <p className="dash-sub">
        This provisions the tenant record. Divisions and rosters get added
        once it exists.
      </p>

      <form onSubmit={handleSubmit} className="tenant-form">
        <div>
          <label className="field-label" htmlFor="name">
            Tenant name
          </label>
          <input
            id="name"
            required
            autoFocus
            className="text-input"
            value={name}
            onChange={(event) => handleNameChange(event.target.value)}
            placeholder="Colombo Pickleball Open"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="slug">
            Slug
          </label>
          <input
            id="slug"
            required
            className="text-input mono"
            value={slug}
            onChange={(event) => handleSlugChange(event.target.value)}
            placeholder="colombo-pickleball-open"
          />
          <p className="field-hint">
            {slug && !slugIsValid
              ? 'Lowercase letters, numbers, and hyphens only.'
              : 'This becomes part of the public and referee URLs. Lowercase, hyphens only.'}
          </p>
        </div>

        <div>
          <label className="field-label" htmlFor="sport">
            Sport
          </label>
          <select
            id="sport"
            className="text-input"
            value={sport}
            onChange={(event) => setSport(event.target.value)}
          >
            {SPORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {status === 'error' && (
          <div className="callout-error" role="alert">
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          className="btn-primary tenant-form-submit"
          disabled={status === 'saving' || !name.trim() || !slugIsValid}
        >
          {status === 'saving' ? 'Creating…' : 'Create tenant'}
        </button>
      </form>
    </Shell>
  );
}
