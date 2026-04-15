import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
import type { ShipStatusData, SystemStatus } from '@/types/shipStatus';
import { EncounterMapDisplay } from '@/components/domain/encounter/EncounterMapDisplay';
import { DashboardPanel } from '@/components/ui/DashboardPanel';
import { gmConsoleApi } from '@/services/gmConsoleApi';
import { ENCOUNTER_ICONS } from '@/components/domain/encounter/EncounterIcons';
import type { ShipDeckData } from '@/types/gmConsole';
import './Section.css';
import './StatusSection.css';


interface StatusSectionProps {
  shipData: ShipStatusData | null;
  shipDeckData?: ShipDeckData;
  shipDeckTotalDecks?: number;
  revealKey?: number;
}

interface SelectedRow {
  panel: 'left' | 'right';
  key: string;
  label: string;
  detail: string;
  accentColor: string;
}

const STATUS_ACCENT: Record<SystemStatus, string> = {
  ONLINE: '#4a8b8b',
  STRESSED: '#c9a050',
  DAMAGED: '#9a6045',
  CRITICAL: '#8b5555',
  OFFLINE: '#3a5050',
};

const RESOURCE_ACCENT = '#8b7355';
const HULL_ACCENT = '#4a8b8b';

const STARTUP_PHASES = [
  'INITIATING COLD START SEQUENCE',
  'PRESSURIZING FUEL LINES',
  'PLASMA CONTAINMENT FIELD ACTIVE',
  'CORE TEMPERATURE STABILIZING',
  'REACTOR ONLINE',
] as const;

// Fallback icons for systems that don't have an icon field in ship.yaml
const SYSTEM_ICONS_FALLBACK: Record<string, string> = {
  reactor: 'reactor core',
  engines: 'jumpdrive',
  comms: 'intercom',
  life_support: 'ventillation',
  weapons: 'weapon system',
  sensors: 'sensors',
};

const RESOURCE_ICONS: Record<string, string> = {
  fuel: 'fuel',
  o2: 'ventillation',
  cargo: 'cargo',
  cryopods: 'cryo',
  escape_pods: 'emergency capsule',
  food: 'galley',
};

function SystemIcon({ name, size = 20 }: { name: string; size?: number }) {
  const content = ENCOUNTER_ICONS[name];
  if (!content) return null;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      dangerouslySetInnerHTML={{ __html: content }}
      className="detail-system-icon"
    />
  );
}

function getThresholdClass(pct: number): string {
  if (pct < 25) return 'critical';
  if (pct <= 50) return 'low';
  return '';
}

export function StatusSection({ shipData, shipDeckData, shipDeckTotalDecks, revealKey }: StatusSectionProps) {
  const [staggerComplete, setStaggerComplete] = useState(false);
  const [currentDeckLevel] = useState(1);
  const previousStatusesRef = useRef<Record<string, SystemStatus> | null>(null);
  const [changingFlags, setChangingFlags] = useState<Record<string, boolean>>({});
  const mapFillRef = useRef<HTMLDivElement>(null);

  const [selectedRow, setSelectedRow] = useState<SelectedRow | null>(null);
  const [connectorPoints, setConnectorPoints] = useState<number[] | null>(null);
  const layoutRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const detailPanelRef = useRef<HTMLDivElement>(null);

  const [newCargoItem, setNewCargoItem] = useState('');
  const [cargoLoading, setCargoLoading] = useState(false);

  const [reactorLoading, setReactorLoading] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const pendingActionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [localAllocations, setLocalAllocations] = useState<Record<string, number> | null>(null);
  const [transitioningKeys, setTransitioningKeys] = useState<Record<string, boolean>>({});
  const transitionTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  interface ReactorModalData {
    action: 'emergency_shutdown' | 'cold_start';
    phase: 'confirm' | 'running';
    countdown: number;
    startupPhase: number | null;
    reactorDrainPct: number;
  }
  const [reactorModal, setReactorModal] = useState<ReactorModalData | null>(null);
  const modalCountdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isDetailExiting, setIsDetailExiting] = useState(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const recalcConnector = useCallback(() => {
    if (!selectedRow || !layoutRef.current) { setConnectorPoints(null); return; }
    const rowEl = rowRefs.current.get(selectedRow.key);
    const detailEl = detailPanelRef.current;
    if (!rowEl || !detailEl) return;

    const layoutRect = layoutRef.current.getBoundingClientRect();
    const rowRect = rowEl.getBoundingClientRect();
    const detailRect = detailEl.getBoundingClientRect();

    const rowY = rowRect.top + rowRect.height / 2 - layoutRect.top;
    const detailMidY = detailRect.top + detailRect.height / 2 - layoutRect.top;

    if (selectedRow.panel === 'right') {
      // Exit row's left edge → go left → elbow 15px right of detail panel right edge →
      // go up/down to detail mid → enter detail panel right edge
      const rowX = rowRect.left - layoutRect.left;
      const elbowX = detailRect.right - layoutRect.left + 15;
      const detailEdgeX = detailRect.right - layoutRect.left;
      setConnectorPoints([rowX, rowY, elbowX, rowY, elbowX, detailMidY, detailEdgeX, detailMidY]);
    } else {
      // Exit row's right edge → go right → elbow 15px left of detail panel left edge →
      // go up/down to detail mid → enter detail panel left edge
      const rowX = rowRect.right - layoutRect.left;
      const elbowX = detailRect.left - layoutRect.left - 15;
      const detailEdgeX = detailRect.left - layoutRect.left;
      setConnectorPoints([rowX, rowY, elbowX, rowY, elbowX, detailMidY, detailEdgeX, detailMidY]);
    }
  }, [selectedRow]);

  // Recompute connector after render (detail panel must be in DOM first)
  // Also re-run when shipData changes so the connector stays aligned if panel content resizes
  useLayoutEffect(() => {
    recalcConnector();
  }, [recalcConnector, shipData]);

  // Re-compute on scroll (rows shift inside scrollable panel-content)
  useEffect(() => {
    const el = layoutRef.current;
    if (!el || !selectedRow) return;
    el.addEventListener('scroll', recalcConnector, { capture: true });
    return () => el.removeEventListener('scroll', recalcConnector, { capture: true });
  }, [selectedRow, recalcConnector]);

  const triggerDismiss = useCallback((nextRow?: SelectedRow) => {
    setIsDetailExiting(true);
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
    exitTimerRef.current = setTimeout(() => {
      setSelectedRow(nextRow ?? null);
      setConnectorPoints(null);
      setIsDetailExiting(false);
    }, 250);
  }, []);

  const handleRowClick = useCallback((row: SelectedRow) => {
    if (selectedRow?.key === row.key) {
      triggerDismiss();
    } else if (selectedRow) {
      triggerDismiss(row);
    } else {
      setSelectedRow(row);
      setConnectorPoints(null);
    }
  }, [selectedRow, triggerDismiss]);

  const setRowRef = useCallback((key: string, el: HTMLDivElement | null) => {
    if (el) rowRefs.current.set(key, el);
    else rowRefs.current.delete(key);
  }, []);

  // Clear optimistic allocations when server sends fresh data
  useEffect(() => {
    if (shipData) setLocalAllocations(null);
  }, [shipData]);


  const handlePowerAdjust = useCallback(async (sysKey: string, newAmount: number) => {
    setLocalAllocations(prev => ({ ...(prev ?? {}), [sysKey]: newAmount }));
    setTransitioningKeys(prev => ({ ...prev, [sysKey]: true }));
    if (transitionTimers.current[sysKey]) clearTimeout(transitionTimers.current[sysKey]);
    transitionTimers.current[sysKey] = setTimeout(() => {
      setTransitioningKeys(prev => { const next = { ...prev }; delete next[sysKey]; return next; });
    }, 5000);
    setReactorLoading(true);
    try {
      await gmConsoleApi.updateReactorPower(sysKey, newAmount);
    } catch {
      setLocalAllocations(null);
    } finally {
      setReactorLoading(false);
    }
  }, []);

  const handleReactorAction = useCallback((action: string) => {
    if (action === 'emergency_shutdown' || action === 'cold_start') {
      if (modalCountdownRef.current) clearInterval(modalCountdownRef.current);
      setReactorModal({ action, phase: 'confirm', countdown: 10, startupPhase: null, reactorDrainPct: 100 });
      return;
    }
    // vent_plasma keeps the inline confirm
    if (pendingAction !== action) {
      if (pendingActionTimeout.current) clearTimeout(pendingActionTimeout.current);
      setPendingAction(action);
      pendingActionTimeout.current = setTimeout(() => setPendingAction(null), 3000);
      return;
    }
    if (pendingActionTimeout.current) clearTimeout(pendingActionTimeout.current);
    setPendingAction(null);
    setReactorLoading(true);
    gmConsoleApi.triggerReactorAction(action as 'vent_plasma').finally(() => setReactorLoading(false));
  }, [pendingAction]);

  // Modal countdown tick
  useEffect(() => {
    if (!reactorModal || reactorModal.phase !== 'confirm') {
      if (modalCountdownRef.current) clearInterval(modalCountdownRef.current);
      return;
    }
    modalCountdownRef.current = setInterval(() => {
      setReactorModal(prev => {
        if (!prev || prev.phase !== 'confirm') return prev;
        if (prev.countdown <= 1) { clearInterval(modalCountdownRef.current!); return null; }
        return { ...prev, countdown: prev.countdown - 1 };
      });
    }, 1000);
    return () => { if (modalCountdownRef.current) clearInterval(modalCountdownRef.current); };
  }, [reactorModal?.phase]);

  const handleModalConfirm = useCallback(async () => {
    if (!reactorModal) return;
    const { action } = reactorModal;
    if (modalCountdownRef.current) clearInterval(modalCountdownRef.current);
    setReactorModal(prev => prev ? { ...prev, phase: 'running' } : null);

    if (action === 'emergency_shutdown' && shipData) {
      const systems = Object.entries(shipData.ship.systems).filter(([k]) => k !== 'reactor');
      const startAllocs: Record<string, number> = Object.fromEntries(
        systems.map(([k, s]) => [k, localAllocations?.[k] ?? s.power?.allocated ?? 0])
      );
      setLocalAllocations({ ...startAllocs });
      const STEPS = 16;
      for (let step = 1; step <= STEPS; step++) {
        await new Promise(r => setTimeout(r, 140));
        const factor = 1 - step / STEPS;
        setLocalAllocations(
          Object.fromEntries(Object.entries(startAllocs).map(([k, v]) => [k, Math.round(v * factor)]))
        );
      }
      await new Promise(r => setTimeout(r, 400));
      // drain reactor bar
      const RSTEPS = 10;
      for (let step = 1; step <= RSTEPS; step++) {
        await new Promise(r => setTimeout(r, 150));
        setReactorModal(prev => prev ? { ...prev, reactorDrainPct: Math.round((1 - step / RSTEPS) * 100) } : null);
      }
      await new Promise(r => setTimeout(r, 350));
      await gmConsoleApi.triggerReactorAction('emergency_shutdown');
      setReactorModal(null);
      return;
    }

    if (action === 'cold_start') {
      const delays = [900, 1100, 950, 850, 800];
      // show all phases immediately as pending, then work through them
      setReactorModal(prev => prev ? { ...prev, startupPhase: 0 } : null);
      for (let i = 0; i < STARTUP_PHASES.length - 1; i++) {
        await new Promise(r => setTimeout(r, delays[i]));
        if (i < STARTUP_PHASES.length - 2) {
          setReactorModal(prev => prev ? { ...prev, startupPhase: i + 1 } : null);
        }
      }
      await gmConsoleApi.triggerReactorAction('cold_start');
      setReactorModal(prev => prev ? { ...prev, startupPhase: STARTUP_PHASES.length - 1 } : null);
      await new Promise(r => setTimeout(r, 1200));
      setReactorModal(null);
    }
  }, [reactorModal, shipData, localAllocations]);

  if (!shipData) {
    return (
      <div className="section-empty">
        &gt; SHIP STATUS DATA UNAVAILABLE
      </div>
    );
  }

  const { ship } = shipData;
  const systems = ship.systems;

  const reactorOffline = ship.systems.reactor?.status === 'OFFLINE';

  // A system is effectively offline if: status=OFFLINE, reactor is down, or power allocated=0
  const isSystemEffectivelyOffline = (key: string, sys: typeof systems[string]): boolean => {
    if (sys.status === 'OFFLINE') return true;
    if (key !== 'reactor' && reactorOffline) return true;
    if (sys.power != null) {
      const allocated = localAllocations?.[key] ?? sys.power.allocated;
      if (allocated === 0) return true;
    }
    return false;
  };

  // Safe capacity: condition is on the same scale as power.max / power_capacity.
  // condition == max means full health (safe to run at full power).
  const getReactorSafeCapacity = (): number => {
    const reactor = ship.systems.reactor;
    if (!reactor) return 0;
    return Math.min(reactor.condition, reactor.power_capacity ?? 0);
  };

  const getSystemSafeMax = (sys: typeof systems[string]): number => {
    if (!sys.power) return 0;
    return Math.min(sys.condition, sys.power.max);
  };

  // Crisis tint: any resource <25%
  const hasCrisis = Object.values(ship.resources ?? {}).some(res => (res.current / res.max) < 0.25);

  const rawSystemEntries = Object.entries(systems);
  const systemEntries = [
    ...rawSystemEntries.filter(([k]) => k === 'reactor'),
    ...rawSystemEntries.filter(([k]) => k !== 'reactor'),
  ];
  const onlineCount = systemEntries.filter(([k, s]) => {
    if (isSystemEffectivelyOffline(k, s)) return false;
    const safeMax = s.power ? getSystemSafeMax(s) : Infinity;
    const alloc = localAllocations?.[k] ?? s.power?.allocated ?? 0;
    return !(s.power != null && alloc > safeMax) && s.status === 'ONLINE';
  }).length;
  const warnCount = systemEntries.filter(([k, s]) => {
    if (isSystemEffectivelyOffline(k, s)) return false;
    const safeMax = s.power ? getSystemSafeMax(s) : Infinity;
    const alloc = localAllocations?.[k] ?? s.power?.allocated ?? 0;
    return (s.power != null && alloc > safeMax) || ['STRESSED', 'DAMAGED', 'CRITICAL'].includes(s.status);
  }).length;
  const resourceEntries = Object.entries(ship.resources ?? {});

  return (
    <div className="section-status">
      <div
        className="status-map-layout"
        ref={layoutRef}
        onClick={() => selectedRow && triggerDismiss()}
      >
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

        {/* SVG connector overlay */}
        {connectorPoints && selectedRow && (
          <svg
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              pointerEvents: 'none', zIndex: 15, overflow: 'visible',
            }}
          >
            <defs>
              <filter id="connector-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            {/* Two-turn elbow connector */}
            <polyline
              points={`${connectorPoints[0]},${connectorPoints[1]} ${connectorPoints[2]},${connectorPoints[3]} ${connectorPoints[4]},${connectorPoints[5]} ${connectorPoints[6]},${connectorPoints[7]}`}
              fill="none"
              strokeWidth="1.5"
              strokeDasharray="4 3"
              filter="url(#connector-glow)"
              className="connector-line"
              style={{ stroke: selectedRow.accentColor }}
            />
            {/* Bracket tick at row origin */}
            <line
              x1={connectorPoints[0]} y1={connectorPoints[1] - 6}
              x2={connectorPoints[0]} y2={connectorPoints[1] + 6}
              strokeWidth="2"
              filter="url(#connector-glow)"
              style={{ stroke: selectedRow.accentColor }}
            />
          </svg>
        )}

        {/* Floating detail panel */}
        {selectedRow && (
          <div className={`status-detail-panel-wrap ${selectedRow.panel === 'left' ? 'side-left' : 'side-right'}`}>
            <div
              ref={detailPanelRef}
              className={`status-detail-panel${isDetailExiting ? ' exiting' : ''}`}
              style={{ '--panel-accent': selectedRow.accentColor } as React.CSSProperties}
              onClick={e => e.stopPropagation()}
            >
              <div className="detail-corner-tl" />
              <div className="detail-corner-br" />
              <div className="detail-panel-label">
                <SystemIcon name={ship.systems[selectedRow.key]?.icon ?? SYSTEM_ICONS_FALLBACK[selectedRow.key] ?? RESOURCE_ICONS[selectedRow.key] ?? ''} size={18} />
                {selectedRow.label}
              </div>
              {selectedRow.key === 'cargo' && ship.cargo ? (
                <div className="cargo-detail-body">
                  {ship.cargo.items.length === 0 && (
                    <div className="cargo-empty">— NO CARGO —</div>
                  )}
                  {ship.cargo.items.map((item, idx) => (
                    <div key={idx} className="cargo-item-row">
                      <span className="cargo-item-name">{item}</span>
                      <button
                        className="cargo-remove-btn"
                        disabled={cargoLoading}
                        onClick={async () => {
                          setCargoLoading(true);
                          try { await gmConsoleApi.updateShipCargo('remove', idx); }
                          finally { setCargoLoading(false); }
                        }}
                      >
                        <svg width="11" height="12" viewBox="0 0 11 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 3h9M4 3V2h3v1M2 3l.75 7.5h5.5L9 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                          <line x1="4.5" y1="5" x2="4.5" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                          <line x1="6.5" y1="5" x2="6.5" y2="9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                  <div className="cargo-add-row">
                    <input
                      className="cargo-add-input"
                      placeholder="Add item…"
                      value={newCargoItem}
                      onChange={e => setNewCargoItem(e.target.value)}
                      onKeyDown={async e => {
                        if (e.key === 'Enter' && newCargoItem.trim()) {
                          setCargoLoading(true);
                          try {
                            await gmConsoleApi.updateShipCargo('add', newCargoItem.trim());
                            setNewCargoItem('');
                          } finally { setCargoLoading(false); }
                        }
                      }}
                      disabled={cargoLoading}
                    />
                    <button
                      className="cargo-add-btn"
                      disabled={cargoLoading || !newCargoItem.trim()}
                      onClick={async () => {
                        if (!newCargoItem.trim()) return;
                        setCargoLoading(true);
                        try {
                          await gmConsoleApi.updateShipCargo('add', newCargoItem.trim());
                          setNewCargoItem('');
                        } finally { setCargoLoading(false); }
                      }}
                    >+</button>
                  </div>
                </div>
              ) : ship.systems[selectedRow.key] && selectedRow.key !== 'reactor' ? (() => {
                const sys = ship.systems[selectedRow.key];
                const allocated = localAllocations?.[selectedRow.key] ?? sys.power?.allocated ?? 0;
                const sysMax = sys.power?.max ?? 0;
                const effectiveOffline = isSystemEffectivelyOffline(selectedRow.key, sys);
                const safeMax = !effectiveOffline && sys.power ? getSystemSafeMax(sys) : null;
                const isStressed = !effectiveOffline && safeMax !== null && allocated > safeMax;
                const powerPct = !effectiveOffline && sysMax > 0 ? (allocated / sysMax) * 100 : 0;
                const safePct = isStressed && safeMax !== null && sysMax > 0 ? (safeMax / sysMax) * 100 : null;
                const detailBarStyle: React.CSSProperties = effectiveOffline
                  ? {}
                  : isStressed && safePct !== null && powerPct > 0
                    ? {
                        width: `${powerPct}%`,
                        background: `linear-gradient(to right, var(--status-online) ${(safePct / powerPct) * 100}%, var(--status-stressed) ${(safePct / powerPct) * 100}%)`,
                        boxShadow: '0 0 4px var(--status-stressed)',
                      }
                    : { width: `${powerPct}%` };
                return (
                  <div className="sys-detail-body">
                    <div className={`sys-detail-status s-${(effectiveOffline ? 'offline' : sys.status.toLowerCase())}${isStressed ? ' stressed' : ''}`}>
                      {effectiveOffline ? 'OFFLINE' : sys.status}
                    </div>
                    <div className="sys-detail-bar-track">
                      <div
                        className={`sys-detail-bar-fill${effectiveOffline ? ' offline' : ''}`}
                        style={effectiveOffline ? { width: '100%' } : {
                          ...detailBarStyle,
                          transition: transitioningKeys[selectedRow.key] ? 'width 5s ease-out, background 0.3s ease, box-shadow 0.3s ease' : undefined,
                        }}
                      />
                    </div>
                    <div className="sys-detail-pct">PWR {allocated} / {sysMax}</div>
                    {sys.subsystems && sys.subsystems.length > 0 && (
                      <div className="sys-subsystem-list">
                        {sys.subsystems.map((label, i) => {
                          const power = i + 1;
                          const active = !effectiveOffline && allocated >= power;
                          const viaOverdrive = active && isStressed && safeMax !== null && power > safeMax;
                          return (
                            <div key={i} className={`sys-subsystem-row${active ? ' active' : ''}${viaOverdrive ? ' overdrive' : ''}`}>
                              <span className="sys-subsystem-label">{label}</span>
                              <span className="sys-subsystem-status">
                                {active ? (viaOverdrive ? 'STRESSED' : 'ONLINE') : 'OFFLINE'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {!effectiveOffline && ((sys.warnings?.length ?? 0) > 0 || sys.faults?.some(f => f.active)) && (
                      <hr className="sys-section-divider" />
                    )}
                    {!effectiveOffline && sys.warnings && sys.warnings.length > 0 && (
                      <div className="sys-warnings-section">
                        <div className="sys-section-title">⚠ WARNINGS</div>
                        {sys.warnings.map((w, i) => (
                          <div key={i} className="sys-warning-row">
                            <span className="sys-warning-dot" />
                            <span>{w}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {!effectiveOffline && (sys.warnings?.length ?? 0) > 0 && sys.faults?.some(f => f.active) && (
                      <hr className="sys-section-divider" />
                    )}
                    {!effectiveOffline && sys.faults && sys.faults.some(f => f.active) && (
                      <div className="sys-fault-list">
                        <div className="sys-section-title" style={{ color: '#c03030' }}>◈ FAULTS</div>
                        {sys.faults.filter(f => f.active).map((f, i) => (
                          <div key={i} className="sys-fault-row">
                            <span className="sys-fault-dot" />
                            <span>{f.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })() : selectedRow.key === 'reactor' && ship.systems.reactor ? (() => {
                const reactor = ship.systems.reactor;
                const systemKeys = Object.keys(ship.systems).filter(k => k !== 'reactor');
                const powerGrid = Object.fromEntries(systemKeys.map(k => {
                  const sys = ship.systems[k];
                  const allocated = localAllocations?.[k] ?? sys.power?.allocated ?? 0;
                  const max = sys.power?.max ?? 0;
                  return [k, { allocated, max }];
                }));
                const capacity = reactor.power_capacity ?? 0;
                const reactorStatus = reactor.status;
                const isOffline = reactorStatus === 'OFFLINE';
                const safeCapacity = getReactorSafeCapacity();
                const totalAllocated = isOffline ? 0 : systemKeys.reduce((sum, k) => sum + powerGrid[k].allocated, 0);
                const isReactorStressed = !isOffline && totalAllocated > safeCapacity;
                const safeCapPct = capacity > 0 ? (safeCapacity / capacity) * 100 : 0;
                const allocPct = capacity > 0 ? (totalAllocated / capacity) * 100 : 0;
                const maxRemain = isOffline ? 0 : capacity - totalAllocated;

                // POWER bar: teal to safeCapacity; when stressed, extends red to totalAllocated
                const powerBarStyle: React.CSSProperties = isOffline
                  ? {}
                  : isReactorStressed
                    ? {
                        width: `${allocPct}%`,
                        background: `linear-gradient(to right, var(--status-online) ${(safeCapPct / allocPct) * 100}%, #c03030 ${(safeCapPct / allocPct) * 100}%)`,
                        boxShadow: '0 0 5px #c03030',
                        transition: 'background 0.3s ease, width 0.3s ease',
                      }
                    : { width: `${safeCapPct}%` };

                // ALLOCATED bar: teal gradient into stressed when overdrive
                const allocBarStyle: React.CSSProperties = isOffline
                  ? {}
                  : isReactorStressed && allocPct > 0
                    ? {
                        width: `${allocPct}%`,
                        background: `linear-gradient(to right, var(--status-online) ${(safeCapPct / allocPct) * 100}%, var(--status-stressed) ${(safeCapPct / allocPct) * 100}%)`,
                        boxShadow: '0 0 4px var(--status-stressed)',
                      }
                    : { width: `${allocPct}%` };

                return (
                  <div className="reactor-detail-body">
                    <div className="reactor-dual-bars">
                      <div className="reactor-bar-row">
                        <span className="reactor-bar-label">POWER</span>
                        <div className="reactor-bar-track">
                          <div className={`reactor-bar-fill${isOffline ? ' offline' : ''}`} style={isOffline ? { width: '100%' } : powerBarStyle} />
                        </div>
                        <span className={`reactor-bar-value${isReactorStressed ? ' overdrive' : ''}`}>
                          {isOffline ? '— / —' : `${safeCapacity} / ${capacity}`}
                        </span>
                      </div>
                      <div className="reactor-bar-row">
                        <span className="reactor-bar-label">ALLOC</span>
                        <div className="reactor-bar-track">
                          <div className={`reactor-bar-fill${isOffline ? ' offline' : ''}`} style={isOffline ? {} : allocBarStyle} />
                        </div>
                        <span className={`reactor-bar-value${isReactorStressed ? ' overdrive' : ''}`}>
                          {isOffline ? '— / —' : `${totalAllocated} / ${capacity}`}
                        </span>
                      </div>
                      {isReactorStressed && <div className="power-overdrive-badge">⚠ STRESSED</div>}
                    </div>

                    <div className="power-grid">
                      {systemKeys.map(sysKey => {
                        const { allocated: amount, max: sysMax } = powerGrid[sysKey];
                        const sys = ship.systems[sysKey];
                        const sysLabel = sys?.display_name ?? sysKey.replace(/_/g, ' ').toUpperCase();
                        const sysSafeMax = !isOffline && sys ? getSystemSafeMax(sys) : 0;
                        const sysIsOverdrive = !isOffline && amount > sysSafeMax;
                        const sysSafePct = !isOffline && sysMax > 0 ? (sysSafeMax / sysMax) * 100 : 0;
                        const sysAllocPct = !isOffline && sysMax > 0 ? (amount / sysMax) * 100 : 0;
                        const miniBarStyle: React.CSSProperties = sysIsOverdrive && sysAllocPct > 0
                          ? {
                              width: `${sysAllocPct}%`,
                              background: `linear-gradient(to right, var(--status-online) ${(sysSafePct / sysAllocPct) * 100}%, var(--status-stressed) ${(sysSafePct / sysAllocPct) * 100}%)`,
                            }
                          : { width: `${sysAllocPct}%` };
                        return (
                          <div key={sysKey} className="power-row">
                            <span className="power-row-name">{sysLabel}</span>
                            <div className="power-bar-mini-track">
                              <div className="power-bar-mini-fill" style={{
                                ...miniBarStyle,
                                transition: transitioningKeys[sysKey] ? 'width 5s ease-out' : undefined,
                              }} />
                            </div>
                            <span className={`power-amount${sysIsOverdrive ? ' overdrive' : ''}`}>
                              {isOffline ? '—' : `${amount}/${sysMax}`}
                            </span>
                            <button
                              className="power-adj-btn"
                              disabled={isOffline || amount <= 0 || reactorLoading}
                              onClick={() => handlePowerAdjust(sysKey, amount - 1)}
                            >−</button>
                            <button
                              className="power-adj-btn"
                              disabled={isOffline || maxRemain <= 0 || amount >= sysMax || reactorLoading}
                              onClick={() => handlePowerAdjust(sysKey, amount + 1)}
                            >+</button>
                          </div>
                        );
                      })}
                    </div>

                    {reactor.warnings && reactor.warnings.length > 0 && (
                      <div className="sys-warnings-section">
                        <div className="sys-section-title">⚠ WARNINGS</div>
                        {reactor.warnings.map((w, i) => (
                          <div key={i} className="sys-warning-row">
                            <span className="sys-warning-dot" />
                            <span>{w}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {(reactor.warnings?.length ?? 0) > 0 && reactor.faults?.some(f => f.active) && (
                      <hr className="sys-section-divider" />
                    )}
                    {reactor.faults && reactor.faults.some(f => f.active) && (
                      <div className="sys-fault-list">
                        <div className="sys-section-title" style={{ color: '#c03030' }}>◈ FAULTS</div>
                        {reactor.faults.filter(f => f.active).map((f, i) => (
                          <div key={i} className="sys-fault-row">
                            <span className="sys-fault-dot" />
                            <span>{f.label}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {((reactor.warnings?.length ?? 0) > 0 || reactor.faults?.some(f => f.active)) && (
                      <hr className="sys-section-divider" />
                    )}
                    <div className="reactor-actions">
                      {reactorStatus !== 'OFFLINE' && (
                        <button
                          className={`reactor-action-btn${pendingAction === 'emergency_shutdown' ? ' confirm' : ''}`}
                          disabled={reactorLoading}
                          onClick={() => handleReactorAction('emergency_shutdown')}
                        >
                          {pendingAction === 'emergency_shutdown' ? 'CONFIRM SHUTDOWN?' : 'EMERGENCY SHUTDOWN'}
                        </button>
                      )}
                      {reactorStatus === 'OFFLINE' && (
                        <button
                          className={`reactor-action-btn${pendingAction === 'cold_start' ? ' confirm' : ''}`}
                          disabled={reactorLoading}
                          onClick={() => handleReactorAction('cold_start')}
                        >
                          {pendingAction === 'cold_start' ? 'CONFIRM COLD START?' : 'COLD START SEQUENCE'}
                        </button>
                      )}
                      {reactorStatus === 'CRITICAL' && (
                        <button
                          className={`reactor-action-btn${pendingAction === 'vent_plasma' ? ' confirm' : ''}`}
                          disabled={reactorLoading}
                          onClick={() => handleReactorAction('vent_plasma')}
                        >
                          {pendingAction === 'vent_plasma' ? 'CONFIRM VENT?' : 'VENT PLASMA'}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })() : (
                <div className="detail-panel-body">{selectedRow.detail}</div>
              )}
            </div>
          </div>
        )}

        {/* Reactor modal */}
        {reactorModal && (
          <div
            className="reactor-modal-overlay"
            onClick={reactorModal.phase === 'confirm' ? () => setReactorModal(null) : undefined}
          >
            <div
              className={`reactor-modal reactor-modal--${reactorModal.action === 'emergency_shutdown' ? 'shutdown' : 'startup'}`}
              onClick={e => e.stopPropagation()}
            >
              <div className="reactor-modal__corner reactor-modal__corner--tl" />
              <div className="reactor-modal__corner reactor-modal__corner--br" />
              {reactorModal.phase === 'confirm' ? (
                <>
                  <div className="reactor-modal__title">
                    {reactorModal.action === 'emergency_shutdown' ? '⚠ EMERGENCY SHUTDOWN' : 'COLD START SEQUENCE'}
                  </div>
                  <div className="reactor-modal__body">
                    {reactorModal.action === 'emergency_shutdown'
                      ? 'All systems will be powered down. Reactor will enter emergency offline state.'
                      : 'Initiate cold start sequence. Reactor will attempt to come back online at reduced capacity.'}
                  </div>
                  <div className="reactor-modal__countdown">
                    <div className="reactor-modal__countdown-track">
                      <div className="reactor-modal__countdown-fill" style={{ width: `${(reactorModal.countdown / 10) * 100}%` }} />
                    </div>
                    <span className="reactor-modal__countdown-label">AUTO-CANCEL IN {reactorModal.countdown}s</span>
                  </div>
                  <div className="reactor-modal__actions">
                    <button className="reactor-modal__btn reactor-modal__btn--cancel" onClick={() => setReactorModal(null)}>CANCEL</button>
                    <button className="reactor-modal__btn reactor-modal__btn--confirm" onClick={handleModalConfirm}>
                      {reactorModal.action === 'emergency_shutdown' ? 'CONFIRM SHUTDOWN' : 'CONFIRM COLD START'}
                    </button>
                  </div>
                </>
              ) : reactorModal.action === 'emergency_shutdown' ? (
                <>
                  <div className="reactor-modal__title reactor-modal__title--running">EMERGENCY SHUTDOWN IN PROGRESS</div>
                  <div className="reactor-modal__drain-list">
                    {Object.entries(ship.systems).filter(([k]) => k !== 'reactor').map(([k, s]) => {
                      const startAmt = s.power?.allocated ?? 0;
                      const cur = localAllocations?.[k] ?? startAmt;
                      const pct = startAmt > 0 ? Math.max(0, (cur / (s.power?.max ?? 1)) * 100) : 0;
                      const label = s.display_name ?? k.replace(/_/g, ' ').toUpperCase();
                      return (
                        <div key={k} className="reactor-modal__drain-row">
                          <span className="reactor-modal__drain-label">{label}</span>
                          <div className="reactor-modal__drain-track">
                            <div className="reactor-modal__drain-fill" style={{ width: `${pct}%`, transition: 'width 0.15s ease-out' }} />
                          </div>
                          <span className={`reactor-modal__drain-status${cur === 0 ? ' offline' : ''}`}>{cur === 0 ? 'OFFLINE' : 'DRAINING'}</span>
                        </div>
                      );
                    })}
                    <div className="reactor-modal__drain-row reactor-modal__drain-row--reactor">
                      <span className="reactor-modal__drain-label">REACTOR CORE</span>
                      <div className="reactor-modal__drain-track">
                        <div className="reactor-modal__drain-fill reactor-modal__drain-fill--reactor" style={{ width: `${reactorModal.reactorDrainPct}%`, transition: 'width 0.18s ease-out' }} />
                      </div>
                      <span className={`reactor-modal__drain-status${reactorModal.reactorDrainPct === 0 ? ' offline' : ''}`}>{reactorModal.reactorDrainPct === 0 ? 'OFFLINE' : 'DRAINING'}</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="reactor-modal__title">COLD START SEQUENCE</div>
                  <div className="reactor-startup-sequence">
                    {STARTUP_PHASES.map((phase, i) => {
                      const cur = reactorModal.startupPhase ?? 0;
                      const cls = i < cur ? 'complete' : i === cur ? (i === STARTUP_PHASES.length - 1 ? 'final complete' : 'active') : 'pending';
                      return <div key={i} className={`startup-phase-line ${cls}`}>{phase}</div>;
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* LEFT PANEL — Systems */}
        <div className="status-panel-left-wrap" onClick={e => e.stopPropagation()}>
          <DashboardPanel
            title="SYSTEMS"
            chamferCorners={['tr', 'bl']}
            footer={
              <>{onlineCount}/{systemEntries.length} OPERATIONAL{warnCount > 0 ? ` · ⚠ ${warnCount} WARNING${warnCount > 1 ? 'S' : ''}` : ''}</>
            }
          >
            {/* Ship stat rows — Thrusters / Battle / Systems */}
            {([
              { key: 'thrusters', label: 'THRUSTERS', value: ship.stats?.thrusters ?? 20 },
              { key: 'battle',    label: 'BATTLE',    value: ship.stats?.battle    ?? 5  },
              { key: 'systems',   label: 'SYSTEMS',   value: ship.stats?.systems   ?? 5  },
            ] as const).map(({ key, label, value }, i) => (
              <div
                key={key}
                ref={el => setRowRef(key, el)}
                className={`stat-row${!staggerComplete ? ' terminal-row-stagger' : ''}${selectedRow?.key === key ? ' row-selected' : ''}`}
                style={!staggerComplete ? { animationDelay: `${i * 80}ms` } : undefined}
                onClick={() => handleRowClick({
                  panel: 'left', key, label,
                  detail: String(value).padStart(2, '0'),
                  accentColor: HULL_ACCENT,
                })}
              >
                <div className="stat-row-inner">
                  <span className="stat-label">{label}</span>
                  <span className="stat-value">{String(value).padStart(2, '0')}</span>
                </div>
              </div>
            ))}

            {/* System rows */}
            {systemEntries.map(([key, sys], i) => {
              const effectiveOffline = isSystemEffectivelyOffline(key, sys);
              const allocated = key === 'reactor'
                ? (effectiveOffline ? 0 : Object.entries(systems).filter(([k]) => k !== 'reactor').reduce((sum, [k, s]) => sum + (localAllocations?.[k] ?? s.power?.allocated ?? 0), 0))
                : localAllocations?.[key] ?? sys.power?.allocated ?? 0;
              const safeMax = !effectiveOffline
                ? (key === 'reactor' ? getReactorSafeCapacity() : (sys.power ? getSystemSafeMax(sys) : null))
                : null;
              const isStressed = !effectiveOffline && safeMax !== null && allocated > safeMax;
              const displayStatus: SystemStatus = effectiveOffline ? 'OFFLINE' : sys.status;
              const staggerDelay = (i + 2) * 80;
              const label = sys.display_name ?? key.replace(/_/g, ' ').toUpperCase();
              const isSelected = selectedRow?.key === key;
              const condMax = sys.power?.max ?? sys.power_capacity ?? 1;
              const barPct = effectiveOffline ? 100 : sys.power ? (allocated / sys.power.max) * 100 : (sys.condition / condMax) * 100;
              const safePct = isStressed && safeMax !== null && sys.power ? (safeMax / sys.power.max) * 100 : null;
              const barFillStyle: React.CSSProperties = effectiveOffline
                ? {}
                : isStressed && safePct !== null
                  ? {
                      width: `${barPct}%`,
                      background: `linear-gradient(to right, var(--status-online) ${(safePct / barPct) * 100}%, var(--status-stressed) ${(safePct / barPct) * 100}%)`,
                      boxShadow: '0 0 4px var(--status-stressed)',
                    }
                  : { width: `${barPct}%` };
              return (
                <div
                  key={key}
                  ref={el => setRowRef(key, el)}
                  className={`sys-row s-${displayStatus.toLowerCase()}${isStressed ? ' stressed' : ''}${changingFlags[key] ? ' state-changing' : ''}${!staggerComplete ? ' terminal-row-stagger' : ''}${isSelected ? ' row-selected' : ''}`}
                  style={!staggerComplete ? { animationDelay: `${staggerDelay}ms` } : undefined}
                  onClick={() => handleRowClick({
                    panel: 'left', key, label,
                    detail: `${displayStatus}  ${sys.condition}%${sys.warnings?.[0] ? `\n${sys.warnings[0]}` : ''}`,
                    accentColor: STATUS_ACCENT[displayStatus],
                  })}
                >
                  <div className="sys-row-top">
                    <span className="sys-name">{label}</span>
                    <span className="sys-status">{displayStatus}</span>
                  </div>
                  <div className="sys-bar-track">
                    <div className={`sys-bar-fill${effectiveOffline ? ' offline' : ''}`} style={barFillStyle} />
                  </div>
                  {key !== 'reactor' && <div className="sys-pct">{sys.power ? `${allocated}/${sys.power.max} pwr` : effectiveOffline ? '' : `${sys.condition}/${sys.power_capacity ?? 0}`}</div>}
                  {isStressed && !effectiveOffline && (
                    <div className="sys-override-indicator">⚠ STRESSED</div>
                  )}
                  {!effectiveOffline && (sys.warnings?.length || sys.faults?.some(f => f.active)) && (
                    <div className="sys-alert-indicators">
                      {(sys.warnings?.length ?? 0) > 0 && (
                        <span className="sys-alert-badge sys-alert-warning">◆ {sys.warnings!.length} WARNING{sys.warnings!.length > 1 ? 'S' : ''}</span>
                      )}
                      {sys.faults?.some(f => f.active) && (
                        <span className="sys-alert-badge sys-alert-fault">● {sys.faults!.filter(f => f.active).length} FAULT{sys.faults!.filter(f => f.active).length > 1 ? 'S' : ''}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </DashboardPanel>
        </div>

        {/* RIGHT PANEL — Resources */}
        <div className="status-panel-right-wrap" onClick={e => e.stopPropagation()}>
          <DashboardPanel
            title="RESOURCES"
            chamferCorners={['tl', 'br']}
            footer={<>CREW {ship.crew_count}/{ship.crew_capacity}</>}
          >
            {resourceEntries.map(([key, res], i) => {
              const pct = Math.round((res.current / res.max) * 100);
              const thresholdClass = getThresholdClass(pct);
              const label = res.display_name ?? key.replace(/_/g, ' ').toUpperCase();
              const isSelected = selectedRow?.key === key;
              return (
                <div
                  key={key}
                  ref={el => setRowRef(key, el)}
                  className={`res-row${!staggerComplete ? ' terminal-row-stagger' : ''}${isSelected ? ' row-selected' : ''}`}
                  style={!staggerComplete ? { animationDelay: `${i * 80}ms` } : undefined}
                  onClick={() => handleRowClick({
                    panel: 'right', key, label,
                    detail: `${res.current} / ${res.max}${res.info ? `\n${res.info}` : ''}`,
                    accentColor: RESOURCE_ACCENT,
                  })}
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
            })}
            {ship.cargo && (
              <div
                ref={el => setRowRef('cargo', el)}
                className={`res-row${!staggerComplete ? ' terminal-row-stagger' : ''}${selectedRow?.key === 'cargo' ? ' row-selected' : ''}`}
                style={!staggerComplete ? { animationDelay: `${resourceEntries.length * 80}ms` } : undefined}
                onClick={() => handleRowClick({
                  panel: 'right', key: 'cargo', label: 'CARGO',
                  detail: '',
                  accentColor: RESOURCE_ACCENT,
                })}
              >
                <div className="res-row-top">
                  <span className="res-name">CARGO</span>
                  <span className="res-val">{ship.cargo.items.length}</span>
                </div>
              </div>
            )}
          </DashboardPanel>
        </div>
      </div>
    </div>
  );
}
