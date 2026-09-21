import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchLiveSeasonStats, getCurrentSeason, seasonLabel } from '../nhlApi.js';

const POSITION_LABELS = {
  C: 'Center',
  LW: 'Left Wing',
  RW: 'Right Wing',
  D: 'Defense',
  G: 'Goalie',
};

const STORAGE_KEYS = {
  mine: 'nhl-fantasy-draft:trades:v1:mine',
  theirs: 'nhl-fantasy-draft:trades:v1:theirs',
};

function loadList(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function formatNumber(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  if (Number.isInteger(value)) return String(value);
  return String(+value.toFixed(2));
}

function SearchPicker({ players, byId, onAdd, taken }) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const suggestions = useMemo(() => {
    if (!needle) return [];
    return players
      .filter((p) => p.name.toLowerCase().includes(needle))
      .filter((p) => !taken.has(p.id))
      .slice(0, 8);
  }, [players, needle, taken]);

  return (
    <div className="trade-picker">
      <input
        type="search"
        className="search"
        placeholder="Search players to add…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {needle && (
        <div className="trade-suggestions">
          {suggestions.length === 0 ? (
            <div className="trade-suggestions-empty">No matches (already added are excluded)</div>
          ) : (
            suggestions.map((p) => (
              <button
                key={p.id}
                type="button"
                className="trade-suggestion"
                onClick={() => {
                  onAdd(p.id);
                  setQuery('');
                }}
              >
                <span>{p.name}</span>
                <span className="pos-badges">
                  {p.positions.map((pos) => (
                    <span key={pos} className={`pos-badge pos-${pos.toLowerCase()}`}>
                      {pos}
                    </span>
                  ))}
                </span>
                <span className="trade-suggestion-team">{p.team}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function TradeAnalyzer({ players, skaterScoring, goalieScoring }) {
  const [mine, setMine] = useState(() => loadList(STORAGE_KEYS.mine));
  const [theirs, setTheirs] = useState(() => loadList(STORAGE_KEYS.theirs));
  const [liveStats, setLiveStats] = useState(null);
  const [season, setSeason] = useState(() => getCurrentSeason());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const loadedSeason = useRef(null);

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  useEffect(() => {
    if (loadedSeason.current === season) return;
    loadedSeason.current = season;
    let alive = true;
    setLoading(true);
    setError(null);
    fetchLiveSeasonStats(season, skaterScoring, goalieScoring)
      .then((map) => {
        if (!alive) return;
        setLiveStats(map);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err.message);
        setLiveStats(new Map());
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [season, skaterScoring, goalieScoring]);

  const persist = (side, next) => {
    localStorage.setItem(STORAGE_KEYS[side], JSON.stringify(next));
  };

  const addPlayer = (side, id) => {
    if (mine.includes(id) || theirs.includes(id)) return;
    if (side === 'mine') {
      setMine((prev) => {
        const next = [...prev, id];
        persist('mine', next);
        return next;
      });
    } else {
      setTheirs((prev) => {
        const next = [...prev, id];
        persist('theirs', next);
        return next;
      });
    }
  };

  const removePlayer = (side, id) => {
    if (side === 'mine') {
      setMine((prev) => {
        const next = prev.filter((x) => x !== id);
        persist('mine', next);
        return next;
      });
    } else {
      setTheirs((prev) => {
        const next = prev.filter((x) => x !== id);
        persist('theirs', next);
        return next;
      });
    }
  };

  const resolve = (id) => {
    const player = byId.get(id);
    const live = liveStats ? liveStats.get(id) : undefined;
    if (player && live) {
      return {
        player,
        source: 'live',
        gp: live.gamesPlayed,
        total: live.total,
        fppg: live.total / live.gamesPlayed,
      };
    }
    if (player) {
      return {
        player,
        source: 'last',
        gp: null,
        total: player.overall,
        fppg: player.fppg,
      };
    }
    return { player: null, source: null, gp: null, total: null, fppg: null };
  };

  const sideRows = (ids) => ids.map((id) => resolve(id)).filter((r) => r.player);

  const summary = (rows) => {
    const liveRows = rows.filter((r) => r.source === 'live');
    const anyLive = liveRows.length > 0;
    const counted = anyLive ? liveRows : rows;
    const total = counted.reduce((a, r) => a + (r.total ?? 0), 0);
    const fppgSum = counted.reduce((a, r) => a + (r.fppg ?? 0), 0);
    const count = counted.length;
    const forecastSum = rows.reduce((a, r) => a + (r.player.adjustedFppg ?? 0), 0);
    return {
      anyLive,
      total,
      avgFppg: count ? fppgSum / count : 0,
      avgForecast: rows.length ? forecastSum / rows.length : 0,
    };
  };

  const mineRows = sideRows(mine);
  const theirsRows = sideRows(theirs);
  const mineSum = summary(mineRows);
  const theirsSum = summary(theirsRows);
  const totalDelta = theirsSum.total - mineSum.total;
  const forecastDelta = theirsSum.avgForecast - mineSum.avgForecast;

  const taken = useMemo(() => new Set([...mine, ...theirs]), [mine, theirs]);

  return (
    <div className="trade-view">
      <div className="trade-header">
        <h2>Trade Analyzer</h2>
        <p className="byline">
          Live fantasy points for {seasonLabel(season)}
          {error ? ` · refresh failed (${error}) — showing last season's stats` : loading ? ' · loading…' : ' · refreshed on this visit'}
        </p>
      </div>

      {loading && <div className="trade-banner">Fetching live stats for {seasonLabel(season)}…</div>}
      {!loading && !error && liveStats && liveStats.size === 0 && (
        <div className="trade-banner">
          No games recorded yet for {seasonLabel(season)} — showing last season&apos;s totals from the draft data.
        </div>
      )}

      <div className="trade-columns">
        <section className="trade-side">
          <div className="trade-side-header">
            <span className="trade-side-title">Your Players</span>
            <span className="trade-side-count">{mineRows.length} player{mineRows.length === 1 ? '' : 's'}</span>
          </div>
          <SearchPicker players={players} byId={byId} onAdd={(id) => addPlayer('mine', id)} taken={taken} />
          <div className={`trade-rows${mineRows.length === 0 ? ' trade-rows-empty' : ''}`}>
            {mineRows.length === 0 ? (
              <div className="trade-empty">Add players above to build this side.</div>
            ) : (
              mineRows.map(({ player, source, gp, total, fppg }) => (
                <div key={player.id} className="trade-row">
                  <button
                    type="button"
                    className="trade-row-remove"
                    onClick={() => removePlayer('mine', player.id)}
                    title={`Remove ${player.name}`}
                  >
                    ×
                  </button>
                  <div className="trade-row-main">
                    <span className="trade-row-name">{player.name}</span>
                    <span className="pos-badges">
                      {player.positions.map((pos) => (
                        <span key={pos} title={`${POSITION_LABELS[pos] ?? pos}`} className={`pos-badge pos-${pos.toLowerCase()}`}>
                          {pos}
                        </span>
                      ))}
                    </span>
                  </div>
                  <div className="trade-row-stats">
                    {source === 'live' ? (
                      <>
                        <span className="trade-stat" title="Games played this season">
                          <span className="trade-stat-label">GP</span>
                          {gp}
                        </span>
                        <span className="trade-stat" title="Season-to-date fantasy points">
                          <span className="trade-stat-label">FP</span>
                          {formatNumber(total)}
                        </span>
                        <span className="trade-stat" title="Season-to-date fantasy points per game">
                          <span className="trade-stat-label">FPPG</span>
                          {formatNumber(fppg)}
                        </span>
                      </>
                    ) : (
                      <span className="trade-stat trade-stat-last" title="No games this season yet — last season's total">
                        <span className="trade-stat-label">Last FP</span>
                        {formatNumber(total)}
                      </span>
                    )}
                    <span className="trade-stat" title="Projected FPPG (Forecast from draft data)">
                      <span className="trade-stat-label">Proj</span>
                      {formatNumber(player.adjustedFppg)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          {mineRows.length > 0 && (
            <div className="trade-totals">
              <div className="trade-total">
                <span>Total fantasy points {mineSum.anyLive ? '(live)' : '(last season)'}</span>
                <strong>{formatNumber(mineSum.total)}</strong>
              </div>
              <div className="trade-total">
                <span>Avg FPPG {mineSum.anyLive ? '(live)' : '(3-season)'}</span>
                <strong>{formatNumber(mineSum.avgFppg)}</strong>
              </div>
              <div className="trade-total">
                <span>Avg Forecast</span>
                <strong>{formatNumber(mineSum.avgForecast)}</strong>
              </div>
            </div>
          )}
        </section>

        <section className="trade-side">
          <div className="trade-side-header">
            <span className="trade-side-title">Their Players</span>
            <span className="trade-side-count">{theirsRows.length} player{theirsRows.length === 1 ? '' : 's'}</span>
          </div>
          <SearchPicker players={players} byId={byId} onAdd={(id) => addPlayer('theirs', id)} taken={taken} />
          <div className={`trade-rows${theirsRows.length === 0 ? ' trade-rows-empty' : ''}`}>
            {theirsRows.length === 0 ? (
              <div className="trade-empty">Add players above to build this side.</div>
            ) : (
              theirsRows.map(({ player, source, gp, total, fppg }) => (
                <div key={player.id} className="trade-row">
                  <button
                    type="button"
                    className="trade-row-remove"
                    onClick={() => removePlayer('theirs', player.id)}
                    title={`Remove ${player.name}`}
                  >
                    ×
                  </button>
                  <div className="trade-row-main">
                    <span className="trade-row-name">{player.name}</span>
                    <span className="pos-badges">
                      {player.positions.map((pos) => (
                        <span key={pos} title={`${POSITION_LABELS[pos] ?? pos}`} className={`pos-badge pos-${pos.toLowerCase()}`}>
                          {pos}
                        </span>
                      ))}
                    </span>
                  </div>
                  <div className="trade-row-stats">
                    {source === 'live' ? (
                      <>
                        <span className="trade-stat" title="Games played this season">
                          <span className="trade-stat-label">GP</span>
                          {gp}
                        </span>
                        <span className="trade-stat" title="Season-to-date fantasy points">
                          <span className="trade-stat-label">FP</span>
                          {formatNumber(total)}
                        </span>
                        <span className="trade-stat" title="Season-to-date fantasy points per game">
                          <span className="trade-stat-label">FPPG</span>
                          {formatNumber(fppg)}
                        </span>
                      </>
                    ) : (
                      <span className="trade-stat trade-stat-last" title="No games this season yet — last season's total">
                        <span className="trade-stat-label">Last FP</span>
                        {formatNumber(total)}
                      </span>
                    )}
                    <span className="trade-stat" title="Projected FPPG (Forecast from draft data)">
                      <span className="trade-stat-label">Proj</span>
                      {formatNumber(player.adjustedFppg)}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
          {theirsRows.length > 0 && (
            <div className="trade-totals">
              <div className="trade-total">
                <span>Total fantasy points {theirsSum.anyLive ? '(live)' : '(last season)'}</span>
                <strong>{formatNumber(theirsSum.total)}</strong>
              </div>
              <div className="trade-total">
                <span>Avg FPPG {theirsSum.anyLive ? '(live)' : '(3-season)'}</span>
                <strong>{formatNumber(theirsSum.avgFppg)}</strong>
              </div>
              <div className="trade-total">
                <span>Avg Forecast</span>
                <strong>{formatNumber(theirsSum.avgForecast)}</strong>
              </div>
            </div>
          )}
        </section>
      </div>

      <div className="trade-verdict">
        {mineRows.length > 0 && theirsRows.length > 0 && (
          <>
            <h3 className="trade-verdict-title">If this trade goes through</h3>
            <div className="trade-verdict-line">
              <span>Net fantasy points change (You gain − You give)</span>
              <strong className={totalDelta > 0 ? 'good' : totalDelta < 0 ? 'bad' : ''}>
                {totalDelta > 0 ? '+' : ''}{formatNumber(totalDelta)}
              </strong>
            </div>
            <div className="trade-verdict-line">
              <span>Net Forecast FPPG change (You gain − You give)</span>
              <strong className={forecastDelta > 0 ? 'good' : forecastDelta < 0 ? 'bad' : ''}>
                {forecastDelta > 0 ? '+' : ''}{formatNumber(forecastDelta)}
              </strong>
            </div>
            <p className="trade-verdict-note">
              Positive = your team&apos;s fantasy value improves with this trade as proposed.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default TradeAnalyzer;