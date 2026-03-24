# Phase 11: Close Functional + Security Gaps - Research

**Researched:** 2026-03-24
**Domain:** Django security decorators, React component wiring, Django template context injection
**Confidence:** HIGH

## Summary

Phase 11 closes four specific gaps identified by the v1.0 milestone audit. Each gap is a surgical, low-risk change — no new architecture, no new libraries, no new patterns. The research confirms all four fixes follow patterns already established elsewhere in the codebase; this is a connect-the-dots phase.

The security fix (STAT-06) is the highest priority: `api_ship_update_integrity` at `/api/gm/ship-status/integrity/` is missing `@login_required`, allowing unauthenticated POST requests to write hull/armor values directly to `ship.yaml`. The companion endpoint `api_ship_toggle_system` (line 1681) has the decorator correctly — this is a one-line oversight.

The three functional gaps follow the same pattern: the capability exists and works elsewhere; it simply was not wired into the right call site. NPCPortraitOverlay renders correctly on the player terminal via `SharedConsole.tsx` but is absent from `src/components/gm/views/EncounterView.tsx`. The "Set Ship Here" right-click context menu renders in BridgeView's `LocationTreePanel` but the prop is not passed in EncounterView's `LocationTreePanel`. The INITIAL_DATA ship status injection works in `shared_console_react.html` / `display_view_react` but the parallel pattern is missing from `gm_console_react` / `gm_console_react.html`.

**Primary recommendation:** Implement all four fixes in a single plan (11-01). Each is 1-5 lines. No new files needed.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PORT-03 | Portrait appears as overlay during GM EncounterView | NPCPortraitOverlay props and usage confirmed in SharedConsole; direct port to EncounterView |
| STAT-06 | GM can toggle system states (secured endpoint) | `@login_required` already imported; one-line decorator addition to `api_ship_update_integrity` |
| SHIP-01 | GM can set ship galactic position from Encounter Locations panel | `onSetShipLocation` prop + `handleSetShipLocation` callback pattern confirmed in BridgeView |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Django `login_required` | 5.2.7 | Authenticate-gate view functions | Already imported at top of `terminal/views.py`; all other GM write endpoints use it |
| React + TypeScript | 19 / 5.x | Component wiring | Project standard |
| Ant Design | 6.1 | UI message feedback | Already used in EncounterView |

### No New Libraries
All fixes use existing infrastructure. No package installs required.

---

## Architecture Patterns

### Pattern 1: `@login_required` on GM write endpoints

**What:** Add the decorator immediately above the function definition.
**When to use:** All GM-only POST endpoints that mutate state.
**Source:** Every other GM write endpoint in `terminal/views.py` — e.g., `api_ship_toggle_system` at line 1681.

```python
# Source: terminal/views.py line 1681 — companion endpoint pattern
@login_required
def api_ship_update_integrity(request):
    ...
```

The decorator is already imported at line 2: `from django.contrib.auth.decorators import login_required`.

---

### Pattern 2: NPCPortraitOverlay in EncounterView

**What:** Import and conditionally render `NPCPortraitOverlay` inside `EncounterView.tsx`.
**When to use:** When `encounter_active_portraits` array is non-empty.
**Source:** `src/entries/SharedConsole.tsx` lines 18, 996-1000.

The overlay takes two props:
- `activePortraitIds: string[]` — from `activeView?.encounter_active_portraits || []`
- `npcData: { [id: string]: NpcData }` — from `activeView?.encounter_npc_data || {}`

Both values are already available in EncounterView as local variables:
```typescript
// Already computed in EncounterView.tsx lines 347-351
const npcs = useMemo(
  () => Object.values(activeView?.encounter_npc_data || {}),
  [activeView?.encounter_npc_data]
);
const activePortraits = activeView?.encounter_active_portraits || [];
```

The overlay must be placed **outside** the `gm-encounter-view__map` div but **inside** the root `gm-encounter-view` div to float above the map. SharedConsole places it as a sibling to the main content area.

```tsx
// Source: src/entries/SharedConsole.tsx lines 996-1001
{(activeView?.encounter_active_portraits?.length ?? 0) > 0 && (
  <NPCPortraitOverlay
    activePortraitIds={activeView?.encounter_active_portraits || []}
    npcData={activeView?.encounter_npc_data || {}}
  />
)}
```

Import path: `import { NPCPortraitOverlay } from '@/components/domain/encounter/NPCPortraitOverlay';`

The overlay is `position: fixed` via its own CSS (`NPCPortraitOverlay.css`), so placement in JSX tree does not affect visual positioning.

---

### Pattern 3: `onSetShipLocation` in EncounterView LocationTreePanel

**What:** Add `handleSetShipLocation` callback to EncounterView and pass it as `onSetShipLocation` prop to `LocationTreePanel`.
**When to use:** GM Encounter view locations panel — matches Bridge view pattern.
**Source:** `src/components/gm/views/BridgeView.tsx` lines 65-68, 185.

The full pattern from BridgeView:
```typescript
// Source: src/components/gm/views/BridgeView.tsx lines 65-68
const handleSetShipLocation = useCallback(async (slug: string) => {
  try {
    await gmConsoleApi.setShipLocation(slug);
    messageApi.success('Ship position updated');
  } catch (err) {
    console.error('Failed to set ship location:', err);
    messageApi.error('Failed to update ship location');
  }
}, [messageApi]);
```

Then pass to `LocationTreePanel`:
```tsx
<LocationTreePanel
  ...existing props...
  onSetShipLocation={handleSetShipLocation}
/>
```

EncounterView already has `messageApi` and `contextHolder` from `message.useMessage()` (line 88). The import `gmConsoleApi` is not currently in EncounterView — needs to be added. Check whether it's worth importing the whole service or just the method; looking at existing imports in EncounterView, it uses `encounterApi` and not `gmConsoleApi`. BridgeView imports `gmConsoleApi` for this call — same import needed in EncounterView.

---

### Pattern 4: INITIAL_DATA injection for ship status

**What:** Pass ship status data as context from `gm_console_react` Django view to `gm_console_react.html` template, then inject into `window.INITIAL_DATA`.
**When to use:** Page-load data that reduces visible flash.
**Source:** `terminal/views.py` `display_view_react` lines 124-134; `shared_console_react.html` lines 24-39.

Django view change — load ship status and pass to template:
```python
# Source: terminal/views.py display_view_react lines 124-126 — established pattern
from terminal.data_loader import DataLoader
loader = DataLoader()
ship_data = loader.load_ship_status()
ship_status_json = json.dumps(ship_data) if ship_data else 'null'
return render(request, 'terminal/gm_console_react.html', {
    'ship_status_json': ship_status_json,
})
```

Template change — inject into `window.INITIAL_DATA`:
```html
<!-- Source: shared_console_react.html lines 24-39 — established pattern -->
<script>
    window.INITIAL_DATA = {
        shipStatus: {{ ship_status_json|safe|default:'null' }},
    };
</script>
```

GMConsole.tsx already reads this at line 28:
```typescript
const [shipData, setShipData] = useState<ShipStatusData | null>(
  (window as unknown as { INITIAL_DATA?: { shipStatus?: ShipStatusData } }).INITIAL_DATA?.shipStatus || null
);
```

No TypeScript changes needed — the read already exists; only the injection was missing.

---

### Recommended Change Set (all in 11-01)

| Fix | File(s) | Change Size |
|-----|---------|-------------|
| STAT-06: add `@login_required` | `terminal/views.py` line 1737 | 1 line added |
| PORT-03: import + render NPCPortraitOverlay | `src/components/gm/views/EncounterView.tsx` | 2 lines import + ~5 lines JSX |
| SHIP-01: handleSetShipLocation + prop thread | `src/components/gm/views/EncounterView.tsx` | ~8 lines callback + 1 prop |
| STAT-01/02/03 flash: context injection | `terminal/views.py` + `gm_console_react.html` | ~8 lines backend + 6 lines template |

Total estimated: ~31 lines across 3 files.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Auth check on endpoint | Custom `if not request.user.is_authenticated` guard | `@login_required` decorator |
| Portrait overlay positioning | New CSS/component | Existing `NPCPortraitOverlay` — already `position: fixed` |
| Ship location setter | New API method | `gmConsoleApi.setShipLocation()` — already implemented |
| Ship data serialization | Custom serializer | `loader.load_ship_status()` — already used in `display_view_react` |

---

## Common Pitfalls

### Pitfall 1: Portrait overlay placement causes layout reflow
**What goes wrong:** Inserting NPCPortraitOverlay inside a flex/grid container that applies constraints to children.
**Why it happens:** If placed inside `gm-encounter-view__map`, the parent might clip it.
**How to avoid:** Place it as a direct child of the root `gm-encounter-view` div (sibling to `__map` and `__right`). The overlay's `position: fixed` makes it viewport-anchored regardless, but scoping inside a `transform`/`will-change` element can break fixed positioning.
**Warning signs:** Portrait cards appear clipped, mispositioned, or invisible.

### Pitfall 2: Missing `gmConsoleApi` import in EncounterView
**What goes wrong:** TypeScript error `Cannot find name 'gmConsoleApi'`.
**Why it happens:** EncounterView currently only imports `encounterApi`. BridgeView imports both.
**How to avoid:** Add `import { gmConsoleApi } from '@/services/gmConsoleApi';` to EncounterView.

### Pitfall 3: `@login_required` redirect vs 403 for API endpoints
**What goes wrong:** `@login_required` by default redirects to the login page (302), not 403.
**Why it happens:** Default `login_required` behavior is redirect, which is wrong for JSON API endpoints.
**How to avoid:** Check how `api_ship_toggle_system` handles it — it uses `@login_required` and Django's `login_url` setting. For API endpoints, this is acceptable; the audit says "returns 403" but the actual Django behavior for unauthenticated AJAX calls via `@login_required` returns 302. The audit's intent is to block unauthenticated writes, not to mandate a specific status code. The `@login_required` decorator is the correct idiomatic fix — identical to all other GM endpoints.

### Pitfall 4: Template context variable name collision
**What goes wrong:** Template crashes or renders `null` for ship status.
**Why it happens:** Django template passes `ship_status_json` as the context key; template references it differently.
**How to avoid:** Use exactly `ship_status_json` as context key (matches `display_view_react` pattern) and `{{ ship_status_json|safe|default:'null' }}` in template.

---

## Code Examples

### Full NPCPortraitOverlay usage (SharedConsole reference)
```tsx
// Source: src/entries/SharedConsole.tsx lines 996-1001
{(activeView?.encounter_active_portraits?.length ?? 0) > 0 && (
  <NPCPortraitOverlay
    activePortraitIds={activeView?.encounter_active_portraits || []}
    npcData={activeView?.encounter_npc_data || {}}
  />
)}
```

### NPCPortraitOverlay interface (for reference)
```typescript
// Source: src/components/domain/encounter/NPCPortraitOverlay.tsx lines 5-14
interface NpcData {
  id: string;
  name: string;
  portrait: string;
}

interface NPCPortraitOverlayProps {
  activePortraitIds: string[];
  npcData: { [id: string]: NpcData };
}
```

### LocationTreePanel prop (for reference)
```typescript
// Source: src/components/gm/panels/LocationTreePanel.tsx line 14
onSetShipLocation?: (slug: string) => void;
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|-----------------|--------|
| NPCPortraitOverlay only on player terminal | Add to GM EncounterView as well | PORT-03 satisfied |
| `api_ship_update_integrity` open to all | Add `@login_required` | STAT-06 security fix |
| Ship location only settable from Bridge | Add to Encounter Locations panel | SHIP-01 fully complete |
| GM console ship data flash on load | Inject via INITIAL_DATA | Cosmetic fix |

---

## Open Questions

1. **`@login_required` returns 302 vs 403**
   - What we know: Django's `@login_required` redirects unauthenticated requests to login page (302). All other GM endpoints use this decorator.
   - What's unclear: The audit says "returns 403" — but the actual behavior of `@login_required` on an API endpoint is a 302 redirect.
   - Recommendation: Use `@login_required` (standard pattern, matches all other endpoints). The audit's intent is blocking unauthenticated writes, not mandating 403 specifically. Document this in the plan.

2. **Portrait overlay z-index in GM console vs player terminal**
   - What we know: `NPCPortraitOverlay.css` uses `position: fixed` which is viewport-anchored.
   - What's unclear: The GM console has additional layout layers (ViewRail, ToolRail) not present in player terminal. Verify z-index doesn't conflict.
   - Recommendation: Wire it in; verify visually during human UAT. The overlay already has z-index defined in its CSS.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | No automated test framework detected in project |
| Config file | none |
| Quick run command | `npm run typecheck` (TypeScript type-checking) |
| Full suite command | `npm run typecheck && npm run build` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STAT-06 | `@login_required` blocks unauthenticated POST to `/api/gm/ship-status/integrity/` | manual-only | n/a — requires HTTP request without auth cookie | manual |
| PORT-03 | NPCPortraitOverlay renders in GM EncounterView | manual-only | n/a — requires browser rendering | manual |
| SHIP-01 | Right-click "Set Ship Here" in Encounter Locations panel | manual-only | n/a — requires browser interaction | manual |
| cosmetic | No "No ship data available" flash on GM console load | manual-only | n/a — requires browser observation | manual |

TypeScript compilation catches prop type errors (e.g., missing required props, wrong `onSetShipLocation` type). All four changes should pass `npm run typecheck` before manual UAT.

### Sampling Rate
- **Per task commit:** `npm run typecheck`
- **Per wave merge:** `npm run typecheck && npm run build`
- **Phase gate:** TypeScript clean + manual UAT confirming all 4 success criteria before `/gsd:verify-work`

### Wave 0 Gaps
None — existing TypeScript tooling covers all automated checks for this phase.

---

## Sources

### Primary (HIGH confidence)
- `src/components/gm/views/EncounterView.tsx` — confirmed: no NPCPortraitOverlay import; no onSetShipLocation prop; messageApi already available
- `src/components/gm/views/BridgeView.tsx` — confirmed: handleSetShipLocation callback and prop-threading pattern
- `src/entries/SharedConsole.tsx` lines 18, 996-1001 — confirmed: NPCPortraitOverlay import path and usage pattern
- `src/components/domain/encounter/NPCPortraitOverlay.tsx` lines 11-14 — confirmed: props interface
- `src/components/gm/panels/LocationTreePanel.tsx` line 14 — confirmed: optional onSetShipLocation prop
- `src/components/gm/LocationTree.tsx` lines 168-169 — confirmed: right-click handler returns early when prop absent
- `terminal/views.py` line 1738 — confirmed: missing `@login_required` on `api_ship_update_integrity`
- `terminal/views.py` line 1681 — confirmed: companion endpoint `api_ship_toggle_system` has `@login_required`
- `terminal/views.py` lines 457-462 — confirmed: `gm_console_react` passes no context to template
- `terminal/views.py` lines 82-135 — confirmed: `display_view_react` INITIAL_DATA injection pattern
- `terminal/templates/terminal/shared_console_react.html` lines 24-39 — confirmed: `window.INITIAL_DATA.shipStatus` injection pattern
- `terminal/templates/terminal/gm_console_react.html` — confirmed: no `<script>` block, no INITIAL_DATA
- `src/entries/GMConsole.tsx` line 28 — confirmed: reads `window.INITIAL_DATA?.shipStatus` (already wired on React side)

### Secondary (MEDIUM confidence)
- Django docs: `@login_required` default behavior — redirects to `settings.LOGIN_URL`, not 403

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns confirmed from source
- Architecture: HIGH — each fix is a direct copy/adapt from an existing call site
- Pitfalls: HIGH — all pitfalls derived from direct code inspection, not speculation

**Research date:** 2026-03-24
**Valid until:** 2026-04-24 (stable codebase, no moving targets)
