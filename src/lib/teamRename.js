// the words for what rename_team hands back
export function renameErrorText(res) {
  if (!res || res.ok) return '';
  switch (res.error) {
    case 'name_empty':
      return 'Type a name first.';
    case 'name_too_long':
      return 'That name is too long. Keep it under 120 characters.';
    case 'name_taken':
      return 'Another team in this division already has that name.';
    case 'override_not_set':
      return 'The bracket has been created, so changing a name needs the override password, and none has been set for this tenant yet. Ask the ScoreIt team.';
    case 'override_invalid':
      return `That override password is not right. ${res.attempts_left} ${res.attempts_left === 1 ? 'try' : 'tries'} left.`;
    case 'override_locked': {
      const mins = Math.max(1, Math.ceil((res.retry_after_seconds || 60) / 60));
      return `Too many wrong tries. Wait ${mins} minute${mins === 1 ? '' : 's'} and try again.`;
    }
    default:
      return 'Something went wrong. Try again.';
  }
}
