import { useState } from 'react';
import { supabase } from '../supabaseClient';

function csvCell(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function matchTitle(row) {
  return `${row.team_a} vs ${row.team_b}`;
}

function whenLabel(row) {
  return [row.scheduled_date, row.scheduled_time].filter(Boolean).join(' ');
}

export default function RefereeCodes({ divisionId, divisionName }) {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function generate(regenerate) {
    if (
      regenerate &&
      !window.confirm(
        'Replace every code in this division? Any code already handed to a referee stops working.'
      )
    ) {
      return;
    }
    setBusy(true);
    setError('');
    const { data, error: rpcError } = await supabase.rpc('generate_division_otps', {
      p_division_id: divisionId,
      p_regenerate: regenerate,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setRows(data);
  }

  function downloadCsv() {
    const header = ['stage', 'group', 'team_a', 'team_b', 'court', 'date', 'time', 'code'];
    const lines = rows.map((r) =>
      [r.stage, r.group_name, r.team_a, r.team_b, r.court, r.scheduled_date, r.scheduled_time, r.code]
        .map(csvCell)
        .join(',')
    );
    const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${divisionName || 'division'}-referee-codes.csv`.replace(/\s+/g, '-');
    link.click();
    URL.revokeObjectURL(url);
  }

  function printSheet() {
    const body = rows
      .map(
        (r) => `<tr>
          <td>${escapeHtml(r.stage)}${r.group_name ? ' · ' + escapeHtml(r.group_name) : ''}</td>
          <td>${escapeHtml(matchTitle(r))}</td>
          <td>${escapeHtml(r.court)}</td>
          <td>${escapeHtml(whenLabel(r))}</td>
          <td class="code">${escapeHtml(r.code)}</td>
        </tr>`
      )
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
        p { margin: 0 0 16px; font-size: 12px; color: #555; }
        table { border-collapse: collapse; width: 100%; font-size: 13px; }
        th, td { border: 1px solid #bbb; padding: 8px 10px; text-align: left; }
        th { background: #eee; }
        .code { font-family: monospace; font-size: 18px; letter-spacing: 2px; }
      </style></head><body>
      <h1>${escapeHtml(divisionName)} referee codes</h1>
      <p>Each code unlocks scoring for one match only. Keep this sheet with the referees, not on display.</p>
      <table><thead><tr><th>Stage</th><th>Match</th><th>Court</th><th>When</th><th>Code</th></tr></thead>
      <tbody>${body}</tbody></table></body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div>
      <p className="field-hint" style={{ marginBottom: 'var(--space-3)' }}>
        Makes a 6 digit code for every unfinished match with both teams known. By default only matches
        without a code get one, so running it again never breaks codes already handed out. Codes are
        shown once, here, so download or print them before leaving this page.
      </p>

      <div className="roster-actions">
        <button type="button" className="btn-primary" disabled={busy} onClick={() => generate(false)}>
          {busy ? 'Working…' : 'Generate codes for matches without one'}
        </button>
        <button type="button" className="btn-ghost" disabled={busy} onClick={() => generate(true)}>
          Replace every code
        </button>
      </div>

      {error && (
        <div className="callout-error" style={{ marginTop: 'var(--space-3)' }}>
          {error}
        </div>
      )}

      {rows && rows.length === 0 && (
        <p className="field-hint" style={{ marginTop: 'var(--space-3)' }}>
          Nothing to generate. Every playable match already has a code, or no match has both teams
          known yet.
        </p>
      )}

      {rows && rows.length > 0 && (
        <div style={{ marginTop: 'var(--space-4)' }}>
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
                <th>Match</th>
                <th>Court</th>
                <th>When</th>
                <th>Code</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.matchup_id}>
                  <td>
                    {matchTitle(r)}
                    <span className="mist">
                      {' '}
                      · {r.stage}
                      {r.group_name ? ` · ${r.group_name}` : ''}
                    </span>
                  </td>
                  <td>{r.court || '-'}</td>
                  <td>{whenLabel(r) || '-'}</td>
                  <td className="mono">{r.code}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
