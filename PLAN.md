# Planet Drill-Down Feature - Implementation Plan

## Overview

This plan outlines how to implement a planetary detail view system that allows users to click an arrow next to a planet in the system view and drill down to see:
- Unique planet visualizations (with rotation)
- Planetary rings (if applicable)
- Orbiting moons
- Orbiting space stations
- Surface markers for cities and bases
- Ability to have bases on moons

## Current State Analysis

### What Already Exists

1. **Galaxy Map → System Map Navigation**: Users can click stars to view solar systems
2. **System Map Rendering**: 3D visualization with orbiting planets using Three.js
3. **Planet Selection**: Clicking planets shows info panel with planet details
4. **Facility Indicators**: Planet buttons show square icons (surface facilities) and triangle icons (orbital stations)
5. **Data Structure**: Hierarchical file structure: `system → planet → facility`
6. **API Infrastructure**:
   - `load_orbit_map()` function exists in DataLoader
   - `get_orbit_map_json()` API endpoint exists but returns 404 (no orbit_map.yaml files)
7. **Facility Counting**: Dynamically counts facilities from directory structure

### What Needs to Be Built

1. **Orbit Map Data Structure**: Define `orbit_map.yaml` format for planet detail views
2. **Moon Support**: Extend data structure to support moons as children of planets
3. **Planet Visualization**: Create unique planet images/textures (procedural or asset-based)
4. **Orbit Map Renderer**: Three.js scene for planet detail view showing moons, stations, and surface markers
5. **Navigation UI**: Drill-down arrow on planet menu items
6. **View Transitions**: Smooth transitions from system map to planet/orbit map

## Data Structure Design

### 1. Moon Support (Hierarchical Extension)

**Current Structure (Implemented):**
```
data/galaxy/
└── {system_slug}/
    ├── location.yaml        (star)
    ├── system_map.yaml
    └── {planet_slug}/
        ├── location.yaml    (planet)
        ├── orbit_map.yaml   (planet detail visualization)
        ├── {facility_slug}/
        │   └── location.yaml (base/station/ship on planet surface)
        └── {moon_slug}/     (moons as children of planets)
            ├── location.yaml (type: "moon")
            ├── orbit_map.yaml (moon can have its own orbital view)
            └── {facility_slug}/
                └── location.yaml (base/station on moon)
```

**Key Design Decision**: Moons are **directories** (just like planets), not just metadata. This allows:
- Moons to have their own facilities (bases, stations)
- Moons to have their own orbit_map.yaml if they have satellites
- Consistent hierarchical loading via `load_location_recursive()`

**Distinguishing Moons from Facilities**: Use `type` field in `location.yaml`:
- `type: "moon"` → Rendered as orbiting body in planet's orbit_map
- `type: "station"` → Rendered as orbital station
- `type: "base"` → Rendered as surface marker
- `type: "ship"` → Rendered as orbital or surface depending on coordinates

### 2. Orbit Map Data Format (orbit_map.yaml)

**Location**: `data/galaxy/{system_slug}/{planet_slug}/orbit_map.yaml`

**Purpose**: Defines the 3D visualization for a planet's orbital environment (moons, stations, surface markers)

**Proposed Schema**:
```yaml
# Planet orbital environment visualization
planet:
  name: "Earth"
  type: "planet"
  size: 15.0  # Radius in scene units
  texture: "earth"  # Reference to planet texture/generation config
  rotation_speed: 0.002  # Radians per frame
  axial_tilt: 23.5  # Degrees

  # Optional ring system
  rings:
    inner_radius: 18.0
    outer_radius: 25.0
    color: 0xD2B48C
    opacity: 0.6

camera:
  position: [0, 30, 50]
  lookAt: [0, 0, 0]
  fov: 60
  zoom_limits: [20, 150]

# Orbiting moons (location_slug links to moon directory)
moons:
  - name: "Luna"
    location_slug: "luna"
    orbital_radius: 40
    orbital_period: 180  # Days
    orbital_angle: 0     # Starting position
    inclination: 5.1
    size: 3.5
    color: 0xAAAAAA
    has_orbit_map: false  # Can drill down further if true
    has_facilities: true  # Shows indicator if moon has bases

# Orbital stations (location_slug links to station directory)
orbital_stations:
  - name: "Gateway Station"
    location_slug: "gateway-station"
    orbital_radius: 25
    orbital_period: 90
    orbital_angle: 120
    size: 1.5
    icon_type: "station"  # station, shipyard, defense_platform

# Surface markers (location_slug links to facility directory)
surface_markers:
  - name: "Research Base Alpha"
    location_slug: "research-base-alpha"
    latitude: 39.79
    longitude: -116.39
    marker_type: "base"  # base, city, spaceport, research

  - name: "Cape Canaveral Spaceport"
    location_slug: "cape-canaveral"
    latitude: 28.57
    longitude: -80.65
    marker_type: "spaceport"
```

### 3. Moon Location Data (location.yaml for moons)

**Location**: `data/galaxy/{system_slug}/{planet_slug}/{moon_slug}/location.yaml`

```yaml
name: "Luna"
type: "moon"  # Key identifier
parent_body: "earth"

# Physical properties
mass: "7.342 × 10^22 kg"
radius: "1,737 km"
gravity: "0.16 G"
atmosphere: "None (vacuum)"

# Orbital properties (also in orbit_map.yaml, but stored here for reference)
orbital_radius: "384,400 km"
orbital_period: "27.3 days"

status: "INHABITED"
population: "~2,500"
description: "Earth's only natural satellite, home to multiple research bases and mining operations."

surface_facilities:
  - "Armstrong Base"
  - "Mining Outpost 7"
```

## Planet Visualization Strategy

### Approach 1: Procedural Generation (RECOMMENDED)

**Pros:**
- Infinitely scalable (every planet unique)
- Small storage footprint
- Can be parameterized from planet metadata
- Consistent with current aesthetic (programmatic, retro)

**Cons:**
- More complex to implement
- Harder to art-direct specific looks

**Implementation**: Use Three.js custom shaders or canvas-based texture generation
- Generate sphere texture based on planet type (rocky, oceanic, gas giant, ice)
- Use noise functions (Perlin/Simplex) for surface variation
- Color palettes based on planet metadata (atmosphere_color, etc.)
- Simple shading for depth/rotation effect

**Example Parameters** (in orbit_map.yaml):
```yaml
planet:
  name: "Earth"
  texture_config:
    type: "terrestrial_oceanic"
    primary_color: 0x4682B4  # Ocean blue
    secondary_color: 0x228B22  # Land green
    cloud_layer: true
    cloud_opacity: 0.3
    noise_scale: 2.5
    rotation_speed: 0.002
```

### Approach 2: Pre-Made Texture Assets

**Pros:**
- Full artistic control
- Potentially higher visual quality
- Simpler rendering code

**Cons:**
- Requires creating/sourcing textures for every planet
- Larger storage footprint
- Less flexible for procedurally created planets

**Implementation**: Standard Three.js texture mapping
- Store PNG/JPG textures in `data/galaxy/{system}/{planet}/textures/`
- Reference in orbit_map.yaml: `texture: "textures/earth_diffuse.png"`

### Approach 3: Fully Procedural (CONFIRMED APPROACH)

**Implementation Strategy:**
1. **Procedural texture generation** for all planets
   - Canvas-based texture generator (2D context, render to texture)
   - Use noise algorithms (Perlin/Simplex or simple cellular noise)
   - Planet type determines color palette and pattern
   - **Colorful and varied** - not limited to UI color palette
   - Atmospheric glow for planets with atmospheres

2. **Planet Type Templates**:
   - **Terrestrial/Rocky**: Browns, grays, reds (Mars-like or barren)
   - **Oceanic**: Blues and greens with continents/clouds
   - **Gas Giant**: Banded patterns, swirling storms
   - **Ice World**: Whites, light blues, crystalline patterns
   - **Volcanic**: Dark with glowing lava patterns
   - **Toxic**: Yellows, greens, purples with atmospheric effects

3. **Texture Generation Pipeline**:
   - Create 1024x512 canvas (equirectangular projection)
   - Generate base layer with primary color + noise
   - Add detail layers (clouds, terrain, atmospheric effects)
   - Apply to sphere as texture map
   - Add rotation animation (spin on axis)

4. **No Asset Files Required**:
   - All generation happens in JavaScript at runtime
   - Configuration stored in orbit_map.yaml (colors, type, parameters)
   - Deterministic generation (same config = same look)

## UI/UX Flow Design

### Current Flow
1. Galaxy Map → Click Star → System Map
2. System Map → Click Planet → Info Panel Shows Planet Details

### Proposed Flow
1. Galaxy Map → Click Star → System Map
2. System Map → Click Planet → Planet List Shows (current behavior)
3. **NEW**: Planet List → Click Drill-Down Arrow → Orbit Map (Planet Detail View)
4. **NEW**: Orbit Map → Click Moon → Moon Orbit Map (if moon has facilities)

### Navigation Controls

#### Planet List Menu Item Design

**Current**:
```
[✓] Tau Ceti e                    [■]
```
- Checkbox: Selects planet (shows in info panel, zooms camera)
- Square indicator: Has surface facilities

**Proposed**:
```
[✓] Tau Ceti e              [■][▲] [▶]
```
- Checkbox: Selects planet (existing behavior)
- Square [■]: Surface facilities indicator (existing)
- Triangle [▲]: Orbital stations indicator (existing)
- **NEW Arrow [▶]**: Drill-down to planet orbit map

#### Interaction Behavior

**Arrow Button**:
- Only visible if planet has `has_orbit_map: true` in system_map.yaml
- Click triggers transition to orbit map view
- Shows: moons, orbital stations, surface markers

**Back Navigation**:
- "BACK TO SYSTEM" button at top of list (similar to "BACK TO GALAXY")
- Returns to system map view

### Visual Transitions

**System Map → Orbit Map Transition**:
1. Camera zooms toward selected planet (animate to close-up)
2. System canvas fades out
3. Orbit canvas fades in showing planet centered
4. Planet list updates to show moons/stations/markers

**Technical Implementation**:
- Reuse GSAP animation pattern from galaxy→system transition
- Similar canvas crossfade technique
- Update `window.systemMapState.currentView` to track orbit map state

## Rendering Architecture

### Scene Hierarchy

**Current System Map**:
- Galaxy Map (Three.js scene)
- System Map (Three.js scene)

**Proposed Extension**:
- Galaxy Map (Three.js scene)
- System Map (Three.js scene)
- **NEW**: Orbit Map (Three.js scene) - can render planet OR moon detail

### Orbit Map Renderer Design

**Similar to System Map but different scale/content**:

```javascript
window.orbitMapState = {
    scene: null,
    camera: null,
    renderer: null,  // Could share renderer with system map
    planet: null,     // Central planet mesh
    moons: [],       // Orbiting moon meshes
    stations: [],    // Orbital station meshes
    markers: [],     // Surface marker meshes
    currentBody: null,  // Which planet/moon is being displayed
    animationFrameId: null,
    controls: null
};
```

**Key Rendering Elements**:

1. **Central Planet**:
   - Large sphere with texture (procedural or asset)
   - Rotation animation around axis
   - Optional axial tilt
   - Optional ring system (like Saturn)

2. **Orbiting Moons**:
   - Similar to planets in system map
   - Smaller scale
   - Orbital paths rendered
   - Clickable if `has_orbit_map: true`

3. **Orbital Stations**:
   - Rendered as sprites or simple meshes
   - Follow orbital paths
   - Different icon based on `icon_type`
   - Clickable to show info

4. **Surface Markers**:
   - Billboarded sprites on planet surface
   - Positioned using latitude/longitude
   - Different icons based on `marker_type`
   - Rotate with planet
   - Clickable to show facility info

### Surface Marker Positioning

**Challenge**: Convert lat/lon to 3D sphere position

**Solution**: Spherical to Cartesian coordinate conversion
```javascript
function latLonToVector3(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    return new THREE.Vector3(
        -(radius * Math.sin(phi) * Math.cos(theta)),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.sin(theta)
    );
}
```

**Marker Visibility**: Use raycasting to hide markers on far side of planet

## Implementation Tasks

> **Status Update (December 2025)**: Core navigation functionality is complete and working. The orbit map rendering system was already implemented prior to this navigation work. Phase 4 (Navigation & UI) was completed to integrate the existing orbit map renderer with the system map navigation.

### Phase 1: Data Structure & Backend ✅ COMPLETE

1. **Extend Moon Support**
   - [x] Update planet location.yaml files to prepare for moon directories
   - [x] Create example moon directory structure (sol/earth/luna/)
   - [x] Add moon location.yaml with type: "moon" *(tau-ceti-e, tau-ceti-f have moons)*
   - [x] Test that load_location_recursive() correctly loads moons

2. **Create Orbit Map Data Files**
   - [x] Design orbit_map.yaml schema (finalized and documented)
   - [x] Create orbit_map.yaml for Earth (uses procedural texture_config)
   - [x] Create orbit_map.yaml for Tau Ceti e (with moons and stations)
   - [x] Create orbit_map.yaml for Tau Ceti f (with moon, station, surface markers)
   - [x] Add surface_markers for existing facilities

3. **Backend API Enhancement**
   - [x] Verify get_orbit_map_json() works with new files
   - [x] Add facility counting for moons
   - [x] Update system_map_json to include has_orbit_map flag

### Phase 2: Planet Visualization ✅ COMPLETE

4. **Planet Texture System**
   - [x] Texture loading from PNG files (equirectangular projection)
   - [x] SphereGeometry for proper UV mapping
   - [x] Add rotation animation to sphere
   - [x] Support texture path override in orbit_map.yaml
   - [x] Test with different planet textures (terrestrial, rock, gas)
   - [x] Lat/lon grid overlay for surface reference

5. **Ring System Renderer** *(implemented but not tested with data)*
   - [x] Ring geometry support in code
   - [x] Inner/outer radius configuration
   - [x] Transparency and color options
   - [ ] Test with actual ringed planet data

### Phase 3: Orbit Map Renderer ✅ COMPLETE

6. **Orbit Map Scene Setup**
   - [x] Create orbitMapState global object
   - [x] Initialize Three.js scene for orbit view
   - [x] Add camera with orbit controls (zoom, pan, rotate)
   - [x] Create background starfield (5000 stars with starburst effect)

7. **Planet Rendering**
   - [x] Render central planet sphere
   - [x] Apply PNG texture with equirectangular mapping
   - [x] Add rotation animation (configurable speed)
   - [x] Axial tilt support
   - [x] Optional cloud layer rendering

8. **Moon Rendering**
   - [x] Render orbiting moons with textures
   - [x] Create orbital paths (elliptical)
   - [x] Animate moon positions with configurable periods
   - [x] Orbital inclination support
   - [ ] Click detection for moons with orbit maps *(not yet implemented)*

9. **Orbital Station Rendering**
   - [x] Create station sprites
   - [x] Position on orbital paths
   - [x] Animate orbital motion
   - [ ] Click detection and info display *(not yet implemented)*

10. **Surface Marker Rendering**
    - [x] Implement lat/lon to 3D conversion
    - [x] Create marker sprites (different types: city, research, spaceport)
    - [x] Position markers on planet surface
    - [x] Rotate markers with planet
    - [x] Visibility culling (hide far side)
    - [ ] Click detection *(not yet implemented)*

### Phase 4: Navigation & UI ✅ COMPLETE

11. **Planet List Drill-Down Button**
    - [x] Add arrow button to planet menu items
    - [x] Show only for planets with has_orbit_map: true
    - [x] Add click handler to trigger orbit map view (uses existing `loadOrbitMap()`)
    - [x] Style button to match UI design system (teal arrow, matching system map button)

12. **View Transitions**
    - [x] Implement system→orbit transition (reuses same canvas)
    - [x] Add orbit→system back navigation (`returnToSystemMap()`)
    - [x] Update planet list to show orbit map contents (moons, stations, markers)
    - [x] Handle canvas visibility and animation pausing/resuming
    - [x] Fixed ES6 module scope issues (made functions globally accessible via window)
    - [x] Styled "BACK TO SYSTEM" button to match "BACK TO GALAXY" (amber color)

13. **Orbit Map Info Panel**
    - [x] Display planet name in menu
    - [x] List moons in menu panel
    - [x] List orbital stations in menu panel
    - [x] List surface locations in menu panel
    - [x] Update details panel when clicking orbit arrow (shows planet details)
    - [ ] Show detailed info when clicking moon/station/marker *(deferred)*

14. **Moon Drill-Down** *(deferred - not yet needed)*
    - [ ] Add arrow to moon items in list
    - [ ] Support moon→moon orbit map transition
    - [ ] Add breadcrumb navigation (Galaxy > System > Planet > Moon)

### Phase 5: Polish & Testing ✅ COMPLETE

15. **Testing & Refinement** ✅ COMPLETE
    - [x] Test galaxy→system→orbit transitions
    - [x] Test with multiple planets (tau-ceti-e, tau-ceti-f)
    - [x] Verify facility counting works correctly
    - [x] Test camera controls and zoom limits
    - [ ] Test orbit→moon transitions *(deferred - not yet implemented)*
    - [x] Mobile/touch testing for orbit map controls (single-finger rotation + pinch zoom)

16. **Visual Polish** ✅ COMPLETE
    - [x] Planet textures working (equirectangular PNG files)
    - [x] Marker icons with different types

17. **Documentation** ✅ COMPLETE
    - [x] Update CLAUDE.md with orbit map system
    - [x] orbit_map.yaml format is documented in PLAN.md
    - [x] Examples exist for terrestrial planets (tau-ceti-e, tau-ceti-f)
    - [x] Update data structure diagrams

### Phase 6: Bug Fixes & Enhancements ✅ COMPLETE

18. **Orbit Map Rendering Bugs** ✅ FIXED
    - [x] Fix lat/lon grid duplication when returning to orbit map (clearOrbitMap now properly disposes clouds and grid)
    - [x] Fix orbit line alignment - moons orbiting on their orbital paths (changed from XY to XZ plane with inclination)
    - [x] Fix camera rotation controls around planet (using spherical coordinates like system map)

19. **Orbit System Redesign** ✅ COMPLETE
    - [x] Orbital inclination tilts orbit relative to equator (rotation around X axis)
    - [x] orbital_angle parameter sets starting position in orbit
    - [x] Both moons and stations support inclination
    - [x] Animation loop applies inclination correctly

20. **Smooth Transition to Orbit Map** ✅ COMPLETE
    - [x] When clicking planet orbit arrow, select planet on system map if not already selected
    - [x] Implement zoom-to-planet animation before showing orbit map
    - [x] Add fade transition: system map fade out → orbit map fade in
    - [x] Match transition style with galaxy→system and system→galaxy transitions
    - [x] Ensure camera positions and animations are smooth
    - [x] Add smooth fade transition when returning from orbit map to system map
    - [x] Track and restore planet selection when returning from orbit map

21. **Clickable Orbit Map Elements** ✅ COMPLETE (Menu-Based Approach)
    - [x] Menu-based selection (no raycasting needed - simpler UX)
    - [x] Click handlers for orbit map menu items (moons, stations, surface markers)
    - [x] Visual selection state with checkboxes and aria attributes
    - [x] Show element info in details panel when selected
    - [x] Typewriter animation for info panel updates
    - [x] Handle deselection (restore planet info)
    - [x] Race condition prevention using sequence tracking
    - [x] Element-specific info HTML builders (buildMoonInfoHTML, buildStationInfoHTML, buildSurfaceMarkerInfoHTML)
    - [ ] Raycasting click detection on 3D canvas *(deferred - menu-based approach preferred)*
    - [ ] Camera zoom-to-target animation *(deferred - not needed for menu-based approach)*

22. **Normal Maps for Planet Surfaces** ✅ COMPLETE
    - [x] Add normal map support to planet material system
    - [x] Create or source normal map textures for different planet types (terrestrial, volcanic, rock, gas)
    - [x] Update Three.js material to use MeshStandardMaterial with normal maps
    - [x] Add normal map texture loading alongside diffuse textures
    - [x] Update orbit_map.yaml schema to support normal_map texture path
    - [x] Test with lighting to ensure depth/detail enhancement is visible
    - [x] Batch conversion script updated to skip Bump-* files
    - [x] Copy script for normal maps (copy_normal_maps.sh)

23. **Realistic Sun Lighting System** ✅ COMPLETE
    - [x] Directional light positioned based on planet's orbital angle in system
    - [x] Bright directional light (intensity 4.0) creates stark terminator line
    - [x] Ambient fill light (intensity 1.1) to see dark side of planet
    - [x] Multi-layer sun visual with core, glow layers, and billboard flare
    - [x] Shadow casting enabled for moon eclipse effect (PCFSoftShadowMap)
    - [x] Planet casts shadows, moons receive shadows

24. **Sun Declination (Seasonal Tilt)** ✅ COMPLETE
    - [x] New `sun_declination` parameter in orbit_map.yaml
    - [x] Positive values = northern hemisphere tilted toward sun (northern summer)
    - [x] Negative values = southern hemisphere tilted toward sun (southern summer)
    - [x] Range: -90 to +90 degrees (typically -23.5 to +23.5 for Earth-like)
    - [x] updateSunPosition() function applies declination after orbit data loads

## Alternative Approaches Considered

### Alternative 1: Flat Data Structure (Rejected)

**Approach**: Keep moons as metadata in orbit_map.yaml, not as directories

**Pros**: Simpler file structure
**Cons**:
- Can't have facilities on moons
- Breaks consistency with hierarchical location system
- Would need separate counting logic for moon facilities

**Decision**: Rejected in favor of hierarchical approach for consistency

### Alternative 2: 2D Planet View (Rejected for MVP)

**Approach**: Show planet as flat 2D map instead of 3D sphere

**Pros**: Easier to show all surface facilities, no occlusion
**Cons**:
- Breaks immersion and aesthetic consistency
- Less visually interesting
- Doesn't show orbiting elements well

**Decision**: Keep 3D for consistency, use camera controls for exploration

### Alternative 3: Pre-rendered Planet Images (Deferred)

**Approach**: Use static images for all planets (Approach 2 above)

**Pros**: Highest visual quality potential
**Cons**: Requires art assets, less flexible

**Decision**: Start with procedural (Approach 3), allow texture override for special cases

## Technical Risks & Mitigations

### Risk 1: Performance with Complex Orbit Maps
**Mitigation**:
- Reuse renderer between views (don't create multiple WebGL contexts)
- Limit particle counts and geometry complexity
- Add LOD (Level of Detail) for distant objects

### Risk 2: Surface Marker Occlusion
**Mitigation**:
- Implement visibility culling (hide far-side markers)
- Add camera rotation controls to view all sides
- Consider mini-map or list view for all markers

### Risk 3: Data Migration Complexity
**Mitigation**:
- Backward compatibility: system without orbit_map.yaml still works
- has_orbit_map flag controls drill-down button visibility
- Gradual migration: add orbit maps one system at a time

### Risk 4: UI Complexity (Too Many Nested Levels)
**Mitigation**:
- Breadcrumb navigation (Galaxy > System > Planet > Moon)
- Always visible "BACK TO..." button
- Clear visual indicators of current level

## Design Decisions (User Confirmed)

1. **Planet Visual Style**: ✓ CONFIRMED
   - Stylized/retro aesthetic (matching current UI style)
   - **Colorful planets allowed** - NOT limited to muted teal/amber palette
   - Procedurally generated with visual variety

2. **Moon Naming Convention**: ✓ CONFIRMED
   - **Fictional names** for all moons
   - Creative sci-fi naming that fits Mothership RPG setting
   - Can use Greek letters, designations, or evocative names

3. **Surface Marker Interaction**: ✓ CONFIRMED
   - **Menu-based interaction** - right panel lists bases/cities/facilities
   - Clicking menu item updates info panel (not drill-down to facility detail)
   - Surface markers are visual indicators, menu is primary navigation

4. **Priority Planets**: ✓ CONFIRMED
   - **No specific priority** - all sample data
   - Can implement with any planet as example
   - Will create examples across multiple systems for variety

5. **Asset Creation**: ✓ CONFIRMED
   - **Fully procedural generation** for all planets
   - No pre-made texture assets required
   - Canvas-based texture generation using noise algorithms

## Success Criteria

### ✅ Core Feature Complete

- [x] Users can click drill-down arrow on planet menu items
- [x] Orbit map displays planet with rotation and texture
- [ ] Rings render correctly on planets that have them *(code exists, needs data to test)*
- [x] Moons orbit the planet with textures and orbital paths
- [ ] Moons are clickable for drill-down *(deferred - not yet needed)*
- [x] Orbital stations are visible and positioned correctly
- [x] Surface markers appear on planet surface at correct lat/lon
- [x] Users can navigate back to system map
- [x] Moons can have their own facilities *(data structure supports it)*
- [ ] Moons can have their own orbit maps *(deferred - not yet implemented)*
- [x] All transitions are smooth and animated
- [x] Data structure supports unlimited nesting depth
- [x] Documentation is updated with new data formats

### 🎯 MVP Status: **COMPLETE** ✅

The core planet drill-down navigation is fully working:
- Galaxy → System → Planet orbit view ✅
- Smooth zoom and fade transitions (both directions) ✅
- Back navigation with planet selection restoration ✅
- Planet rendering with textures and rotation ✅
- Moons orbiting correctly on orbital paths ✅
- Orbital stations and surface markers rendering ✅
- Menu updates with orbit map contents ✅
- Camera rotation controls (pan, zoom, rotate) ✅
- Touch controls (single-finger rotate, pinch zoom) ✅
- Orbital inclination system working ✅
- Normal maps for surface detail ✅
- Realistic sun lighting with terminator line ✅
- Moon eclipse shadows ✅
- Sun declination (seasonal tilt) ✅

**Future Enhancements:**
- 🔵 Moon drill-down (moon → moon orbit map)
- 🔵 Ring system testing with actual ringed planet data

## Timeline

### Original Estimate
**Total Estimate**: 13-17 development sessions (26-34 hours)

### Actual Progress
- **Phase 1 (Data)**: ✅ Complete (prior work)
- **Phase 2 (Planets)**: ✅ Complete (prior work)
- **Phase 3 (Orbit Map)**: ✅ Complete (prior work)
- **Phase 4 (UI/Nav)**: ✅ Complete (1 session, December 2025)
- **Phase 5 (Polish)**: ✅ Complete (December 2025)
- **Phase 6 (Fixes/Features)**: ✅ Complete (1 session, December 2025)

**Note**: Phases 1-3 were completed in earlier development sessions. The bulk of the orbit map rendering system already existed. Phase 4 required only 1 session to add navigation UI. Phase 6 (bug fixes) completed in 1 session:
- Fixed orbit rendering alignment (XZ plane vs XY plane)
- Fixed camera rotation controls (spherical coordinates)
- Fixed lat/lon grid cleanup
- Added smooth GSAP transitions (both directions)
- Added planet selection tracking and restoration

### Phase 7: Interactive Features (December 2025) ✅ COMPLETE
- **Task 21**: Menu-based orbit map element selection (1 session)
  - Fixed details panel visibility issue in `selectPlanet()`
  - Implemented menu click handlers for moons, stations, surface markers
  - Created element-specific info HTML builders
  - Added typewriter animation with race condition prevention
  - Proper planet info restoration on deselection

### Phase 8: Targeting Reticle & Camera System (December 2025) ✅ COMPLETE
- **Task 23**: Orbit map targeting reticle (1 session)
  - Added selection reticle to orbit map (same amber style as galaxy/system maps)
  - Reticle positions on selected moons, stations, and surface markers
  - Reticle follows orbiting elements in animation loop
  - Reticle scales based on element type and size
  - Reticle hidden on deselection and when clearing orbit map

- **Task 24**: Camera zoom to selected elements
  - Camera animates to selected element using GSAP
  - Moons/stations: Camera positioned relative to element, orbits around it
  - Surface markers: Camera positioned outside planet looking at marker
  - Camera tracks moving elements (moons/stations continue to orbit)

- **Task 25**: Animation pause for surface markers
  - Planet rotation pauses when surface marker is selected
  - Moon and station orbital animations also pause
  - Allows free zoom/rotate around selected surface location
  - Animation resumes on deselect without position jumps (adjusted startTime)

- **Task 26**: Camera return animation
  - Camera animates back to default planet view on deselection
  - Stores default camera position when loading orbit map
  - Smooth GSAP transition back to overview

- **Task 27**: Unified targeting reticle design
  - Updated all three reticle textures (galaxy, system, orbit maps)
  - Consistent design: two concentric circles with cross cutout
  - Added corner brackets around circles
  - Unified line widths: 4px circles, 3px brackets
  - All views now have identical targeting reticle appearance

### Phase 9: Touch Controls & Documentation (December 2025) ✅ COMPLETE
- **Touch controls for orbit map**
  - Added single-finger drag rotation (matches mouse drag behavior)
  - Added two-finger pinch zoom (MIN: 20, MAX: 150 units)
  - Camera rotates around selected element when moon/station selected
  - Panel detection prevents rotation when touching menu

- **Documentation updates**
  - Updated CLAUDE.md with camera controls and behavior documentation
  - Updated data structure diagram (removed "Proposed"/"NEW" labels)
  - Marked all Phase 5 tasks complete
  - Marked Task 19 (Orbit System Redesign) as complete

### Phase 10: Normal Maps & Realistic Lighting (December 2025) ✅ COMPLETE
- **Task 22**: Normal maps for planet surfaces
  - Updated batch_convert_textures.sh to skip Bump-* files
  - Created copy_normal_maps.sh to copy normal maps to output directories
  - Changed planet/moon materials to MeshStandardMaterial
  - Added normal map loading with normalScale: 5.0 for pronounced detail
  - Normal maps auto-derived from texture path (Type-* → Bump-*)

- **Task 23**: Realistic sun lighting system
  - Directional light positioned based on planet's orbital angle
  - Bright directional light (intensity 4.0) for stark terminator line
  - Ambient fill light (intensity 1.1) to see dark side
  - Multi-layer sun visual (core, glow layers, billboard flare)
  - Shadow casting for moon eclipse effect (PCFSoftShadowMap)

- **Task 24**: Sun declination (seasonal tilt)
  - New `sun_declination` parameter in orbit_map.yaml
  - Positive = northern summer, Negative = southern summer
  - updateSunPosition() applies declination after orbit data loads
  - Example: Tau Ceti f set to 23° (northern summer)
