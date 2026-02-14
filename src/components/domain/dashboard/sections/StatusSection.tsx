import { useState, useEffect, useRef } from 'react';
import { DashboardPanel } from '@components/ui/DashboardPanel';
import type { ShipStatusData, SystemStatus } from '@/types/shipStatus';
import './Section.css';
import './StatusSection.css';

// Read ship data from window.INITIAL_DATA (loaded by Django backend)
function getShipStatusData(): ShipStatusData | null {
  return window.INITIAL_DATA?.shipStatus || null;
}

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

// Ship schematic component - SVG blueprint-style top-down view
function ShipSchematic() {
  return (
    <svg
      className="ship-schematic"
      viewBox="0 0 400 600"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Background grid pattern */}
      <defs>
        <pattern
          id="grid"
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <path
            d="M 20 0 L 0 0 0 20"
            fill="none"
            stroke="var(--color-border-subtle)"
            strokeWidth="0.5"
          />
        </pattern>
      </defs>
      <rect width="400" height="600" fill="url(#grid)" />

      {/* Ship outline - vertical orientation */}
      <path
        d="M 200 50 L 250 150 L 240 300 L 250 450 L 200 550 L 150 450 L 160 300 L 150 150 Z"
        fill="var(--color-bg-panel-dark)"
        stroke="var(--color-teal)"
        strokeWidth="2"
      />

      {/* Bridge section */}
      <circle
        cx="200"
        cy="120"
        r="15"
        fill="none"
        stroke="var(--color-teal)"
        strokeWidth="1"
      />
      <text
        x="200"
        y="125"
        textAnchor="middle"
        fill="var(--color-text-muted)"
        fontSize="10"
        fontFamily="Cascadia Code, monospace"
      >
        BRIDGE
      </text>

      {/* Cargo bay section */}
      <rect
        x="170"
        y="280"
        width="60"
        height="40"
        fill="none"
        stroke="var(--color-teal)"
        strokeWidth="1"
      />
      <text
        x="200"
        y="305"
        textAnchor="middle"
        fill="var(--color-text-muted)"
        fontSize="10"
        fontFamily="Cascadia Code, monospace"
      >
        CARGO
      </text>

      {/* Engine section */}
      <rect
        x="170"
        y="460"
        width="60"
        height="60"
        fill="none"
        stroke="var(--color-teal)"
        strokeWidth="1"
      />
      <text
        x="200"
        y="495"
        textAnchor="middle"
        fill="var(--color-text-muted)"
        fontSize="10"
        fontFamily="Cascadia Code, monospace"
      >
        ENGINES
      </text>
    </svg>
  );
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
              className={`system-condition-fill ${statusClass}`}
              style={{ width: `${condition}%` }}
            />
          </div>
          {info && <div className="system-info-text">{info}</div>}
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
  variant: 'hull' | 'armor';
  delay: number;
  staggerDone: boolean;
}

function IntegrityPanel({ label, current, max, variant, delay, staggerDone }: IntegrityPanelProps) {
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
        </div>
      </DashboardPanel>
    </div>
  );
}

export function StatusSection() {
  const [shipData, setShipData] = useState<ShipStatusData | null>(getShipStatusData());
  const [staggerComplete, setStaggerComplete] = useState(false);
  const previousStatusesRef = useRef<PreviousStatuses | null>(null);
  const [changingFlags, setChangingFlags] = useState<ChangingFlags>({
    life_support: false,
    engines: false,
    weapons: false,
    comms: false,
  });

  // Mark stagger animation complete after longest delay + animation duration
  useEffect(() => {
    const timer = setTimeout(() => setStaggerComplete(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Initialize previous statuses on mount
  useEffect(() => {
    if (shipData && !previousStatusesRef.current) {
      previousStatusesRef.current = {
        life_support: shipData.ship.systems.life_support.status,
        engines: shipData.ship.systems.engines.status,
        weapons: shipData.ship.systems.weapons.status,
        comms: shipData.ship.systems.comms.status,
      };
    }
  }, [shipData]);

  // Fetch fresh ship status from API
  const fetchShipStatus = async (skipFlicker = false) => {
    try {
      const res = await fetch('/api/ship-status/');
      if (!res.ok) {
        console.error('Failed to fetch ship status:', res.statusText);
        return;
      }
      const data: ShipStatusData = await res.json();

      // Detect changes and set flicker flags (skip on initial fetch)
      if (!skipFlicker && previousStatusesRef.current) {
        const newChangingFlags: ChangingFlags = {
          life_support: data.ship.systems.life_support.status !== previousStatusesRef.current.life_support,
          engines: data.ship.systems.engines.status !== previousStatusesRef.current.engines,
          weapons: data.ship.systems.weapons.status !== previousStatusesRef.current.weapons,
          comms: data.ship.systems.comms.status !== previousStatusesRef.current.comms,
        };

        setChangingFlags(newChangingFlags);

        // Clear flicker flags after 400ms
        setTimeout(() => {
          setChangingFlags({
            life_support: false,
            engines: false,
            weapons: false,
            comms: false,
          });
        }, 400);
      }

      // Update previous statuses
      previousStatusesRef.current = {
        life_support: data.ship.systems.life_support.status,
        engines: data.ship.systems.engines.status,
        weapons: data.ship.systems.weapons.status,
        comms: data.ship.systems.comms.status,
      };

      setShipData(data);
    } catch (err) {
      console.error('Failed to poll ship status:', err);
    }
  };

  // Fetch fresh data immediately on mount, then poll every 3 seconds
  useEffect(() => {
    fetchShipStatus(true);
    const interval = setInterval(() => fetchShipStatus(), 3000);
    return () => clearInterval(interval);
  }, []);

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

      {/* Main layout: panels + schematic */}
      <div className="status-layout">
        {/* Left column - Hull, Armor, Life Support */}
        <div className="status-column-left">
          <IntegrityPanel
            label="HULL"
            current={ship.hull.current}
            max={ship.hull.max}
            variant="hull"
            delay={0.6}
            staggerDone={staggerComplete}
          />
          <IntegrityPanel
            label="ARMOR"
            current={ship.armor.current}
            max={ship.armor.max}
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

        {/* Center - Ship schematic */}
        <div className="status-schematic-container">
          <ShipSchematic />
        </div>

        {/* Right column - Engines, Weapons, Comms */}
        <div className="status-column-right">
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
