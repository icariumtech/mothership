import { DashboardPanel } from '@components/ui/DashboardPanel';
import type { StarMapData } from '../../../types/starMap';
import type { SystemMapData, BodyData } from '../../../types/systemMap';
import type { MoonData, StationData, SurfaceMarkerData, OrbitMapData } from '../../../types/orbitMap';
import './StarMapPanel.css';

type MapViewMode = 'galaxy' | 'system' | 'orbit';

interface StarMapPanelProps {
  mapViewMode: MapViewMode;
  starMapData: StarMapData | null;
  selectedSystem: string | null;
  onSystemSelect: (systemName: string) => void;
  systemMapData: SystemMapData | null;
  currentSystemSlug: string | null;
  selectedPlanet: BodyData | null;
  onPlanetSelect: (planetData: BodyData | null) => void;
  onBackToGalaxy: () => void;
  orbitMapData: OrbitMapData | null;
  currentBodySlug: string | null;
  selectedOrbitElement: string | null;
  selectedOrbitElementType: 'moon' | 'station' | 'surface' | null;
  onOrbitElementSelect: (elementType: string | null, elementData: MoonData | StationData | SurfaceMarkerData | null) => void;
  onBackToSystem: () => void;
  onDiveToSystem: (systemName: string) => void;
  onOrbitMapNavigate: (systemSlug: string, planetSlug: string) => void;
  visible: boolean;
}

export function StarMapPanel({
  mapViewMode,
  starMapData,
  selectedSystem,
  onSystemSelect,
  systemMapData,
  currentSystemSlug,
  selectedPlanet,
  onPlanetSelect,
  onBackToGalaxy,
  orbitMapData,
  selectedOrbitElement,
  selectedOrbitElementType,
  onOrbitElementSelect,
  onBackToSystem,
  onDiveToSystem,
  onOrbitMapNavigate,
  visible,
}: StarMapPanelProps) {
  // Render galaxy list
  const renderGalaxyList = () => (
    <>
      {starMapData && starMapData.systems.length > 0 ? (
        starMapData.systems.map((system) => (
          <div
            key={system.name}
            className={`star-system-row ${selectedSystem === system.name ? 'selected' : ''}`}
            onClick={() => onSystemSelect(system.name)}
          >
            <div className="star-system-content">
              <div className={`star-system-checkbox ${selectedSystem === system.name ? 'checked' : ''}`} />
              <div className="star-system-name">{system.name}</div>
            </div>
            {system.location_slug && (
              <div
                className="system-map-btn-container"
                title="View system map"
                onClick={(e) => {
                  e.stopPropagation();
                  onDiveToSystem(system.name);
                }}
              >
                <span className="system-map-btn-icon">▶</span>
              </div>
            )}
          </div>
        ))
      ) : (
        <p>&gt; No star systems found</p>
      )}
    </>
  );

  // Render planet list for system view
  const renderPlanetList = () => (
    <>
      {/* Back to Galaxy button */}
      <div
        className="star-system-row back-to-galaxy-btn"
        onClick={() => onBackToGalaxy()}
        style={{ marginBottom: 12, borderColor: 'var(--color-amber)' }}
      >
        <div className="star-system-content">
          <div
            className="star-system-checkbox"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-amber)',
              fontSize: 14,
              background: 'none',
              border: 'none',
              marginLeft: 2
            }}
          >
            ◀
          </div>
          <div className="star-system-name" style={{ color: 'var(--color-amber)' }}>
            BACK TO GALAXY
          </div>
        </div>
      </div>

      {/* Planet list */}
      {systemMapData && systemMapData.bodies && systemMapData.bodies.length > 0 ? (
        systemMapData.bodies.map((planet) => (
          <div
            key={planet.name}
            className={`star-system-row planet-row ${selectedPlanet?.name === planet.name ? 'selected' : ''}`}
            onClick={() => onPlanetSelect(selectedPlanet?.name === planet.name ? null : planet)}
          >
            <div className="star-system-content">
              <div className={`star-system-checkbox ${selectedPlanet?.name === planet.name ? 'checked' : ''}`} />
              <div className="star-system-name">{planet.name}</div>
              {/* Facility indicators */}
              {((planet.surface_facility_count ?? 0) > 0 || (planet.orbital_station_count ?? 0) > 0) && (
                <div className="planet-indicators">
                  {(planet.surface_facility_count ?? 0) > 0 && (
                    <span className="planet-indicator surface" title={`${planet.surface_facility_count} surface facilities`}>
                      ▼
                    </span>
                  )}
                  {(planet.orbital_station_count ?? 0) > 0 && (
                    <span className="planet-indicator orbital" title={`${planet.orbital_station_count} orbital stations`}>
                      ◆
                    </span>
                  )}
                </div>
              )}
            </div>
            {planet.location_slug && (
              <div
                className="system-map-btn-container"
                title="View orbit map"
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentSystemSlug && planet.location_slug) {
                    onOrbitMapNavigate(currentSystemSlug, planet.location_slug);
                  }
                }}
              >
                <span className="system-map-btn-icon">▶</span>
              </div>
            )}
          </div>
        ))
      ) : (
        <p>&gt; No planetary bodies in system</p>
      )}
    </>
  );

  // Render orbit view
  const renderOrbitList = () => (
    <>
      {/* Back to System button */}
      <div
        className="star-system-row back-to-system-btn"
        onClick={() => onBackToSystem()}
        style={{ marginBottom: 12, borderColor: 'var(--color-amber)' }}
      >
        <div className="star-system-content">
          <div
            className="star-system-checkbox"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-amber)',
              fontSize: 14,
              background: 'none',
              border: 'none',
              marginLeft: 2
            }}
          >
            ◀
          </div>
          <div className="star-system-name" style={{ color: 'var(--color-amber)' }}>
            BACK TO SYSTEM
          </div>
        </div>
      </div>

      {selectedPlanet && (
        <div className="orbit-planet-info" style={{ marginBottom: 16 }}>
          <p style={{ color: 'var(--color-teal)', fontSize: 11, marginBottom: 12 }}>
            &gt; ORBIT OF {selectedPlanet.name.toUpperCase()}
          </p>
        </div>
      )}

      {/* Moons section */}
      {orbitMapData?.moons && orbitMapData.moons.length > 0 && (
        <>
          <div className="orbit-section-header">MOONS</div>
          {orbitMapData.moons.map((moon) => (
            <div
              key={moon.name}
              className={`star-system-row orbit-element-row ${
                selectedOrbitElementType === 'moon' && selectedOrbitElement === moon.name ? 'selected' : ''
              }`}
              onClick={() => {
                if (selectedOrbitElementType === 'moon' && selectedOrbitElement === moon.name) {
                  onOrbitElementSelect(null, null);
                } else {
                  onOrbitElementSelect('moon', moon);
                }
              }}
            >
              <div className="star-system-content">
                <div
                  className={`star-system-checkbox ${
                    selectedOrbitElementType === 'moon' && selectedOrbitElement === moon.name ? 'checked' : ''
                  }`}
                />
                <div className="star-system-name">{moon.name}</div>
                {moon.has_facilities && (
                  <span className="planet-indicator surface" title="Has facilities" style={{ marginLeft: 8 }}>
                    ▼
                  </span>
                )}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Orbital Stations section */}
      {orbitMapData?.orbital_stations && orbitMapData.orbital_stations.length > 0 && (
        <>
          <div className="orbit-section-header">ORBITAL STATIONS</div>
          {orbitMapData.orbital_stations.map((station) => (
            <div
              key={station.name}
              className={`star-system-row orbit-element-row ${
                selectedOrbitElementType === 'station' && selectedOrbitElement === station.name ? 'selected' : ''
              }`}
              onClick={() => {
                if (selectedOrbitElementType === 'station' && selectedOrbitElement === station.name) {
                  onOrbitElementSelect(null, null);
                } else {
                  onOrbitElementSelect('station', station);
                }
              }}
            >
              <div className="star-system-content">
                <div
                  className={`star-system-checkbox ${
                    selectedOrbitElementType === 'station' && selectedOrbitElement === station.name ? 'checked' : ''
                  }`}
                />
                <div className="star-system-name">{station.name}</div>
              </div>
            </div>
          ))}
        </>
      )}

      {/* Surface Markers section */}
      {orbitMapData?.surface_markers && orbitMapData.surface_markers.length > 0 && (
        <>
          <div className="orbit-section-header">SURFACE FACILITIES</div>
          {orbitMapData.surface_markers.map((marker) => (
            <div
              key={marker.name}
              className={`star-system-row orbit-element-row ${
                selectedOrbitElementType === 'surface' && selectedOrbitElement === marker.name ? 'selected' : ''
              }`}
              onClick={() => {
                if (selectedOrbitElementType === 'surface' && selectedOrbitElement === marker.name) {
                  onOrbitElementSelect(null, null);
                } else {
                  onOrbitElementSelect('surface', marker);
                }
              }}
            >
              <div className="star-system-content">
                <div
                  className={`star-system-checkbox ${
                    selectedOrbitElementType === 'surface' && selectedOrbitElement === marker.name ? 'checked' : ''
                  }`}
                />
                <div className="star-system-name">{marker.name}</div>
              </div>
            </div>
          ))}
        </>
      )}
    </>
  );

  if (!visible) return null;

  return (
    <div className="star-map-panel-wrapper">
      <DashboardPanel title="STAR MAP" chamferCorners={['tl', 'br']}>
        {mapViewMode === 'galaxy' && renderGalaxyList()}
        {mapViewMode === 'system' && renderPlanetList()}
        {mapViewMode === 'orbit' && renderOrbitList()}
      </DashboardPanel>
    </div>
  );
}
