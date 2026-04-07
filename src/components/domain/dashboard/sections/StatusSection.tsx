import { useState, useEffect, useRef } from 'react';
import type { ShipStatusData, SystemStatus } from '@/types/shipStatus';
import { EncounterMapDisplay } from '@/components/domain/encounter/EncounterMapDisplay';
import type { ShipDeckData } from '@/types/gmConsole';
import './Section.css';
import './StatusSection.css';

interface PreviousStatuses {
  life_support: SystemStatus;
  engines: SystemStatus;
  weapons: SystemStatus;
  comms: SystemStatus;
  reactor: SystemStatus;
}

interface ChangingFlags {
  life_support: boolean;
  engines: boolean;
  weapons: boolean;
  comms: boolean;
  reactor: boolean;
}

const SYSTEM_ORDER = ['reactor', 'life_support', 'engines', 'weapons', 'comms'] as const;

const SYSTEM_LABELS: Record<string, string> = {
  reactor: 'REACTOR',
  life_support: 'LIFE SUPPORT',
  engines: 'ENGINES',
  weapons: 'WEAPONS',
  comms: 'COMMS',
};

interface StatusSectionProps {
  shipData: ShipStatusData | null;
  shipDeckData?: ShipDeckData;
  shipDeckTotalDecks?: number;
  revealKey?: number;
}

function getThresholdClass(pct: number): string {
  if (pct < 25) return 'critical';
  if (pct <= 50) return 'low';
  return '';
}

function renderResourceRows(ship: ShipStatusData['ship'], staggerComplete: boolean) {
  const resources = ship.resources;
  if (!resources) return null;

  const rows: Array<{ key: string; label: string; valueDisplay: string; pct: number; subLabel: string }> = [];

  const fuelPct = Math.round((resources.fuel.current / resources.fuel.max) * 100);
  rows.push({ key: 'fuel', label: 'FUEL', valueDisplay: `${resources.fuel.current} / ${resources.fuel.max}`, pct: fuelPct, subLabel: `${fuelPct}% REMAINING` });

  const foodPct = Math.round((resources.food.current / resources.food.max) * 100);
  rows.push({ key: 'food', label: 'FOOD', valueDisplay: `${resources.food.current} / ${resources.food.max}`, pct: foodPct, subLabel: 'GALLEY STOCK' });

  const o2Pct = Math.round((resources.o2.current / resources.o2.max) * 100);
  rows.push({ key: 'o2', label: 'O2', valueDisplay: `${o2Pct}%`, pct: o2Pct, subLabel: 'OXYGEN REMAINING' });

  const cryoPct = Math.round(((resources.cryopods.occupied ?? 0) / resources.cryopods.total) * 100);
  rows.push({ key: 'cryopods', label: 'CRYOPODS', valueDisplay: `${resources.cryopods.occupied ?? 0} / ${resources.cryopods.total}`, pct: cryoPct, subLabel: 'OCCUPIED' });

  const podPct = Math.round(((resources.escape_pods.available ?? 0) / resources.escape_pods.total) * 100);
  rows.push({ key: 'escape_pods', label: 'ESCAPE PODS', valueDisplay: `${resources.escape_pods.available ?? 0} / ${resources.escape_pods.total}`, pct: podPct, subLabel: 'AVAILABLE' });

  return rows.map((row, i) => {
    const thresholdClass = getThresholdClass(row.pct);
    return (
      <div
        key={row.key}
        className={`res-row${!staggerComplete ? ' terminal-row-stagger' : ''}`}
        style={!staggerComplete ? { animationDelay: `${i * 80}ms` } : undefined}
      >
        <div className="res-row-top">
          <span className="res-name">{row.label}</span>
          <span className="res-val">{row.valueDisplay}</span>
        </div>
        <div className="res-bar-track">
          <div
            className={`res-bar-fill${thresholdClass ? ` ${thresholdClass}` : ''}`}
            style={{ width: `${row.pct}%` }}
          />
        </div>
        <div className="res-sub">{row.subLabel}</div>
      </div>
    );
  });
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
    reactor: false,
  });
  const mapFillRef = useRef<HTMLDivElement>(null);

  // Mark stagger complete after all rows have animated in
  useEffect(() => {
    const timer = setTimeout(() => setStaggerComplete(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Re-trigger schematic glitch-in animation when view reveals
  useEffect(() => {
    if (revealKey === undefined || revealKey === 0) return;
    const el = mapFillRef.current;
    if (!el) return;
    el.classList.remove('glitch-enter');
    void el.offsetWidth;
    el.classList.add('glitch-enter');
  }, [revealKey]);

  // Track SSE status changes — flash row briefly on change
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
        reactor: systems.reactor.status,
      };
      return;
    }

    const changed: ChangingFlags = {
      life_support: prev.life_support !== systems.life_support.status,
      engines: prev.engines !== systems.engines.status,
      weapons: prev.weapons !== systems.weapons.status,
      comms: prev.comms !== systems.comms.status,
      reactor: prev.reactor !== systems.reactor.status,
    };

    if (Object.values(changed).some(Boolean)) {
      setChangingFlags(changed);
      previousStatusesRef.current = {
        life_support: systems.life_support.status,
        engines: systems.engines.status,
        weapons: systems.weapons.status,
        comms: systems.comms.status,
        reactor: systems.reactor.status,
      };
      setTimeout(() => setChangingFlags({
        life_support: false, engines: false, weapons: false, comms: false, reactor: false,
      }), 600);
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
  const systems = ship.systems;

  // Crisis tint: hull <50% or any key resource <25%
  const hasCrisis = (
    (ship.hull.current / ship.hull.max) < 0.5 ||
    (ship.resources?.fuel && (ship.resources.fuel.current / ship.resources.fuel.max) < 0.25) ||
    (ship.resources?.food && (ship.resources.food.current / ship.resources.food.max) < 0.25) ||
    (ship.resources?.o2 && (ship.resources.o2.current / ship.resources.o2.max) < 0.25)
  );

  // System summary for left panel footer
  const onlineCount = SYSTEM_ORDER.filter(k => systems[k].status === 'ONLINE').length;
  const warnCount = SYSTEM_ORDER.filter(k => ['STRESSED', 'DAMAGED', 'CRITICAL'].includes(systems[k].status)).length;

  return (
    <div className="section-status">
      <div className="status-map-layout">
        {/* Deck map */}
        <div
          className={`status-map-fill glitch-enter${hasCrisis ? ' crisis-tint' : ''}`}
          ref={mapFillRef}
        >
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
              showLegend={false}
            />
          ) : (
            <div className="status-map-unavailable">DECK MAP UNAVAILABLE</div>
          )}
        </div>

        {/* LEFT PANEL — Systems */}
        <div className="terminal-panel panel-left">
          <div className="terminal-panel-header">SYSTEMS</div>
          <div className="terminal-panel-content">
            {/* Hull row */}
            <div
              className={`hull-row${!staggerComplete ? ' terminal-row-stagger' : ''}`}
              style={!staggerComplete ? { animationDelay: '0ms' } : undefined}
            >
              <div className="hull-top">
                <span className="hull-label">HULL</span>
                <span className="hull-val">{ship.hull.current} / {ship.hull.max}</span>
              </div>
              <div className="hull-bar-track">
                <div className="hull-bar-fill" style={{ width: `${(ship.hull.current / ship.hull.max) * 100}%` }} />
              </div>
              <div className="hull-pct">{Math.round((ship.hull.current / ship.hull.max) * 100)}%</div>
            </div>

            {/* Armor row */}
            <div
              className={`hull-row${!staggerComplete ? ' terminal-row-stagger' : ''}`}
              style={!staggerComplete ? { animationDelay: '80ms' } : undefined}
            >
              <div className="hull-top">
                <span className="hull-label">ARMOR</span>
                <span className="hull-val armor-val">{ship.armor.current} / {ship.armor.max}</span>
              </div>
              <div className="hull-bar-track">
                <div className="hull-bar-fill armor-fill" style={{ width: `${(ship.armor.current / ship.armor.max) * 100}%` }} />
              </div>
              <div className="hull-pct">{Math.round((ship.armor.current / ship.armor.max) * 100)}%</div>
            </div>

            {/* System rows */}
            {SYSTEM_ORDER.map((key, i) => {
              const sys = systems[key];
              const statusLower = sys.status.toLowerCase();
              const staggerDelay = (i + 2) * 80;
              return (
                <div
                  key={key}
                  className={`sys-row s-${statusLower}${changingFlags[key] ? ' state-changing' : ''}${!staggerComplete ? ' terminal-row-stagger' : ''}`}
                  style={!staggerComplete ? { animationDelay: `${staggerDelay}ms` } : undefined}
                >
                  <div className="sys-row-top">
                    <span className="sys-name">{SYSTEM_LABELS[key]}</span>
                    <span className="sys-status">{sys.status}</span>
                  </div>
                  <div className="sys-bar-track">
                    <div className="sys-bar-fill" style={{ width: `${sys.condition}%` }} />
                  </div>
                  <div className="sys-info">{sys.info}</div>
                </div>
              );
            })}
          </div>

          <div className="terminal-panel-footer">
            {onlineCount}/5 OPERATIONAL{warnCount > 0 ? ` · ⚠ ${warnCount} WARNING${warnCount > 1 ? 'S' : ''}` : ''}
          </div>
        </div>

        {/* RIGHT PANEL — Resources */}
        <div className="terminal-panel panel-right">
          <div className="terminal-panel-header">RESOURCES</div>
          <div className="terminal-panel-content">
            {renderResourceRows(ship, staggerComplete)}
          </div>
          <div className="terminal-panel-footer">
            <span>CREW</span>
            <span style={{ float: 'right' }}>
              <span style={{ color: 'var(--color-teal)' }}>{ship.crew_count}</span> / {ship.crew_capacity}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
