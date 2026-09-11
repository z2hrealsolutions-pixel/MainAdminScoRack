import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Shell from '../components/Shell';
import '../styles/tenants.css';
import '../styles/roster.css';

const GENDERS = [
  { value: 'M', label: 'Male' },
  { value: 'F', label: 'Female' },
];

function emptyPlayer() {
  return { name: '', gender: 'M', dupr_rating: '', dupr_id: '', dupr_email: '' };
}

export default function TeamCreate({ email }) {
  const { tenantId, divisionId } = useParams();
  const navigate = useNavigate();

  const [division, setDivision] = useState(null);
  const [loadError, setLoadError] = useState('');

  const [teamName, setTeamName] = useState('');
  const [captainName, setCaptainName] = useState('');
  const [players, setPlayers] = useState([emptyPlayer()]);

  const [status, setStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;
    supabase
      .from('divisions')
      .select('id, name, category')
      .eq('id', divisionId)
      .single()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) {
          setLoadError(error.message);
          return;
        }
        setDivision(data);
        setPlayers(
          data.category === 'doubles' ? [emptyPlayer(), emptyPlayer()] : [emptyPlayer()]
        );
      });
    return () => {
      isMounted = false;
    };
  }, [divisionId]);

  if (loadError) {
    return (
      <Shell email={email}>
        <div className="callout-error">Couldn't load this division: {loadError}</div>
      </Shell>
    );
  }

  if (!division) {
    return (
      <Shell email={email}>
        <p className="tenants-empty mono">Loading…</p>
      </Shell>
    );
  }

  const category = division.category;

  function updatePlayer(index, field, value) {
    setPlayers((prev) =>
      prev.map((player, i) => (i === index ? { ...player, [field]: value } : player))
    );
  }

  function playersPayload() {
    return players.map((player) => ({
      name: player.name.trim(),
      gender: player.gender,
      dupr_rating: player.dupr_rating.trim(),
      dupr_id: player.dupr_id.trim(),
      dupr_email: player.dupr_email.trim(),
    }));
  }

  function resolvedTeamName() {
    if (category === 'singles') return players[0].name.trim();
    if (category === 'doubles') {
      return (
        teamName.trim() ||
        `${players[0].name.trim()} / ${players[1].name.trim()}`
      );
    }
    return teamName.trim();
  }

  const canSubmit =
    category === 'league'
      ? teamName.trim().length > 0
      : players.every((p) => p.name.trim().length > 0);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    setStatus('saving');
    setErrorMessage('');

    const { error } = await supabase.rpc('create_team_with_players', {
      p_division_id: divisionId,
      p_team_name: resolvedTeamName(),
      p_captain_name: captainName.trim() || null,
      p_players: category === 'league' ? [] : playersPayload(),
    });

    if (error) {
      setStatus('error');
      setErrorMessage(error.message);
      return;
    }

    navigate(`/tenants/${tenantId}/divisions/${divisionId}`);
  }

  return (
    <Shell email={email}>
      <Link to={`/tenants/${tenantId}/divisions/${divisionId}`} className="tenants-back mono">
        ← Back to {division.name}
      </Link>
      <h1 className="dash-headline">
        {category === 'league' ? 'Add team' : category === 'doubles' ? 'Add pair' : 'Add player'}
      </h1>

      <form onSubmit={handleSubmit} className="tenant-form roster-form">
        {(category === 'league' || category === 'doubles') && (
          <div>
            <label className="field-label" htmlFor="teamName">
              {category === 'league' ? 'Team name' : 'Pair name (optional)'}
            </label>
            <input
              id="teamName"
              className="text-input"
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
              placeholder={
                category === 'league' ? 'Fire Bees' : 'Leave blank to use both player names'
              }
            />
          </div>
        )}

        {category === 'league' && (
          <div>
            <label className="field-label" htmlFor="captainName">
              Captain name (optional)
            </label>
            <input
              id="captainName"
              className="text-input"
              value={captainName}
              onChange={(event) => setCaptainName(event.target.value)}
            />
          </div>
        )}

        {category !== 'league' &&
          players.map((player, index) => (
            <fieldset key={index} className="roster-player-fields">
              {category === 'doubles' && (
                <legend className="field-label">Player {index + 1}</legend>
              )}

              <div>
                <label className="field-label" htmlFor={`name-${index}`}>
                  Name
                </label>
                <input
                  id={`name-${index}`}
                  required
                  className="text-input"
                  value={player.name}
                  onChange={(event) => updatePlayer(index, 'name', event.target.value)}
                />
              </div>

              <div className="roster-field-row">
                <div>
                  <label className="field-label" htmlFor={`gender-${index}`}>
                    Gender
                  </label>
                  <select
                    id={`gender-${index}`}
                    className="text-input"
                    value={player.gender}
                    onChange={(event) => updatePlayer(index, 'gender', event.target.value)}
                  >
                    {GENDERS.map((g) => (
                      <option key={g.value} value={g.value}>
                        {g.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label" htmlFor={`rating-${index}`}>
                    DUPR rating (optional)
                  </label>
                  <input
                    id={`rating-${index}`}
                    className="text-input"
                    inputMode="decimal"
                    placeholder="4.25"
                    value={player.dupr_rating}
                    onChange={(event) => updatePlayer(index, 'dupr_rating', event.target.value)}
                  />
                </div>
              </div>

              <div className="roster-field-row">
                <div>
                  <label className="field-label" htmlFor={`duprid-${index}`}>
                    DUPR ID (optional)
                  </label>
                  <input
                    id={`duprid-${index}`}
                    className="text-input"
                    value={player.dupr_id}
                    onChange={(event) => updatePlayer(index, 'dupr_id', event.target.value)}
                  />
                </div>
                <div>
                  <label className="field-label" htmlFor={`duemail-${index}`}>
                    DUPR email (optional)
                  </label>
                  <input
                    id={`duemail-${index}`}
                    type="email"
                    className="text-input"
                    value={player.dupr_email}
                    onChange={(event) => updatePlayer(index, 'dupr_email', event.target.value)}
                  />
                </div>
              </div>
            </fieldset>
          ))}

        {status === 'error' && (
          <div className="callout-error" role="alert">
            {errorMessage}
          </div>
        )}

        <button
          type="submit"
          className="btn-primary tenant-form-submit"
          disabled={!canSubmit || status === 'saving'}
        >
          {status === 'saving' ? 'Saving…' : 'Save'}
        </button>
      </form>
    </Shell>
  );
}
