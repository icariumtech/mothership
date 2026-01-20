/**
 * LevelIndicator - Shows current deck level on player display
 *
 * Fixed position in upper-right corner, displays:
 * - "DECK 1 / 3" format with deck number and total
 * - Deck name below
 *
 * V2-1 retro terminal styling (teal border, amber numbers)
 * Now uses Panel component for consistency
 */

import { CompactPanel } from '@components/ui/CompactPanel';
import './LevelIndicator.css';

interface LevelIndicatorProps {
  currentLevel: number;
  totalLevels: number;
  deckName?: string;
}

export function LevelIndicator({ currentLevel, totalLevels, deckName }: LevelIndicatorProps) {
  // Don't show for single-deck maps
  if (totalLevels <= 1) {
    return null;
  }

  return (
    <div className="level-indicator-wrapper">
      <CompactPanel
        title="DECK"
        chamferCorners={['tl', 'br']}
        scrollable={false}
      >
        <div className="level-indicator__numbers">
          <span className="level-indicator__current">{currentLevel}</span>
          <span className="level-indicator__separator">/</span>
          <span className="level-indicator__total">{totalLevels}</span>
        </div>
        {deckName && (
          <div className="level-indicator__name">{deckName.toUpperCase()}</div>
        )}
      </CompactPanel>
    </div>
  );
}
