> **SUPERSEDED BY CONTEXT.md D-08:** This research document was written before the armor-removal decision was reversed. **Armor stays in all files** — it is NOT removed from ship.yaml, TypeScript types, Django views, BridgeView, ShipStatusPanel, or any other location. All armor-removal instructions throughout this document are superseded by CONTEXT.md D-08. The plans (14-01, 14-02, 14-03) reflect the correct decision: armor is kept.

# Phase 14: Rework Bridge STATUS Tab Ship Systems (Remove Armor, Add Reactor) - Research

**Researched:** 2026-04-06
**Domain:** Full-stack refactor — YAML data schema, Django views, TypeScript types, React components
**Confidence:** HIGH — all files read directly, no external research needed for this domain

---

## Summary

This phase is a targeted data-model refactor across all layers of the ship status pipeline. The change is surgical: remove the `armor` field from `ship.yaml` and all code that reads/writes it, and add `reactor` as a new entry in the `systems` dict following the identical `SystemData` shape already used by `life_support`, `engines`, `weapons`, and `comms`.

The touch surface is larger than it appears because `armor` is treated as an "integrity field" (separate from systems, with its own `current/max` semantics) rather than as a `SystemData` system. The GM panel has a dedicated integrity slider/input block for it. Removing armor means removing that entire integrity mechanism for armor while keeping it only for `hull`. The `reactor` addition is simpler: it slots directly into `ship.systems` with no new API endpoints needed.

The layout decision for `StatusSection.tsx` is straightforward: left column becomes Hull + Reactor + Life Support, right column stays Engines + Weapons + Comms. This preserves 3-per-column balance while placing Reactor conceptually near Hull (both are "core ship health" indicators).

**Primary recommendation:** Execute as a single-wave refactor touching 8 files. No new API endpoints, no new components, no new CSS classes beyond converting `armor` references to `reactor`.

---

## Project Constraints (from CLAUDE.md)

- **Languages:** Python (Django backend), TypeScript (React frontend)
- **Frontend stack:** React 19 + TypeScript, Vite 5.4, Ant Design 6.1, GSAP 3.14
- **Backend stack:** Django 5.2.7, SQLite, file-based YAML data, PyYAML
- **Linting:** Ruff (Python), TypeScript compiler (`npm run typecheck`)
- **Colors:** Teal `#4a6b6b` (structure), Amber `#8b7355` (actions/highlights)
- **Font:** Cascadia Code (monospace)
- **Chamfer:** 12px angular corners
- **Import alias:** `@/` -> `src/`
- **Build verification:** `npm run typecheck` must pass; Ruff must pass

---

## Complete Touch Surface (All Files That Must Change)

This is the full change surface, enumerated layer by layer. No file outside this list requires modification.

### Layer 1: YAML Data

| File | Change |
|------|--------|
| `data/campaign/ship.yaml` | Remove `armor` block under `ship:`; add `reactor` entry under `ship.systems` |

**There is only one `ship.yaml`** in the entire data directory. Confirmed via glob: `data/campaign/ship.yaml` is the sole instance. [VERIFIED: filesystem glob]

### Layer 2: Django Backend

| File | Change |
|------|--------|
| `terminal/views.py` | `api_ship_update_integrity`: remove `'armor'` from the allowed `field` set (line 1802: `if field not in ('hull', 'armor')`) — change to `if field not in ('hull',)` |
| `terminal/data_loader.py` | `save_ship_integrity` docstring update only (the function itself is generic — it writes whatever field is passed; only the validation in views.py is armor-specific) |

Note: `load_ship_status()` in `data_loader.py` reads ship.yaml generically via `yaml.safe_load()` — no structural changes needed there. The YAML drives the shape.

### Layer 3: TypeScript Types

| File | Change |
|------|--------|
| `src/types/shipStatus.ts` | Remove `armor` from `ShipStatusData.ship`; add `reactor: SystemData` to `ShipStatusData.ship.systems` |

### Layer 4: React Components

| File | Change |
|------|--------|
| `src/components/domain/dashboard/sections/StatusSection.tsx` | Remove Armor `IntegrityPanel`; add Reactor `SystemStatusPanel` to left column; update `PreviousStatuses` and `ChangingFlags` interfaces; update `useEffect` tracking logic |
| `src/components/domain/dashboard/sections/StatusSection.css` | Remove `.integrity-value.integrity-armor` and `.system-condition-fill.integrity-fill-armor`; add Reactor system styling if needed (inherits `status-*` classes — likely no new CSS needed) |
| `src/components/gm/views/BridgeView.tsx` | Remove armor from `localIntegrity` state init; remove armor destructure in `useEffect`; remove armor from `['hull', 'armor']` integrity loop (reduce to `['hull']`); add `reactor` to `SYSTEM_LABELS_GM`; remove `armorPct`/`armorColor` computed vars; remove `armor_current`/`armor_max`/`armor_info` keys from `editingRef` pattern |
| `src/components/gm/ShipStatusPanel.tsx` | Remove ARMOR display row from the Ship Identity Card; note: system controls render via `Object.entries(ship.systems)` loop so `reactor` appears automatically once it's in the type+data |

### Layer 5: API Service (Minor)

| File | Change |
|------|--------|
| `src/services/gmConsoleApi.ts` | `updateShipIntegrity` signature: change `field: 'hull' | 'armor'` to `field: 'hull'` — or simply remove the union since armor is gone. `armor?: number` on the `CrewMember` interface is NPC armor, NOT ship armor — leave it unchanged. |

---

## Architecture Patterns

### How Ship Data Flows

```
data/campaign/ship.yaml
    └── DataLoader.load_ship_status()          # reads raw YAML dict
        └── api_ship_status (GET)              # serves JSON to SSE broadcaster
            └── broadcaster.announce_ship_status()  # SSE push to all clients
                └── useSSE('shipstatus')        # SharedConsole.tsx listens
                    └── StatusSection.tsx       # receives shipData prop
                        └── renders panels

GM writes:
    GM control (select/slider) → gmConsoleApi.toggleShipSystem()
        → POST /gm/ship-status/toggle/
        → api_ship_toggle_system (views.py)
        → DataLoader.save_ship_system()        # writes ship.yaml
        → broadcaster.announce_ship_status()   # push update
```

### SystemData Shape (Used for All Systems Including New Reactor)

```typescript
// Source: src/types/shipStatus.ts — VERIFIED
export interface SystemData {
  status: SystemStatus;   // 'ONLINE' | 'STRESSED' | 'DAMAGED' | 'CRITICAL' | 'OFFLINE'
  condition: number;      // 0–100
  info?: string;          // optional status note
}
```

The `reactor` system will use this exact shape — no new type definitions needed.

### Integrity vs System Distinction

Currently the codebase treats `hull` and `armor` as "integrity fields" with a separate `{current, max}` shape — NOT as `SystemData`. Reactor is being added as a `SystemData` system (status + condition + info), NOT as an integrity field. This means:

- Reactor gets: status dropdown + condition slider + info text in GM panel (same as engines, comms, etc.)
- Reactor does NOT get: current/max number inputs
- The integrity section in GmBridgeShipPanel reduces from 2 fields (`hull`, `armor`) to 1 field (`hull` only)

### How GmBridgeShipPanel Renders Systems

The system controls in `GmBridgeShipPanel` render via `Object.entries(ship.systems).map(...)`. Once `reactor` is added to the YAML and TypeScript type, it will appear in that loop automatically. The only manual addition needed is `reactor: 'Reactor'` in `SYSTEM_LABELS_GM`.

---

## Exact Schema Changes

### YAML: `data/campaign/ship.yaml`

**Remove** the `armor` block:
```yaml
# REMOVE THIS:
  armor:
    current: 12
    max: 12
```

**Add** under `ship.systems`:
```yaml
# ADD THIS (alongside life_support, engines, weapons, comms):
    reactor:
      condition: 100
      info: 'Power output nominal'
      status: ONLINE
```

**Final shape:**
```yaml
location_slug: phoebe
ship:
  class: Hargrave-Class Light Freighter
  crew_capacity: 12
  crew_count: 7
  hull:
    current: 60
    max: 60
  name: USCSS Morrigan
  systems:
    comms:
      condition: 100
      info: ''
      status: OFFLINE
    engines:
      condition: 43
      info: Coolant pressure low
      status: OFFLINE
    life_support:
      condition: 100
      info: O2 levels nominal
      status: OFFLINE
    reactor:
      condition: 100
      info: Power output nominal
      status: ONLINE
    weapons:
      condition: 100
      info: Defense grid active
      status: ONLINE
slug: ship
```

### TypeScript: `src/types/shipStatus.ts`

**Before:**
```typescript
export interface ShipStatusData {
  ship: {
    armor: { current: number; max: number; info?: string };
    systems: {
      life_support: SystemData;
      engines: SystemData;
      weapons: SystemData;
      comms: SystemData;
    };
  };
}
```

**After:**
```typescript
export interface ShipStatusData {
  ship: {
    // armor: removed
    systems: {
      life_support: SystemData;
      engines: SystemData;
      weapons: SystemData;
      comms: SystemData;
      reactor: SystemData;  // NEW
    };
  };
}
```

---

## Layout Decision: StatusSection.tsx Panel Arrangement

**Decision: Left column = Hull + Reactor + Life Support; Right column = Engines + Weapons + Comms.**

Rationale:
- Maintains 3-per-column balance (same as current layout)
- Hull and Reactor are both "core ship health" — power source grouped with structural integrity makes narrative sense
- Life Support stays left (player-critical systems on the left panel)
- Engines/Weapons/Comms stay right (operational/combat systems on the right)

**Current layout:**
```
Left: Hull (IntegrityPanel) | Right: Engines (SystemStatusPanel)
Left: Armor (IntegrityPanel)| Right: Weapons (SystemStatusPanel)
Left: Life Support (System) | Right: Comms   (SystemStatusPanel)
```

**New layout:**
```
Left: Hull (IntegrityPanel)        | Right: Engines (SystemStatusPanel)
Left: Reactor (SystemStatusPanel)  | Right: Weapons (SystemStatusPanel)
Left: Life Support (SystemStatus)  | Right: Comms   (SystemStatusPanel)
```

The `IntegrityPanel` component (`variant: 'hull' | 'armor'`) is only used for `hull` now. Reactor uses `SystemStatusPanel` (same as all other systems). No changes to `IntegrityPanel` component itself beyond removing its `armor` variant usage.

---

## Detailed Code Changes Per File

### `src/types/shipStatus.ts`

```typescript
// AFTER — complete file replacement
export type SystemStatus = 'ONLINE' | 'STRESSED' | 'DAMAGED' | 'CRITICAL' | 'OFFLINE';

export interface SystemData {
  status: SystemStatus;
  condition: number;
  info?: string;
}

export interface ShipStatusData {
  location_slug?: string;
  slug?: string;
  ship: {
    name: string;
    class: string;
    crew_count: number;
    crew_capacity: number;
    hull: { current: number; max: number; info?: string };
    // armor REMOVED
    systems: {
      life_support: SystemData;
      engines: SystemData;
      weapons: SystemData;
      comms: SystemData;
      reactor: SystemData;  // ADDED
    };
  };
}
```

### `src/components/domain/dashboard/sections/StatusSection.tsx`

Changes:
1. `PreviousStatuses` interface: add `reactor: SystemStatus`
2. `ChangingFlags` interface: add `reactor: boolean`
3. `useState<ChangingFlags>` initial value: add `reactor: false`
4. `useEffect` status tracking: add `reactor` to snapshot and change detection
5. `setTimeout` reset: add `reactor: false`
6. Left overlay JSX: replace `<IntegrityPanel label="ARMOR" ...>` with `<SystemStatusPanel name="REACTOR" ...>`

### `src/components/domain/dashboard/sections/StatusSection.css`

Remove these classes (no longer needed with armor gone):
- `.integrity-value.integrity-armor`
- `.system-condition-fill.integrity-fill-armor`

The `IntegrityPanel` component `variant` prop still accepts `'hull' | 'armor'` in its local interface — narrow it to `'hull'` only, or leave it for now (TypeScript will catch unused variant). Safer: narrow to `'hull'` only to prevent future confusion.

### `src/components/gm/views/BridgeView.tsx`

1. `SYSTEM_LABELS_GM`: add `reactor: 'Reactor'`
2. `useEffect` syncing `localIntegrity`: remove `armor` destructure — change:
   ```typescript
   const { hull, armor } = shipData.ship;
   ```
   to:
   ```typescript
   const { hull } = shipData.ship;
   ```
   Remove the three `armor_current`, `armor_max`, `armor_info` lines.
3. Computed vars: remove `armorPct` and `armorColor` (lines 845, 847)
4. Integrity loop: change `(['hull', 'armor'] as const)` to `(['hull'] as const)`. Also remove the conditional fallback reference to `ship.armor.max` in `sliderMax` computation.
5. Handler signatures: `handleIntegrityCurrentSubmit`, `handleIntegrityMaxSubmit`, `handleIntegrityInfoSubmit` all have `field: 'hull' | 'armor'` — narrow to `field: 'hull'` (or just `field: string` if generic). The simplest approach: change union to just `'hull'` since that's the only caller.

### `src/components/gm/ShipStatusPanel.tsx`

Remove the ARMOR row in the Ship Identity Card (lines 134–139):
```tsx
// REMOVE:
<div>
  <Text type="secondary" style={{ fontSize: 11 }}>ARMOR</Text>
  <div>
    <Text style={{ fontSize: 13, color: ship.armor.current < ship.armor.max * 0.3 ? '#8b5555' : '#fff' }}>
      {ship.armor.current} / {ship.armor.max}
    </Text>
  </div>
</div>
```

The system controls section renders via `Object.entries(ship.systems)` — reactor appears automatically.

### `src/services/gmConsoleApi.ts`

Change `updateShipIntegrity` signature:
```typescript
// BEFORE:
async function updateShipIntegrity(field: 'hull' | 'armor', ...): Promise<any>

// AFTER:
async function updateShipIntegrity(field: 'hull', ...): Promise<any>
```

### `terminal/views.py`

Change validation in `api_ship_update_integrity`:
```python
# BEFORE:
if field not in ('hull', 'armor'):
    return JsonResponse({'error': 'field must be "hull" or "armor"'}, status=400)

# AFTER:
if field not in ('hull',):
    return JsonResponse({'error': 'field must be "hull"'}, status=400)
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| System display rendering | New component for reactor | Reuse existing `SystemStatusPanel` | Already handles all status states, animations, condition bar, info text |
| GM system controls | New UI for reactor | Reactor appears automatically via `Object.entries(ship.systems)` loop | Pattern already handles dynamic system addition |
| SSE broadcast | New event type | Existing `announce_ship_status()` broadcasts full ship payload | Reactor is part of ship.systems — no new event needed |

---

## Common Pitfalls

### Pitfall 1: TypeScript Compile Errors from `ship.armor` References
**What goes wrong:** TypeScript compiler errors cascade across multiple files once `armor` is removed from `ShipStatusData`.
**Why it happens:** `ship.armor` is referenced in 4 places: `StatusSection.tsx`, `BridgeView.tsx` (multiple lines), `ShipStatusPanel.tsx`, `gmConsoleApi.ts`.
**How to avoid:** Run `npm run typecheck` after YAML + type changes to get the complete error list before touching components. Fix all TypeScript errors before proceeding.
**Warning signs:** Any remaining `ship.armor` reference in source files.

### Pitfall 2: GmBridgeShipPanel Integrity Loop `sliderMax` Reference
**What goes wrong:** Line 916 in BridgeView.tsx has `(field === 'hull' ? ship.hull.max : ship.armor.max)` — if `armor` is removed from the type, this line breaks TypeScript even if the runtime `['hull']` array never produces `'armor'`.
**Why it happens:** TypeScript evaluates all branches of ternary expressions.
**How to avoid:** When narrowing the `['hull', 'armor']` loop to `['hull']`, also simplify the `sliderMax` computation to just `ship.hull.max` (no conditional needed).

### Pitfall 3: Staggered Animation Delay Numbering
**What goes wrong:** The `delay` props in `StatusSection.tsx` are hardcoded values (0.6, 0.8, 1.0s). Adding Reactor in the left column requires the delays to still be ordered correctly for the boot stagger.
**Why it happens:** The stagger delays are positional — they must increase top to bottom.
**How to avoid:** Left column delays: Hull=0.6s, Reactor=0.8s, Life Support=1.0s (same timing as before, just Reactor replaces Armor in slot 2). No timing math changes needed.

### Pitfall 4: Reactor Missing from `SYSTEM_LABELS_GM`
**What goes wrong:** `GmBridgeShipPanel` renders `{SYSTEM_LABELS_GM[systemKey]}` for each system key. If `reactor` is not in the labels map, the GM panel shows `undefined` for the reactor label.
**Why it happens:** `SYSTEM_LABELS_GM` is a static Record — it does not auto-populate when the YAML changes.
**How to avoid:** Add `reactor: 'Reactor'` to `SYSTEM_LABELS_GM` in `BridgeView.tsx`.

### Pitfall 5: `IntegrityPanel` Variant Type Still Includes `'armor'`
**What goes wrong:** The `IntegrityPanelProps` interface in `StatusSection.tsx` has `variant: 'hull' | 'armor'`. After removing the armor panel usage, TypeScript may not flag this as dead code — but leaving it creates confusion and CSS dead code.
**Why it happens:** TypeScript doesn't warn about unused union members.
**How to avoid:** Narrow the `variant` type to `'hull'` only and remove the `integrity-armor` CSS classes.

---

## Backward Compatibility

**No backward compatibility concern.** There is exactly one `ship.yaml` in the project (`data/campaign/ship.yaml`). Confirmed via glob — no other campaigns or fixtures. The YAML change is the source of truth; all downstream code derives from it.

The `save_ship_integrity` function in `data_loader.py` accepts arbitrary `field` strings — it writes whatever key is passed. The validation happens in `views.py`. No data migration is needed: we're removing a key from the YAML file and the code that reads/writes it. No existing data needs transformation.

---

## Reactor System Initial Values (Recommended)

For the ship.yaml addition, use values consistent with the narrative context:

```yaml
reactor:
  condition: 100
  info: Power output nominal
  status: ONLINE
```

This follows the pattern of `life_support` (100% condition, in-character info text, ONLINE status). The GM can set it to whatever state makes sense for their campaign.

---

## Architecture Patterns (Existing — Reuse These)

### SystemStatusPanel (Player View)

```typescript
// Source: StatusSection.tsx — VERIFIED
<SystemStatusPanel
  name="REACTOR"
  status={ship.systems.reactor.status}
  condition={ship.systems.reactor.condition}
  info={ship.systems.reactor.info}
  isChanging={changingFlags.reactor}
  delay={0.8}
  staggerDone={staggerComplete}
/>
```

### System SSE Status Tracking Pattern

```typescript
// Source: StatusSection.tsx — VERIFIED
// PreviousStatuses and ChangingFlags interfaces must include reactor
interface PreviousStatuses {
  life_support: SystemStatus;
  engines: SystemStatus;
  weapons: SystemStatus;
  comms: SystemStatus;
  reactor: SystemStatus;  // ADD
}
```

---

## Environment Availability

Step 2.6: SKIPPED (no external dependencies — this is a code/data refactor with no new tools, services, or CLI utilities required).

---

## Validation Architecture

The project has no automated test suite. All verification is manual (human UAT pattern used in prior phases).

**Verification checklist for this phase:**

| Check | Method |
|-------|--------|
| `npm run typecheck` passes | Run after all TS changes |
| `npm run build` passes | Run after typecheck passes |
| Reactor appears in player STATUS tab left column | Visual check in browser |
| Reactor appears in GM BridgeView ship panel system controls | Visual check in browser |
| Armor is absent from player STATUS tab | Visual check |
| Armor is absent from GM BridgeView ship panel | Visual check |
| Hull integrity slider still functions | GM interaction test |
| System status toggle for Reactor works (GM) | Toggle dropdown, observe SSE push |
| Boot stagger animation still fires correctly (3 panels per column) | Watch player STATUS tab load |

---

## Security Domain

No security surface changes. `api_ship_update_integrity` already requires `@login_required`. `api_ship_toggle_system` already requires `@login_required`. No new endpoints, no new data flows, no authentication changes.

---

## Sources

### Primary (HIGH confidence)

All findings are directly verified by reading the source files in this session.

- `data/campaign/ship.yaml` — current ship data schema (VERIFIED: file read)
- `src/types/shipStatus.ts` — TypeScript types (VERIFIED: file read)
- `src/components/domain/dashboard/sections/StatusSection.tsx` — player render (VERIFIED: file read)
- `src/components/domain/dashboard/sections/StatusSection.css` — player CSS (VERIFIED: file read)
- `src/components/gm/ShipStatusPanel.tsx` — GM legacy panel (VERIFIED: file read)
- `src/components/gm/views/BridgeView.tsx` — GM bridge panel (VERIFIED: file read, full)
- `terminal/views.py` — Django endpoints (VERIFIED: grep of armor/integrity sections)
- `terminal/data_loader.py` — data persistence (VERIFIED: file read)
- `src/services/gmConsoleApi.ts` — API client (VERIFIED: file read)

### Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `data/campaign/ship.yaml` is the only ship.yaml in the data directory | Backward Compatibility | Low — glob confirmed single file |

**All other claims are VERIFIED by direct file inspection in this session.**

---

## Metadata

**Confidence breakdown:**
- Touch surface: HIGH — read every file, grep confirmed all armor references
- Schema changes: HIGH — exact before/after documented from file contents
- Architecture: HIGH — existing patterns re-used, no new infrastructure
- Pitfalls: HIGH — identified from direct reading of the code that will be modified

**Research date:** 2026-04-06
**Valid until:** Until any of the 8 listed files are modified by unrelated work (stable)
