/**
 * LegendPanel - Shows door types and POI icons for encounter maps
 *
 * Fixed position in lower-right corner
 * Now uses CompactPanel component for consistency
 */

import { CompactPanel } from '@components/ui/CompactPanel';
import './LegendPanel.css';

// V2-1 Color palette (must match EncounterMapRenderer)
const COLORS = {
  bgPrimary: '#0a0a0a',
  bgRoom: '#0f1515',
  borderMain: '#4a6b6b',
  borderSubtle: '#2a3a3a',
  teal: '#4a6b6b',
  tealBright: '#5a7a7a',
  amber: '#8b7355',
  amberBright: '#9a8065',
  textPrimary: '#9a9a9a',
  textMuted: '#5a5a5a',
  hazard: '#8b5555',
  warning: '#8b7355',
  pathLine: '#3a5a5a',
};

export function LegendPanel() {
  return (
    <div className="legend-panel-wrapper">
      <CompactPanel
        title="LEGEND"
        chamferCorners={['tl', 'br']}
        scrollable={false}
      >
        {/* Doors section */}
        <div className="legend-section">
          <div className="legend-section-header">DOORS</div>
          <div className="legend-item">
            <svg width="24" height="16" viewBox="0 0 24 16">
              <rect x="2" y="2" width="20" height="12" fill={COLORS.teal} stroke={COLORS.borderMain} strokeWidth="1.5" />
            </svg>
            <span>Standard</span>
          </div>
          <div className="legend-item">
            <svg width="24" height="16" viewBox="0 0 24 16">
              <rect x="2" y="2" width="20" height="12" fill={COLORS.amber} stroke={COLORS.borderMain} strokeWidth="1.5" />
              <rect x="5" y="5" width="14" height="6" fill="none" stroke={COLORS.bgPrimary} strokeWidth="1" />
            </svg>
            <span>Airlock</span>
          </div>
          <div className="legend-item">
            <svg width="24" height="16" viewBox="0 0 24 16">
              <rect x="2" y="2" width="20" height="12" fill={COLORS.tealBright} stroke={COLORS.borderMain} strokeWidth="1.5" />
              <line x1="5" y1="4" x2="19" y2="12" stroke={COLORS.bgPrimary} strokeWidth="1.5" />
              <line x1="19" y1="4" x2="5" y2="12" stroke={COLORS.bgPrimary} strokeWidth="1.5" />
            </svg>
            <span>Blast Door</span>
          </div>
          <div className="legend-item">
            <svg width="24" height="16" viewBox="0 0 24 16">
              <rect x="2" y="2" width="20" height="12" fill={COLORS.hazard} stroke={COLORS.borderMain} strokeWidth="1.5" />
            </svg>
            <span>Emergency</span>
          </div>
        </div>

        {/* POI section */}
        <div className="legend-section">
          <div className="legend-section-header">POINTS OF INTEREST</div>
          <div className="legend-item">
            <svg width="20" height="14" viewBox="0 0 20 14">
              <path d="M10,2 L15,10 L5,10 Z" fill={COLORS.amber} stroke={COLORS.bgPrimary} strokeWidth="1" />
            </svg>
            <span>Objective</span>
          </div>
          <div className="legend-item">
            <svg width="20" height="14" viewBox="0 0 20 14">
              <rect x="6" y="3" width="8" height="8" fill={COLORS.teal} stroke={COLORS.bgPrimary} strokeWidth="1" />
            </svg>
            <span>Item</span>
          </div>
          <div className="legend-item">
            <svg width="20" height="14" viewBox="0 0 20 14">
              <path d="M10,2 L16,10 L4,10 Z" fill={COLORS.hazard} stroke={COLORS.bgPrimary} strokeWidth="1" />
            </svg>
            <span>Hazard</span>
          </div>
          <div className="legend-item">
            <svg width="20" height="14" viewBox="0 0 20 14">
              <rect x="4" y="2" width="12" height="10" rx="1" fill={COLORS.amber} stroke={COLORS.bgPrimary} strokeWidth="1" />
              <rect x="6" y="4" width="8" height="6" fill={COLORS.bgPrimary} />
            </svg>
            <span>Terminal</span>
          </div>
        </div>
      </CompactPanel>
    </div>
  );
}
