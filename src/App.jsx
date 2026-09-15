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
  { key: 'fppg', label: 'FPPG', defaultVisible: false, help: 'Fantasy points per game, averaged over the last 3 seasons and weighted by games played.' },
  { key: 'overall', label: 'Overall', defaultVisible: true, help: 'Total fantasy points from last season.' },
  { key: 'stdDev', label: 'Std Dev', defaultVisible: true, help: 'Games-weighted standard deviation of fantasy points per game across seasons. Lower = steadier.' },
  { key: 'consistency', label: 'Consistency', defaultVisible: true, help: 'Coefficient of variation of fantasy points per game (std dev ÷ FPPG). Lower = more consistent.' },
  { key: 'reliability', label: 'Reliability', defaultVisible: true, help: 'How much proven sample a player has: total games played ÷ (games + 30). Higher = number is more trustworthy.' },
  { key: 'adjustedFppg', label: 'Forecast', defaultVisible: false, help: 'FPPG pulled toward the position average when sample is small. Best per-game projection for the upcoming season.' },
];

const STORAGE_DRAFTED = 'nhl-fantasy-draft:drafted';
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
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
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
  if (colKey === 'consistency') {
    if (typeof value !== 'number' || Number.isNaN(value)) return '—';
    return value.toFixed(3);
  }
  return formatNumber(value);
}

function App() {
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('All');
  const [hideDrafted, setHideDrafted] = useState(false);
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

  const toggleDrafted = (playerId) => {
    setDrafted((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      localStorage.setItem(STORAGE_DRAFTED, JSON.stringify([...next]));
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
    if (hideDrafted) rows = rows.filter((p) => !drafted.has(p.id));

    const dir = sortDir === 'asc' ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'string') return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
    return rows;
  }, [data.players, query, position, hideDrafted, drafted, editedPositions, sortKey, sortDir]);

  const handleSort = (key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const visibleCols = COLUMNS.filter((c) => visibleColumns.has(c.key) || c.key === 'name');

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
            checked={hideDrafted}
            onChange={(e) => setHideDrafted(e.target.checked)}
          />
          Hide drafted
        </label>
        <ColumnPicker columns={COLUMNS} visible={visibleColumns} onChange={setColumnVisible} />
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
              const isDrafted = drafted.has(player.id);
              return (
                <tr key={player.id} className={isDrafted ? 'drafted' : ''}>
                  <td className="draft-col">
                    <button
                      type="button"
                      className={isDrafted ? 'draft-btn drafted' : 'draft-btn'}
                      onClick={() => toggleDrafted(player.id)}
                    >
                      {isDrafted ? 'Undraft' : 'Draft'}
                    </button>
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