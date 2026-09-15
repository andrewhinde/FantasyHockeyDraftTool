import { useMemo, useState } from 'react';
import data from './data/players.json';
import ColumnPicker from './components/ColumnPicker.jsx';

const COLUMNS = [
  { key: 'name', label: 'Name', defaultVisible: true },
  { key: 'team', label: 'Team', defaultVisible: true },
  { key: 'goals', label: 'G', defaultVisible: true },
  { key: 'assists', label: 'A', defaultVisible: true },
  { key: 'plusMinus', label: '+/-', defaultVisible: false },
  { key: 'penaltyMinutes', label: 'PIM', defaultVisible: false },
  { key: 'hits', label: 'HIT', defaultVisible: false },
  { key: 'blockedShots', label: 'BLK', defaultVisible: false },
  { key: 'wins', label: 'W', defaultVisible: true },
  { key: 'losses', label: 'L', defaultVisible: true },
  { key: 'saves', label: 'SV', defaultVisible: false },
  { key: 'shutouts', label: 'SHO', defaultVisible: false },
  { key: 'overall', label: 'Overall', defaultVisible: true, help: 'Total fantasy points from last season.' },
  { key: 'stdDev', label: 'Std Dev', defaultVisible: true, help: 'Games-weighted standard deviation of fantasy points per game across seasons. Lower = steadier.' },
  { key: 'consistency', label: 'Consistency', defaultVisible: true, help: 'Grade based on the coefficient of variation of fantasy points per game (CV = std dev ÷ FPPG). Very High < 0.1, High < 0.2, Medium < 0.3, otherwise Low. Lower CV = more consistent.' },
  { key: 'reliability', label: 'Reliability', defaultVisible: true, help: 'How much proven sample a player has: total games played ÷ (games + 30). Higher = number is more trustworthy.' },
  { key: 'fppg', label: 'FPPG', defaultVisible: false, help: 'Fantasy points per game, averaged over the last 3 seasons and weighted by games played.' },
  { key: 'adjustedFppg', label: 'Forecast', defaultVisible: false, help: 'FPPG pulled toward the position average when sample is small. Best per-game projection for the upcoming season.' },
];

const STORAGE_DRAFTED = 'nhl-fantasy-draft:drafted:v2';
const STORAGE_COLUMNS = 'nhl-fantasy-draft:columns:v2';
const STORAGE_POSITIONS = 'nhl-fantasy-draft:positions';

const POSITIONS = ['C', 'LW', 'RW', 'D', 'G'];
const POSITION_LABELS = {
  C: 'Center',
  LW: 'Left Wing',
  RW: 'Right Wing',
  D: 'Defense',
  G: 'Goalie',
};

function loadDrafted() {
  try {
    const raw = localStorage.getItem(STORAGE_DRAFTED);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadColumns() {
  try {
    const raw = localStorage.getItem(STORAGE_COLUMNS);
    if (raw) return new Set(JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return new Set(COLUMNS.filter((c) => c.defaultVisible).map((c) => c.key));
}

function loadPositions() {
  try {
    const raw = localStorage.getItem(STORAGE_POSITIONS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function formatNumber(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  if (Number.isInteger(value)) return String(value);
  return String(+value.toFixed(2));
}

function formatCell(colKey, value) {
  if (colKey === 'reliability') {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—';
    return (Math.round(value * 1000) / 10) + '%';
  }
  return formatNumber(value);
}

function consistencyGrade(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return null;
  if (value < 0.1) return { label: 'Very High', tone: 'great' };
  if (value < 0.2) return { label: 'High', tone: 'good' };
  if (value < 0.3) return { label: 'Medium', tone: 'mid' };
  return { label: 'Low', tone: 'low' };
}

function ConsistencyBadge({ value }) {
  const grade = consistencyGrade(value);
  if (!grade) return <span className="cell-muted">—</span>;
  return (
    <span className={`cons-badge cons-${grade.tone}`} title={`CV ${value.toFixed(3)} — lower is more consistent`}>
      {grade.label}
    </span>
  );
}

function App() {
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('All');
  const [hideTaken, setHideTaken] = useState(false);
  const [sortKey, setSortKey] = useState('overall');
  const [sortDir, setSortDir] = useState('desc');
  const [visibleColumns, setVisibleColumns] = useState(loadColumns);
  const [drafted, setDrafted] = useState(loadDrafted);
  const [editedPositions, setEditedPositions] = useState(loadPositions);

  const getPositions = (player) => {
    const edited = editedPositions[player.id];
    return edited && edited.length ? edited : player.positions;
  };

  const togglePosition = (playerId, pos) => {
    setEditedPositions((prev) => {
      const current = prev[playerId] ?? [];
      const has = current.includes(pos);
      const next = has ? current.filter((p) => p !== pos) : [...current, pos].sort((a, b) => POSITIONS.indexOf(a) - POSITIONS.indexOf(b));
      const map = { ...prev };
      if (next.length) map[playerId] = next;
      else delete map[playerId];
      localStorage.setItem(STORAGE_POSITIONS, JSON.stringify(map));
      return map;
    });
  };

  const setPlayerStatus = (playerId, status) => {
    setDrafted((prev) => {
      const next = { ...prev };
      if (status) next[playerId] = status;
      else delete next[playerId];
      localStorage.setItem(STORAGE_DRAFTED, JSON.stringify(next));
      return next;
    });
  };

  const setColumnVisible = (key, visible) => {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (visible) next.add(key);
      else next.delete(key);
      localStorage.setItem(STORAGE_COLUMNS, JSON.stringify([...next]));
      return next;
    });
  };

  const players = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let rows = data.players;
    if (needle) {
      rows = rows.filter((p) => {
        const poss = editedPositions[p.id] && editedPositions[p.id].length ? editedPositions[p.id] : p.positions;
        const posText = poss.map((pos) => POSITION_LABELS[pos] ?? pos).join(' ');
        return [p.name, p.team, posText].join(' ').toLowerCase().includes(needle);
      });
    }
    if (position !== 'All') {
      rows = rows.filter((p) => {
        const poss = editedPositions[p.id] && editedPositions[p.id].length ? editedPositions[p.id] : p.positions;
        return poss.includes(position);
      });
    }
    if (hideTaken) rows = rows.filter((p) => drafted[p.id] !== 'other');

    const dir = sortDir === 'asc' ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const ra = drafted[a.id] === 'me' ? 0 : 1;
      const rb = drafted[b.id] === 'me' ? 0 : 1;
      if (ra !== rb) return ra - rb;
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return rows;
  }, [data.players, query, position, hideTaken, drafted, editedPositions, sortKey, sortDir]);

  const handleSort = (key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const effectiveColumns = useMemo(() => {
    const set = new Set(visibleColumns);
    const goalieView = position === 'All' || position === 'G';
    if (goalieView) {
      set.add('wins');
      set.add('losses');
    } else {
      set.delete('wins');
      set.delete('losses');
    }
    if (position === 'G') {
      set.delete('goals');
      set.delete('assists');
    }
    return set;
  }, [visibleColumns, position]);

  const visibleCols = COLUMNS.filter((c) => effectiveColumns.has(c.key) || c.key === 'name');
  const lockedCols = useMemo(() => {
    const set = new Set(['name', 'wins', 'losses']);
    if (position === 'G') {
      set.add('goals');
      set.add('assists');
    }
    return set;
  }, [position]);

  const sortIndicator = (key) => {
    if (key !== sortKey) return '';
    return sortDir === 'desc' ? ' ↓' : ' ↑';
  };

  return (
    <div className="app">
      <h1>NHL Fantasy Draft Tool</h1>
      <div className="byline">
        {data.players.length.toLocaleString()} players · last season {data.seasons.at(-1).replace(/(....)(....)/, '$1-$2')}
      </div>

      <div className="toolbar">
        <input
          className="search"
          type="search"
          placeholder="Search name, team, position…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <label className="select-wrap">
          Position
          <select value={position} onChange={(e) => setPosition(e.target.value)}>
            <option value="All">All</option>
            {POSITIONS.map((pos) => (
              <option key={pos} value={pos}>
                {pos}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox">
          <input
            type="checkbox"
            checked={hideTaken}
            onChange={(e) => setHideTaken(e.target.checked)}
          />
          Hide taken
        </label>
        <ColumnPicker columns={COLUMNS} visible={effectiveColumns} lockedKeys={lockedCols} onChange={setColumnVisible} />
      </div>

      <div className="summary">Showing {players.length.toLocaleString()} players</div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th className="draft-col" aria-label="Drafted" />
              {visibleCols.map((col) => (
                <th
                  key={col.key}
                  className={sortKey === col.key ? `sorted-${sortDir}` : ''}
                  title={col.help}
                  onClick={() => handleSort(col.key)}
                >
                  {col.label}
                  {sortIndicator(col.key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {players.map((player) => {
              const status = drafted[player.id] ?? null;
              return (
                <tr
                  key={player.id}
                  className={status === 'me' ? 'my-pick' : status === 'other' ? 'taken' : ''}
                >
                  <td className="draft-col">
                    <span className="draft-actions">
                      <button
                        type="button"
                        className={status === 'me' ? 'draft-btn mine active' : 'draft-btn'}
                        onClick={() => setPlayerStatus(player.id, status === 'me' ? null : 'me')}
                        title="Mark as your pick"
                      >
                        Mine
                      </button>
                      <button
                        type="button"
                        className={status === 'other' ? 'draft-btn taken active' : 'draft-btn'}
                        onClick={() => setPlayerStatus(player.id, status === 'other' ? null : 'other')}
                        title="Mark as drafted by another team"
                      >
                        Taken
                      </button>
                    </span>
                  </td>
                  {visibleCols.map((col) => (
                    <td key={col.key} className={col.key !== 'name' && col.key !== 'team' ? 'num' : ''}>
{col.key === 'name' ? (
                        <span className="player-name">
                          {player.name}
                          <span className="pos-badges">
                            {getPositions(player).map((pos) => (
                              <button
                                key={pos}
                                type="button"
                                title={`Remove ${POSITION_LABELS[pos]} eligibility`}
                                className={`pos-badge pos-${pos.toLowerCase()}`}
                                onClick={() => togglePosition(player.id, pos)}
                              >
                                {pos}
                              </button>
                            ))}
                          </span>
                          <details
                            className="pos-picker"
                            onToggle={(e) => {
                              if (e.target.open) e.stopPropagation();
                            }}
                          >
                            <summary title="Edit position eligibility">+</summary>
                            <span className="pos-picker-menu">
                              {POSITIONS.map((pos) => {
                                const active = getPositions(player).includes(pos);
                                return (
                                  <label key={pos} className="checkbox">
                                    <input
                                      type="checkbox"
                                      checked={active}
                                      onChange={() => togglePosition(player.id, pos)}
                                    />
                                    {pos} · {POSITION_LABELS[pos]}
                                  </label>
                                );
                              })}
                            </span>
                          </details>
                        </span>
                      ) : col.key === 'team' ? (
                        player.team
                      ) : col.key === 'consistency' ? (
                        <ConsistencyBadge value={player.consistency} />
                      ) : (
                        formatCell(col.key, player[col.key])
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
        {players.length === 0 && <div className="empty">No players match.</div>}
      </div>
    </div>
  );
}

export default App;