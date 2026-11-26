// The tenants' sign-in page asks the database "does this email already have access to an event?" before it sends a
// link. These turn that answer into the words on the page. Pure, so they can be tested.

export function eventList(names) {
  const list = (Array.isArray(names) ? names : []).filter(Boolean);
  if (list.length === 0) return '';
  if (list.length === 1) return list[0];
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

// answer of rent_login_check when the email has no access
export function noAccessMessage(code) {
  switch (code) {
    case 'blocked':
      return 'Access for this email has been blocked. Contact the ScoreIt team.';
    case 'slow_down':
      return 'Too many tries. Wait a few minutes and try again.';
    case 'bad_email':
      return 'That does not look like an email address.';
    default:
      return "This email hasn't been given access to an event yet. Ask the event owner or the ScoreIt team to add it.";
  }
}

// the link could not be sent although the email has access
export function linkErrorMessage(error) {
  const text = String((error && error.message) || '');
  if (/signups not allowed|user not found|not allowed for otp/i.test(text)) {
    return "Your access is ready, but your account isn't set up yet. Ask the event owner to resend your invitation.";
  }
  if (/rate limit|too many/i.test(text)) return 'Too many emails were sent. Wait a few minutes and try again.';
  return text || 'The link could not be sent. Try again.';
}

export function sentMessage(names, email) {
  const events = eventList(names);
  return {
    found: events ? `Found: ${events}.` : '',
    body: `We emailed a one-time link to ${email}. Open it to log in to ${events ? 'your event' : 'your event'}. It can take a minute and may land in spam, and it expires after an hour.`,
  };
}
