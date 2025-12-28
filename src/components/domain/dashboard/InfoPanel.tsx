import { useEffect, useRef, useState } from 'react';
import { useTypewriter } from '@hooks/useTypewriter';
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
  /** Typewriter speed in ms per character */
  typewriterSpeed?: number;
}

/**
 * Reusable floating info panel with typewriter effect.
 * Can be used for system info, planet info, station info, etc.
 */
export function InfoPanel({
  title,
  content,
  visible,
  showDecorators = true,
  typewriterSpeed = 15,
}: InfoPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [triangleTop, setTriangleTop] = useState(0);

  // Typewriter effect - cursor is now inline in the content
  const { displayedContent } = useTypewriter(
    visible ? content : '',
    { speed: typewriterSpeed, showCursor: true }
  );

  // Update triangle position when panel resizes or visibility changes
  useEffect(() => {
    function updatePosition() {
      if (!panelRef.current || !visible || !showDecorators) return;

      const panelRect = panelRef.current.getBoundingClientRect();
      // Triangle positioned below panel bottom
      const triangleHeight = 35;
      setTriangleTop(panelRect.bottom + 5 - triangleHeight - 5);
    }

    updatePosition();

    // Set up ResizeObserver
    const resizeObserver = new ResizeObserver(updatePosition);
    if (panelRef.current) {
      resizeObserver.observe(panelRef.current);
    }

    window.addEventListener('resize', updatePosition);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updatePosition);
    };
  }, [visible, showDecorators]);

  return (
    <>
      {/* Main info panel */}
      <div
        ref={panelRef}
        className={`info-panel ${visible ? 'visible' : ''}`}
      >
        <div className="info-panel-header">
          <h3>{title}</h3>
        </div>
        <div className="info-panel-content">
          <div
            className="info-panel-body"
            dangerouslySetInnerHTML={{ __html: displayedContent }}
          />
        </div>
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
}

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
