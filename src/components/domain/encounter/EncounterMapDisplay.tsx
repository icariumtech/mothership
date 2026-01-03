/**
 * EncounterMapDisplay - 2D map display for facilities
 *
 * Supports two map formats:
 * 1. Interactive SVG maps (new) - YAML with rooms, doors, terminals, POIs
 * 2. Legacy PNG images - Static map images
 *
 * Also supports multi-deck maps with room visibility control.
 * Automatically routes to the correct renderer based on map data.
 */

import './EncounterMapDisplay.css';
import { EncounterMapRenderer } from './EncounterMapRenderer';
import {
  EncounterMapData,
  RoomVisibilityState,
  isEncounterMap,
  isMultiDeckMap,
  MultiDeckMapData,
} from '../../../types/encounterMap';

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
    // Multi-deck map fields
    is_multi_deck?: boolean;
    manifest?: any;
    current_deck?: any;
    current_deck_id?: string;
    room_visibility?: RoomVisibilityState;
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
}

interface EncounterMapDisplayProps {
  locationData: LocationData | null;
  roomVisibility?: RoomVisibilityState;
}

export function EncounterMapDisplay({ locationData, roomVisibility }: EncounterMapDisplayProps) {
  const mapData = locationData?.map;

  // Check if this is a multi-deck map
  if (mapData && isMultiDeckMap(mapData)) {
    const multiDeckData = mapData as MultiDeckMapData;
    // Use the current deck's map data with visibility from props or map data
    const effectiveVisibility = roomVisibility || multiDeckData.room_visibility || {};
    return (
      <EncounterMapRenderer
        mapData={multiDeckData.current_deck}
        roomVisibility={effectiveVisibility}
      />
    );
  }

  // Check if this is an interactive encounter map (has rooms defined)
  if (mapData && isEncounterMap(mapData)) {
    return (
      <EncounterMapRenderer
        mapData={mapData as EncounterMapData}
        roomVisibility={roomVisibility}
      />
    );
  }

  // Legacy image-based map
  const mapImagePath = mapData?.image_path;

  // No map available
  if (!mapImagePath) {
    return (
      <div className="encounter-map-display encounter-map-display--no-map">
        <div className="encounter-map-no-data">
          <span className="encounter-map-no-data__icon">[ ]</span>
          <span className="encounter-map-no-data__text">NO MAP DATA AVAILABLE</span>
          {locationData?.name && (
            <span className="encounter-map-no-data__location">{locationData.name.toUpperCase()}</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="encounter-map-display">
      <img
        src={`/data/${mapImagePath}`}
        alt={locationData?.name || 'Encounter Map'}
        className="encounter-map-display__image"
      />
    </div>
  );
}
