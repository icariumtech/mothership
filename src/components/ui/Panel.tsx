import { ReactNode, CSSProperties } from 'react';
import './Panel.css';

export type PanelVariant = 'default' | 'dashboard' | 'info' | 'compact';
export type ChamferCorner = 'tl' | 'tr' | 'bl' | 'br';

/** Chamfer size can be uniform (number) or per-corner (object) */
export type ChamferSize = number | {
  tl?: number;
  tr?: number;
  bl?: number;
  br?: number;
};

interface PanelProps {
  /** Panel title displayed in header */
  title?: string;
  /** Panel content */
  children: ReactNode;
  /** Visual variant style */
  variant?: PanelVariant;
  /** Active state (brighter borders) */
  isActive?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Which corners to chamfer */
  chamferCorners?: ChamferCorner[];
  /** Chamfer size in pixels - uniform or per-corner */
  chamferSize?: ChamferSize;
  /** Optional action buttons/controls in header */
  headerActions?: ReactNode;
  /** Optional footer content */
  footer?: ReactNode;
  /** Enable/disable content scrolling */
  scrollable?: boolean;
  /** Custom content padding (overrides default) */
  padding?: string | number;
  /** Minimum height constraint */
  minHeight?: string | number;
  /** Maximum height constraint */
  maxHeight?: string | number;
  /** Callback when header is clicked (for collapsible panels) */
  onHeaderClick?: () => void;
  /** Custom styles for panel wrapper */
  style?: CSSProperties;
}

/** Helper to get chamfer size for a specific corner */
function getChamferSize(chamferSize: ChamferSize | undefined, corner: ChamferCorner, defaultSize: number = 12): number {
  if (chamferSize === undefined) return defaultSize;
  if (typeof chamferSize === 'number') return chamferSize;
  return chamferSize[corner] ?? defaultSize;
}

/** Generate clip-path polygon based on chamfered corners and their sizes */
function generateClipPath(corners: ChamferCorner[], sizes: { tl: number; tr: number; bl: number; br: number }): string {
  const hasTl = corners.includes('tl');
  const hasTr = corners.includes('tr');
  const hasBl = corners.includes('bl');
  const hasBr = corners.includes('br');

  // Build polygon points clockwise from top-left
  const points: string[] = [];

  // Top edge
  if (hasTl) {
    points.push(`${sizes.tl}px 0`);
  } else {
    points.push('0 0');
  }

  if (hasTr) {
    points.push(`calc(100% - ${sizes.tr}px) 0`);
    points.push(`100% ${sizes.tr}px`);
  } else {
    points.push('100% 0');
  }

  // Right edge to bottom
  if (hasBr) {
    points.push(`100% calc(100% - ${sizes.br}px)`);
    points.push(`calc(100% - ${sizes.br}px) 100%`);
  } else {
    points.push('100% 100%');
  }

  // Bottom edge to left
  if (hasBl) {
    points.push(`${sizes.bl}px 100%`);
    points.push(`0 calc(100% - ${sizes.bl}px)`);
  } else {
    points.push('0 100%');
  }

  // Left edge back to top
  if (hasTl) {
    points.push(`0 ${sizes.tl}px`);
  }

  return `polygon(${points.join(', ')})`;
}

export function Panel({
  title,
  children,
  variant = 'default',
  isActive = false,
  className = '',
  chamferCorners = ['tl', 'br'],
  chamferSize,
  headerActions,
  footer,
  scrollable = true,
  padding,
  minHeight,
  maxHeight,
  onHeaderClick,
  style,
}: PanelProps) {
  const chamferClasses = chamferCorners.map(c => `chamfer-${c}`).join(' ');

  // Calculate chamfer sizes for each corner
  const sizes = {
    tl: getChamferSize(chamferSize, 'tl'),
    tr: getChamferSize(chamferSize, 'tr'),
    bl: getChamferSize(chamferSize, 'bl'),
    br: getChamferSize(chamferSize, 'br'),
  };

  // Check if we need custom sizes (non-default)
  const hasCustomSize = chamferSize !== undefined;

  // Use corner elements when we have tr or bl (pseudo-elements ::before/::after can't handle these)
  // Also use them for 3+ corners (need more than 2 pseudo-elements)
  // Also use them when we have custom sizes
  const needsCornerElements = hasCustomSize ||
                               chamferCorners.length > 2 ||
                               chamferCorners.includes('tr') ||
                               chamferCorners.includes('bl');

  const variantClass = variant !== 'default' ? `panel-${variant}` : '';

  // Generate clip-path if we have custom sizes
  const clipPath = hasCustomSize ? generateClipPath(chamferCorners, sizes) : undefined;

  const wrapperStyle: CSSProperties = {
    ...style,
    minHeight,
    maxHeight,
    ...(clipPath && { clipPath }),
  };

  const contentStyle: CSSProperties = {
    padding,
  };

  // Corner element styles for custom sizes
  const cornerStyle = (corner: ChamferCorner): CSSProperties => ({
    width: sizes[corner],
    height: sizes[corner],
  });

  return (
    <div
      className={`panel-wrapper ${chamferClasses} ${isActive ? 'active' : ''} ${variantClass} ${className}`}
      style={wrapperStyle}
    >
      {/* Corner elements for panels with tr/bl, 3+ corners, or custom sizes */}
      {needsCornerElements && chamferCorners.includes('tl') && <div className="corner-tl" style={cornerStyle('tl')} />}
      {needsCornerElements && chamferCorners.includes('tr') && <div className="corner-tr" style={cornerStyle('tr')} />}
      {needsCornerElements && chamferCorners.includes('bl') && <div className="corner-bl" style={cornerStyle('bl')} />}
      {needsCornerElements && chamferCorners.includes('br') && <div className="corner-br" style={cornerStyle('br')} />}

      {title && (
        <div
          className={`panel-header ${onHeaderClick ? 'clickable' : ''}`}
          onClick={onHeaderClick}
        >
          <h3>{title}</h3>
          {headerActions && <div className="panel-header-actions">{headerActions}</div>}
        </div>
      )}

      <div
        className={`panel-content ${!scrollable ? 'no-scroll' : ''}`}
        style={contentStyle}
      >
        {children}
      </div>

      {footer && (
        <div className="panel-footer">
          {footer}
        </div>
      )}
    </div>
  );
}
