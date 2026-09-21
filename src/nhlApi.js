const BASE = 'https://api.nhle.com/stats/rest/en';
const PAGE_SIZE = 100;

function round2(value) {
  return Math.round(value * 100) / 100;
}

export function getCurrentSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const start = month >= 10 ? year : year - 1;
  return `${start}${start + 1}`;
}

export function seasonLabel(seasonId) {
  return `${seasonId.slice(0, 4)}-${seasonId.slice(4)}`;
}

async function fetchPages(report, seasonId) {
  const rows = [];
  let start = 0;
  for (;;) {
    const params = new URLSearchParams({
      cayenneExp: `gameTypeId=2 and seasonId=${seasonId}`,
      limit: String(PAGE_SIZE),
      start: String(start),
    });
    let res;
    try {
      res = await fetch(`${BASE}/${report}?${params}`, {
        headers: { 'User-Agent': 'nhl-fantasy-draft-tool/1.0' },
      });
    } catch {
      throw new Error('Network error fetching NHL stats');
    }
    if (!res.ok) {
      if (res.status === 500) break;
      throw new Error(`HTTP ${res.status}`);
    }
    const page = await res.json();
    rows.push(...page.data);
    if (!page.data || page.data.length < PAGE_SIZE) break;
    start += PAGE_SIZE;
  }
  return rows;
}

function score(row, scoring) {
  let total = 0;
  for (const [stat, value] of Object.entries(scoring)) {
    total += (row[stat] ?? 0) * value;
  }
  return total;
}

export async function fetchLiveSeasonStats(seasonId, skaterScoring, goalieScoring) {
  const [summary, realtime, goalies] = await Promise.all([
    fetchPages('skater/summary', seasonId),
    fetchPages('skater/realtime', seasonId),
    fetchPages('goalie/summary', seasonId),
  ]);

  const realtimeByPlayer = new Map(realtime.map((row) => [row.playerId, row]));
  const map = new Map();

  for (const row of summary) {
    if (!(row.gamesPlayed > 0)) continue;
    const rt = realtimeByPlayer.get(row.playerId) ?? {};
    const merged = { ...row, hits: rt.hits ?? 0, blockedShots: rt.blockedShots ?? 0 };
    const total = score(merged, skaterScoring);
    map.set(row.playerId, { gamesPlayed: row.gamesPlayed, total: round2(total) });
  }

  for (const row of goalies) {
    if (!(row.gamesPlayed > 0)) continue;
    const total = score(row, goalieScoring);
    map.set(row.playerId, { gamesPlayed: row.gamesPlayed, total: round2(total) });
  }

  return map;
}