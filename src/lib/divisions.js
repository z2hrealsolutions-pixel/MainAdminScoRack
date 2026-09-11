export const CATEGORIES = [
  { value: 'singles', label: 'Singles' },
  { value: 'doubles', label: 'Doubles' },
  { value: 'league', label: 'League' },
];

export const FORMATS = [
  { value: 'knockout', label: 'Knockout' },
  { value: 'group_then_knockout', label: 'Group stage then knockout' },
];

export function categoryLabel(value) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function formatLabel(value) {
  return FORMATS.find((f) => f.value === value)?.label ?? value;
}
