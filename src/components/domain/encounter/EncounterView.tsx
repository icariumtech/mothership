/**
 * EncounterView - Clean map display for player terminal
 *
 * Renders the appropriate visualization based on selected location type:
 * - No location: Galaxy view (3D stars, routes, nebulae) with auto-rotate
 * - System: System view (3D solar system with planets)
 * - Planet/Moon: Orbit view (3D planet with moons/stations/surface)
 * - Station/Ship/Deck/Room: 2D encounter map image
 *
 * Supports multi-deck maps with level indicator and GM-controlled visibility.
 * No info panels, no navigation - just clean view with camera controls.
 */

import { useState, useEffect, useMemo } from 'react';
import { GalaxyMap } from '@components/domain/maps/GalaxyMap';
import { SystemMap } from '@components/domain/maps/SystemMap';
import { OrbitMap } from '@components/domain/maps/OrbitMap';
import { EncounterMapDisplay } from './EncounterMapDisplay';
import { LevelIndicator } from './LevelIndicator';
import type { StarMapData } from '../../../types/starMap';
import type { RoomVisibilityState } from '../../../types/encounterMap';
import './EncounterView.css';

// Location data from API
interface LocationData {
  slug: string;
  name: string;
  type: string;
  status?: string;
  description?: string;
  has_map?: boolean;
  map?: {
    image_path?: string;
    name?: string;
    // Encounter map fields (when present, use SVG renderer)
    grid?: {
      width: number;
      height: number;
      unit_size?: number;
      show_grid?: boolean;
    };
    rooms?: any[];
    corridors?: any[];
    doors?: any[];
    terminals?: any[];
    poi?: any[];
  };
  // For systems/planets, we need parent info
  parent_slug?: string;
  system_slug?: string;
}

interface EncounterViewProps {
  /** Location slug to display */
  locationSlug: string | null;
  /** Location type (system, planet, moon, station, ship, base, deck, room) */
  locationType: string | null;
  /** Full location data from API */
  locationData: LocationData | null;
  /** Current deck level (1-indexed) */
  encounterLevel?: number;
  /** Total number of decks (for multi-deck maps) */
  totalDecks?: number;
  /** Current deck name */
  deckName?: string;
  /** Room visibility state from GM */
  roomVisibility?: RoomVisibilityState;
}

// Determine view mode based on location type
type ViewMode = 'galaxy' | 'system' | 'orbit' | 'map';

function getViewMode(locationType: string | null): ViewMode {
  if (!locationType) return 'galaxy';

  switch (locationType.toLowerCase()) {
    case 'system':
      return 'system';
    case 'planet':
    case 'moon':
      return 'orbit';
    case 'station':
    case 'ship':
    case 'base':
    case 'deck':
    case 'room':
    case 'level':
    case 'section':
      return 'map';
    default:
      return 'galaxy';
  }
}

export function EncounterView({
  locationSlug,
  locationType,
  locationData,
  encounterLevel = 1,
  totalDecks = 1,
  deckName,
  roomVisibility,
}: EncounterViewProps) {
  const [starMapData, setStarMapData] = useState<StarMapData | null>(null);

  // Determine view mode
  const viewMode = useMemo(() => getViewMode(locationType), [locationType]);

  // Fetch star map data for galaxy view
  useEffect(() => {
    async function fetchStarMapData() {
      try {
        const response = await fetch('/api/star-map/');
        const data = await response.json();
        setStarMapData(data);
      } catch (error) {
        console.error('Failed to fetch star map data:', error);
      }
    }
    fetchStarMapData();
  }, []);

  // Extract system and body slugs from location data
  // For orbit view, we need both system_slug and body_slug
  const systemSlug = useMemo(() => {
    if (viewMode === 'system') {
      return locationSlug;
    }
    if (viewMode === 'orbit' && locationData) {
      // Planet/moon needs parent system slug
      return locationData.system_slug || locationData.parent_slug || null;
    }
    return null;
  }, [viewMode, locationSlug, locationData]);

  const bodySlug = useMemo(() => {
    if (viewMode === 'orbit') {
      return locationSlug;
    }
    return null;
  }, [viewMode, locationSlug]);

  return (
    <div className="encounter-view">
      {/* Galaxy view - shown when no location selected */}
      {viewMode === 'galaxy' && (
        <GalaxyMap
          data={starMapData}
          selectedSystem={null}
          // No onSystemSelect - navigation disabled
          visible={true}
        />
      )}

      {/* System view - shown for system locations */}
      {viewMode === 'system' && systemSlug && (
        <SystemMap
          systemSlug={systemSlug}
          selectedPlanet={null}
          // No callbacks - navigation disabled, camera only
        />
      )}

      {/* Orbit view - shown for planet/moon locations */}
      {viewMode === 'orbit' && systemSlug && bodySlug && (
        <OrbitMap
          systemSlug={systemSlug}
          bodySlug={bodySlug}
          selectedElement={null}
          selectedElementType={null}
          // No callbacks - navigation disabled, camera only
        />
      )}

      {/* 2D Map display - shown for facilities (stations, ships, decks, rooms) */}
      {viewMode === 'map' && (
        <>
          <EncounterMapDisplay
            locationData={locationData}
            roomVisibility={roomVisibility}
          />
          {/* Level indicator for multi-deck maps */}
          <LevelIndicator
            currentLevel={encounterLevel}
            totalLevels={totalDecks}
            deckName={deckName}
          />
        </>
      )}
    </div>
  );
}
