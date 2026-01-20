import { ReactNode } from 'react';
import { Panel, ChamferCorner } from './Panel';

interface CompactPanelProps {
  /** Panel title displayed in header */
  title: string;
  /** Panel content */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Which corners to chamfer */
  chamferCorners?: ChamferCorner[];
  /** Active state */
  isActive?: boolean;
  /** Optional action buttons/controls in header */
  headerActions?: ReactNode;
  /** Optional footer content */
  footer?: ReactNode;
  /** Enable/disable content scrolling */
  scrollable?: boolean;
  /** Callback when header is clicked */
  onHeaderClick?: () => void;
}

/**
 * Compact panel variant for dense information displays.
 * Features smaller padding and font sizes compared to standard panels.
 * Ideal for GM console panels with lots of information.
 */
export function CompactPanel({
  title,
  children,
  className = '',
  chamferCorners = ['tl', 'br'],
  isActive = false,
  headerActions,
  footer,
  scrollable = true,
  onHeaderClick,
}: CompactPanelProps) {
  return (
    <Panel
      title={title}
      variant="compact"
      chamferCorners={chamferCorners}
      isActive={isActive}
      className={className}
      headerActions={headerActions}
      footer={footer}
      scrollable={scrollable}
      onHeaderClick={onHeaderClick}
    >
      {children}
    </Panel>
  );
}
