import { ReactNode } from 'react';
import { TabBar, BridgeTab } from './TabBar';
import { CrewSection } from './sections/CrewSection';
import { ContactsSection } from './sections/ContactsSection';
import { NotesSection } from './sections/NotesSection';
import { StatusSection } from './sections/StatusSection';
import './BridgeView.css';

// Re-export types from CampaignDashboard for compatibility
export interface StarSystem {
  name: string;
  hasSystemMap: boolean;
}

export interface SystemPlanet {
  name: string;
  hasOrbitMap: boolean;
  locationSlug?: string;
  surfaceFacilityCount?: number;
  orbitalStationCount?: number;
}

export interface OrbitElement {
  name: string;
  type: 'moon' | 'station' | 'surface';
  hasFacilities?: boolean;
}

export interface CrewMemberStats {
  strength: number;
  speed: number;
  intellect: number;
  combat: number;
}

export interface CrewMemberSaves {
  sanity: number;
  fear: number;
  body: number;
}

export interface CrewMemberHealth {
  current: number;
  max: number;
}

export interface CrewMember {
  id: string;
  name: string;
  callsign?: string;
  role: string;
  class: string;
  portrait?: string;
  stats: CrewMemberStats;
  saves: CrewMemberSaves;
  stress: number;
  health: CrewMemberHealth;
  wounds: number;
  armor: number;
  background: string;
  motivation: string;
  status: string;
  description: string;
}

export interface BridgeViewProps {
  activeTab: BridgeTab;
  onTabChange: (tab: BridgeTab) => void;
  tabTransitionActive?: boolean;
  children?: ReactNode; // Map components and InfoPanel passed from SharedConsole
}

export function BridgeView({
  activeTab,
  onTabChange,
  tabTransitionActive = false,
  children,
}: BridgeViewProps) {
  return (
    <div className="bridge-view">
      {/* Content Area */}
      <div className="bridge-content-area">
        {/* MAP Section - always mounted, renders children (maps + InfoPanel) */}
        {activeTab === 'map' && children}

        {/* Other sections - conditionally rendered */}
        {activeTab === 'crew' && <CrewSection />}
        {activeTab === 'contacts' && <ContactsSection />}
        {activeTab === 'notes' && <NotesSection />}
        {activeTab === 'status' && <StatusSection />}
      </div>

      {/* Tab Bar */}
      <TabBar
        activeTab={activeTab}
        onTabChange={onTabChange}
        disabled={tabTransitionActive}
      />
    </div>
  );
}
