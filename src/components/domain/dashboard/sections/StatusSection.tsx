import { useState, useEffect, useRef } from 'react';
import type { ShipStatusData, SystemStatus } from '@/types/shipStatus';
import { EncounterMapDisplay } from '@/components/domain/encounter/EncounterMapDisplay';
import { DashboardPanel } from '@/components/ui/DashboardPanel';
import type { ShipDeckData } from '@/types/gmConsole';
import './Section.css';
import './StatusSection.css';


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

  return Object.entries(resources).map(([key, res], i) => {
    const pct = Math.round((res.current / res.max) * 100);
    const thresholdClass = getThresholdClass(pct);
    const label = res.display_name ?? key.replace(/_/g, ' ').toUpperCase();
    return (
      <div
        key={key}
        className={`res-row${!staggerComplete ? ' terminal-row-stagger' : ''}`}
        style={!staggerComplete ? { animationDelay: `${i * 80}ms` } : undefined}
      >
        <div className="res-row-top">
          <span className="res-name">{label}</span>
          <span className="res-val">{res.current} / {res.max}</span>
        </div>
        <div className="res-bar-track">
          <div
            className={`res-bar-fill${thresholdClass ? ` ${thresholdClass}` : ''}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {res.info && <div className="res-sub">{res.info}</div>}
      </div>
    );
  });
}

export function StatusSection({ shipData, shipDeckData, shipDeckTotalDecks, revealKey }: StatusSectionProps) {
  const [staggerComplete, setStaggerComplete] = useState(false);
  const [currentDeckLevel] = useState(1);
  const previousStatusesRef = useRef<Record<string, SystemStatus> | null>(null);
  const [changingFlags, setChangingFlags] = useState<Record<string, boolean>>({});
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
      previousStatusesRef.current = Object.fromEntries(
        Object.entries(systems).map(([k, s]) => [k, s.status])
      );
      return;
    }

    const changed: Record<string, boolean> = {};
    let hasChanges = false;
    for (const [key, sys] of Object.entries(systems)) {
      if (prev[key] !== sys.status) {
        changed[key] = true;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      setChangingFlags(changed);
      previousStatusesRef.current = Object.fromEntries(
        Object.entries(systems).map(([k, s]) => [k, s.status])
      );
      setTimeout(() => setChangingFlags({}), 600);
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

  // Crisis tint: hull <50% or any resource <25%
  const hasCrisis = (
    (ship.hull.current / ship.hull.max) < 0.5 ||
    Object.values(ship.resources ?? {}).some(res => (res.current / res.max) < 0.25)
  );

  // System summary for left panel footer
  const systemEntries = Object.entries(systems);
  const onlineCount = systemEntries.filter(([, s]) => s.status === 'ONLINE').length;
  const warnCount = systemEntries.filter(([, s]) => ['STRESSED', 'DAMAGED', 'CRITICAL'].includes(s.status)).length;

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
        <div className="status-panel-left-wrap">
          <DashboardPanel
            title="SYSTEMS"
            chamferCorners={['tr', 'bl']}
            footer={
              <>{onlineCount}/{systemEntries.length} OPERATIONAL{warnCount > 0 ? ` · ⚠ ${warnCount} WARNING${warnCount > 1 ? 'S' : ''}` : ''}</>
            }
          >
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
            {systemEntries.map(([key, sys], i) => {
              const statusLower = sys.status.toLowerCase();
              const staggerDelay = (i + 2) * 80; // +2 for hull and armor rows
              const label = sys.display_name ?? key.replace(/_/g, ' ').toUpperCase();
              return (
                <div
                  key={key}
                  className={`sys-row s-${statusLower}${changingFlags[key] ? ' state-changing' : ''}${!staggerComplete ? ' terminal-row-stagger' : ''}`}
                  style={!staggerComplete ? { animationDelay: `${staggerDelay}ms` } : undefined}
                >
                  <div className="sys-row-top">
                    <span className="sys-name">{label}</span>
                    <span className="sys-status">{sys.status}</span>
                  </div>
                  <div className="sys-bar-track">
                    <div className="sys-bar-fill" style={{ width: `${sys.condition}%` }} />
                  </div>
                  <div className="sys-pct">{sys.condition}%</div>
                  <div className="sys-info">{sys.info}</div>
                </div>
              );
            })}
          </DashboardPanel>
        </div>

        {/* RIGHT PANEL — Resources */}
        <div className="status-panel-right-wrap">
          <DashboardPanel
            title="RESOURCES"
            chamferCorners={['tl', 'br']}
            footer={<>CREW {ship.crew_count}/{ship.crew_capacity}</>}
          >
            {renderResourceRows(ship, staggerComplete)}
          </DashboardPanel>
        </div>
      </div>
    </div>
  );
}
