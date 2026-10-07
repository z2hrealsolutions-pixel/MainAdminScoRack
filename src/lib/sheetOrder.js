// The order a referee code sheet lists a scope's matches in: by court and time as the database
// gives them, and when those are equal or not set yet, round by round (Round of 16, quarterfinals,
// semifinals, final) instead of mixing the rounds together by their place in the bracket.
// The sort is stable, so inside a round the bracket order the database gave stays.

export function stageSize(stage) {
  const m = /^Round of (\d+)$/.exec(stage || '');
  if (m) return Number(m[1]);
  return { Quarterfinal: 8, Semifinal: 4, Final: 2 }[stage] || 0;
}

export function orderSheetMatches(matches) {
  const late = '\uffff';
  return [...matches].sort(
    (a, b) =>
      String(a.scheduled_date || late).localeCompare(String(b.scheduled_date || late)) ||
      String(a.scheduled_time || late).localeCompare(String(b.scheduled_time || late)) ||
      String(a.court || late).localeCompare(String(b.court || late)) ||
      stageSize(b.stage) - stageSize(a.stage)
  );
}
