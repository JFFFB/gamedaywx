async function fetchLiveNcaaSchedule({ week = 13, dates = null, seasonYear = 2026 } = {}) {
  const params = new URLSearchParams({
    seasontype: '2',
    limit: '100'
  });

  if (dates) {
    params.set('dates', String(dates));
  } else {
    params.set('week', String(week));
    params.set('dates', String(seasonYear));
  }

  const url = `${ESPN_CFB_SCOREBOARD}?${params.toString()}`;
  const storageKey = `gamedaywx_schedule_${seasonYear}_w${week}_${dates || 'all'}`;
  // ... same fetch, cache, and fallback logic
}