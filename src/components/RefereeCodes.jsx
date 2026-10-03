import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function whenLabel(m) {
  return [m.scheduled_date, m.scheduled_time].filter(Boolean).join(' ');
}

export default function RefereeCodes({ divisionId, divisionName }) {
  const [groups, setGroups] = useState(null);
  const [codes, setCodes] = useState({});
  const [reloadKey, setReloadKey] = useState(0);
  const [revealed, setRevealed] = useState({});
  const [custom, setCustom] = useState({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [bulk, setBulk] = useState(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      const [groupsRes, codesRes] = await Promise.all([
        supabase.from('groups').select('id, name').eq('division_id', divisionId).order('name'),
        supabase
          .from('referee_codes')
          .select('group_id, failed_attempts, locked_until, updated_at')
          .eq('division_id', divisionId),
      ]);
      if (!isMounted) return;
      const err = groupsRes.error || codesRes.error;
      if (err) {
        setError(err.message);
        return;
      }
      const byKey = {};
      codesRes.data.forEach((row) => {
        byKey[row.group_id ?? 'knockout'] = row;
      });
      setGroups(groupsRes.data);
      setCodes(byKey);
    }
    load();
    return () => {
      isMounted = false;
    };
  }, [divisionId, reloadKey]);

  const scopes = [
    ...(groups ?? []).map((g) => ({ key: g.id, groupId: g.id, label: g.name })),
    { key: 'knockout', groupId: null, label: 'Knockout stage' },
  ];

  async function callRpc(name, params) {
    setBusy(name);
    setError('');
    const result = await supabase.rpc(name, params);
    setBusy('');
    if (result.error) {
      setError(result.error.message);
      return null;
    }
    setReloadKey((k) => k + 1);
    return result;
  }

  async function handleGenerate(scope) {
    const result = await callRpc('generate_referee_code', {
      p_division_id: divisionId,
      p_group_id: scope.groupId,
    });
    if (result) setRevealed((r) => ({ ...r, [scope.key]: result.data }));
  }

  async function handleCustom(scope) {
    const result = await callRpc('set_referee_code', {
      p_division_id: divisionId,
      p_group_id: scope.groupId,
      p_otp: (custom[scope.key] ?? '').trim(),
    });
    if (result) {
      setCustom((c) => ({ ...c, [scope.key]: '' }));
      setRevealed((r) => ({ ...r, [scope.key]: '' }));
    }
  }

  async function handleClear(scope) {
    if (!window.confirm(`Remove the code for ${scope.label}? Its referees can no longer score.`)) return;
    const result = await callRpc('clear_referee_code', {
      p_division_id: divisionId,
      p_group_id: scope.groupId,
    });
    if (result) setRevealed((r) => ({ ...r, [scope.key]: '' }));
  }

  async function handleBulk(regenerate) {
    if (
      regenerate &&
      !window.confirm(
        'Replace every code in this division? Any code already handed to a referee stops working.'
      )
    ) {
      return;
    }
    const result = await callRpc('generate_division_referee_codes', {
      p_division_id: divisionId,
      p_regenerate: regenerate,
    });
    if (result) {
      setBulk(result.data);
      setRevealed({});
    }
  }

  function downloadCsv() {
    const header = ['scope', 'code', 'stage', 'team_a', 'team_b', 'court', 'date', 'time'];
    const lines = [];
    bulk.forEach((s) => {
      if (s.matches.length === 0) {
        lines.push([s.scope, s.code, '', '', '', '', '', ''].map(csvCell).join(','));
      }
      s.matches.forEach((m) =>
        lines.push(
          [s.scope, s.code, m.stage, m.team_a, m.team_b, m.court, m.scheduled_date, m.scheduled_time]
            .map(csvCell)
            .join(',')
        )
      );
    });
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${divisionName || 'division'}-referee-codes.csv`.replace(/\s+/g, '-');
    link.click();
    URL.revokeObjectURL(url);
  }

  function printSheet() {
    const sections = bulk
      .map((s) => {
        const rows = s.matches
          .map(
            (m) => `<tr><td>${escapeHtml(m.stage)}</td><td>${escapeHtml(m.team_a)} vs ${escapeHtml(m.team_b)}</td>
              <td>${escapeHtml(m.court)}</td><td>${escapeHtml(whenLabel(m))}</td></tr>`
          )
          .join('');
        return `<section><h2>${escapeHtml(s.scope)} <span class="code">${escapeHtml(s.code)}</span></h2>
          <table><thead><tr><th>Stage</th><th>Match</th><th>Court</th><th>When</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4">No matches yet</td></tr>'}</tbody></table></section>`;
      })
      .join('');
    const win = window.open('', '_blank');
    if (!win) {
      setError('Your browser blocked the print window. Allow pop-ups for this site, or use the CSV.');
      return;
    }
    win.document.write(`<!doctype html><html><head><title>Referee codes</title>
      <style>
        body { font-family: sans-serif; padding: 24px; color: #111; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        h2 { font-size: 15px; margin: 22px 0 8px; }
        p { margin: 0 0 8px; font-size: 12px; color: #555; }
        table { border-collapse: collapse; width: 100%; font-size: 13px; }
        th, td { border: 1px solid #bbb; padding: 6px 10px; text-align: left; }
        th { background: #eee; }
        .code { font-family: monospace; font-size: 20px; letter-spacing: 3px; margin-left: 12px; }
        section { page-break-inside: avoid; }
      </style></head><body>
      <h1>${escapeHtml(divisionName)} referee codes</h1>
      <p>One code covers every match listed under it. Keep this sheet with the referees, not on display.</p>
      ${sections}</body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div>
      <p className="field-hint" style={{ marginBottom: 'var(--space-3)' }}>
        One code per group: whoever scores Group A uses the same code for every Group A match. The
        knockout stage has one code of its own. Codes are shown once and stored scrambled, so write
        them down or print them before leaving this page.
      </p>

      {error && <div className="callout-error">{error}</div>}

      <div className="roster-actions" style={{ marginBottom: 'var(--space-4)' }}>
        <button type="button" className="btn-primary" disabled={Boolean(busy)} onClick={() => handleBulk(false)}>
          {busy === 'generate_division_referee_codes' ? 'Working…' : 'Generate codes for everything without one'}
        </button>
        <button type="button" className="btn-ghost" disabled={Boolean(busy)} onClick={() => handleBulk(true)}>
          Replace every code
        </button>
      </div>

      {bulk && bulk.length === 0 && (
        <p className="field-hint" style={{ marginBottom: 'var(--space-4)' }}>
          Nothing to generate, every group and the knockout stage already has a code.
        </p>
      )}

      {bulk && bulk.length > 0 && (
        <div style={{ marginBottom: 'var(--space-5)' }}>
          <div className="roster-actions" style={{ marginBottom: 'var(--space-3)' }}>
            <button type="button" className="btn-ghost" onClick={downloadCsv}>
              Download CSV
            </button>
            <button type="button" className="btn-ghost" onClick={printSheet}>
              Print sheet
            </button>
          </div>
          <table className="csv-preview-table">
            <thead>
              <tr>
                <th>Covers</th>
                <th>Matches</th>
                <th>Code</th>
              </tr>
            </thead>
            <tbody>
              {bulk.map((s) => (
                <tr key={s.scope}>
                  <td>{s.scope}</td>
                  <td>{s.matches.length}</td>
                  <td className="mono">{s.code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {groups === null && <p className="tenants-empty mono">Loading…</p>}

      {groups && groups.length === 0 && (
        <p className="field-hint" style={{ marginBottom: 'var(--space-3)' }}>
          No groups yet. Generate groups first to get one code per group.
        </p>
      )}

      {groups &&
        scopes.map((scope) => {
          const row = codes[scope.key];
          const locked = row?.locked_until && new Date(row.locked_until) > new Date();
          return (
            <div key={scope.key} className="code-scope">
              <div className="code-scope-head">
                <span className="code-scope-name">{scope.label}</span>
                <span className="field-hint">
                  {!row && 'No code yet'}
                  {row && !locked && 'Code set'}
                  {locked && `Locked until ${new Date(row.locked_until).toLocaleTimeString()}`}
                </span>
              </div>

              {locked && (
                <div className="callout-error" style={{ marginBottom: 'var(--space-2)' }}>
                  Locked after too many wrong guesses. Generating a new code unlocks it straight away.
                </div>
              )}

              {revealed[scope.key] && (
                <div className="code-reveal">
                  <span className="code-reveal-code mono">{revealed[scope.key]}</span>
                  <span className="field-hint">Note this down now. It won't be shown again.</span>
                </div>
              )}

              <div className="roster-actions">
                <button
                  type="button"
                  className={row ? 'btn-ghost' : 'btn-primary'}
                  disabled={Boolean(busy)}
                  onClick={() => handleGenerate(scope)}
                >
                  {row ? 'Generate a new code' : 'Generate code'}
                </button>
                {row && (
                  <button type="button" className="btn-ghost" disabled={Boolean(busy)} onClick={() => handleClear(scope)}>
                    Remove code
                  </button>
                )}
              </div>
              <div className="code-custom-row">
                <input
                  className="text-input mono"
                  inputMode="numeric"
                  placeholder="Or choose 4 to 8 digits"
                  value={custom[scope.key] ?? ''}
                  onChange={(event) => setCustom((c) => ({ ...c, [scope.key]: event.target.value }))}
                />
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={Boolean(busy) || !/^[0-9]{4,8}$/.test((custom[scope.key] ?? '').trim())}
                  onClick={() => handleCustom(scope)}
                >
                  Use this code
                </button>
              </div>
            </div>
          );
        })}
    </div>
  );
}
