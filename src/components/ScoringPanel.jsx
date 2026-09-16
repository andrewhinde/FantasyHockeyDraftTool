import { useEffect, useState } from 'react';
import { useIsMobile } from '../useIsMobile.js';

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
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isMobile) setOpen(false);
  }, [isMobile]);

  if (!skaterScoring || !goalieScoring) return null;

  return (
    <>
      <button
        type="button"
        className={`scoring-fab${open ? ' hidden' : ''}`}
        onClick={() => setOpen(true)}
        aria-expanded={open}
      >
        <svg className="help-icon scoring-fab-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M3 7.5h.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M6.6 4H3.9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M11 5.5h1.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="6.6" cy="7.5" r="1.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
          <circle cx="11" cy="5.5" r="1.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
          <path d="M3 13.5h2.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <path d="M12.8 13.5H9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          <circle cx="8.6" cy="13.5" r="1.5" stroke="currentColor" strokeWidth="1.2" fill="none" />
        </svg>
        Scoring
        <svg className="scoring-fab-chevron" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </svg>
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