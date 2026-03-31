import { useState, useEffect, useRef } from 'react';
import { DashboardPanel } from '@components/ui/DashboardPanel';
import type { ShipStatusData, SystemStatus } from '@/types/shipStatus';
import { EncounterMapDisplay } from '@/components/domain/encounter/EncounterMapDisplay';
import type { ShipDeckData } from '@/types/gmConsole';
import './Section.css';
import './StatusSection.css';

// Track previous status for flicker detection
interface PreviousStatuses {
  life_support: SystemStatus;
  engines: SystemStatus;
  weapons: SystemStatus;
  comms: SystemStatus;
}

interface ChangingFlags {
  life_support: boolean;
  engines: boolean;
  weapons: boolean;
  comms: boolean;
}

// System status panel component
interface SystemStatusPanelProps {
  name: string;
  status: SystemStatus;
  condition: number;
  info?: string;
  isChanging: boolean;
  delay: number;
  staggerDone: boolean;
}

function SystemStatusPanel({
  name,
  status,
  condition,
  info,
  isChanging,
  delay,
  staggerDone,
}: SystemStatusPanelProps) {
  const statusLower = status.toLowerCase();
  const statusClass = `status-${statusLower}`;
  const changingClass = isChanging ? 'state-changing' : '';
  const staggerClass = staggerDone ? '' : 'stagger-animate';

  return (
    <div className={`system-panel ${statusClass} ${staggerClass}`} style={!staggerDone ? { animationDelay: `${delay}s` } : undefined}>
      <DashboardPanel title={name} chamferCorners={['tl', 'br']} padding={12}>
        <div className={`system-panel-content ${changingClass}`}>
          <div className={`system-status-label ${statusClass}`}>{status}</div>
          <div className="system-condition-bar">
            <div
              className={`system-condition-fill ${statusClass}${condition <= 25 ? ' condition-low' : ''}`}
              style={{ width: `${condition}%` }}
            />
          </div>
          <div className="system-info-text">{info}</div>
        </div>
      </DashboardPanel>
    </div>
  );
}

// Integrity panel component for hull/armor
interface IntegrityPanelProps {
  label: string;
  current: number;
  max: number;
  info?: string;
  variant: 'hull' | 'armor';
  delay: number;
  staggerDone: boolean;
}

function IntegrityPanel({ label, current, max, info, variant, delay, staggerDone }: IntegrityPanelProps) {
  const percentage = (current / max) * 100;
  const variantClass = `integrity-${variant}`;
  const staggerClass = staggerDone ? '' : 'stagger-animate';

  return (
    <div className={`system-panel ${variantClass} ${staggerClass}`} style={!staggerDone ? { animationDelay: `${delay}s` } : undefined}>
      <DashboardPanel title={label} chamferCorners={['tl', 'br']} padding={12}>
        <div className="system-panel-content">
          <div className={`integrity-value ${variantClass}`}>
            {current} / {max}
          </div>
          <div className="system-condition-bar">
            <div
              className={`system-condition-fill integrity-fill-${variant}`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="system-info-text">{info}</div>
        </div>
      </DashboardPanel>
    </div>
  );
}

interface StatusSectionProps {
  shipData: ShipStatusData | null;
  shipDeckData?: ShipDeckData;
  shipDeckTotalDecks?: number;
  revealKey?: number;
}

export function StatusSection({ shipData, shipDeckData, shipDeckTotalDecks, revealKey }: StatusSectionProps) {
  const [staggerComplete, setStaggerComplete] = useState(false);
  const [currentDeckLevel] = useState(1);
  const previousStatusesRef = useRef<PreviousStatuses | null>(null);
  const [changingFlags, setChangingFlags] = useState<ChangingFlags>({
    life_support: false,
    engines: false,
    weapons: false,
    comms: false,
  });
  const mapFillRef = useRef<HTMLDivElement>(null);

  // Mark stagger animation complete after longest delay + animation duration
  useEffect(() => {
    const timer = setTimeout(() => setStaggerComplete(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Re-trigger schematic glitch-in animation when view reveals (bridgeRevealKey increments)
  useEffect(() => {
    if (revealKey === undefined || revealKey === 0) return;
    const el = mapFillRef.current;
    if (!el) return;
    el.classList.remove('glitch-enter');
    void el.offsetWidth; // force reflow
    el.classList.add('glitch-enter');
  }, [revealKey]);

  // Track status changes from SSE updates — flash changingFlags briefly on change
  useEffect(() => {
    if (!shipData) return;
    const systems = shipData.ship.systems;
    const prev = previousStatusesRef.current;

    if (!prev) {
      previousStatusesRef.current = {
        life_support: systems.life_support.status,
        engines: systems.engines.status,
        weapons: systems.weapons.status,
        comms: systems.comms.status,
      };
      return;
    }

    const changed: ChangingFlags = {
      life_support: prev.life_support !== systems.life_support.status,
      engines: prev.engines !== systems.engines.status,
      weapons: prev.weapons !== systems.weapons.status,
      comms: prev.comms !== systems.comms.status,
    };

    if (Object.values(changed).some(Boolean)) {
      setChangingFlags(changed);
      previousStatusesRef.current = {
        life_support: systems.life_support.status,
        engines: systems.engines.status,
        weapons: systems.weapons.status,
        comms: systems.comms.status,
      };
      setTimeout(() => setChangingFlags({ life_support: false, engines: false, weapons: false, comms: false }), 600);
    }
  }, [shipData]);

  if (!shipData) {
    return (
      <div className="section-empty">
        &gt; SHIP STATUS DATA UNAVAILABLE
      </div>
    );
  }

  const { ship } = shipData;

  return (
    <div className="section-status">
      {/* Ship identity header */}
      <div className="ship-identity-header">
        <div className="ship-identity-name">{ship.name}</div>
        <div className="ship-identity-class">{ship.class}</div>
        <div className="ship-identity-crew">
          CREW: {ship.crew_count}/{ship.crew_capacity}
        </div>
      </div>

      {/* Map + floating panels */}
      <div className="status-map-layout">
        {/* Deck map — fills the area */}
        <div className="status-map-fill glitch-enter" ref={mapFillRef}>
          {shipDeckData ? (
            <EncounterMapDisplay
              locationData={{
                slug: 'campaign_ship',
                name: ship.name || 'USCSS Morrigan',
                type: 'ship',
                map: shipDeckData,
              }}
              isGM={false}
              currentLevel={currentDeckLevel}
              totalLevels={shipDeckTotalDecks || 1}
              viewPadding={8}
            />
          ) : (
            <div className="status-map-unavailable">DECK MAP UNAVAILABLE</div>
          )}
        </div>

        {/* Left overlay — Hull, Armor, Life Support */}
        <div className="status-overlay-left">
          <IntegrityPanel
            label="HULL"
            current={ship.hull.current}
            max={ship.hull.max}
            info={ship.hull.info}
            variant="hull"
            delay={0.6}
            staggerDone={staggerComplete}
          />
          <IntegrityPanel
            label="ARMOR"
            current={ship.armor.current}
            max={ship.armor.max}
            info={ship.armor.info}
            variant="armor"
            delay={0.8}
            staggerDone={staggerComplete}
          />
          <SystemStatusPanel
            name="LIFE SUPPORT"
            status={ship.systems.life_support.status}
            condition={ship.systems.life_support.condition}
            info={ship.systems.life_support.info}
            isChanging={changingFlags.life_support}
            delay={1.0}
            staggerDone={staggerComplete}
          />
        </div>

        {/* Right overlay — Engines, Weapons, Comms */}
        <div className="status-overlay-right">
          <SystemStatusPanel
            name="ENGINES"
            status={ship.systems.engines.status}
            condition={ship.systems.engines.condition}
            info={ship.systems.engines.info}
            isChanging={changingFlags.engines}
            delay={0.6}
            staggerDone={staggerComplete}
          />
          <SystemStatusPanel
            name="WEAPONS"
            status={ship.systems.weapons.status}
            condition={ship.systems.weapons.condition}
            info={ship.systems.weapons.info}
            isChanging={changingFlags.weapons}
            delay={0.8}
            staggerDone={staggerComplete}
          />
          <SystemStatusPanel
            name="COMMS"
            status={ship.systems.comms.status}
            condition={ship.systems.comms.condition}
            info={ship.systems.comms.info}
            isChanging={changingFlags.comms}
            delay={1.0}
            staggerDone={staggerComplete}
          />
        </div>
      </div>
    </div>
  );
}
