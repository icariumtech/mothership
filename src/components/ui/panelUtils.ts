import { ChamferCorner, PanelVariant } from './Panel';

/**
 * Panel utility functions for creating consistent panel configurations
 */

// ============================================
// Panel Configuration Factories
// ============================================

export interface PanelConfig {
  variant: PanelVariant;
  chamferCorners: ChamferCorner[];
  scrollable?: boolean;
  className?: string;
}

/**
 * Returns standard panel configuration
 */
export function createStandardPanel(): PanelConfig {
  return {
    variant: 'default',
    chamferCorners: ['tl', 'br'],
    scrollable: true,
  };
}

/**
 * Returns dashboard panel configuration
 */
export function createDashboardPanel(corners: ChamferCorner[] = ['tr', 'bl']): PanelConfig {
  return {
    variant: 'dashboard',
    chamferCorners: corners,
    scrollable: true,
  };
}

/**
 * Returns GM console panel configuration
 */
export function createGMPanel(): PanelConfig {
  return {
    variant: 'compact',
    chamferCorners: ['tl', 'br'],
    scrollable: true,
  };
}

/**
 * Returns info panel configuration
 */
export function createInfoPanel(): PanelConfig {
  return {
    variant: 'info',
    chamferCorners: ['tl', 'br'],
    scrollable: true,
  };
}

// ============================================
// CSS Class Helpers
// ============================================

/**
 * Generate chamfer corner classes from corner array
 */
export function getPanelClasses(chamferCorners: ChamferCorner[]): string {
  return chamferCorners.map(c => `chamfer-${c}`).join(' ');
}

/**
 * Get corner line CSS class based on chamfer combination
 * NOTE: This is a legacy helper for HTML templates that use corner-line-* classes.
 * React components should use the Panel component instead.
 */
export function getCornerLineClass(chamferCorners: ChamferCorner[]): string {
  const sorted = [...chamferCorners].sort();
  const key = sorted.join('-');

  const classMap: Record<string, string> = {
    'bl-br': 'corner-line-bl-br',
    'br-tl': 'corner-line-tl-br',  // sorted ['tl', 'br'] becomes 'br-tl'
    'tl-br': 'corner-line-tl-br',  // also handle non-sorted for safety
    'bl-tr': 'corner-line-tr-bl',
    'tr-bl': 'corner-line-tr-bl',  // also handle non-sorted for safety
  };

  return classMap[key] || '';
}

// ============================================
// Chamfer Configuration Helpers
// ============================================

export interface ChamferConfig {
  corners: ChamferCorner[];
  clipPath: string;
}

/**
 * Returns chamfer configuration for specific corner combinations
 */
export function getPanelChamferConfig(corners: ChamferCorner[]): ChamferConfig {
  const chamferSize = '12px';

  // Sort for consistent lookup
  const sorted = [...corners].sort().join(',');

  const configs: Record<string, string> = {
    // Single corners
    'tl': `polygon(${chamferSize} 0, 100% 0, 100% 100%, 0 100%, 0 ${chamferSize})`,
    'tr': `polygon(0 0, calc(100% - ${chamferSize}) 0, 100% ${chamferSize}, 100% 100%, 0 100%)`,
    'bl': `polygon(0 0, 100% 0, 100% 100%, ${chamferSize} 100%, 0 calc(100% - ${chamferSize}))`,
    'br': `polygon(0 0, 100% 0, 100% calc(100% - ${chamferSize}), calc(100% - ${chamferSize}) 100%, 0 100%)`,

    // Two corners (diagonal)
    'br,tl': `polygon(${chamferSize} 0, 100% 0, 100% calc(100% - ${chamferSize}), calc(100% - ${chamferSize}) 100%, 0 100%, 0 ${chamferSize})`,
    'bl,tr': `polygon(0 0, calc(100% - ${chamferSize}) 0, 100% ${chamferSize}, 100% 100%, ${chamferSize} 100%, 0 calc(100% - ${chamferSize}))`,

    // Two corners (same edge)
    'bl,br': `polygon(0 0, 100% 0, 100% calc(100% - ${chamferSize}), calc(100% - ${chamferSize}) 100%, ${chamferSize} 100%, 0 calc(100% - ${chamferSize}))`,
    'tl,tr': `polygon(${chamferSize} 0, calc(100% - ${chamferSize}) 0, 100% ${chamferSize}, 100% 100%, 0 100%, 0 ${chamferSize})`,

    // Three corners
    'bl,br,tr': `polygon(0 0, calc(100% - ${chamferSize}) 0, 100% ${chamferSize}, 100% calc(100% - ${chamferSize}), calc(100% - ${chamferSize}) 100%, ${chamferSize} 100%, 0 calc(100% - ${chamferSize}))`,
    'br,tl,tr': `polygon(${chamferSize} 0, calc(100% - ${chamferSize}) 0, 100% ${chamferSize}, 100% calc(100% - ${chamferSize}), calc(100% - ${chamferSize}) 100%, 0 100%, 0 ${chamferSize})`,
    'bl,br,tl': `polygon(${chamferSize} 0, 100% 0, 100% calc(100% - ${chamferSize}), calc(100% - ${chamferSize}) 100%, ${chamferSize} 100%, 0 calc(100% - ${chamferSize}), 0 ${chamferSize})`,
    'bl,tl,tr': `polygon(${chamferSize} 0, calc(100% - ${chamferSize}) 0, 100% ${chamferSize}, 100% 100%, ${chamferSize} 100%, 0 calc(100% - ${chamferSize}), 0 ${chamferSize})`,

    // All four corners
    'bl,br,tl,tr': `polygon(${chamferSize} 0, calc(100% - ${chamferSize}) 0, 100% ${chamferSize}, 100% calc(100% - ${chamferSize}), calc(100% - ${chamferSize}) 100%, ${chamferSize} 100%, 0 calc(100% - ${chamferSize}), 0 ${chamferSize})`,
  };

  const clipPath = configs[sorted] || configs['br,tl']; // Default to tl-br

  return {
    corners,
    clipPath,
  };
}

// ============================================
// Validation Helpers
// ============================================

/**
 * Check if a chamfer corner combination is valid
 */
export function isValidChamferConfig(corners: ChamferCorner[]): boolean {
  // All combinations are valid
  return corners.length > 0 && corners.length <= 4;
}

/**
 * Normalize chamfer corners (remove duplicates, sort)
 */
export function normalizeChamferCorners(corners: ChamferCorner[]): ChamferCorner[] {
  return Array.from(new Set(corners)).sort() as ChamferCorner[];
}
