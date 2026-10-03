// DNL's real rubber taxonomy. These exact strings are what the
// standings view counts as singles or doubles wins, so keep them in
// step with scorack_phase1h_results.sql if either changes.
export const RUBBER_TYPES = [
  { value: 'mens_singles', label: "Men's singles" },
  { value: 'womens_singles', label: "Women's singles" },
  { value: 'mens_doubles', label: "Men's doubles" },
  { value: 'womens_doubles', label: "Women's doubles" },
  { value: 'mixed_doubles', label: 'Mixed doubles' },
  { value: 'mixed_45_doubles', label: 'Mixed 45+ doubles' },
];

export function rubberLabel(value) {
  return RUBBER_TYPES.find((type) => type.value === value)?.label ?? value;
}
