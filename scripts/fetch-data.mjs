import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://api.nhle.com/stats/rest/en';
const CBS_INJURIES_URL = 'https://www.cbssports.com/nhl/injuries/';
const SEASONS = ['20232024', '20242025', '20252026'];
const PAGE_SIZE = 100;
const REQUEST_DELAY_MS = 300;

const SKATER_SCORING = {
  goals: 3,
  assists: 2,
  plusMinus: 0.5,
  penaltyMinutes: 0.2,
  hits: 0.1,
  blockedShots: 0.1,
};

const GOALIE_SCORING = {
  wins: 1,
  losses: -1,
  saves: 0.1,
  shutouts: 1,
};

const POSITION_ORDER = ['C', 'LW', 'RW', 'D', 'G'];
const PRIOR_GAMES = 41;

function normalizePosition(code) {
  if (code === 'C') return 'C';
  if (code === 'L') return 'LW';
  if (code === 'R') return 'RW';
  if (code === 'D') return 'D';
  return null;
}

const delay = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

async function fetchJson(url) {
  let lastError;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'nhl-fantasy-draft-tool/1.0' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      await delay(REQUEST_DELAY_MS);
      return await res.json();
    } catch (err) {
      lastError = err;
      await delay(attempt * attempt * 1000);
    }
  }
  throw lastError;
}

async function fetchAll(report, seasonId) {
  const rows = [];
  let start = 0;
  for (;;) {
    const params = new URLSearchParams({
      cayenneExp: `gameTypeId=2 and seasonId=${seasonId}`,
      limit: String(PAGE_SIZE),
      start: String(start),
    });
    const page = await fetchJson(`${BASE}/${report}?${params}`);
    rows.push(...page.data);
    if (!page.data || page.data.length < PAGE_SIZE) break;
    start += PAGE_SIZE;
  }
  return rows;
}

function normalizeName(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

async function fetchInjuries() {
  const res = await fetch(CBS_INJURIES_URL, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; nhl-fantasy-draft-tool/1.0)' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${CBS_INJURIES_URL}`);
  const html = await res.text();
  const strip = (value) => value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const injuries = new Map();
  const rows = html.matchAll(/<tr class="TableBase-bodyTr">([\s\S]*?)<\/tr>/g);
  for (const [, body] of rows) {
    const cells = [...body.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map((m) => strip(m[1]));
    if (cells.length < 5) continue;
    const nameMatch = body.match(/CellPlayerName--long[^>]*>\s*<span[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>/);
    const name = strip(nameMatch ? nameMatch[1] : cells[0]);
    if (!name) continue;
    injuries.set(normalizeName(name), {
      description: cells[3],
      status: cells[4],
      updatedOn: cells[2],
    });
  }
  return injuries;
}

function skaterScore(row) {
  let total = 0;
  for (const [stat, value] of Object.entries(SKATER_SCORING)) {
    total += (row[stat] ?? 0) * value;
  }
  return total;
}

function goalieScore(row) {
  let total = 0;
  for (const [stat, value] of Object.entries(GOALIE_SCORING)) {
    total += (row[stat] ?? 0) * value;
  }
  return total;
}

function round(value, places = 2) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

const players = new Map();

function getPlayer(id) {
  if (!players.has(id)) players.set(id, { id, _positions: new Set(), team: '', name: '', seasons: {} });
  return players.get(id);
}

for (const seasonId of SEASONS) {
  const [summary, realtime, goalies] = await Promise.all([
    fetchAll('skater/summary', seasonId),
    fetchAll('skater/realtime', seasonId),
    fetchAll('goalie/summary', seasonId),
  ]);

  const realtimeByPlayer = new Map(realtime.map((r) => [r.playerId, r]));

  for (const row of summary) {
    if (!(row.gamesPlayed > 0)) continue;
    const player = getPlayer(row.playerId);
    const position = normalizePosition(row.positionCode);
    if (position) player._positions.add(position);
    player.name = row.skaterFullName;
    if (row.teamAbbrevs) player.team = row.teamAbbrevs;
    const rt = realtimeByPlayer.get(row.playerId) ?? {};
    const season = {
      gamesPlayed: row.gamesPlayed,
      goals: row.goals ?? 0,
      assists: row.assists ?? 0,
      plusMinus: row.plusMinus ?? 0,
      penaltyMinutes: row.penaltyMinutes ?? 0,
      hits: rt.hits ?? 0,
      blockedShots: rt.blockedShots ?? 0,
    };
    season.overall = round(skaterScore(season));
    player.seasons[seasonId] = season;
  }

  for (const row of goalies) {
    if (!(row.gamesPlayed > 0)) continue;
    const player = getPlayer(row.playerId);
    player._positions.add('G');
    player.name = row.goalieFullName;
    if (row.teamAbbrevs) player.team = row.teamAbbrevs;
    const season = {
      gamesPlayed: row.gamesPlayed,
      wins: row.wins ?? 0,
      losses: row.losses ?? 0,
      saves: row.saves ?? 0,
      shutouts: row.shutouts ?? 0,
    };
    season.overall = round(goalieScore(season));
    player.seasons[seasonId] = season;
  }

  console.log(`${seasonId}: ${summary.length} skaters, ${goalies.length} goalies`);
}

for (const player of players.values()) {
  const played = SEASONS.map((s) => player.seasons[s]).filter((s) => s && s.gamesPlayed > 0);
  let totalGP = 0;
  let weightedSum = 0;
  for (const s of played) {
    const fppg = s.overall / s.gamesPlayed;
    totalGP += s.gamesPlayed;
    weightedSum += s.gamesPlayed * fppg;
  }
  const meanFppg = totalGP > 0 ? weightedSum / totalGP : 0;
  let variance = 0;
  for (const s of played) {
    const fppg = s.overall / s.gamesPlayed;
    variance += s.gamesPlayed * (fppg - meanFppg) ** 2;
  }
  const stdDevFppg = totalGP > 0 ? Math.sqrt(variance / totalGP) : 0;
  player._totalGP = totalGP;
  player._meanFppg = meanFppg;
  player._stdDevFppg = stdDevFppg;
  player._seasonCount = played.length;
}

const baselineTotals = {};
for (const player of players.values()) {
  const primary = [...player._positions].sort(
    (a, b) => POSITION_ORDER.indexOf(a) - POSITION_ORDER.indexOf(b)
  )[0];
  if (!primary || player._totalGP === 0) continue;
  const acc = baselineTotals[primary] ?? { gp: 0, sum: 0 };
  acc.gp += player._totalGP;
  acc.sum += player._totalGP * player._meanFppg;
  baselineTotals[primary] = acc;
}
const baselines = {};
for (const [pos, acc] of Object.entries(baselineTotals)) {
  baselines[pos] = acc.gp > 0 ? acc.sum / acc.gp : 0;
}

const injuries = await fetchInjuries().catch((err) => {
  console.warn(`Injury fetch failed, continuing without it: ${err.message}`);
  return new Map();
});

const output = [];
for (const player of players.values()) {
  const ordered = SEASONS.map((s) => player.seasons[s]).filter(Boolean);
  const last = ordered[ordered.length - 1];
  const positions = [...player._positions].sort(
    (a, b) => POSITION_ORDER.indexOf(a) - POSITION_ORDER.indexOf(b)
  );
  const primary = positions[0] ?? null;
  const mean = player._meanFppg;
  const std = player._stdDevFppg;
  const baseline = primary ? (baselines[primary] ?? 0) : 0;
  const reliability = player._totalGP / (player._totalGP + PRIOR_GAMES);
  const adjustedFppg = mean * reliability + baseline * (1 - reliability);
  const consistency =
    player._seasonCount >= 2 && mean > 0 && std > 0 ? std / mean : null;

  output.push({
    id: player.id,
    name: player.name,
    position: primary,
    positions,
    team: player.team,
    injury: injuries.get(normalizeName(player.name)) ?? null,
    goals: last.goals ?? 0,
    assists: last.assists ?? 0,
    plusMinus: last.plusMinus ?? 0,
    penaltyMinutes: last.penaltyMinutes ?? 0,
    hits: last.hits ?? 0,
    blockedShots: last.blockedShots ?? 0,
    wins: last.wins ?? 0,
    losses: last.losses ?? 0,
    saves: last.saves ?? 0,
    shutouts: last.shutouts ?? 0,
    overall: round(last.overall ?? 0),
    fppg: round(mean),
    adjustedFppg: round(adjustedFppg),
    stdDev: player._seasonCount >= 2 ? round(std) : null,
    consistency: consistency === null ? null : round(consistency, 3),
    reliability: round(reliability, 3),
    seasons: player.seasons,
  });
}

const payload = {
  generatedAt: new Date().toISOString(),
  seasons: SEASONS,
  skaterScoring: SKATER_SCORING,
  goalieScoring: GOALIE_SCORING,
  players: output,
};

const outDir = dirname(fileURLToPath(import.meta.url)).replace(/[\\/]scripts$/, '/src/data');
await mkdir(outDir, { recursive: true });
const outFile = resolve(outDir, 'players.json');
await writeFile(outFile, JSON.stringify(payload, null, 2), 'utf8');

const drafted = output.length;
const injured = output.filter((p) => p.injury).length;
const lastSeason = SEASONS[SEASONS.length - 1];
const ranked = [...output].filter((p) => p.overall > 0).sort((a, b) => b.overall - a.overall);
console.log(`Wrote ${drafted} players to ${outFile}`);
console.log(`Injuries matched: ${injured} players`);
console.log(`Top 10 by ${lastSeason} overall:`);
for (const p of ranked.slice(0, 10)) {
  console.log(`  ${p.name} (${p.position}, ${p.team}) overall=${p.overall} stdDev=${p.stdDev}`);
}