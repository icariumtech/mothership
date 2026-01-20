/**
 * UI Components - Reusable components for the Mothership GM Tool
 */

// Panel Components
export { Panel } from './Panel';
export type { PanelVariant, ChamferCorner } from './Panel';

export { DashboardPanel } from './DashboardPanel';
export { CompactPanel } from './CompactPanel';

// Panel Utilities
export {
  createStandardPanel,
  createDashboardPanel,
  createGMPanel,
  createInfoPanel,
  getPanelClasses,
  getCornerLineClass,
  getPanelChamferConfig,
  isValidChamferConfig,
  normalizeChamferCorners,
} from './panelUtils';
export type { PanelConfig, ChamferConfig } from './panelUtils';
