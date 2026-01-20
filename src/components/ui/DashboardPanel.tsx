import { ReactNode } from 'react';
import { Panel, ChamferCorner } from './Panel';

interface DashboardPanelProps {
  /** Panel title displayed in header */
  title?: string;
  /** Panel content */
  children: ReactNode;
  /** Additional CSS classes */
  className?: string;
  /** Which corners to chamfer (default: tr-bl for dashboard) */
  chamferCorners?: ChamferCorner[];
  /** Active state */
  isActive?: boolean;
  /** Optional action buttons/controls in header */
  headerActions?: ReactNode;
  /** Optional footer content */
  footer?: ReactNode;
  /** Enable/disable content scrolling */
  scrollable?: boolean;
  /** Custom content padding */
  padding?: string | number;
  /** Callback when header is clicked */
  onHeaderClick?: () => void;
}

/**
 * Dashboard-specific panel variant.
 * Pre-configured with dashboard styling and default tr-bl chamfered corners.
 * Used in CampaignDashboard and other dashboard views.
 */
export function DashboardPanel({
  title,
  children,
  className = '',
  chamferCorners = ['tr', 'bl'],
  isActive = false,
  headerActions,
  footer,
  scrollable = true,
  padding,
  onHeaderClick,
}: DashboardPanelProps) {
  return (
    <Panel
      title={title}
      variant="dashboard"
      chamferCorners={chamferCorners}
      isActive={isActive}
      className={className}
      headerActions={headerActions}
      footer={footer}
      scrollable={scrollable}
      padding={padding}
      onHeaderClick={onHeaderClick}
    >
      {children}
    </Panel>
  );
}
