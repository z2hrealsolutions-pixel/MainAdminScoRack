import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Shell from '../components/Shell';
import '../styles/tenants.css';
import '../styles/roster.css';

function PlayerRow({ player, onSaved, onRemoved }) {
  const [form, setForm] = useState({
    name: player.name,
    gender: player.gender,
    dupr_rating: player.dupr_rating ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dirty =
    form.name !== player.name ||
    form.gender !== player.gender ||
    form.dupr_rating !== (player.dupr_rating ?? '');

  async function handleSave() {
    setSaving(true);
    setError('');
    const { data, error: saveError } = await supabase
      .from('players')
      .update({
        name: form.name.trim(),
        gender: form.gender,
        dupr_rating: form.dupr_rating === '' ? null : Number(form.dupr_rating),
      })
      .eq('id', player.id)
      .select('id, name, gender, dupr_rating, dupr_id, dupr_email')
      .single();
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    onSaved(data);
  }

  async function handleRemove() {
    if (!window.confirm(`Remove ${player.name} from this team?`)) return;
    const { error: removeError } = await supabase.from('players').delete().eq('id', player.id);
    if (removeError) {
      setError(removeError.message);
      return;
    }
    onRemoved(player.id);
  }

  return (
    <div className="roster-edit-row">
      <input
        className="text-input"
        value={form.name}
        onChange={(event) => setForm({ ...form, name: event.target.value })}
      />
      <select
        className="text-input"
        value={form.gender}
        onChange={(event) => setForm({ ...form, gender: event.target.value })}
      >
        <option value="M">Male</option>
        <option value="F">Female</option>
      </select>
      <input
        className="text-input"
        inputMode="decimal"
        placeholder="DUPR"
        value={form.dupr_rating}
        onChange={(event) => setForm({ ...form, dupr_rating: event.target.value })}
      />
      <button
        type="button"
        className="btn-ghost"
        disabled={!dirty || saving}
        onClick={handleSave}
      >
        {saving ? '…' : 'Save'}
      </button>
      <button type="button" className="btn-ghost roster-remove-btn" onClick={handleRemove}>
        Remove
      </button>
      {error && <span className="csv-row-error-msg">{error}</span>}
    </div>
  );
}

export default function TeamDetail({ email }) {
  const { tenantId, divisionId, teamId } = useParams();
  const [team, setTeam] = useState(null);
  const [division, setDivision] = useState(null);
  const [players, setPlayers] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(null);
  const [saveState, setSaveState] = useState('idle');
  const [saveError, setSaveError] = useState('');

  const [newPlayer, setNewPlayer] = useState({ name: '', gender: 'M', dupr_rating: '' });
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [addPlayerError, setAddPlayerError] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function load() {
      const [teamRes, divisionRes, playersRes] = await Promise.all([
        supabase.from('teams').select('id, name, captain_name, seed').eq('id', teamId).single(),
        supabase.from('divisions').select('id, category').eq('id', divisionId).single(),
        supabase
          .from('players')
          .select('id, name, gender, dupr_rating, dupr_id, dupr_email')
          .eq('team_id', teamId)
          .order('created_at', { ascending: true }),
      ]);
      if (!isMounted) return;

      if (teamRes.error || divisionRes.error || playersRes.error) {
        setLoadError(
          (teamRes.error || divisionRes.error || playersRes.error).message
        );
        return;
      }

      setTeam(teamRes.data);
      setDivision(divisionRes.data);
      setPlayers(playersRes.data);
      setForm({
        name: teamRes.data.name,
        captain_name: teamRes.data.captain_name ?? '',
        seed: teamRes.data.seed ?? '',
      });
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [teamId, divisionId]);

  const hasChanges =
    team &&
    form &&
    (form.name !== team.name ||
      form.captain_name !== (team.captain_name ?? '') ||
      String(form.seed) !== String(team.seed ?? ''));

  async function handleSave(event) {
    event.preventDefault();
    setSaveState('saving');
    setSaveError('');

    const { data, error } = await supabase
      .from('teams')
      .update({
        name: form.name.trim(),
        captain_name: form.captain_name.trim() || null,
        seed: form.seed === '' ? null : Number(form.seed),
      })
      .eq('id', teamId)
      .select('id, name, captain_name, seed')
      .single();

    if (error) {
      setSaveState('error');
      setSaveError(error.message);
      return;
    }
    setTeam(data);
    setSaveState('saved');
  }

  async function handleAddPlayer(event) {
    event.preventDefault();
    setAddingPlayer(true);
    setAddPlayerError('');

    const { data, error } = await supabase
      .from('players')
      .insert({
        tenant_id: tenantId,
        team_id: teamId,
        name: newPlayer.name.trim(),
        gender: newPlayer.gender,
        dupr_rating: newPlayer.dupr_rating === '' ? null : Number(newPlayer.dupr_rating),
      })
      .select('id, name, gender, dupr_rating, dupr_id, dupr_email')
      .single();

    setAddingPlayer(false);
    if (error) {
      setAddPlayerError(error.message);
      return;
    }
    setPlayers((prev) => [...prev, data]);
    setNewPlayer({ name: '', gender: 'M', dupr_rating: '' });
  }

  if (loadError) {
    return (
      <Shell email={email}>
        <div className="callout-error">Couldn't load this team: {loadError}</div>
      </Shell>
    );
  }

  if (!team || !division || !players || !form) {
    return (
      <Shell email={email}>
        <p className="tenants-empty mono">Loading…</p>
      </Shell>
    );
  }

  return (
    <Shell email={email}>
      <Link to={`/tenants/${tenantId}/divisions/${divisionId}`} className="tenants-back mono">
        ← Back to division
      </Link>
      <h1 className="dash-headline">{team.name}</h1>

      <section className="tenant-section" style={{ marginTop: 'var(--space-4)' }}>
        <h2 className="tenant-section-title">Team details</h2>
        <form onSubmit={handleSave} className="tenant-form roster-form">
          <div>
            <label className="field-label" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              className="text-input"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
            />
          </div>
          <div className="roster-field-row">
            <div>
              <label className="field-label" htmlFor="captain">
                Captain (optional)
              </label>
              <input
                id="captain"
                className="text-input"
                value={form.captain_name}
                onChange={(event) => setForm({ ...form, captain_name: event.target.value })}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="seed">
                Seed (optional)
              </label>
              <input
                id="seed"
                className="text-input"
                inputMode="numeric"
                value={form.seed}
                onChange={(event) => setForm({ ...form, seed: event.target.value })}
              />
            </div>
          </div>

          {saveState === 'error' && <div className="callout-error">{saveError}</div>}

          <button
            type="submit"
            className="btn-primary tenant-form-submit"
            disabled={!hasChanges || saveState === 'saving'}
          >
            {saveState === 'saving' ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </section>

      <section className="tenant-section">
        <h2 className="tenant-section-title">Players</h2>
        {players.length === 0 && <p className="tenants-empty">No players yet.</p>}
        {players.length > 0 && (
          <div className="roster-edit-list">
            {players.map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                onSaved={(updated) =>
                  setPlayers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
                }
                onRemoved={(id) => setPlayers((prev) => prev.filter((p) => p.id !== id))}
              />
            ))}
          </div>
        )}

        {division.category === 'league' && (
          <form onSubmit={handleAddPlayer} className="roster-add-player-form">
            <input
              className="text-input"
              placeholder="Player name"
              required
              value={newPlayer.name}
              onChange={(event) => setNewPlayer({ ...newPlayer, name: event.target.value })}
            />
            <select
              className="text-input"
              value={newPlayer.gender}
              onChange={(event) => setNewPlayer({ ...newPlayer, gender: event.target.value })}
            >
              <option value="M">Male</option>
              <option value="F">Female</option>
            </select>
            <input
              className="text-input"
              inputMode="decimal"
              placeholder="DUPR"
              value={newPlayer.dupr_rating}
              onChange={(event) =>
                setNewPlayer({ ...newPlayer, dupr_rating: event.target.value })
              }
            />
            <button type="submit" className="btn-primary" disabled={addingPlayer}>
              {addingPlayer ? '…' : 'Add player'}
            </button>
            {addPlayerError && <div className="callout-error">{addPlayerError}</div>}
          </form>
        )}
      </section>
    </Shell>
  );
}
