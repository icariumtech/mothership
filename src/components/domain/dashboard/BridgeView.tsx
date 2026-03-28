import { ReactNode, useState, useEffect, useRef } from 'react';
import type { ShipStatusData } from '@/types/shipStatus';
import type { ShipDeckData } from '@/types/gmConsole';
import { TabBar, BridgeTab } from './TabBar';
import { PersonnelSection } from './sections/PersonnelSection';
import { LogsSection } from './sections/LogsSection';
import { StatusSection } from './sections/StatusSection';
import { CharonSection } from './sections/CharonSection';
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

export interface NPC {
  id: string;
  name: string;
  role: string;
  faction?: string;
  location: string;
  portrait?: string;
  status: string;
  description: string;
}

export interface BridgeViewProps {
  activeTab: BridgeTab;
  onTabChange: (tab: BridgeTab) => void;
  tabTransitionActive?: boolean;
  children?: ReactNode; // Map components and InfoPanel passed from SharedConsole
  charonHasMessages?: boolean;
  shipData?: ShipStatusData | null;
  shipDeckData?: ShipDeckData;
  shipDeckTotalDecks?: number;
}

export function BridgeView({
  activeTab,
  onTabChange,
  tabTransitionActive = false,
  children,
  charonHasMessages = false,
  shipData,
  shipDeckData,
  shipDeckTotalDecks,
}: BridgeViewProps) {
  const [staggerDone, setStaggerDone] = useState(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (mountedRef.current) return; // Only run once per mount
    mountedRef.current = true;
    // 5 main content items (map, personnel, logs, status, charon) + tab bar = 6 items
    // Last item at index 5, delay = 5 * 0.1s = 0.5s, animation = 0.6s
    // Total stagger window: 0.5 + 0.6 = 1.1s
    const timer = setTimeout(() => setStaggerDone(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="bridge-view">
      {/* Content Area */}
      <div className={`bridge-content-area${staggerDone ? '' : ' bridge-stagger-active'}`}>
        {/* MAP Section - always mounted, renders children (maps + InfoPanel) */}
        {activeTab === 'map' && (
          <div style={!staggerDone ? { animationDelay: '0s' } : undefined}>
            {children}
          </div>
        )}

        {/* Other sections - conditionally rendered */}
        {activeTab === 'personnel' && (
          <div style={!staggerDone ? { animationDelay: '0.1s' } : undefined}>
            <PersonnelSection />
          </div>
        )}
        {activeTab === 'logs' && (
          <div style={!staggerDone ? { animationDelay: '0.2s' } : undefined}>
            <LogsSection />
          </div>
        )}
        {activeTab === 'status' && (
          <div style={!staggerDone ? { animationDelay: '0.3s' } : undefined}>
            <StatusSection shipData={shipData ?? null} shipDeckData={shipDeckData} shipDeckTotalDecks={shipDeckTotalDecks} />
          </div>
        )}

        {/* CHARON Section - always mounted to preserve conversation state and avoid indicator flashes */}
        <div style={{ display: activeTab === 'charon' ? 'block' : 'none', ...(!staggerDone ? { animationDelay: '0.4s' } : {}) }}>
          <CharonSection isVisible={activeTab === 'charon'} />
        </div>
      </div>

      {/* Tab Bar */}
      <div style={!staggerDone ? { animation: 'bridge-panel-fade-in 0.6s ease 0.5s backwards' } : undefined}>
        <TabBar
          activeTab={activeTab}
          onTabChange={onTabChange}
          disabled={tabTransitionActive}
          charonHasMessages={charonHasMessages}
        />
      </div>
    </div>
  );
}
