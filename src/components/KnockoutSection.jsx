import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import BracketView from './BracketView';
import R16Panel from './R16Panel';

// The knockout stage. A division with 8 or 9 groups (singles or doubles) can
// choose between the cross-group bracket and the seeded Round of 16, everything
// else gets the one bracket builder it always had.
export default function KnockoutSection({ tenantId, divisionId, division }) {
  const [status, setStatus] = useState(null);
  const [mode, setMode] = useState('cross');
  const [bracketKey, setBracketKey] = useState(0);

  const canChoose = division.format_type === 'group_then_knockout' && division.category !== 'league';

  useEffect(() => {
    if (!canChoose) return;
    let isMounted = true;
    supabase.rpc('r16_status', { p_division_id: divisionId }).then(({ data }) => {
      if (!isMounted || !data) return;
      setStatus(data);
      // a playoff only exists in the seeded format
      if (data.eligible && data.playoff_exists) setMode('seeded');
    });
    return () => {
      isMounted = false;
    };
  }, [divisionId, canChoose]);

  const eligible = canChoose && status && status.eligible;

  if (!eligible) {
    return <BracketView tenantId={tenantId} divisionId={divisionId} format={division.format_type} />;
  }

  return (
    <div>
      <div className="mode-choice" role="radiogroup" aria-label="How to build the knockout">
        <label className={`mode-card ${mode === 'cross' ? 'mode-card-on' : ''}`}>
          <input type="radio" name="koMode" checked={mode === 'cross'} onChange={() => setMode('cross')} />
          <span className="mode-title">Cross-group bracket</span>
          <span className="mode-hint">
            The top teams of each group, groups paired up so round one never repeats a group match.
          </span>
        </label>
        <label className={`mode-card ${mode === 'seeded' ? 'mode-card-on' : ''}`}>
          <input type="radio" name="koMode" checked={mode === 'seeded'} onChange={() => setMode('seeded')} />
          <span className="mode-title">Seeded Round of 16</span>
          <span className="mode-hint">
            16 teams seeded 1 to 16 from the group results. With {status.groups} groups
            {status.needs_playoff ? ', the 4 lowest runners-up play off for the last two places.' : ', the top two of every group go straight through.'}
          </span>
        </label>
      </div>

      {mode === 'seeded' && (
        <R16Panel tenantId={tenantId} divisionId={divisionId} onChanged={() => setBracketKey((k) => k + 1)} />
      )}
      <BracketView
        key={bracketKey}
        tenantId={tenantId}
        divisionId={divisionId}
        format={division.format_type}
        hideGenerate={mode === 'seeded'}
      />
    </div>
  );
}
