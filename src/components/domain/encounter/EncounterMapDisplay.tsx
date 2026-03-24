/**
 * EncounterMapDisplay - 2D map display for facilities
 *
 * Supports three map formats:
 * 1. Grid-based SVG maps (Phase 7) - YAML with rooms as rects, wall-attached doors
 * 2. Interactive SVG maps (legacy) - YAML with rooms, doors, terminals, POIs (node-graph)
 * 3. Legacy PNG images - Static map images
 *
 * Also supports multi-deck maps with room visibility control.
 * Automatically routes to the correct renderer based on map data.
 */

import './EncounterMapDisplay.css';
import { EncounterMapRenderer } from './EncounterMapRenderer';
import {
  GridEncounterMapData,
  HullDef,
  RoomVisibilityState,
  DoorStatusState,
  TokenState,
  TokenStatus,
  isEncounterMap,
  isGridEncounterMap,
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
  doorStatus?: DoorStatusState;
  /** Current deck level (1-indexed) for multi-deck maps */
  currentLevel?: number;
  /** Total number of decks */
  totalLevels?: number;
  /** Current deck name */
  deckName?: string;
  /** Token state */
  tokens?: TokenState;
  /** Is this a GM view? */
  isGM?: boolean;
  /** Callback when GM clicks a room to toggle visibility */
  onRoomToggle?: (roomId: string, visible: boolean) => void;
  /** Token callbacks */
  onTokenMove?: (id: string, x: number, y: number, roomId: string) => void;
  onTokenRemove?: (id: string) => void;
  onTokenStatusToggle?: (id: string, status: TokenStatus) => void;
  /** Extra grid-cell padding around the map in the SVG viewBox */
  viewPadding?: number;
}

export function EncounterMapDisplay({
  locationData,
  roomVisibility,
  doorStatus,
  currentLevel = 1,
  totalLevels = 1,
  deckName,
  tokens,
  isGM = false,
  onRoomToggle,
  onTokenMove,
  onTokenRemove,
  onTokenStatusToggle,
  viewPadding,
}: EncounterMapDisplayProps) {
  const mapData = locationData?.map;

  // Check if this is a multi-deck map
  if (mapData && isMultiDeckMap(mapData)) {
    const multiDeckData = mapData as MultiDeckMapData;
    const deckData = multiDeckData.current_deck;
    const effectiveVisibility = roomVisibility || multiDeckData.room_visibility || {};
    // Hull defined at manifest level applies to every deck — same silhouette on all levels
    const manifestHull = multiDeckData.manifest?.hull as HullDef | undefined;
    const commonProps = {
      roomVisibility: effectiveVisibility,
      doorStatus,
      currentLevel,
      totalLevels,
      deckName,
      tokens,
      isGM,
      onRoomToggle,
      onTokenMove,
      onTokenRemove,
      onTokenStatusToggle,
      hull: manifestHull,
      viewPadding,
    };

    // IMPORTANT: check the deck's own format before choosing a renderer.
    // Grid-format decks use the new wall-segment renderer.
    // Old-format multi-deck maps (if any exist) fall through to the old renderer.
    if (isGridEncounterMap(deckData)) {
      return (
        <div className="encounter-map-display">
          <EncounterMapRenderer
            mapData={deckData as GridEncounterMapData}
            {...commonProps}
          />
        </div>
      );
    } else if (isEncounterMap(deckData)) {
      // Legacy EncounterMapData deck — cast to pass through until data is migrated to grid format
      return (
        <div className="encounter-map-display">
          <EncounterMapRenderer
            mapData={deckData as unknown as GridEncounterMapData}
            {...commonProps}
          />
        </div>
      );
    }
    // If deck format is unrecognized, fall through to null/loading state below.
  }

  // NEW: Grid-based encounter map (Phase 7 format)
  if (mapData && isGridEncounterMap(mapData)) {
    return (
      <div className="encounter-map-display">
        <EncounterMapRenderer
          mapData={mapData as GridEncounterMapData}
          roomVisibility={roomVisibility}
          doorStatus={doorStatus}
          currentLevel={currentLevel}
          totalLevels={totalLevels}
          deckName={deckName}
          tokens={tokens}
          isGM={isGM}
          onRoomToggle={onRoomToggle}
          onTokenMove={onTokenMove}
          onTokenRemove={onTokenRemove}
          onTokenStatusToggle={onTokenStatusToggle}
          viewPadding={viewPadding}
        />
      </div>
    );
  }

  // Legacy: interactive encounter map (node-graph format, has rooms + grid)
  if (mapData && isEncounterMap(mapData)) {
    return (
      <div className="encounter-map-display">
        <EncounterMapRenderer
          mapData={mapData as unknown as GridEncounterMapData}
          roomVisibility={roomVisibility}
          doorStatus={doorStatus}
          currentLevel={currentLevel}
          totalLevels={totalLevels}
          deckName={deckName}
          tokens={tokens}
          isGM={isGM}
          onRoomToggle={onRoomToggle}
          onTokenMove={onTokenMove}
          onTokenRemove={onTokenRemove}
          onTokenStatusToggle={onTokenStatusToggle}
          viewPadding={viewPadding}
        />
      </div>
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
