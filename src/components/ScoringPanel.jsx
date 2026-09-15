import { useState } from 'react';

const SKATER_STATS = [
  ['goals', 'Goals (G)'],
  ['assists', 'Assists (A)'],
  ['plusMinus', 'Plus/Minus (+/-)'],
  ['penaltyMinutes', 'Penalty Minutes (PIM)'],
  ['hits', 'Hits (HIT)'],
  ['blockedShots', 'Blocks (BLK)'],
];

const GOALIE_STATS = [
  ['wins', 'Wins (W)'],
  ['losses', 'Losses (L)'],
  ['saves', 'Saves (SV)'],
  ['shutouts', 'Shutouts (SHO)'],
];

function formatValue(value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—';
  return String(+value.toFixed(2));
}

function ScoringPanel({ skaterScoring, goalieScoring }) {
  const [open, setOpen] = useState(true);
  if (!skaterScoring || !goalieScoring) return null;

  return (
    <>
      <button
        type="button"
        className={`scoring-fab${open ? ' hidden' : ''}`}
        onClick={() => setOpen(true)}
      >
        Scoring
      </button>
      {open && (
        <div className="scoring-panel">
          <div className="scoring-panel-header">
            <span>Scoring Settings</span>
            <button
              type="button"
              className="scoring-close"
              onClick={() => setOpen(false)}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="scoring-group">
            <div className="scoring-group-title">Forwards / Defensemen</div>
            {SKATER_STATS.map(([key, label]) => (
              <div key={key} className="scoring-row">
                <span>{label}</span>
                <span className="scoring-value">{formatValue(skaterScoring[key])}</span>
              </div>
            ))}
          </div>
          <div className="scoring-group">
            <div className="scoring-group-title">Goaltenders</div>
            {GOALIE_STATS.map(([key, label]) => (
              <div key={key} className="scoring-row">
                <span>{label}</span>
                <span className="scoring-value">{formatValue(goalieScoring[key])}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default ScoringPanel;