import { useEffect, useRef, useState, forwardRef, useMemo } from 'react';
import { Panel } from '@components/ui/Panel';
import { useTypewriterState } from '@/stores/sceneStore';
import { computeTypewriterContent } from '@/utils/typewriterUtils';
import './InfoPanel.css';

interface InfoPanelProps {
  /** Panel title displayed in header */
  title: string;
  /** HTML content to display with typewriter effect */
  content: string;
  /** Whether the panel is visible */
  visible: boolean;
  /** Show decorative elements below panel */
  showDecorators?: boolean;
  /** @deprecated Typewriter speed - no longer used (RAF-driven now) */
  typewriterSpeed?: number;
}

/**
 * Reusable floating info panel with typewriter effect.
 * Can be used for system info, planet info, station info, etc.
 * Now uses RAF-driven typewriter via Zustand store for smooth animations.
 */
export const InfoPanel = forwardRef<HTMLDivElement, InfoPanelProps>(({
  title,
  content,
  visible,
  showDecorators = true,
  typewriterSpeed, // Retained for API compatibility (not used - RAF-driven now)
}, ref) => {
  // Avoid unused variable warning
  void typewriterSpeed;
  const internalPanelRef = useRef<HTMLDivElement>(null);
  const [triangleTop, setTriangleTop] = useState(0);

  // Subscribe to Zustand typewriter state (RAF-driven)
  const typewriterState = useTypewriterState();

  // Compute displayed content based on Zustand progress
  const displayedContent = useMemo(() => {
    if (!visible || !content) {
      return '';
    }

    // Use Zustand typewriter state if active and text matches
    if (typewriterState.active && typewriterState.text === content) {
      return computeTypewriterContent({
        content: typewriterState.text,
        progress: typewriterState.progress,
        showCursor: true,
        cursorChar: '_',
      });
    }

    // If typewriter is not active but we have content, show it fully
    // This handles the case where content changes but typewriter hasn't started yet
    if (typewriterState.text === content && typewriterState.progress === 1) {
      return content;
    }

    // Content doesn't match typewriter state - show without animation
    // This can happen during rapid transitions
    return content;
  }, [visible, content, typewriterState]);

  const isTyping = typewriterState.active && typewriterState.text === content;

  // Expose isTyping state to parent via data attribute for backward compatibility
  useEffect(() => {
    const panelRef = (ref as React.RefObject<HTMLDivElement>)?.current || internalPanelRef.current;
    if (panelRef) {
      panelRef.dataset.isTyping = String(isTyping);
    }
  }, [isTyping, ref]);

  // Update triangle position when panel resizes or visibility changes
  useEffect(() => {
    function updatePosition() {
      const panelElement = (ref as React.RefObject<HTMLDivElement>)?.current || internalPanelRef.current;
      if (!panelElement || !visible || !showDecorators) return;

      // Find the actual panel wrapper inside
      const panelWrapper = panelElement.querySelector('.panel-wrapper');
      if (panelWrapper) {
        const panelRect = panelWrapper.getBoundingClientRect();
        // Position triangle just below panel with 5px gap
        setTriangleTop(panelRect.height - 5);
      }
    }

    updatePosition();

    // Set up ResizeObserver
    const resizeObserver = new ResizeObserver(updatePosition);
    const panelElement = (ref as React.RefObject<HTMLDivElement>)?.current || internalPanelRef.current;
    if (panelElement) {
      resizeObserver.observe(panelElement);
    }

    window.addEventListener('resize', updatePosition);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updatePosition);
    };
  }, [visible, showDecorators, ref]);

  return (
    <>
      {/* Main info panel - uses base Panel component with info variant */}
      <div
        ref={(node) => {
          // Assign to both internal ref and forwarded ref
          internalPanelRef.current = node;
          if (typeof ref === 'function') {
            ref(node);
          } else if (ref) {
            (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
          }
        }}
        className={`info-panel-wrapper ${visible ? 'visible' : ''}`}
      >
        <Panel
          title={title}
          variant="info"
          chamferCorners={['tl', 'br']}
          chamferSize={{ tl: 12, br: 48 }}
          scrollable={true}
        >
          <div
            className="info-panel-body"
            dangerouslySetInnerHTML={{ __html: displayedContent }}
          />
        </Panel>
      </div>

      {/* Triangle decoration - positioned as sibling to avoid clip-path clipping */}
      {showDecorators && (
        <div
          className={`info-panel-triangle ${visible ? 'visible' : ''}`}
          style={{ top: triangleTop }}
        />
      )}
    </>
  );
});

InfoPanel.displayName = 'InfoPanel';

// ============================================
// Helper functions to build content HTML
// ============================================

interface InfoField {
  label: string;
  value: string | number | boolean | undefined | null;
}

/**
 * Build HTML for a list of label/value pairs.
 * Skips undefined/null values.
 */
export function buildInfoHTML(fields: InfoField[]): string {
  return fields
    .filter(f => f.value !== undefined && f.value !== null && f.value !== '')
    .map(f => `<p><span class="info-label">${f.label}:</span> <span class="info-value">${f.value}</span></p>`)
    .join('');
}

/**
 * Build HTML for star system info
 */
export function buildSystemInfoHTML(system: {
  type?: string;
  description?: string;
  population?: string;
  position?: number[];
  has_system_map?: boolean;
}): string {
  const fields: InfoField[] = [
    { label: 'TYPE', value: system.type?.toUpperCase() },
    { label: 'DESCRIPTION', value: system.description },
    { label: 'POPULATION', value: system.population },
    { label: 'COORDINATES', value: system.position?.join(', ') },
    { label: 'SYSTEM MAP', value: system.has_system_map ? 'AVAILABLE' : undefined },
  ];
  return buildInfoHTML(fields);
}

/**
 * Build HTML for planet info
 */
export function buildPlanetInfoHTML(planet: {
  type?: string;
  description?: string;
  population?: string;
  habitability?: string;
  industry?: string;
  orbital_radius?: number;
  orbital_period?: number;
  inclination?: number;
  tidally_locked?: boolean;
}): string {
  const fields: InfoField[] = [
    { label: 'TYPE', value: planet.type?.toUpperCase().replace('_', ' ') },
    { label: 'DESCRIPTION', value: planet.description },
    { label: 'POPULATION', value: planet.population },
    { label: 'HABITABILITY', value: planet.habitability },
    { label: 'INDUSTRY', value: planet.industry },
    { label: 'ORBITAL RADIUS', value: planet.orbital_radius ? `${planet.orbital_radius} AU` : undefined },
    { label: 'ORBITAL PERIOD', value: planet.orbital_period ? `${planet.orbital_period} days` : undefined },
    { label: 'INCLINATION', value: planet.inclination !== undefined ? `${planet.inclination}°` : undefined },
    { label: 'ROTATION', value: planet.tidally_locked !== undefined ? (planet.tidally_locked ? 'TIDALLY LOCKED' : 'NORMAL') : undefined },
  ];
  return buildInfoHTML(fields);
}

/**
 * Build HTML for moon info
 * Supports both flat fields and nested info object from orbit map API
 */
export function buildMoonInfoHTML(moon: {
  type?: string;
  description?: string;
  population?: string;
  orbital_radius?: number;
  has_facilities?: boolean;
  info?: {
    description?: string;
    population?: string;
    type?: string;
  };
}): string {
  const fields: InfoField[] = [
    { label: 'TYPE', value: (moon.info?.type || moon.type || 'Moon').toUpperCase() },
    { label: 'DESCRIPTION', value: moon.info?.description || moon.description },
    { label: 'POPULATION', value: moon.info?.population || moon.population },
    { label: 'ORBITAL RADIUS', value: moon.orbital_radius ? `${moon.orbital_radius} km` : undefined },
    { label: 'FACILITIES', value: moon.has_facilities ? 'PRESENT' : undefined },
  ];
  return buildInfoHTML(fields);
}

/**
 * Build HTML for station/facility info
 * Supports both flat fields and nested info object from orbit map API
 */
export function buildStationInfoHTML(station: {
  type?: string;
  description?: string;
  population?: string;
  status?: string;
  orbital_radius?: number;
  info?: {
    description?: string;
    population?: string;
    type?: string;
    status?: string;
  };
}): string {
  const fields: InfoField[] = [
    { label: 'TYPE', value: (station.info?.type || station.type || 'Orbital Station').toUpperCase() },
    { label: 'DESCRIPTION', value: station.info?.description || station.description },
    { label: 'POPULATION', value: station.info?.population || station.population },
    { label: 'STATUS', value: (station.info?.status || station.status)?.toUpperCase() },
    { label: 'ORBITAL RADIUS', value: station.orbital_radius ? `${station.orbital_radius} km` : undefined },
  ];
  return buildInfoHTML(fields);
}

/**
 * Build HTML for surface marker info
 * Supports both flat fields and nested info object from orbit map API
 */
export function buildSurfaceMarkerInfoHTML(marker: {
  type?: string;
  marker_type?: string;
  description?: string;
  population?: string;
  latitude?: number;
  longitude?: number;
  traffic?: string;
  status?: string;
  info?: {
    description?: string;
    population?: string;
    type?: string;
    status?: string;
    traffic?: string;
  };
}): string {
  const fields: InfoField[] = [
    { label: 'TYPE', value: (marker.info?.type || marker.marker_type || marker.type || 'Surface Location').toUpperCase() },
    { label: 'DESCRIPTION', value: marker.info?.description || marker.description },
    { label: 'POPULATION', value: marker.info?.population || marker.population },
    { label: 'COORDINATES', value: marker.latitude !== undefined && marker.longitude !== undefined
      ? `${marker.latitude.toFixed(1)}°, ${marker.longitude.toFixed(1)}°`
      : undefined },
    { label: 'TRAFFIC', value: marker.info?.traffic || marker.traffic },
    { label: 'STATUS', value: (marker.info?.status || marker.status)?.toUpperCase() },
  ];
  return buildInfoHTML(fields);
}
