import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useVenueAccess } from '../lib/access';
import { treeFromMatchups, treeFromTemplate, slotErrorText, declareErrorText } from '../lib/bracketTree';

function when(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS = {
  complete: { text: 'Done', cls: 'chip-done' },
  live: { text: 'Live', cls: 'chip-live' },
  bye: { text: 'Bye', cls: 'chip-todo' },
};

// The knockout drawn as a tree, round by round. A place nobody has earned yet reads TBD and says where its team
// will come from. An owner can set a place by hand with the override password; the tree then shows who changed it.
export default function KnockoutTree({ tenantId, divisionId, division, refreshKey = 0 }) {
  const access = useVenueAccess(tenantId);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(null); // { matchId, side }
  const [pick, setPick] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [declaring, setDeclaring] = useState(null); // match id
  const [tools, setTools] = useState(null); // the match whose Edit has been opened: its changes show
  const [winnerPick, setWinnerPick] = useState('');
  const [reason, setReason] = useState('');
  const [declCode, setDeclCode] = useState('');
  const [declError, setDeclError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let isMounted = true;
    async function load() {
      const [mRes, tRes, gRes, eRes, dRes] = await Promise.all([
        supabase
          .from('matchups')
          .select('id, stage, status, team_a_id, team_b_id, advances_to_matchup_id, advances_to_slot, winner_team_id_override, bracket_position, court, scheduled_date, scheduled_time')
          .eq('division_id', divisionId)
          .is('group_id', null),
        supabase.from('teams').select('id, name').eq('division_id', divisionId),
        supabase.from('groups').select('id, name, is_playoff').eq('division_id', divisionId).order('name'),
        supabase.from('bracket_slot_edits').select('matchup_id, slot, old_team_name, new_team_name, edited_by_email, edited_at').eq('division_id', divisionId),
        supabase.from('bracket_winner_declarations').select('matchup_id, winner_team_name, reason, declared_by_email, declared_at').eq('division_id', divisionId),
      ]);
      if (!isMounted) return;
      const err = mRes.error || tRes.error || gRes.error;
      if (err) {
        setLoadError(err.message);
        return;
      }
      const ids = mRes.data.map((m) => m.id);
      let scored = new Set();
      if (ids.length > 0) {
        const [setsRes, subsRes] = await Promise.all([
          supabase.from('match_sets').select('matchup_id').in('matchup_id', ids),
          supabase.from('sub_matches').select('matchup_id, team_a_score, done').in('matchup_id', ids),
        ]);
        if (!isMounted) return;
        (setsRes.data || []).forEach((s) => scored.add(s.matchup_id));
        (subsRes.data || []).forEach((s) => {
          if (s.done || s.team_a_score !== null) scored.add(s.matchup_id);
        });
      }
      const teams = {};
      tRes.data.forEach((t) => {
        teams[t.id] = t.name;
      });
      setData({
        matchups: mRes.data.map((m) => ({ ...m, hasScores: scored.has(m.id) })),
        teams,
        teamList: tRes.data,
        groupNames: gRes.data.filter((g) => !g.is_playoff).map((g) => g.name),
        edits: eRes.error ? [] : eRes.data,
        declarations: dRes.error ? [] : dRes.data,
      });
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [divisionId, refreshKey, reload]);

  if (loadError) return <div className="callout-error">Couldn't load the bracket: {loadError}</div>;
  if (!data) return <p className="tenants-empty mono">Loading…</p>;

  const canEdit = access.isOwner;
  const tree =
    treeFromMatchups({ matchups: data.matchups, teams: data.teams, edits: data.edits, declarations: data.declarations, canEdit }) ||
    treeFromTemplate(division.knockout_template, data.groupNames);

  if (!tree) {
    return <p className="tenants-empty">The knockout has not been built yet.</p>;
  }

  function closeTools() {
    setTools(null);
    setEditing(null);
    setDeclaring(null);
    setError('');
    setDeclError('');
  }

  function open(match, slot) {
    setTools(match.id);
    setEditing({ matchId: match.id, side: slot.side });
    setPick('');
    setCode('');
    setError('');
  }

  function openDeclare(match) {
    setDeclaring(match.id);
    setWinnerPick('');
    setReason('');
    setDeclCode('');
    setDeclError('');
    setNotice('');
  }

  async function declare(match) {
    setBusy(true);
    setDeclError('');
    const { data: res, error: err } = await supabase.rpc('declare_bracket_winner', {
      p_matchup_id: match.id,
      p_winner_team_id: winnerPick,
      p_override_code: declCode,
      p_reason: reason,
    });
    setBusy(false);
    if (err) {
      setDeclError(err.message);
      return;
    }
    if (!res?.ok) {
      setDeclError(declareErrorText(res));
      return;
    }
    setDeclaring(null);
    setTools(null);
    setNotice(
      res.next_place_locked
        ? 'Winner recorded. The place in the next round was set by hand, so it was left as it is.'
        : ''
    );
    setReload((k) => k + 1);
  }

  async function save(match) {
    setBusy(true);
    setError('');
    const { data: res, error: err } = await supabase.rpc('set_bracket_slot', {
      p_matchup_id: match.id,
      p_slot: editing.side,
      p_team_id: pick,
      p_override_code: code,
    });
    setBusy(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (!res?.ok) {
      setError(slotErrorText(res));
      return;
    }
    setEditing(null);
    setTools(null);
    setReload((k) => k + 1);
  }

  return (
    <div>
      {notice && <div className="callout-error" role="status">{notice}</div>}
      {!tree.exists && (
        <p className="field-hint">
          This is how the knockout will look. Every place is TBD until the pool matches are finished and the bracket is created.
        </p>
      )}
      <div className="tree-scroll">
        <div className="tree-cols">
          {tree.rounds.map((round, rIndex) => (
            <div key={round.name} className="tree-col">
              <h3 className="tree-round">{round.name}</h3>
              <div className="tree-cells">
                {round.matches.map((match) => (
                  <div key={match.key} className={`tree-cell ${rIndex === tree.rounds.length - 1 ? 'tree-cell-last' : ''}`}>
                    <div className="tree-match">
                      <div className="tree-match-head">
                        <span className="tree-match-label">{match.label}</span>
                        {match.id && match.declarable && !match.editable && tools !== match.id && (
                          <button type="button" className="tree-edit" onClick={() => setTools(match.id)}>
                            Edit
                          </button>
                        )}
                        {match.id && (
                          <Link to={`/tenants/${tenantId}/divisions/${divisionId}/matchups/${match.id}`} className="tree-open">
                            {STATUS[match.status] ? STATUS[match.status].text : 'Open'} ›
                          </Link>
                        )}
                      </div>
                      {match.when && <div className="tree-when">{match.when}</div>}
                      {match.slots.map((slot) => {
                        const isEditing = editing && editing.matchId === match.id && editing.side === slot.side;
                        return (
                          <div key={slot.side} className={`tree-slot ${slot.name ? '' : 'tree-slot-tbd'}`}>
                            <div className="tree-slot-main">
                              <span className="tree-slot-name">{slot.name || 'TBD'}</span>
                              {match.editable && !isEditing && (
                                <button type="button" className="tree-edit" onClick={() => open(match, slot)}>
                                  Edit
                                </button>
                              )}
                            </div>
                            {slot.sub && <span className="tree-slot-sub">{slot.sub}</span>}
                            {slot.edit && (
                              <span className="tree-slot-audit">
                                Edited by {slot.edit.by} · {when(slot.edit.at)}
                                {slot.edit.from ? ` · was ${slot.edit.from}` : ''}
                              </span>
                            )}
                            {isEditing && (
                              <div className="tree-editor">
                                <label className="field-label" htmlFor={`pick-${match.id}-${slot.side}`}>
                                  Team for this place
                                </label>
                                <select
                                  id={`pick-${match.id}-${slot.side}`}
                                  className="text-input"
                                  value={pick}
                                  onChange={(event) => setPick(event.target.value)}
                                >
                                  <option value="">Choose a team…</option>
                                  {data.teamList
                                    .filter((t) => t.id !== match.slots.find((s) => s.side !== slot.side)?.teamId)
                                    .map((t) => (
                                      <option key={t.id} value={t.id}>
                                        {t.name}
                                      </option>
                                    ))}
                                </select>
                                <label className="field-label" htmlFor={`code-${match.id}-${slot.side}`}>
                                  Override password
                                </label>
                                <input
                                  id={`code-${match.id}-${slot.side}`}
                                  type="password"
                                  autoComplete="off"
                                  className="text-input"
                                  value={code}
                                  onChange={(event) => setCode(event.target.value)}
                                />
                                {error && <div className="callout-error" role="alert">{error}</div>}
                                <div className="tree-editor-actions">
                                  <button type="button" className="btn-primary" disabled={busy || !pick || !code} onClick={() => save(match)}>
                                    {busy ? 'Saving…' : 'Save'}
                                  </button>
                                  <button type="button" className="btn-ghost" onClick={() => setEditing(null)}>
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {match.declared && (
                        <div className="tree-declared">
                          <strong>Winner declared by hand: {match.declared.winner}</strong>
                          <span>
                            By {match.declared.by} · {when(match.declared.at)}
                          </span>
                          {match.declared.reason && <span>Reason: {match.declared.reason}</span>}
                        </div>
                      )}
                      {tools === match.id && (
                        <div className="tree-tools">
                          {match.declarable && declaring !== match.id && (
                            <button type="button" className="tree-declare" onClick={() => openDeclare(match)}>
                              Declare winner by hand
                            </button>
                          )}
                          {!match.declarable && !(editing && editing.matchId === match.id) && <span className="field-hint">Nothing can be changed on this match.</span>}
                          <button type="button" className="tree-close" onClick={closeTools}>
                            Done
                          </button>
                        </div>
                      )}
                      {declaring === match.id && (
                        <div className="tree-editor">
                          <span className="field-label">Who won?</span>
                          {match.slots.map((slot) => (
                            <label key={slot.side} className="check-row">
                              <input type="radio" name={`winner-${match.id}`} checked={winnerPick === slot.teamId} onChange={() => setWinnerPick(slot.teamId)} />
                              <span>{slot.name}</span>
                            </label>
                          ))}
                          <label className="field-label" htmlFor={`reason-${match.id}`}>
                            Reason (optional)
                          </label>
                          <input
                            id={`reason-${match.id}`}
                            className="text-input"
                            maxLength={300}
                            placeholder="For example: the other pair withdrew"
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                          />
                          <label className="field-label" htmlFor={`dcode-${match.id}`}>
                            Override password
                          </label>
                          <input
                            id={`dcode-${match.id}`}
                            type="password"
                            autoComplete="off"
                            className="text-input"
                            value={declCode}
                            onChange={(event) => setDeclCode(event.target.value)}
                          />
                          {declError && <div className="callout-error" role="alert">{declError}</div>}
                          <div className="tree-editor-actions">
                            <button type="button" className="btn-primary" disabled={busy || !winnerPick || !declCode} onClick={() => declare(match)}>
                              {busy ? 'Saving…' : 'Declare winner'}
                            </button>
                            <button type="button" className="btn-ghost" onClick={() => setDeclaring(null)}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      {tree.exists && (
        <p className="field-hint">
          Press Edit on a match to set a place by hand, or to declare a winner if the match is not played. Each change needs the override password, and is shown on the match with who made it and when.
        </p>
      )}
    </div>
  );
}
