export const SPORTS = [
  { value: 'pickleball', label: 'Pickleball' },
  { value: 'padel', label: 'Padel' },
  { value: 'badminton', label: 'Badminton' },
  { value: 'tennis', label: 'Tennis' },
  { value: 'table_tennis', label: 'Table tennis' },
  { value: 'squash', label: 'Squash' },
];

export function sportLabel(value) {
  return SPORTS.find((sport) => sport.value === value)?.label ?? value;
}
