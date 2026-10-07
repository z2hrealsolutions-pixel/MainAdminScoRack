import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { sizesDiffer } from '../lib/bracketChoice';
import BracketView from './BracketView';
import CustomBracketPanel from './CustomBracketPanel';
import R16Panel from './R16Panel';

// The knockout stage of a division that plays groups first. There are three ways to build it:
//   the same number of teams from every group (the cross-group bracket),
//   a number chosen for each group, which works for groups of any size,
//   and the seeded Round of 16 for 8 or 9 groups.
// A division that is not played in groups gets the one bracket builder it always had.
export default function KnockoutSection({ tenantId, divisionId, division }) {
  const [status, setStatus] = useState(null);
  const [mode, setMode] = useState(null);
  const [bracketKey, setBracketKey] = useState(0);
  const [info, setInfo] = useState(null);

  const canChoose = division.format_type === 'group_then_knockout' && division.category !== 'league';

  const loadInfo = useCallback(async () => {
    const [groupsRes, teamsRes, koRes] = await Promise.all([
      supabase.from('groups').select('id, name, is_playoff').eq('division_id', divisionId).order('name'),
      supabase.from('teams').select('id, group_id').eq('division_id', divisionId),
      supabase.from('matchups').select('id, status').eq('division_id', divisionId).is('group_id', null),
    ]);
    if (groupsRes.error || teamsRes.error || koRes.error) return;
    const sizes = {};
    teamsRes.data.forEach((t) => {
      if (t.group_id) sizes[t.group_id] = (sizes[t.group_id] || 0) + 1;
    });
    const groups = groupsRes.data.filter((g) => !g.is_playoff).map((g) => ({ id: g.id, name: g.name, size: sizes[g.id] || 0 }));
    setInfo({
      groups,
      knockout: {
        exists: koRes.data.length > 0,
        hasResults: koRes.data.some((m) => m.status === 'complete' || m.status === 'live'),
      },
    });
  }, [divisionId]);

  useEffect(() => {
    if (!canChoose) return undefined;
    let isMounted = true;
    loadInfo();
    supabase.rpc('r16_status', { p_division_id: divisionId }).then(({ data }) => {
      if (isMounted && data) setStatus(data);
    });
    return () => {
      isMounted = false;
    };
  }, [divisionId, canChoose, loadInfo]);

  const r16 = canChoose && status && status.eligible;
  const hasGroups = canChoose && info && info.groups.length > 0;

  // where to start: a playoff only exists in the seeded format, groups of different sizes need a number
  // chosen for each group, and anything else keeps the builder it always had
  const unequal = hasGroups && sizesDiffer(info.groups);
  const chosen = mode || (r16 && status.playoff_exists ? 'seeded' : unequal ? 'custom' : 'cross');

  if (!hasGroups) {
    return <BracketView tenantId={tenantId} divisionId={divisionId} format={division.format_type} />;
  }

  const refresh = () => {
    setBracketKey((k) => k + 1);
    loadInfo();
  };

  return (
    <div>
      <div className="mode-choice" role="radiogroup" aria-label="How to build the knockout">
        <label className={`mode-card ${chosen === 'cross' ? 'mode-card-on' : ''}`}>
          <input type="radio" name="koMode" checked={chosen === 'cross'} onChange={() => setMode('cross')} />
          <span className="mode-title">Cross-group bracket</span>
          <span className="mode-hint">
            The same number of top teams from every group, groups paired up so round one never repeats a group match.
          </span>
        </label>
        <label className={`mode-card ${chosen === 'custom' ? 'mode-card-on' : ''}`}>
          <input type="radio" name="koMode" checked={chosen === 'custom'} onChange={() => setMode('custom')} />
          <span className="mode-title">Choose per group</span>
          <span className="mode-hint">
            Pick how many teams go through from each group, for groups of any size. Seeded by place, win percentage and
            point difference, with byes if the bracket is not full.
          </span>
        </label>
        {r16 && (
          <label className={`mode-card ${chosen === 'seeded' ? 'mode-card-on' : ''}`}>
            <input type="radio" name="koMode" checked={chosen === 'seeded'} onChange={() => setMode('seeded')} />
            <span className="mode-title">Seeded Round of 16</span>
            <span className="mode-hint">
              16 teams seeded 1 to 16 from the group results. With {status.groups} groups
              {status.needs_playoff ? ', the 4 lowest runners-up play off for the last two places.' : ', the top two of every group go straight through.'}
            </span>
          </label>
        )}
      </div>

      {chosen === 'seeded' && <R16Panel tenantId={tenantId} divisionId={divisionId} onChanged={refresh} />}
      {chosen === 'custom' && (
        <CustomBracketPanel
          tenantId={tenantId}
          divisionId={divisionId}
          groups={info.groups}
          knockout={info.knockout}
          onChanged={refresh}
        />
      )}
      <BracketView
        key={bracketKey}
        tenantId={tenantId}
        divisionId={divisionId}
        format={division.format_type}
        hideGenerate={chosen === 'seeded' || chosen === 'custom'}
      />
    </div>
  );
}
