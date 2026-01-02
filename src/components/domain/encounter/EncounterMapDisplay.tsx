/**
 * EncounterMapDisplay - 2D map display for facilities
 *
 * Shows static map images for stations, ships, bases, decks, and rooms.
 * Clean full-screen display without UI overlays.
 */

import './EncounterMapDisplay.css';

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
  };
}

interface EncounterMapDisplayProps {
  locationData: LocationData | null;
}

export function EncounterMapDisplay({ locationData }: EncounterMapDisplayProps) {
  const mapImagePath = locationData?.map?.image_path;

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
