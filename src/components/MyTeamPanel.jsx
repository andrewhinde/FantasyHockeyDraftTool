import { useEffect, useMemo, useState } from 'react';
import { useIsMobile } from '../useIsMobile.js';

const ORDER = ['C', 'LW', 'RW', 'D', 'G'];

function positionsFor(player, editedPositions) {
  const edited = editedPositions[player.id];
  return edited && edited.length ? edited : player.positions;
}

function rank(pos) {
  const i = ORDER.indexOf(pos);
  return i === -1 ? 99 : i;
}

function MyTeamPanel({ players, drafted, editedPositions }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(() => !isMobile);

  useEffect(() => {
    if (isMobile) setOpen(false);
  }, [isMobile]);

  const team = useMemo(
    () =>
      players
        .filter((p) => drafted[p.id] === 'me')
        .map((p) => ({ player: p, positions: positionsFor(p, editedPositions) }))
        .sort((a, b) => {
          const ra = rank(a.positions[0]);
          const rb = rank(b.positions[0]);
          if (ra !== rb) return ra - rb;
          return a.player.name.localeCompare(b.player.name);
        }),
    [players, drafted, editedPositions]
  );

  return (
    <>
      <button
        type="button"
        className={`scoring-fab team-fab${open ? ' hidden' : ''}`}
        onClick={() => setOpen(true)}
        aria-expanded={open}
      >
        <svg className="scoring-fab-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M2 3h12M2 8h12M2 13h12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          <circle cx="11.5" cy="8" r="1.1" fill="currentColor" />
          <circle cx="5.5" cy="3" r="1.1" fill="currentColor" />
          <circle cx="8.5" cy="13" r="1.1" fill="currentColor" />
        </svg>
        My Team ({team.length})
        <svg className="scoring-fab-chevron" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
      </button>
      {open && (
        <div className="team-panel">
          <div className="scoring-panel-header">
            <span>My Team ({team.length})</span>
            <button
              type="button"
              className="scoring-close"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          {team.length === 0 ? (
            <div className="team-panel-empty">No players selected yet.</div>
          ) : (
            <ul className="team-list">
              {team.map(({ player, positions }) => (
                <li key={player.id} className="team-item">
                  <span className="team-item-name">{player.name}</span>
                  <span className="team-item-pos">
                    {positions.map((pos) => (
                      <span key={pos} className={`pos-badge pos-${pos.toLowerCase()}`}>
                        {pos}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

export default MyTeamPanel;