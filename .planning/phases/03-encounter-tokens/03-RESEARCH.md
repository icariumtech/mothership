# Phase 3: Encounter Tokens - Research

**Researched:** 2026-02-14
**Domain:** React drag-and-drop UI, SVG token rendering, Django real-time state management, grid snapping
**Confidence:** HIGH

## Summary

Phase 3 implements drag-and-drop tokens on encounter maps for tactical gameplay. The GM can place and move tokens (player characters, NPCs, creatures, objects) on the grid-based SVG map, with live updates pushed to players via polling. This builds directly on the existing encounter map SVG renderer (EncounterMapRenderer.tsx) which already handles grid layout, pan/zoom, and room visibility. Tokens snap to grid cells using coordinate rounding, distinguish between types via visual styling, and display status indicators (wounded, dead, panicked) as overlays.

The implementation follows established project patterns: React functional components with TypeScript, Django file-based data storage (tokens stored in ActiveView JSON field for runtime state), SVG rendering with procedural textures, and 2-second polling for player updates. Key technical decision: Use native browser drag-and-drop API (onMouseDown/onMouseMove/onMouseUp) with grid snapping math rather than external library—avoids dependency bloat while integrating cleanly with existing SVG pan/zoom system.

**Primary recommendation:** Extend EncounterMapRenderer with TokenLayer component rendering SVG sprites, store token state in ActiveView.encounter_tokens JSONField, implement GM drag handlers with grid snap calculation, poll /api/active-view/ for updates. Use procedural SVG circles/icons for token avatars, CSS classes for type styling, and SVG overlays for status indicators. No new dependencies needed.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 19 | UI framework | Already in project, hooks pattern |
| TypeScript | 5.x | Type safety | All frontend uses TS |
| Django | 5.2.7 | Backend API | Project backend framework |
| SVG | Native | Token rendering | Existing encounter map uses SVG |
| Browser DnD API | Native | Drag and drop | No external deps, integrates with existing pan/zoom |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| EncounterMapRenderer | (local) | SVG map renderer | Extend with token layer |
| ActiveView model | (local) | Runtime state storage | Token positions and status |
| Panel components | (local) | GM token palette UI | Token selection and placement |
| CSS animations | Native | Status indicators | Pulse/blink effects |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native drag API | dnd-kit (~10kb) | dnd-kit adds accessibility features but requires learning custom API, native drag integrates with existing SVG event handlers |
| Native drag API | React DnD (~25kb) | React DnD is more complex abstraction, overkill for simple token dragging |
| Polling (2s) | WebSockets | WebSockets require Django Channels infrastructure, polling reuses existing pattern |
| SVG sprites | Canvas 2D | Canvas requires redraw logic, SVG declarative and scales with zoom |
| ActiveView JSON | Separate Token model | JSON field matches existing pattern (room_visibility, door_status) |

**Installation:**
```bash
# No new dependencies needed - use existing stack
```

## Architecture Patterns

### Recommended Project Structure
```
src/components/domain/encounter/
├── EncounterMapRenderer.tsx     # Extend with token rendering
├── TokenLayer.tsx                # New: Render all tokens as SVG group
├── Token.tsx                     # New: Individual token sprite
├── TokenStatusOverlay.tsx        # New: Status indicators (wounded, dead, etc.)
└── EncounterMapRenderer.css      # Add token styling

src/components/gm/
├── EncounterPanel.tsx            # Extend with token controls
├── TokenPalette.tsx              # New: Token type selector + placement
└── TokenStatusControl.tsx        # New: Status toggle buttons

terminal/
├── models.py                     # Add encounter_tokens JSONField to ActiveView
└── views.py                      # Add api_encounter_place_token, api_encounter_move_token, api_encounter_remove_token

src/types/
└── encounterMap.ts               # Add TokenData, TokenType, TokenStatus interfaces
```

### Pattern 1: Token Data in ActiveView JSONField
**What:** Store runtime token state in ActiveView.encounter_tokens as JSON
**When to use:** All GM-controlled encounter state (matches room_visibility, door_status pattern)
**Example:**
```python
# In terminal/models.py (ActiveView model)
class ActiveView(models.Model):
    # ... existing fields ...
    encounter_tokens = models.JSONField(default=dict, blank=True)
    # Structure: { 'token_id': { 'type': 'player', 'x': 5, 'y': 3, 'name': 'Marcus', 'status': ['wounded'] } }

# In terminal/views.py
def api_encounter_place_token(request):
    """GM places a token on the encounter map"""
    if request.method != 'POST':
        return JsonResponse({'error': 'POST required'}, status=405)

    token_id = request.POST.get('token_id')
    token_type = request.POST.get('type')  # player, npc, creature, object
    x = int(request.POST.get('x'))
    y = int(request.POST.get('y'))
    name = request.POST.get('name')

    active_view = ActiveView.get_current()
    if not active_view.encounter_tokens:
        active_view.encounter_tokens = {}

    active_view.encounter_tokens[token_id] = {
        'type': token_type,
        'x': x,
        'y': y,
        'name': name,
        'status': [],  # List of status flags: wounded, dead, panicked, etc.
    }
    active_view.save()

    return JsonResponse({'success': True, 'token_id': token_id})
```

### Pattern 2: SVG Token Layer with Drag Handlers
**What:** Render tokens as SVG sprites with native drag handlers
**When to use:** All token visualization and interaction
**Example:**
```typescript
// src/components/domain/encounter/TokenLayer.tsx
import { Token } from './Token';
import { TokenData } from '@/types/encounterMap';

interface TokenLayerProps {
  tokens: Record<string, TokenData>;
  unitSize: number;
  onTokenMove?: (tokenId: string, x: number, y: number) => void;
  onTokenSelect?: (tokenId: string) => void;
  isGM?: boolean;
}

export function TokenLayer({ tokens, unitSize, onTokenMove, onTokenSelect, isGM }: TokenLayerProps) {
  return (
    <g className="encounter-map__token-layer">
      {Object.entries(tokens).map(([tokenId, tokenData]) => (
        <Token
          key={tokenId}
          id={tokenId}
          data={tokenData}
          unitSize={unitSize}
          onMove={isGM ? (x, y) => onTokenMove?.(tokenId, x, y) : undefined}
          onSelect={() => onTokenSelect?.(tokenId)}
          draggable={isGM}
        />
      ))}
    </g>
  );
}
```

### Pattern 3: Grid Snapping with Coordinate Rounding
**What:** Snap token positions to grid cells during drag
**When to use:** All token movement operations
**Example:**
```typescript
// src/components/domain/encounter/Token.tsx
interface TokenProps {
  id: string;
  data: TokenData;
  unitSize: number;
  onMove?: (x: number, y: number) => void;
  draggable?: boolean;
}

export function Token({ id, data, unitSize, onMove, draggable }: TokenProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!draggable) return;

    e.stopPropagation(); // Prevent map panning
    setIsDragging(true);

    const svg = svgRef.current?.ownerSVGElement;
    if (!svg) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

    setDragOffset({
      x: svgP.x - data.x * unitSize,
      y: svgP.y - data.y * unitSize,
    });
  }, [draggable, data, unitSize]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;

    const svg = svgRef.current?.ownerSVGElement;
    if (!svg) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgP = pt.matrixTransform(svg.getScreenCTM()?.inverse());

    // Calculate new grid position with snapping
    const rawX = (svgP.x - dragOffset.x) / unitSize;
    const rawY = (svgP.y - dragOffset.y) / unitSize;

    // Snap to nearest grid cell (round to integer)
    const snappedX = Math.round(rawX);
    const snappedY = Math.round(rawY);

    // Optional: Validate bounds against grid dimensions
    // const clampedX = Math.max(0, Math.min(gridWidth - 1, snappedX));
    // const clampedY = Math.max(0, Math.min(gridHeight - 1, snappedY));

    onMove?.(snappedX, snappedY);
  }, [isDragging, dragOffset, unitSize, onMove]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Calculate center position of token in SVG coordinates
  const centerX = data.x * unitSize + unitSize / 2;
  const centerY = data.y * unitSize + unitSize / 2;
  const tokenRadius = unitSize * 0.4; // 80% of cell size

  return (
    <g
      ref={svgRef}
      className={`encounter-map__token encounter-map__token--${data.type}`}
      transform={`translate(${centerX}, ${centerY})`}
      style={{ cursor: draggable ? 'grab' : 'default' }}
      onMouseDown={handleMouseDown}
    >
      {/* Token circle */}
      <circle
        r={tokenRadius}
        className="encounter-map__token-body"
      />
      {/* Token label */}
      <text
        y={4}
        className="encounter-map__token-label"
        textAnchor="middle"
      >
        {data.name}
      </text>
      {/* Status indicators */}
      {data.status.includes('wounded') && (
        <circle r={4} cx={tokenRadius * 0.7} cy={-tokenRadius * 0.7} fill="#8b5555" />
      )}
      {data.status.includes('dead') && (
        <path d="M-5,-5 L5,5 M-5,5 L5,-5" stroke="#8b5555" strokeWidth={2} />
      )}
    </g>
  );
}
```

### Pattern 4: GM Token Palette UI
**What:** Panel UI for GM to select and place tokens
**When to use:** GM Console encounter controls
**Example:**
```typescript
// src/components/gm/TokenPalette.tsx
interface TokenPaletteProps {
  onPlaceToken: (type: TokenType, name: string) => void;
}

export function TokenPalette({ onPlaceToken }: TokenPaletteProps) {
  const [selectedType, setSelectedType] = useState<TokenType>('player');
  const [tokenName, setTokenName] = useState('');

  const handlePlace = () => {
    if (!tokenName.trim()) {
      alert('Enter a token name');
      return;
    }
    onPlaceToken(selectedType, tokenName);
    setTokenName(''); // Clear for next placement
  };

  return (
    <div className="token-palette">
      <div className="token-palette__type-selector">
        <button
          className={selectedType === 'player' ? 'active' : ''}
          onClick={() => setSelectedType('player')}
        >
          Player
        </button>
        <button
          className={selectedType === 'npc' ? 'active' : ''}
          onClick={() => setSelectedType('npc')}
        >
          NPC
        </button>
        <button
          className={selectedType === 'creature' ? 'active' : ''}
          onClick={() => setSelectedType('creature')}
        >
          Creature
        </button>
        <button
          className={selectedType === 'object' ? 'active' : ''}
          onClick={() => setSelectedType('object')}
        >
          Object
        </button>
      </div>
      <input
        type="text"
        placeholder="Token name"
        value={tokenName}
        onChange={(e) => setTokenName(e.target.value)}
      />
      <button onClick={handlePlace}>Place Token</button>
    </div>
  );
}
```

### Pattern 5: Status Indicator Overlays
**What:** Visual overlays on tokens showing status (wounded, dead, panicked)
**When to use:** All token status display
**Example:**
```typescript
// src/components/domain/encounter/TokenStatusOverlay.tsx
interface TokenStatusOverlayProps {
  status: string[];
  tokenRadius: number;
}

export function TokenStatusOverlay({ status, tokenRadius }: TokenStatusOverlayProps) {
  return (
    <g className="encounter-map__token-status">
      {status.includes('wounded') && (
        <circle
          r={4}
          cx={tokenRadius * 0.7}
          cy={-tokenRadius * 0.7}
          fill="#8b5555"
          className="status-indicator status-indicator--wounded"
        />
      )}
      {status.includes('dead') && (
        <g className="status-indicator status-indicator--dead">
          <line x1={-tokenRadius} y1={-tokenRadius} x2={tokenRadius} y2={tokenRadius} stroke="#8b5555" strokeWidth={3} />
          <line x1={-tokenRadius} y1={tokenRadius} x2={tokenRadius} y2={-tokenRadius} stroke="#8b5555" strokeWidth={3} />
        </g>
      )}
      {status.includes('panicked') && (
        <circle
          r={tokenRadius + 2}
          fill="none"
          stroke="#8b7355"
          strokeWidth={2}
          strokeDasharray="4 4"
          className="status-indicator status-indicator--panicked"
          style={{ animation: 'pulse 1s ease-in-out infinite' }}
        />
      )}
    </g>
  );
}

// In CSS:
// @keyframes pulse {
//   0%, 100% { opacity: 1; stroke-width: 2; }
//   50% { opacity: 0.5; stroke-width: 3; }
// }
```

### Anti-Patterns to Avoid
- **External drag library for simple use case:** dnd-kit/React DnD add complexity and bundle size for features not needed (accessibility wrappers, keyboard nav, complex constraints). Native drag API sufficient for mouse-based token placement.
- **Separate Token database model:** Token positions are runtime state that changes frequently during encounters. Storing in ActiveView JSON matches existing pattern (room_visibility, door_status) and avoids database migrations/queries.
- **Canvas rendering instead of SVG:** Canvas requires manual redraw logic and doesn't integrate with existing SVG map. SVG tokens are declarative, scale with zoom, and share coordinate system with rooms.
- **Real-time database queries:** Polling every 2 seconds with single ActiveView query is simpler than WebSockets infrastructure (Django Channels). Matches existing pattern in project.
- **Token image uploads:** Procedural SVG shapes (circles, icons) are faster, lighter, and styleable with CSS. Image uploads add file management complexity.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG coordinate transforms | Custom matrix math | SVGGraphicsElement.getScreenCTM() | Browser provides accurate screen-to-SVG transforms, handles zoom/pan automatically |
| Grid snapping logic | Complex collision detection | Math.round(x / unitSize) * unitSize | Simple rounding snaps to nearest cell, no library needed |
| Token state persistence | Custom state management | ActiveView JSONField (existing pattern) | Matches project's room_visibility/door_status pattern |
| Drag and drop | Custom mouse tracking | Native onMouseDown/Move/Up | Browser events handle edge cases (mouse leaving window, etc.) |
| Status indicator animations | JavaScript RAF loops | CSS animations with @keyframes | CSS animations are performant, don't block main thread |

**Key insight:** The encounter map SVG renderer already handles 90% of the infrastructure (grid layout, coordinate system, pan/zoom, room visibility). Tokens are just another SVG layer rendered above rooms, reusing the same coordinate math and event handling patterns.

## Common Pitfalls

### Pitfall 1: SVG Transform Conflicts with Pan/Zoom
**What goes wrong:** Token drag calculates wrong position when map is panned/zoomed
**Why it happens:** Mouse clientX/Y are in screen space, but token positions are in SVG coordinate space
**How to avoid:**
- Use `svg.createSVGPoint()` and `getScreenCTM().inverse()` to transform screen coords to SVG coords
- Account for current pan/zoom state in transform
- Store drag offset relative to token origin, not mouse position
**Warning signs:** Tokens jump to wrong position on first drag, offset increases with zoom level

### Pitfall 2: Drag Event Propagation to Map Pan
**What goes wrong:** Dragging token also pans the map
**Why it happens:** EncounterMapRenderer has mouse handlers for pan, token mouse events propagate to parent
**How to avoid:**
- Call `e.stopPropagation()` in token's onMouseDown handler
- Check event target in map's mouse handler before panning (`if (target.closest('.encounter-map__token')) return`)
- Set pointer-events: none on token when not draggable (player view)
**Warning signs:** Map pans while dragging tokens, tokens don't stay under cursor

### Pitfall 3: Token State Race Conditions
**What goes wrong:** Player sees stale token positions, GM moves get overwritten
**Why it happens:** Multiple rapid moves before polling interval, optimistic UI updates not in sync with server
**How to avoid:**
- Debounce token move API calls (300ms) but update local state immediately (optimistic update)
- Include timestamp in API response, discard stale updates
- Show visual feedback during pending moves (opacity, border)
**Warning signs:** Tokens snap back to old position after drag, positions don't match between GM and players

### Pitfall 4: Token ID Collisions
**What goes wrong:** Placing multiple tokens with same ID causes overwrites
**Why it happens:** Using token name as ID, or incrementing counter without checking existing tokens
**How to avoid:**
- Generate unique IDs: `crypto.randomUUID()` or `Date.now() + Math.random()`
- Validate ID doesn't exist in encounter_tokens before placing
- Use separate name field for display, id field for unique identification
**Warning signs:** Tokens disappear when placing new ones, only one token of each type visible

### Pitfall 5: Grid Coordinate Edge Cases
**What goes wrong:** Tokens placed at negative coordinates or outside grid bounds
**Why it happens:** No validation when snapping to grid, drag can exit map boundaries
**How to avoid:**
- Clamp grid coordinates: `Math.max(0, Math.min(gridWidth - 1, snappedX))`
- Validate bounds in both client-side drag handler and server-side API
- Provide visual feedback when attempting to drag outside valid area
**Warning signs:** Tokens disappear off edge of map, console errors about invalid coordinates

### Pitfall 6: Status Indicator Visual Clutter
**What goes wrong:** Multiple status icons overlap and become unreadable
**Why it happens:** All status indicators render at same position without spacing logic
**How to avoid:**
- Position status dots in cardinal directions around token (N, E, S, W)
- Limit to 4 simultaneous statuses, or stack remaining as list
- Use different visual styles (dot vs outline vs overlay) to differentiate
**Warning signs:** Status indicators overlap into illegible blob, can't tell which statuses are active

## Code Examples

Verified patterns from existing codebase and industry best practices:

### Token Type Enum and Data Structure
```typescript
// src/types/encounterMap.ts
export type TokenType = 'player' | 'npc' | 'creature' | 'object';
export type TokenStatus = 'wounded' | 'dead' | 'panicked' | 'stunned' | 'hidden';

export interface TokenData {
  type: TokenType;
  x: number;  // Grid cell X coordinate
  y: number;  // Grid cell Y coordinate
  name: string;
  status: TokenStatus[];
  color?: string;  // Optional: custom token color
  icon?: string;   // Optional: custom icon name
}

// Complete token state for ActiveView
export interface TokenState {
  [tokenId: string]: TokenData;
}
```

### Extending EncounterMapRenderer with Token Layer
```typescript
// In src/components/domain/encounter/EncounterMapRenderer.tsx (extend existing component)
import { TokenLayer } from './TokenLayer';
import type { TokenState } from '@/types/encounterMap';

interface EncounterMapRendererProps {
  mapData: EncounterMapData;
  roomVisibility?: RoomVisibilityState;
  doorStatus?: DoorStatusState;
  tokens?: TokenState;  // NEW: Token positions from API
  onTokenMove?: (tokenId: string, x: number, y: number) => void;  // NEW: GM move handler
  isGM?: boolean;  // NEW: Enable drag for GM only
  // ... existing props ...
}

export function EncounterMapRenderer({
  mapData,
  roomVisibility,
  doorStatus,
  tokens,
  onTokenMove,
  isGM,
  // ... existing props ...
}: EncounterMapRendererProps) {
  // ... existing state and handlers ...

  return (
    <div className="encounter-map-renderer" /* ... existing handlers ... */>
      <svg /* ... existing props ... */>
        {/* Existing layers: background, connections, rooms, doors, terminals, POIs */}

        {/* NEW: Token layer - rendered above all other elements */}
        {tokens && (
          <TokenLayer
            tokens={tokens}
            unitSize={unitSize}
            onTokenMove={onTokenMove}
            isGM={isGM}
          />
        )}
      </svg>
      {/* ... existing overlays ... */}
    </div>
  );
}
```

### GM API Call for Moving Token
```typescript
// src/services/encounterApi.ts (extend existing file)
export async function moveToken(
  tokenId: string,
  x: number,
  y: number
): Promise<{ success: boolean }> {
  const response = await api.post('/api/encounter/move-token/', {
    token_id: tokenId,
    x,
    y,
  });
  return response.data;
}

export async function setTokenStatus(
  tokenId: string,
  status: TokenStatus[]
): Promise<{ success: boolean }> {
  const response = await api.post('/api/encounter/set-token-status/', {
    token_id: tokenId,
    status,
  });
  return response.data;
}

export async function removeToken(
  tokenId: string
): Promise<{ success: boolean }> {
  const response = await api.post('/api/encounter/remove-token/', {
    token_id: tokenId,
  });
  return response.data;
}
```

### Player Polling for Token Updates
```typescript
// In SharedConsole.tsx (extend existing polling logic)
useEffect(() => {
  const pollActiveView = async () => {
    try {
      const response = await fetch('/api/active-view/');
      const data = await response.json();

      // Existing: Set view type, location, room visibility, door status
      // NEW: Update token positions
      if (data.encounter_tokens) {
        setTokens(data.encounter_tokens);
      }
    } catch (error) {
      console.error('Failed to poll active view:', error);
    }
  };

  // Poll every 2 seconds (existing pattern)
  const interval = setInterval(pollActiveView, 2000);
  return () => clearInterval(interval);
}, []);
```

### CSS Styling for Token Types
```css
/* src/components/domain/encounter/EncounterMapRenderer.css */

/* Token base styling */
.encounter-map__token {
  transition: opacity 0.2s ease;
}

.encounter-map__token-body {
  fill: var(--color-teal);
  stroke: var(--color-border-main);
  stroke-width: 2;
  transition: fill 0.2s ease, stroke 0.2s ease;
}

.encounter-map__token:hover .encounter-map__token-body {
  fill: var(--color-teal-bright);
  stroke: var(--color-amber);
}

/* Token type colors */
.encounter-map__token--player .encounter-map__token-body {
  fill: var(--color-amber);
  stroke: var(--color-amber-bright);
}

.encounter-map__token--npc .encounter-map__token-body {
  fill: var(--color-teal);
  stroke: var(--color-teal-bright);
}

.encounter-map__token--creature .encounter-map__token-body {
  fill: #6b4a4a;  /* Burgundy for threats */
  stroke: #8b5555;
}

.encounter-map__token--object .encounter-map__token-body {
  fill: var(--color-bg-panel-dark);
  stroke: var(--color-border-subtle);
  stroke-dasharray: 3 3;
}

/* Token label */
.encounter-map__token-label {
  fill: var(--color-text-primary);
  font-size: 10px;
  font-family: 'Cascadia Code', monospace;
  pointer-events: none;
  user-select: none;
}

/* Status indicator animations */
@keyframes pulse-wounded {
  0%, 100% { opacity: 1; r: 4; }
  50% { opacity: 0.6; r: 5; }
}

@keyframes pulse-panicked {
  0%, 100% { opacity: 1; stroke-width: 2; }
  50% { opacity: 0.5; stroke-width: 3; }
}

.status-indicator--wounded {
  animation: pulse-wounded 1.5s ease-in-out infinite;
}

.status-indicator--panicked {
  animation: pulse-panicked 1s ease-in-out infinite;
}

/* Dragging state */
.encounter-map__token.is-dragging {
  opacity: 0.7;
  cursor: grabbing !important;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React DnD library | Native browser drag API | 2023+ | Smaller bundle, simpler integration with SVG |
| Separate Token model | ActiveView JSONField | This project | Matches existing pattern, faster polling queries |
| Image-based tokens | Procedural SVG shapes | 2020+ | Faster rendering, CSS styling, no file management |
| WebSockets push | HTTP polling | This project | Simpler infrastructure, reuses existing pattern |
| Canvas rendering | SVG declarative | Modern React | Better integration with existing map, automatic scaling |

**Deprecated/outdated:**
- **React DnD (react-dnd):** Still maintained but heavyweight for simple use cases. Modern trend is native drag API or lightweight dnd-kit.
- **Image sprites for tokens:** SVG procedural generation preferred for styling flexibility and performance.
- **Long polling:** Short interval polling (2s) preferred for simplicity over complex long-poll or SSE infrastructure.

## Tech Stack Verification

### dnd-kit (Modern Drag and Drop Library)

**From official documentation** (https://docs.dndkit.com/ - verified 2026-02-14):
- Core library ~10kb minified, no external dependencies
- Built around React state management and context
- Supports lists, grids, multiple containers, nested contexts
- Modifiers API for grid snapping: `createSnapModifier` from '@dnd-kit/modifiers'
- TypeScript support built-in

**Grid snapping implementation:**
```typescript
import { createSnapModifier } from '@dnd-kit/modifiers';

const gridSize = 40; // Match unitSize from encounter map
const snapToGrid = createSnapModifier(gridSize);

<DndContext modifiers={[snapToGrid]}>
  {/* Draggable tokens */}
</DndContext>
```

**Decision:** While dnd-kit is excellent for complex scenarios (sortable lists, multiple drop zones, accessibility requirements), this project only needs simple token dragging on a single SVG map. Native browser drag API is sufficient and avoids dependency.

### Real-Time Updates: Polling vs WebSockets

**From search results verification** (2026-02-14):
- **WebSockets:** More efficient for true real-time (instant push), requires Django Channels infrastructure
- **Polling:** Simpler implementation, works well for 2-second update intervals, existing pattern in project
- **Benchmark data:** At 100k concurrent users, WebSockets significantly outperform polling. At <100 users, polling is adequate.

**Project context:** Mothership GM Tool targets small groups (1 GM + 3-7 players). 2-second polling matches existing pattern (`/api/active-view/` already polled). Token positions don't require sub-second updates.

**Decision:** Use existing 2-second polling pattern. WebSockets are overkill for this scale and would require infrastructure changes (Django Channels, connection management, reconnection logic).

## Open Questions

1. **Token Rotation/Facing**
   - What we know: Standard grid tokens usually face a direction (important for line-of-sight rules)
   - What's unclear: Should tokens have facing indicator? How to set (click to rotate, explicit control)?
   - Recommendation: Start without rotation (simpler), add in future phase if GM requests. Mothership RPG doesn't have strict facing rules.

2. **Token Avatar Images**
   - What we know: Procedural SVG shapes are simpler to implement and style
   - What's unclear: Will GMs want custom images for specific NPCs/creatures?
   - Recommendation: Start with procedural shapes (circles with type-based colors). Add optional image upload in future if requested. Most tactical VTTs use simple shapes for performance.

3. **Multi-Select for Batch Operations**
   - What we know: GMs often need to move multiple tokens together (monster groups)
   - What's unclear: Should Phase 3 include multi-select, or defer to future phase?
   - Recommendation: Defer to Phase 4. Single-token placement and movement is minimum viable. Multi-select adds complexity (shift-click, drag box, etc.).

4. **Token Size Variations**
   - What we know: Some creatures are larger (2x2 cells) or smaller (0.5x0.5 cells)
   - What's unclear: Should tokens support variable size in Phase 3?
   - Recommendation: Start with 1x1 tokens only (80% of cell size). Add size variation in future if needed. Mothership encounters rarely use size-based mechanics.

5. **Persistent Token Library**
   - What we know: ActiveView stores runtime encounter state, but tokens disappear when switching encounters
   - What's unclear: Should there be a persistent library of token templates (saved NPCs/creatures)?
   - Recommendation: Phase 3 uses runtime-only tokens. Add persistent library in future phase (campaign/tokens.yaml file with reusable templates).

## Sources

### Primary (HIGH confidence)
- Project codebase: `/home/gjohnson/mothership/charon/` (direct inspection)
  - CLAUDE.md - Project architecture overview
  - codemaps/frontend.md - React component patterns and SVG integration
  - codemaps/backend.md - Django ActiveView model and API patterns
  - src/components/domain/encounter/EncounterMapRenderer.tsx - Existing SVG renderer with pan/zoom/grid
  - src/types/encounterMap.ts - Existing map data structures
  - terminal/models.py - ActiveView model with JSONField pattern
- MDN Web Docs - SVG coordinate transforms, browser drag API (official standard)

### Secondary (MEDIUM confidence)
- [dnd-kit Official Documentation](https://docs.dndkit.com/) - Modern drag and drop library features, grid snapping
- [Top 5 Drag-and-Drop Libraries for React in 2026](https://puckeditor.com/blog/top-5-drag-and-drop-libraries-for-react) - Library comparison and recommendations
- [React WebSocket tutorial (LogRocket)](https://blog.logrocket.com/websocket-tutorial-socket-io/) - WebSockets vs polling tradeoffs
- [Django Real-Time Polling Example (Medium)](https://medium.com/@hraju115/step-into-real-time-web-applications-part-1-django-real-time-polling-example-with-ajax-7123f5762b3f) - Django polling patterns
- [Async Django + HTMX: WebSockets vs. Polling Benchmarks (Medium)](https://medium.com/@yogeshkrishnanseeniraj/async-django-htmx-real-time-updates-at-100k-concurrent-users-websockets-vs-polling-benchmarks-af18eda4e65f) - Performance data for polling vs WebSockets
- [Implementing Polling in React (Medium)](https://medium.com/@sfcofc/implementing-polling-in-react-a-guide-for-efficient-real-time-data-fetching-47f0887c54a7) - React polling best practices

### Tertiary (LOW confidence)
- [React DnD (GitHub)](https://github.com/react-dnd/react-dnd) - Alternative drag library (heavier, more complex)
- [React Beautiful DND](https://github.com/atlassian/react-beautiful-dnd) - Deprecated, replaced by Pragmatic Drag and Drop

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All components already in project, native APIs well-documented
- Architecture: HIGH - Clear extension of existing EncounterMapRenderer pattern
- Drag and drop: HIGH - Native browser API sufficient, dnd-kit well-documented if needed later
- Grid snapping: HIGH - Simple math (coordinate rounding), existing grid system in place
- Real-time updates: HIGH - Polling pattern already established, WebSocket comparison verified
- Token rendering: HIGH - SVG sprites match existing map rendering, procedural textures proven in project
- Pitfalls: MEDIUM - Based on common SVG drag issues, not project-specific experience yet

**Research date:** 2026-02-14
**Valid until:** 30 days (stable stack, drag APIs unlikely to change)
