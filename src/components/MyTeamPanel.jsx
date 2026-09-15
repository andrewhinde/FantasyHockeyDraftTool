import { useMemo } from 'react';

const ORDER = ['C', 'LW', 'RW', 'D', 'G'];

function positionsFor(player, editedPositions) {
  const edited = editedPositions[player.id];
  return edited && edited.length ? edited : player.positions;
}

function rank(pos) {
  const i = ORDER.indexOf(pos);
  return i === -1 ? 99 : i;
}

function MyTeamPanel({ players, drafted, editedPositions, onRemove }) {
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
    <div className="team-panel">
      <div className="team-panel-header">My Team ({team.length})</div>
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
              <button
                type="button"
                className="team-item-remove"
                onClick={() => onRemove(player.id)}
                title={`Remove ${player.name} from my team`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default MyTeamPanel;