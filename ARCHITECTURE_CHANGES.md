# Architecture Changes - Bridge View Refactoring

**Date**: 2026-01-25
**Summary**: Major refactoring of the Bridge View to improve code organization, maintainability, and extensibility.

## Overview

The Bridge View has been refactored from a monolithic `CampaignDashboard` component into a modular, tab-based architecture. This change separates concerns, improves code reusability, and sets up a foundation for implementing additional bridge sections.

## New Component Architecture

### Core Components

#### BridgeView (`src/components/domain/dashboard/BridgeView.tsx`)
- Main container component for the bridge interface
- Manages tab navigation and content switching
- Receives map components as children from SharedConsole
- Props:
  - `activeTab`: Current active tab
  - `onTabChange`: Tab change callback
  - `tabTransitionActive`: Disables tab switching during transitions
  - `children`: Map components and InfoPanel rendered in MAP tab

#### TabBar (`src/components/domain/dashboard/TabBar.tsx`)
- Bottom navigation bar with 5 tabs
- Tabs: MAP, CREW, CONTACTS, NOTES, STATUS
- Features:
  - Active state highlighting (amber color)
  - Disabled state during transitions
  - Uses base Panel component with full chamfering

#### StarMapPanel (`src/components/domain/dashboard/StarMapPanel.tsx`)
- Left sidebar panel showing hierarchical location lists
- Three display modes based on `mapViewMode`:
  - **Galaxy**: List of star systems with dive buttons
  - **System**: List of planets with facility indicators and back button
  - **Orbit**: List of moons, stations, and surface facilities
- Features:
  - Navigation buttons ("BACK TO GALAXY", "BACK TO SYSTEM")
  - Dive buttons (▶) for drilling down into sub-levels
  - Facility indicators (▼ surface, ◆ orbital)
  - Selection highlighting with checkboxes

#### InfoPanel (Enhanced) (`src/components/domain/dashboard/InfoPanel.tsx`)
- Refactored to use `forwardRef` for parent access to typing state
- Now uses base Panel component internally for consistency
- Exposes `isTyping` state via `data-isTyping` attribute
- Helper functions for building HTML content:
  - `buildSystemInfoHTML()`
  - `buildPlanetInfoHTML()`
  - `buildMoonInfoHTML()`
  - `buildStationInfoHTML()`
  - `buildSurfaceMarkerInfoHTML()`

### Section Components

New placeholder components in `src/components/domain/dashboard/sections/`:
- `CrewSection.tsx` - Player character roster (placeholder)
- `ContactsSection.tsx` - NPC and faction database (placeholder)
- `NotesSection.tsx` - Campaign notes and session logs (placeholder)
- `StatusSection.tsx` - Ship status and mission objectives (placeholder)
- `MapSection.tsx` - Map view logic (currently inline in SharedConsole)

Each section currently displays "SECTION UNDER CONSTRUCTION" placeholder text.

## State Management Changes

### Tab State
- Active tab stored in `sessionStorage` as `bridgeActiveTab`
- Persists across page refreshes
- Defaults to 'map' if no saved state

### Tab Transition State
- New `tabTransition` state ('idle' | 'transitioning')
- Disables tab switching during animations
- Prevents race conditions during tab changes

### Map View Refactoring
- Removed redundant state management from CampaignDashboard
- Centralized in SharedConsole with clearer data flow
- Map components receive state and callbacks via props

## File Organization

### New Files
```
src/components/domain/dashboard/
├── BridgeView.tsx              # Main bridge container
├── BridgeView.css              # Bridge view styles
├── TabBar.tsx                  # Tab navigation
├── TabBar.css                  # Tab bar styles
├── StarMapPanel.tsx            # Star map list panel
├── StarMapPanel.css            # Star map panel styles
└── sections/
    ├── CrewSection.tsx         # Crew roster section
    ├── ContactsSection.tsx     # Contacts section
    ├── NotesSection.tsx        # Notes section
    ├── StatusSection.tsx       # Status section
    ├── MapSection.tsx          # Map section
    └── Section.css             # Shared section styles

src/entries/
└── SharedConsole.css           # SharedConsole-specific styles
```

### Removed Files
- `CampaignDashboard.tsx` - Replaced by BridgeView and related components
- `CampaignDashboard.css` - Split into BridgeView.css and other component styles

### Modified Files
- `SharedConsole.tsx` - Refactored to use new BridgeView architecture
- `InfoPanel.tsx` - Enhanced with forwardRef and internal Panel usage
- `InfoPanel.css` - Updated styles
- `GalaxyMap.tsx` - Added methods for camera positioning
- `SystemMap.tsx` - Added methods for camera positioning
- `OrbitMap.tsx` - Added methods for camera positioning
- `GalaxyScene.ts` - Added `positionCameraOnSystem()` method
- `SystemScene.ts` - Added `positionCameraOnPlanet()` method
- `OrbitScene.ts` - Added positioning methods

## Data Flow

### Before (Monolithic)
```
SharedConsole → CampaignDashboard
                ├── StarSystemList (inline)
                ├── Maps (inline)
                └── InfoPanel (inline)
```

### After (Modular)
```
SharedConsole → BridgeView → TabBar
                ├── StarMapPanel
                ├── Maps (children)
                ├── InfoPanel (children)
                └── Sections (CrewSection, etc.)
```

## Benefits

1. **Separation of Concerns**: Each component has a single, well-defined responsibility
2. **Reusability**: StarMapPanel and InfoPanel can be used in other contexts
3. **Maintainability**: Smaller, focused components are easier to understand and modify
4. **Extensibility**: New sections can be added easily with minimal changes
5. **Type Safety**: Improved TypeScript interfaces and type exports
6. **Performance**: Better optimization opportunities with smaller component trees
7. **Testing**: Smaller components are easier to test in isolation

## Migration Notes

### For Future Development

When implementing new sections (CREW, CONTACTS, NOTES, STATUS):

1. Replace placeholder content in respective section component
2. Add necessary props to BridgeView if data needs to be passed down
3. Consider creating sub-components for complex sections
4. Follow the existing pattern of using Panel components for consistent styling

### Example: Implementing CrewSection

```tsx
// Before (placeholder)
export function CrewSection() {
  return (
    <div className="section-empty">
      &gt; SECTION UNDER CONSTRUCTION
    </div>
  );
}

// After (with implementation)
export function CrewSection({ crew }: { crew: CrewMember[] }) {
  return (
    <div className="crew-section">
      {crew.map(member => (
        <CrewCard key={member.id} member={member} />
      ))}
    </div>
  );
}
```

## Testing Checklist

- [x] Tab navigation works correctly
- [x] Tab state persists in sessionStorage
- [x] Map navigation (galaxy → system → orbit) functions properly
- [x] Back buttons work correctly
- [x] Dive buttons navigate to deeper levels
- [x] InfoPanel displays correct information for each selection
- [x] Transition animations are smooth
- [x] No console errors or warnings
- [x] Responsive layout works on different screen sizes
- [x] Performance is acceptable (no lag during navigation)

## Future Enhancements

1. **Crew Section**: Display player character roster with stats, stress, and health
2. **Contacts Section**: NPC database with portraits and relationship tracking
3. **Notes Section**: Session logs, GM notes, and player discoveries
4. **Status Section**: Ship status, mission objectives, inventory
5. **Enhanced Transitions**: More sophisticated animation sequences between tabs
6. **Keyboard Navigation**: Hotkeys for switching tabs
7. **Mobile Optimization**: Collapsible panels for smaller screens

## Related Documentation

- [CLAUDE.md](CLAUDE.md) - Updated with new component architecture
- [STYLE_GUIDE.md](STYLE_GUIDE.md) - UI design system reference
- [src/components/ui/README.md](src/components/ui/README.md) - Panel component API

## Git History

Recent commits related to this refactoring:
- `f2ad9db` - Reorganize CLAUDE.md and extract STYLE_GUIDE.md
- `97f3eb9` - Add NPC portrait system with amber gradient conversion
- `e1bbae2` - Remove obsolete panel documentation files
- `fa3a93b` - Fix bug when clicking back to galaxy
- `1647c42` - Refactor encounter map overlays to use CSS Grid positioning
