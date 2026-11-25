// Ready-made formats a division can start from. A preset sets three things together: how each stage is
// played (points, win by, sets), how a tie in the group table is broken, and which teams meet in the knockout.
// The knockout is a template: "g1p1" is group 1's first place, "best3r1" the best of all the third placed teams,
// {"w":[round, match]} the winner of an earlier match (rounds and matches counted from 0).

const w = (r, m) => ({ w: [r, m] });

const SETS = (target = 11) => ({ target, win_by: 2, best_of: 3 });
const GAME = (target) => ({ target, win_by: 2, best_of: 1 });

// two pools, the top two cross over into semi finals, then the final
const CROSS_SEMIS = {
  rounds: [
    [
      { a: 'g1p1', b: 'g2p2' },
      { a: 'g2p1', b: 'g1p2' },
    ],
    [{ a: w(0, 0), b: w(0, 1) }],
  ],
};

export const PRESETS = [
  {
    key: 'playful',
    label: 'Playful Divas',
    summary: '3 pools of 5. Top 2 of each pool and the two best 3rd placed teams go to the quarter finals.',
    tiebreak: 'points',
    rules: { group: GAME(11), qf: GAME(15), sf: SETS(), final: SETS() },
    template: {
      rounds: [
        [
          { a: 'g1p1', b: 'best3r1' },
          { a: 'g2p1', b: 'best3r2' },
          { a: 'g3p1', b: 'g2p2' },
          { a: 'g1p2', b: 'g3p2' },
        ],
        [
          { a: w(0, 0), b: w(0, 2) },
          { a: w(0, 1), b: w(0, 3) },
        ],
        [{ a: w(1, 0), b: w(1, 1) }],
      ],
    },
  },
  {
    key: 'precision',
    label: 'Precision Divas',
    summary: '2 pools of 3. Top 2 of each pool to the semi finals.',
    tiebreak: 'points',
    rules: { group: GAME(15), sf: SETS(), final: SETS() },
    template: CROSS_SEMIS,
  },
  {
    key: 'power',
    label: 'Power Divas',
    summary: '1 pool of 5. Top 4 to the semi finals (1 v 4, 2 v 3).',
    tiebreak: 'points',
    rules: { group: GAME(15), sf: SETS(), final: SETS() },
    template: {
      rounds: [
        [
          { a: 'g1p1', b: 'g1p4' },
          { a: 'g1p2', b: 'g1p3' },
        ],
        [{ a: w(0, 0), b: w(0, 1) }],
      ],
    },
  },
  {
    key: 'timeless',
    label: 'Timeless Divas',
    summary: '2 pools of 4. Top 2 of each pool to the semi finals.',
    tiebreak: 'points',
    rules: { group: GAME(15), sf: SETS(), final: SETS() },
    template: CROSS_SEMIS,
  },
  {
    key: 'solo',
    label: 'Solo Divas',
    summary: 'Singles. 2 pools of 3. Top 2 of each pool to the semi finals.',
    tiebreak: 'points',
    rules: { group: GAME(11), sf: SETS(), final: SETS() },
    template: CROSS_SEMIS,
  },
  {
    key: 'rising',
    label: 'Rising Divas',
    summary: '2 pools of 3. Top 2 of each pool to the semi finals.',
    tiebreak: 'points',
    rules: { group: GAME(11), sf: SETS(), final: SETS() },
    template: CROSS_SEMIS,
  },
];

export function presetByKey(key) {
  return PRESETS.find((p) => p.key === key) || null;
}

// the stages a division can set a format for, in the order they are played
export const STAGES = [
  { key: 'group', label: 'Group games', sets: false },
  { key: 'qf', label: 'Quarter finals', sets: true },
  { key: 'sf', label: 'Semi finals', sets: true },
  { key: 'final', label: 'Final', sets: true },
];

export function describeRule(rule) {
  if (!rule || (!rule.target && !rule.best_of)) return 'Not set, any score can finish a game';
  const parts = [];
  const sets = rule.best_of && rule.best_of > 1;
  parts.push(sets ? `Best of ${rule.best_of} sets, each set to ${rule.target || '?'}` : `One game to ${rule.target || '?'}`);
  parts.push(rule.win_by && rule.win_by > 1 ? `win by ${rule.win_by}` : 'no win by rule');
  return parts.join(', ');
}
