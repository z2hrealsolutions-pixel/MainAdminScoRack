import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import Shell from '../components/Shell';
import StatusPill from '../components/StatusPill';
import StatusControl from '../components/StatusControl';
import RosterSection from '../components/RosterSection';
import GroupSchedule from '../components/GroupSchedule';
import KnockoutSection from '../components/KnockoutSection';
import RulesPanel from '../components/RulesPanel';
import DuprExport from '../components/DuprExport';
import DeleteDivision from '../components/DeleteDivision';
import RefereeCodes from '../components/RefereeCodes';
import { Stepper, NextUp } from '../components/DivisionSteps';
import { CATEGORIES, FORMATS, categoryLabel, formatLabel } from '../lib/divisions';
import { computeSteps, nextUp, hasPools } from '../lib/divisionSteps';
import { STAGES, describeRule } from '../lib/presets';
import '../styles/tenants.css';
import '../styles/bracket.css';
import '../styles/plan.css';
import '../styles/steps.css';

const DIVISION_COLS =
  'id, name, category, format_type, age_label, gender_label, status, group_win_points, tiebreak_mode, match_rules, knockout_template';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', hint: 'Hidden from the public. Referees cannot score it yet.' },
  { value: 'active', label: 'Published', hint: 'Live: visible to the public and open to referee scoring.' },
  { value: 'completed', label: 'Completed', hint: 'The division is finished. It stays visible for the record.' },
];

const STEP_TITLES = {
  teams: ['Teams & pools', 'Who is playing, and which pool each team is in. The pool matches are made for you.'],
  rules: ['Rules', 'How points, sets and tie-breaks work. The settings already match the format, so only change them if you need to.'],
  live: ['Go live', 'Publish the division so referees can score and the public can follow. You can switch it back to draft at any time.'],
  matches: ['Pool matches', 'Every pool match, with its court and time. Open one to enter the score.'],
  knockout: ['Knockout', 'The bracket after the pools. Check who plays whom, then create it.'],
};

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [progress, setProgress] = useState(null);

  const loadProgress = useCallback(async () => {
    const [teamsRes, groupsRes, matchesRes] = await Promise.all([
      supabase.from('teams').select('id, group_id').eq('division_id', divisionId),
      supabase.from('groups').select('id, is_playoff').eq('division_id', divisionId),
      supabase.from('matchups').select('id, group_id, stage, status').eq('division_id', divisionId),
    ]);
    if (teamsRes.error || groupsRes.error || matchesRes.error) return;
    const pools = groupsRes.data.filter((g) => !g.is_playoff);
    const poolMatches = matchesRes.data.filter((m) => m.group_id && m.stage === 'group');
    const knockout = matchesRes.data.filter((m) => !m.group_id && m.stage !== 'group');
    const finals = knockout.filter((m) => m.stage === 'Final');
    const decider = finals.length > 0 ? finals : knockout;
    setProgress({
      teams: teamsRes.data.length,
      ungrouped: teamsRes.data.filter((t) => !t.group_id).length,
      groups: pools.length,
      poolMatches: poolMatches.length,
      poolMatchesDone: poolMatches.filter((m) => m.status === 'complete').length,
      knockoutExists: knockout.length > 0,
      knockoutDone: decider.length > 0 && decider.every((m) => m.status === 'complete' || m.status === 'bye'),
    });
  }, [divisionId]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  useEffect(() => {
    let isMounted = true;
    supabase
      .from('divisions')
      .select(DIVISION_COLS)
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

  async function reloadDivision() {
    const { data } = await supabase.from('divisions').select(DIVISION_COLS).eq('id', divisionId).single();
    if (data) setDivision(data);
  }

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
      .select(DIVISION_COLS)
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
      .select(DIVISION_COLS)
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

  const full = progress ? { ...progress, status: division.status, formatType: division.format_type } : null;
  const steps = full ? computeSteps(full) : [];
  const next = full ? nextUp(full) : null;
  const requested = searchParams.get('step');
  const current = steps.find((x) => x.state === 'current');
  const active = steps.some((x) => x.id === requested) ? requested : current ? current.id : steps.length > 0 ? steps[steps.length - 1].id : 'teams';

  function goTo(step) {
    setSearchParams({ step }, { replace: false });
    loadProgress();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const rules = division.match_rules || {};
  const pools = hasPools(division.format_type);
  // only the stages this division actually has a rule for; a division with none set shows them all
  const setRows = STAGES.filter((st) => (st.key === 'group' ? pools : rules[st.key]));
  const stageRows = setRows.length > 0 ? setRows : STAGES.filter((st) => pools || st.key !== 'group');

  return (
    <Shell email={email}>
      <Link to={`/tenants/${tenantId}`} className="tenants-back mono">
        ← Back to tenant
      </Link>

      <div className="tenant-detail-header">
        <h1 className="dash-headline">{division.name}</h1>
        <StatusPill status={division.status} />
      </div>
      <p className="division-meta">
        {categoryLabel(division.category)} · {formatLabel(division.format_type)}
        {full ? ` · ${full.teams} team${full.teams === 1 ? '' : 's'}` : ''}
      </p>

      {next && <NextUp next={next} onGo={goTo} />}
      {full && <Stepper progress={full} active={active} onPick={goTo} />}

      <section className="tenant-section step-panel">
        <h2 className="tenant-section-title">{STEP_TITLES[active]?.[0] ?? ''}</h2>
        <p className="step-lead">{STEP_TITLES[active]?.[1] ?? ''}</p>

        {active === 'teams' && (
          <>
            {pools && (
              <GroupSchedule
                view="pools"
                tenantId={tenantId}
                divisionId={divisionId}
                divisionName={division.name}
                category={division.category}
                tiebreak={division.tiebreak_mode}
                onGenerated={loadProgress}
              />
            )}
            <details className="tool-fold" open={!pools || (full ? full.teams === 0 : false)}>
              <summary>{pools ? 'Add or remove teams' : 'Teams'}</summary>
              <div className="tool-fold-body">
                <RosterSection key={rosterKey} tenantId={tenantId} divisionId={divisionId} category={division.category} />
              </div>
            </details>
          </>
        )}

        {active === 'rules' && (
          <>
            <ul className="rule-summary">
              {stageRows.map((st) => (
                <li key={st.key}>
                  <span className="rule-stage">{st.label}</span>
                  <span className="rule-text">{describeRule(rules[st.key])}</span>
                </li>
              ))}
              <li>
                <span className="rule-stage">Tie in a pool</span>
                <span className="rule-text">
                  {division.tiebreak_mode === 'points'
                    ? 'Most wins, then point difference, then points scored, then head to head'
                    : 'Most wins, then head to head, then point difference'}
                </span>
              </li>
            </ul>
            <details className="tool-fold">
              <summary>Change the rules</summary>
              <div className="tool-fold-body">
                <RulesPanel tenantId={tenantId} divisionId={divisionId} division={division} onSaved={reloadDivision} />
              </div>
            </details>
          </>
        )}

        {active === 'live' && (
          <>
            <StatusControl options={STATUS_OPTIONS} current={division.status} onChange={async (v) => { await handleStatusChange(v); loadProgress(); }} />
            <details className="tool-fold">
              <summary>Referee codes</summary>
              <div className="tool-fold-body">
                <p className="field-hint">Give each referee the code for their pool. They use it to open the scoring screen.</p>
                <RefereeCodes tenantId={tenantId} divisionId={divisionId} divisionName={division.name} />
              </div>
            </details>
          </>
        )}

        {active === 'matches' && pools && (
          <GroupSchedule
            view="matches"
            tenantId={tenantId}
            divisionId={divisionId}
            divisionName={division.name}
            category={division.category}
            tiebreak={division.tiebreak_mode}
          />
        )}

        {active === 'knockout' && (
          <KnockoutSection tenantId={tenantId} divisionId={divisionId} division={division} />
        )}
      </section>

      <details className="adv-fold">
        <summary>Advanced settings</summary>
        <div className="adv-body">
          <section className="adv-block">
            <h3 className="adv-title">Division details</h3>
            <form onSubmit={handleSave} className="tenant-form">
              <div>
                <label className="field-label" htmlFor="name">Division name</label>
                <input id="name" className="text-input" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
              </div>
              <div>
                <label className="field-label" htmlFor="category">Category</label>
                <select id="category" className="text-input" value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                  {CATEGORIES.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="format">Format</label>
                <select id="format" className="text-input" value={form.format_type} onChange={(event) => setForm({ ...form, format_type: event.target.value })}>
                  {FORMATS.map((option) => (<option key={option.value} value={option.value}>{option.label}</option>))}
                </select>
              </div>
              <div>
                <label className="field-label" htmlFor="gender">Gender label</label>
                <input id="gender" className="text-input" value={form.gender_label} onChange={(event) => setForm({ ...form, gender_label: event.target.value })} placeholder="Men's, Women's, Mixed, Open…" />
              </div>
              <div>
                <label className="field-label" htmlFor="age">Age label</label>
                <input id="age" className="text-input" value={form.age_label} onChange={(event) => setForm({ ...form, age_label: event.target.value })} placeholder="Open, 40+, 50+…" />
              </div>
              {form.category !== 'league' && (
                <div>
                  <label className="field-label" htmlFor="winPoints">Standings points per group win</label>
                  <input id="winPoints" className="text-input" inputMode="numeric" value={form.group_win_points} onChange={(event) => setForm({ ...form, group_win_points: event.target.value })} />
                  <p className="field-hint">What a win is worth in the pool table. League divisions set points per rubber instead.</p>
                </div>
              )}
              {saveState === 'error' && (<div className="callout-error" role="alert">{saveError}</div>)}
              <button type="submit" className="btn-primary tenant-form-submit" disabled={!hasChanges || !/^\d+$/.test(form.group_win_points) || saveState === 'saving'}>
                {saveState === 'saving' ? 'Saving…' : 'Save changes'}
              </button>
              {saveState === 'saved' && !hasChanges && <span className="field-hint">Saved.</span>}
            </form>
          </section>

          <section className="adv-block">
            <h3 className="adv-title">Seeding</h3>
            <p className="field-hint">
              Ranks every team by its players' average DUPR rating, highest first. Teams with no rating go last. Seeds set by hand are overwritten.
            </p>
            <button type="button" className="btn-ghost" disabled={seedState === 'seeding'} onClick={handleSeed}>
              {seedState === 'seeding' ? 'Seeding…' : 'Seed by DUPR rating'}
            </button>
            {seedState === 'done' && <span className="field-hint"> Done.</span>}
            {seedState === 'error' && <div className="callout-error">{seedError}</div>}
          </section>

          <section className="adv-block">
            <h3 className="adv-title">Export to DUPR</h3>
            <DuprExport tenantId={tenantId} division={division} />
          </section>

          <section className="adv-block">
            <h3 className="adv-title">Delete division</h3>
            <DeleteDivision tenantId={tenantId} divisionId={divisionId} />
          </section>
        </div>
      </details>
    </Shell>
  );
}
