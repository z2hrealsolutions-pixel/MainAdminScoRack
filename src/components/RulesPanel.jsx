import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useVenueAccess } from '../lib/access';
import { PRESETS, STAGES, describeRule, presetByKey } from '../lib/presets';

const TIEBREAKS = [
  {
    value: 'points',
    title: 'Wins, then point difference, then points scored',
    hint: 'Decided by the numbers across all the pool games. Head to head only if all of those are level. Used to rank the best 3rd placed teams too.',
  },
  {
    value: 'classic',
    title: 'Wins, then head to head, then point difference',
    hint: 'The result between the tied teams comes first. Not used across pools.',
  },
];

function blank(rules) {
  const out = {};
  STAGES.forEach((s) => {
    const r = (rules && rules[s.key]) || {};
    out[s.key] = {
      target: r.target ? String(r.target) : '',
      win_by: r.win_by ? String(r.win_by) : '1',
      best_of: r.best_of ? String(r.best_of) : '1',
    };
  });
  return out;
}

function toRules(form) {
  const out = {};
  STAGES.forEach((s) => {
    const r = form[s.key];
    if (!r.target) return;
    out[s.key] = { target: Number(r.target), win_by: Number(r.win_by) || 1, best_of: Number(r.best_of) || 1 };
  });
  return out;
}

// How each stage of a division is played, and how a tie in the pool table is broken.
// A preset fills all of it at once, and every part can still be changed by hand.
export default function RulesPanel({ tenantId, divisionId, division, onSaved }) {
  const access = useVenueAccess(tenantId);
  const [tiebreak, setTiebreak] = useState(division.tiebreak_mode || 'classic');
  const [form, setForm] = useState(() => blank(division.match_rules));
  const [template, setTemplate] = useState(division.knockout_template || null);
  const [presetKey, setPresetKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setTiebreak(division.tiebreak_mode || 'classic');
    setForm(blank(division.match_rules));
    setTemplate(division.knockout_template || null);
    setDirty(false);
  }, [division.tiebreak_mode, division.match_rules, division.knockout_template]);

  const isLeague = division.category === 'league';
  const canEdit = access.canChange && !isLeague;

  function applyPreset(key) {
    setPresetKey(key);
    setSaved('');
    const p = presetByKey(key);
    if (!p) return;
    setTiebreak(p.tiebreak);
    setForm(blank(p.rules));
    setTemplate(p.template);
    setDirty(true);
  }

  function setField(stage, field, value) {
    setSaved('');
    setDirty(true);
    setForm((f) => ({ ...f, [stage]: { ...f[stage], [field]: value } }));
  }

  async function save() {
    setBusy(true);
    setError('');
    setSaved('');
    const { error: err } = await supabase.rpc('set_division_rules', {
      p_division_id: divisionId,
      p_tiebreak: tiebreak,
      p_rules: toRules(form),
      p_template: template,
      p_clear_template: !template,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDirty(false);
    setSaved('Saved.');
    if (onSaved) onSaved();
  }

  if (isLeague) {
    return <p className="field-hint">League divisions score by rubbers. These rules are for singles and doubles divisions.</p>;
  }

  return (
    <div className="rules-panel">
      <div>
        <label className="field-label" htmlFor="preset">
          Start from a ready made format
        </label>
        <select
          id="preset"
          className="text-input"
          value={presetKey}
          disabled={!canEdit}
          onChange={(e) => applyPreset(e.target.value)}
        >
          <option value="">Choose a division to fill in everything below…</option>
          {PRESETS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
        {presetKey && <p className="field-hint">{presetByKey(presetKey).summary} Check the details, then save.</p>}
      </div>

      <fieldset className="rules-tiebreak" disabled={!canEdit}>
        <legend className="field-label">When teams in a pool are level</legend>
        <div className="mode-choice" role="radiogroup">
          {TIEBREAKS.map((t) => (
            <label key={t.value} className={`mode-card ${tiebreak === t.value ? 'mode-card-on' : ''}`}>
              <input
                type="radio"
                name="tiebreak"
                checked={tiebreak === t.value}
                onChange={() => {
                  setTiebreak(t.value);
                  setDirty(true);
                  setSaved('');
                }}
              />
              <span className="mode-title">{t.title}</span>
              <span className="mode-hint">{t.hint}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <h3 className="adv-h">How each stage is played</h3>
        <div className="rules-grid">
          <span className="rules-head">Stage</span>
          <span className="rules-head">Points to win</span>
          <span className="rules-head">Win by</span>
          <span className="rules-head">Sets</span>
          {STAGES.map((s) => (
            <RuleRow key={s.key} stage={s} value={form[s.key]} disabled={!canEdit} onChange={(f, v) => setField(s.key, f, v)} />
          ))}
        </div>
        <p className="field-hint">
          A game ends when a side has the points to win and is ahead by the win by number. There is no upper limit, a
          game goes on until someone is ahead by enough. A set match is won by the first side to win most of its sets.
          Leave points to win empty to let any score finish a game.
        </p>
      </div>

      {template && (
        <p className="field-hint">
          Knockout plan saved with this division: {template.rounds.length} round{template.rounds.length === 1 ? '' : 's'}.
          It is used to fill the knockout in below when the pools are done.
        </p>
      )}

      {error && (
        <div className="callout-error" role="alert">
          {error}
        </div>
      )}
      <div className="rules-actions">
        <button type="button" className="btn-primary" disabled={!canEdit || busy || !dirty} onClick={save}>
          {busy ? 'Saving…' : 'Save scoring rules'}
        </button>
        {saved && !dirty && <span className="field-hint">{saved}</span>}
      </div>
      <p className="field-hint rules-now">
        Now: {STAGES.map((s) => `${s.label}: ${describeRule(toRules(form)[s.key])}`).join(' · ')}
      </p>
    </div>
  );
}

function RuleRow({ stage, value, disabled, onChange }) {
  return (
    <>
      <span className="rules-stage">{stage.label}</span>
      <input
        className="text-input rules-num"
        inputMode="numeric"
        aria-label={`${stage.label} points to win`}
        value={value.target}
        disabled={disabled}
        placeholder="any"
        onChange={(e) => onChange('target', e.target.value.replace(/\D/g, '').slice(0, 2))}
      />
      <select
        className="text-input rules-num"
        aria-label={`${stage.label} win by`}
        value={value.win_by}
        disabled={disabled}
        onChange={(e) => onChange('win_by', e.target.value)}
      >
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
      </select>
      {stage.sets ? (
        <select
          className="text-input rules-num"
          aria-label={`${stage.label} sets`}
          value={value.best_of}
          disabled={disabled}
          onChange={(e) => onChange('best_of', e.target.value)}
        >
          <option value="1">One game</option>
          <option value="3">Best of 3</option>
          <option value="5">Best of 5</option>
        </select>
      ) : (
        <span className="rules-fixed">One game</span>
      )}
    </>
  );
}
