import { useState } from 'react';
import { supabase } from '../supabaseClient';

export default function MatchupSchedule({ matchupId, court, date, time, onSaved }) {
  const [form, setForm] = useState({
    court: court ?? '',
    date: date ?? '',
    time: time ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dirty =
    form.court !== (court ?? '') || form.date !== (date ?? '') || form.time !== (time ?? '');

  async function handleSave() {
    setSaving(true);
    setError('');
    const { error: saveError } = await supabase
      .from('matchups')
      .update({
        court: form.court.trim() || null,
        scheduled_date: form.date || null,
        scheduled_time: form.time.trim() || null,
      })
      .eq('id', matchupId);
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    onSaved();
  }

  return (
    <div>
      <div className="schedule-row">
        <div>
          <label className="field-label" htmlFor="court">
            Court
          </label>
          <input
            id="court"
            className="text-input"
            placeholder="Court 3"
            value={form.court}
            onChange={(event) => setForm({ ...form, court: event.target.value })}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="matchDate">
            Date
          </label>
          <input
            id="matchDate"
            type="date"
            className="text-input"
            value={form.date}
            onChange={(event) => setForm({ ...form, date: event.target.value })}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="matchTime">
            Time
          </label>
          <input
            id="matchTime"
            className="text-input"
            placeholder="18:30"
            value={form.time}
            onChange={(event) => setForm({ ...form, time: event.target.value })}
          />
        </div>
      </div>
      {error && <div className="callout-error">{error}</div>}
      <button
        type="button"
        className="btn-primary"
        style={{ marginTop: 'var(--space-3)' }}
        disabled={!dirty || saving}
        onClick={handleSave}
      >
        {saving ? 'Saving…' : 'Save schedule'}
      </button>
    </div>
  );
}
