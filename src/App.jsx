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
  { key: 'overall', label: 'Overall', defaultVisible: true },
  { key: 'stdDev', label: 'Std Dev', defaultVisible: true },
];

const STORAGE_DRAFTED = 'nhl-fantasy-draft:drafted';
const STORAGE_COLUMNS = 'nhl-fantasy-draft:columns';
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
      rows = rows.filter((p) =>
        [p.name, p.team, POSITION_LABELS[p.position] ?? p.position]
          .join(' ')
          .toLowerCase()
          .includes(needle)
      );
    }
    if (position !== 'All') rows = rows.filter((p) => p.position === position);
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
  }, [data.players, query, position, hideDrafted, drafted, sortKey, sortDir]);

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
            <option value="F">F</option>
            <option value="D">D</option>
            <option value="G">G</option>
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
                    <td key={col.key} className={col.key === 'stdDev' ? 'num' : ''}>
                      {col.key === 'name' ? (
                        <span className="player-name">
                          {player.name}
                          <span className={`pos-badge pos-${player.position.toLowerCase()}`}>
                            {player.position}
                          </span>
                        </span>
                      ) : col.key === 'team' ? (
                        player.team
                      ) : (
                        formatNumber(player[col.key])
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