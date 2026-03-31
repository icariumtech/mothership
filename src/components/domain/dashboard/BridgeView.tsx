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
  revealKey?: number;
}

// Applies bridge-tab-glitch on mount; boot stagger overrides via higher CSS specificity
function SectionWrapper({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  const [animating, setAnimating] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setAnimating(false), 200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={animating ? 'bridge-tab-entering' : ''} style={style}>
      {children}
    </div>
  );
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
  revealKey,
}: BridgeViewProps) {
  const [staggerDone, setStaggerDone] = useState(false);
  const mountedRef = useRef(false);

  // Tab transition: hold exiting section in DOM while it glitches out, then mount incoming
  const [displayedTab, setDisplayedTab] = useState<BridgeTab>(activeTab);
  const [exitingTab, setExitingTab] = useState<BridgeTab | null>(null);

  useEffect(() => {
    if (mountedRef.current) return;
    mountedRef.current = true;
    const timer = setTimeout(() => setStaggerDone(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (activeTab === displayedTab) return;
    // Start exit on current tab, then swap after exit animation (100ms + small buffer)
    setExitingTab(displayedTab);
    const t = setTimeout(() => {
      setDisplayedTab(activeTab);
      setExitingTab(null);
    }, 120);
    return () => clearTimeout(t);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  const renderSection = (tab: BridgeTab, isExiting: boolean) => {
    const cls = isExiting ? 'bridge-tab-exiting' : undefined;
    const Wrap = isExiting
      ? ({ children: c }: { children: ReactNode }) => <div className={cls}>{c}</div>
      : SectionWrapper;
    const staggerStyle = !staggerDone ? ({
      map: { animationDelay: '0s' },
      personnel: { animationDelay: '0.1s' },
      logs: { animationDelay: '0.2s' },
      status: { animationDelay: '0.3s' },
      charon: { animationDelay: '0.4s' },
    } as Record<BridgeTab, React.CSSProperties>)[tab] : undefined;

    if (tab === 'charon') return null; // CHARON handled separately (always mounted)

    return (
      <Wrap key={isExiting ? `exit-${tab}` : tab} style={staggerStyle}>
        {tab === 'map' && children}
        {tab === 'personnel' && <PersonnelSection />}
        {tab === 'logs' && <LogsSection />}
        {tab === 'status' && <StatusSection shipData={shipData ?? null} shipDeckData={shipDeckData} shipDeckTotalDecks={shipDeckTotalDecks} revealKey={revealKey} />}
      </Wrap>
    );
  };

  return (
    <div className="bridge-view">
      {/* Content Area */}
      <div className={`bridge-content-area${staggerDone ? '' : ' bridge-stagger-active'}`}>
        {/* Exiting section — held in DOM briefly to play glitch-out */}
        {exitingTab && exitingTab !== 'charon' && renderSection(exitingTab, true)}

        {/* Active section — mounts after exit completes, plays glitch-in via SectionWrapper */}
        {exitingTab !== displayedTab && renderSection(displayedTab, false)}

        {/* CHARON — always mounted, shown/hidden via display */}
        <div style={{ display: displayedTab === 'charon' ? 'block' : 'none', ...(!staggerDone ? { animationDelay: '0.4s' } : {}) }}>
          <CharonSection isVisible={displayedTab === 'charon'} />
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
