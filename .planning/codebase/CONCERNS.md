# Codebase Concerns

**Analysis Date:** 2026-02-09

## Security Issues

### Hardcoded Secret Key (Critical)

**Issue:** Django SECRET_KEY is hardcoded in settings file with insecure value
- Files: `mothership_gm/settings.py:30`
- Impact: If deployed to production, compromises CSRF protection, session security, and password reset tokens
- Current state: DEBUG=True, ALLOWED_HOSTS=['*'], insecure-prefixed SECRET_KEY
- Fix approach: Move SECRET_KEY to environment variables (.env file), use django-environ or python-dotenv
- Production checklist: Enable secure cookies (SESSION_COOKIE_SECURE=True), set HTTPS_ONLY, proper ALLOWED_HOSTS

### DEBUG Mode Enabled in Development Configuration

**Issue:** DEBUG=True in settings.py with detailed error pages exposed
- Files: `mothership_gm/settings.py:33`
- Risk: Exposes stack traces, environment variables, and internal paths to anyone who triggers an error
- Current: Runs in development only but comment warns about production
- Recommendation: Ensure environment-specific settings (separate settings_dev.py, settings_prod.py)

### Overly Permissive ALLOWED_HOSTS

**Issue:** ALLOWED_HOSTS = ['*'] allows requests from any hostname
- Files: `mothership_gm/settings.py:35`
- Risk: Host header injection attacks, cache poisoning
- Fix approach: Set specific domains/IPs in production, use environment variable

## Error Handling Issues

### Broad Exception Catching Without Logging Context

**Issue:** Exception handlers swallow errors silently or with minimal context
- Files:
  - `terminal/views.py:96` - `except (FileNotFoundError, Exception): pass` silently ignores all errors loading star map
  - `src/entries/SharedConsole.tsx:236-237, 251-252, 320-321` - console.error but no error recovery
- Impact: Silent failures make debugging difficult, users see broken features without knowing why
- Pattern: Use specific exception types, log meaningful context (request path, data being loaded)
- Fix approach: Create error boundaries in React, implement proper error recovery/retry logic

### Missing API Error Handling in Services

**Issue:** API service functions have no try-catch or error handling
- Files: `src/services/charonApi.ts` - All functions assume success
- Impact: Network failures or server errors cause unhandled promise rejections
- Pattern: None of the async functions catch or transform axios errors
- Fix approach: Add error transformers in axios interceptor or wrap service calls with error boundaries

### Unhandled Promise Rejections in Polling

**Issue:** Polling loops may create unhandled rejections if API fails
- Files: `src/entries/SharedConsole.tsx:259-322`, `src/components/gm/CharonPanel.tsx:83-99`
- Pattern: `fetchData()` called but errors only logged with console.error
- Risk: Memory leaks if promises queue up, hidden failures
- Fix approach: Implement exponential backoff for failed polls, error count limits

## Memory and Resource Concerns

### Multiple Active Polling Intervals

**Issue:** Many concurrent polling loops may consume excessive resources
- Count: At least 6 active setInterval instances in SharedConsole and related components
  - `SharedConsole.tsx:259` - Active view poll (2s interval)
  - `SharedConsole.tsx:345` - Bridge messages poll (3s interval)
  - `GMConsole.tsx:62` - Active view sync (5s interval)
  - `CharonPanel.tsx:98` - CHARON data fetch (2s interval)
  - `CharonDialog.tsx:71` - Conversation fetch (2s interval)
  - `CharonTerminal.tsx:65` - Conversation fetch (2s interval)
- Impact: On low-end devices or with many open tabs, network bandwidth and CPU spike
- Fix approach: Consolidate polling into single coordinator, implement adaptive polling (slower when not focused)

### RAF Loop Without Pause Handling

**Issue:** Some R3F components with useFrame may not respect pause state
- Files: `src/components/domain/maps/r3f/` - OrbitScene.tsx, SystemScene.tsx, GalaxyScene.tsx
- Pattern: useFrame continues running even when canvas is paused
- Risk: Memory pressure on idle screens, battery drain on mobile
- Current mitigation: Canvas has `frameloop={paused ? 'demand' : 'always'}` but verify all components check state

### Event Listener Cleanup Missing

**Issue:** Some event listeners may not be properly cleaned up
- Files: `src/components/domain/encounter/EncounterMapRenderer.tsx` - Touch/mouse drag handlers
- Pattern: Refs track drag state but no verification cleanup happens on unmount
- Risk: Memory leak if component remounts repeatedly

## Large Components - Complexity and Maintainability

### EncounterMapRenderer (1031 lines)

**Files:** `src/components/domain/encounter/EncounterMapRenderer.tsx`
- Why large: SVG rendering, pan/zoom state, touch gestures, room visibility, door status, tooltips all in one component
- Fragility: Changes to pan/zoom math risk breaking mouse/touch interactions
- Recommendation: Extract pan/zoom logic to custom hook (usePanZoom), extract touch gesture handler to separate module
- Safe modification: Use ref forwarding, write test for coordinate transformations before refactoring

### SharedConsole (997 lines)

**Files:** `src/entries/SharedConsole.tsx`
- Why large: Contains all view rendering logic, polling orchestration, transition coordination, state management
- Why fragile: Many dependencies on prop drilling, timing-sensitive state updates
- Safe approach: Extract view rendering to separate components, create custom hook for polling orchestration
- Next step: Create `useViewPolling()` hook to separate polling logic from render logic

### OrbitScene (799 lines)

**Files:** `src/components/domain/maps/r3f/OrbitScene.tsx`
- Why large: 3D scene composition, camera control, element rendering, selection management
- Why fragile: R3F component with imperative handle, timing-sensitive animations
- Safe approach: Extract element rendering to sub-components, create dedicated hook for camera control
- Test gap: No tests for camera animation sequences

### SystemScene (651 lines)

**Files:** `src/components/domain/maps/r3f/SystemScene.tsx`
- Similar concerns to OrbitScene: monolithic scene composition
- Add imperative tests for zoom/transition sequences before refactoring

## Test Coverage Gaps

### No Automated Tests in Codebase

**What's not tested:**
- Data loader file parsing (YAML corruption handling)
- API error scenarios (network timeouts, malformed responses)
- React component render paths (especially error states)
- R3F scene state transitions and camera animations
- Polling state consistency across multiple sources

**Files:** No test files found in `src/` or `terminal/` (only node_modules tests)

**Risk:** High - Large refactors (e.g., breaking up EncounterMapRenderer) could silently introduce bugs

**Priority:** High - Add at least critical path tests:
1. `terminal/data_loader.py` - load_map error handling, missing files
2. `src/entries/SharedConsole.tsx` - view polling state consistency
3. `src/components/domain/encounter/EncounterMapRenderer.tsx` - coordinate transforms

## Fragile Areas

### Typewriter Timing Dependencies

**Files:**
- `src/utils/transitionCoordinator.ts:53-74` - waitForTypewriter uses requestAnimationFrame polling
- `src/components/domain/dashboard/InfoPanel.tsx` - TypewriterController drives progress
- `src/entries/SharedConsole.tsx:200-210` - Depends on typewriter completion before transitions

**Why fragile:**
- Polling-based (requestAnimationFrame in a loop) has race conditions
- 3-second timeout could skip animation if frame rate drops
- Multiple components write to same `typewriter` store field without locking

**Safe modification:**
- Extract to proper state machine (e.g., xstate)
- Add cypress/playwright E2E tests for transition sequences before refactoring
- Verify timeout is sufficient for all browsers/devices

### Pan/Zoom State in EncounterMapRenderer

**Files:** `src/components/domain/encounter/EncounterMapRenderer.tsx:100-114` - ViewState refs

**Why fragile:**
- Complex math for coordinate transformation (pan, zoom, SVG to canvas coords)
- Multiple touch gesture types (single, pinch, drag)
- No validation that zoom stays within bounds during animation

**Safe modification:**
- Extract to custom hook: `usePanZoom()` returning { panX, panY, zoom, handlers }
- Add unit tests for coordinate math before changes
- Document zoom boundary logic

### Map Navigation State Synchronization

**Files:** `src/entries/SharedConsole.tsx:284-293` - BRIDGE view state reset

**Issue:** When switching to BRIDGE view, code resets 6 state variables sequentially
- Risk: Intermediate state may render incorrectly
- Current: Uses multiple useState setters without batching

**Fix:** Wrap in React.startTransition or use single store action that updates all at once

## Data Validation Issues

### YAML Parsing Without Schema Validation

**Issue:** YAML files loaded without type checking or schema validation
- Files: `terminal/data_loader.py:44, 78, 103, 118` - yaml.safe_load() returns untyped dict
- Impact: Missing required fields not caught until rendering (runtime errors)
- Example: If location.yaml missing 'name' field, code creates {"name": dirname} silently

**Fix approach:**
- Add Pydantic models for LocationData, MapData, TerminalData
- Validate on load: `LocationData.model_validate(yaml_dict)`
- Return structured types instead of dicts

### JSON Parse Without Error Handling

**Files:** `src/hooks/useTreeState.ts:8` - JSON.parse(saved) with no try-catch

**Issue:** If localStorage contains corrupted JSON, throws error
- Impact: Component fails to render
- Risk: Unlikely but high impact (UI broken for that user)

**Fix:** Wrap in try-catch, fall back to empty set: `try { JSON.parse(...) } catch { return new Set() }`

## Known Bugs/Limitations

### Typewriter Animation Race Condition on Fast View Switches

**Symptom:** If user rapidly switches views, info panel text may not display or show partial text
- Files: `src/utils/transitionCoordinator.ts:53-74`
- Cause: requestAnimationFrame polling doesn't guarantee typewriter state is read consistently
- Workaround: Slow down, wait for text to complete before switching
- Fix priority: Medium - affects UX but not functionality

### Polling Desynchronization Under Network Latency

**Symptom:** With multiple polling intervals (2s, 3s, 5s), under poor connection they may all fire at once
- Files: Multiple polling locations in SharedConsole.tsx, CharonPanel.tsx
- Cause: No jitter/backoff, all timers start at same time
- Impact: Network spike every N seconds
- Fix approach: Add random jitter (±250ms) to poll intervals

### Missing Fallback for Deleted Locations in Data Directory

**Symptom:** If GM deletes a location directory while terminal is displaying it, no graceful error
- Files: `terminal/views.py`, `terminal/data_loader.py`
- Cause: No "location not found" error handler
- Impact: Terminal may crash or show stale data
- Fix: Add FileNotFoundError handler in data_loader, return None for missing locations

## Performance Bottlenecks

### Star Map Rendering Performance

**Issue:** Galaxy scene renders all ~100 star systems at once without LOD (Level of Detail)
- Files: `src/components/domain/maps/r3f/GalaxyScene.tsx`
- Bottleneck: Every system is a sprite mesh, no culling for off-screen systems
- Recommendation: Implement frustum culling or dynamic sprite LOD
- Impact: On older GPUs, frame rate drops when camera is far out

### Three.js Geometry Reallocation on Map Changes

**Issue:** Switching between Galaxy/System/Orbit scenes recreates all geometries
- Files: Canvas wrapper components (GalaxyMap.tsx, SystemMap.tsx, OrbitMap.tsx)
- Current: Each view mode renders new Canvas with new scene graph
- Alternative: Keep single Canvas, toggle scene visibility (less overhead)
- Impact: ~500ms loading time between view switches on mid-range devices

### No Image Asset Compression

**Issue:** Encounter map images loaded full-res from disk
- Files: `terminal/data_loader.py:124-127` - Loads .png/.jpg directly
- Impact: High bandwidth for facility maps, slow over slow connections
- Recommendation: Generate web-optimized versions (webp) or use image service worker

## Dependencies at Risk

### Python YAML Library

**Package:** PyYAML (required for data loading)
- Current use: `terminal/data_loader.py` - yaml.safe_load()
- Risk: PyYAML is well-maintained but parsing untrusted YAML (from data files) could be vector
- Current mitigation: Only loads from trusted local files, uses safe_load
- No blocker, but: Consider validating YAML structure on load with schema

### React Three Fiber / Three.js Versions

**Stack:** R3F 9.0, Three.js 0.182
- Pattern: Heavy use of useFrame, imperative handles, custom hooks
- Risk: Major version updates (10.x) could break camera control, texture loading
- Mitigation: Fixed versions in package-lock.json
- Action: Before upgrading, test camera transition sequences thoroughly

## Scaling Limits

### Database (SQLite)

**Current:** ActiveView (1 record), Message (small, limited by UI)
- Limit: SQLite maxes out around 10k concurrent connections, but this isn't at risk
- Bottleneck: Message polling across terminals - each poll queries database
- Scaling approach: Cache MessageQuery results in memory, invalidate on new message

### File-Based Data Directory

**Current:** ~100 locations, nested directories
- Limit: No hard limit, but listdir() performance degrades beyond ~10k entries
- Bottleneck: load_all_locations() recursively walks entire tree on startup
- Scaling approach: Implement location cache with mtime checking, lazy load children

### Memory Usage for Campaign Data

**Issue:** starMapData, systemMapData, orbitMapData all loaded into memory
- Each map: ~100-500KB JSON (depends on system size)
- Concern: Switching between maps repeatedly could accumulate memory if cleanup is incomplete
- Mitigation: Check that old map data is GC'd when new data loaded

## Security Considerations

### CSRF Token Handling

**Current:** `src/services/api.ts:3-22` - Reads CSRF from cookie, adds to X-CSRFToken header
- Pattern: Correct Django CSRF pattern
- Risk: Low (Django's csrf middleware validates)
- Note: Ensure SESSION_COOKIE_SECURE=True and SESSION_COOKIE_HTTPONLY=True in production

### No Input Validation on GM Console Actions

**Issue:** GM can set arbitrary location slugs, encounter levels without validation
- Files: `src/entries/GMConsole.tsx` - Tree click handlers directly call API
- Risk: If attacker gains GM access, can set invalid state
- Current: Backend should validate, but no explicit check
- Recommendation: Add frontend validation (enum check) before API calls

### File Path Traversal Risk in Data Loader

**Issue:** Location slug used directly in path construction
- Files: `terminal/data_loader.py:75` - location_dir = self.locations_dir / location_slug
- Risk: If slug contains "..", could escape data directory
- Current mitigation: Django controls what slugs are used, frontend provides them
- Hardening: Validate slug matches pattern `^[a-z0-9_-]+$` in backend

## Missing Critical Features

### No Undo/Redo for GM Actions

**Issue:** Once GM sends a CHARON message or sets view state, no way to undo
- Concern: Accidental messages broadcast to all players
- Recommendation: Implement undo queue, require confirmation for broadcasts

### No Rate Limiting on Polling

**Issue:** Client can poll API as fast as network allows
- Files: SharedConsole polling intervals hardcoded to 2-5 seconds
- Risk: Malicious client or buggy polling could DOS server
- Fix: Implement server-side rate limiting (Django cache-based)

### No Graceful Degradation for Offline/Slow Network

**Issue:** All views depend on API calls succeeding
- Concern: Slow connection or server maintenance leaves GM unable to update display
- Recommendation: Cache last known state, show "OFFLINE" indicator when server unavailable

---

*Concerns audit: 2026-02-09*
