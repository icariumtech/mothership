# Phase 20: Audit Closure — Security + Requirements Tracking - Research

**Researched:** 2026-05-07
**Domain:** Django auth decorators, requirements tracking housekeeping, VERIFICATION.md authoring
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (VERIFICATION.md approach):** Write lightweight evidence-referencing VERIFICATION.md files for phases 04, 05, 07, 08, 10, 13, 14. Each doc cites existing UAT results (pass counts, test names) and SUMMARY.md self-check evidence. No re-running code checks — formalize what already passed.
- **D-02 (PORT-03 deviation):** PORT-03 is `[x]` and stays `[x]`. Add a brief note in Phase 11's VERIFICATION.md documenting the accepted design deviation (GM-only overlay, not player-facing). Do NOT re-open PORT-03 or change its `[x]` status.
- **D-03 (tech debt):** Remove `getRoomVisibility` and `setRoomVisibility` from the export list in `src/services/encounterApi.ts` (lines 240–241). Functions stay in the file; only the exports are removed.

### Claude's Discretion

- ANIM-* requirement text/descriptions can be written based on Phase 13 SUMMARY.md evidence — exact wording is Claude's choice as long as it matches what was implemented.
- VERIFICATION.md format can follow whatever minimal structure makes the evidence clearly readable.

### Deferred Ideas (OUT OF SCOPE)

None.

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STAT-10 | STATUS tab uses dual terminal-readout panel layout (left=systems, right=resources) floating over full-screen deck map with semi-transparent backgrounds and chamfered corners | Phase 14 VERIFICATION.md Truth #7 confirms StatusSection.tsx `terminal-panel panel-left/panel-right` implemented; UAT test 1 passed |
| STAT-11 | Reactor added as 5th ship system in YAML, TypeScript types, and Django backend | Phase 14 VERIFICATION.md Truth #1 + #4 confirm; UAT test 8 passed |
| STAT-12 | Ship resource tracking for fuel, food, O2, cryopods, and escape pods | Phase 14 VERIFICATION.md Truth #2 + #5 confirm; UAT test 3 + 9 passed |
| STAT-13 | GM can modify reactor status/condition and all resource values from BridgeView panel | Phase 14 VERIFICATION.md Truth #10 confirms; UAT test 9 passed |
| STAT-14 | Status change-flash animation (600ms row highlight) and typewriter stagger-in animation (80ms) | Phase 14 VERIFICATION.md Truth (stagger + flicker confirmed); UAT test 6 + 7 passed |
| GRID-01..10 | Grid-based encounter map system (10 requirements) | Already `[x]` in REQUIREMENTS.md — Phase 12 execution checked them off (Phase 12 VERIFICATION.md Truth #1 confirms) |
| ANIM-VIEW | View-to-view glitch transitions | Phase 13-01 SUMMARY; UAT test 1 + 2 passed |
| ANIM-OVERLAY | Overlay entrance/exit animations (CharonDialog, DocumentDialog, CommTerminalDialog) | Phase 13-02 SUMMARY; UAT test 3 + 4 + 5 passed |
| ANIM-ROOM | Encounter room reveal flicker + token cascade | Phase 13-03 SUMMARY; UAT test 6 passed |
| ANIM-BRIDGE | Bridge panel boot stagger | Phase 13-04 SUMMARY; UAT test 7 passed |

</phase_requirements>

---

## Summary

Phase 20 is a pure housekeeping phase closing the remaining v1.0 audit gaps. The technical domain is narrow: Django auth decorators (one safe addition, one requires redesign), REQUIREMENTS.md text editing, and writing VERIFICATION.md documents citing pre-existing evidence. No new features. No migrations. No frontend architecture changes.

The single biggest discovery from this research is that `api_bridge_selection` **cannot** receive `@login_required` without breaking player functionality. The player terminal (`/terminal/`) is an unauthenticated route, and `SharedConsole.tsx` calls `terminalApi.updateBridgeSelection()` → `POST /api/bridge-selection/` directly from player sessions that hold no Django session cookie. Adding `@login_required` would return a redirect-to-login response, breaking the player bridge map navigation. The audit's security severity label ("medium / low-severity") is correct: this endpoint writes only ephemeral in-memory state and broadcasts to SSE; it has no persistent data consequence. The correct fix is to document it as an intentional public endpoint — not to add auth.

`api_set_ship_location` is different: called only from `gmConsoleApi.ts` (GM components `EncounterView.tsx` and `BridgeView.tsx`), never from any player-facing path. It writes to `ship.yaml` on disk. Adding `@login_required` is safe and correct.

A second discovery: the audit's GRID-01..10 gap is already resolved. Phase 12 was executed after the audit date and its VERIFICATION.md (verified 2026-04-17) confirms all 10 grid checkboxes are `[x]`. Phase 20 does not need to touch GRID checkboxes.

Phase 14 already has a VERIFICATION.md (`VERIFICATION.md` with `status: human_needed`, 12/12 truths verified), but the REQUIREMENTS.md `[ ]` checkboxes for STAT-10..14 were not updated when Phase 14 completed. Those need to be flipped to `[x]`.

The `api_ship_update_stat` endpoint (line 1945 of views.py) is also `@csrf_exempt`-only and writes to ship.yaml — a similar gap to the two audit-identified ones. The audit did not flag it, so Phase 20 scope does not cover it unless the planner decides to address it. This is flagged as an open question.

**Primary recommendation:** Fix `api_set_ship_location` with `@login_required`; document `api_bridge_selection` as intentionally public; flip STAT-10..14 checkboxes; add ANIM-* requirements; write 7 VERIFICATION.md files referencing existing UAT evidence; remove two encounterApi exports; update Phase 11 VERIFICATION.md with PORT-03 deviation note.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `@login_required` on GM endpoints | API / Backend | — | Auth enforcement is server-side; frontend callers must already hold a session |
| Player-facing `bridge-selection` endpoint | API / Backend (public) | Browser / Client | Players are unauthenticated; endpoint is intentionally open by design |
| REQUIREMENTS.md checkbox updates | Planning documents | — | Text editing in `.planning/` — no code tier |
| VERIFICATION.md authoring | Planning documents | — | Text authoring citing existing evidence |
| encounterApi.ts export removal | Frontend / API service | — | TypeScript module surface; safe to remove unused exports |
| ANIM-* requirement registration | Planning documents | — | Adds new entries to REQUIREMENTS.md |

---

## Standard Stack

This phase uses no new libraries. All work is Django decorator application, TypeScript export removal, and Markdown document writing.

### Core (existing project stack)
| Component | Purpose | Relevant to Phase 20 |
|-----------|---------|----------------------|
| `django.contrib.auth.decorators.login_required` | GM endpoint auth enforcement | Add to `api_set_ship_location` only |
| `django.views.decorators.csrf.csrf_exempt` | CSRF bypass for unauthenticated callers | Retain on `api_bridge_selection`; retain on `api_set_ship_location` alongside new `@login_required` |

**Version verification:** Both decorators are standard Django 5.2.7 builtins already imported at line 2 and line 5 of `terminal/views.py`. [VERIFIED: grep terminal/views.py]

**Installation:** No new packages needed.

---

## Architecture Patterns

### Pattern 1: Django Dual-Decorator Stack for GM Endpoints

**What:** GM-only write endpoints that need CSRF bypass AND authentication use both decorators stacked — `@csrf_exempt` first (outermost), then `@login_required` second (innermost, applied first at runtime).

**When to use:** Any POST endpoint that: (a) is GM-only, (b) must reject unauthenticated requests, and (c) is called from JavaScript via Axios (not a browser form, so CSRF token is not sent).

**Precedent in codebase (Phase 11 pattern):** [VERIFIED: grep terminal/views.py line 1898]

```python
# Source: terminal/views.py line 1898 — api_ship_update_integrity (Phase 11 pattern)
@login_required
def api_ship_update_integrity(request):
    """GM only - updates runtime overrides in ActiveView."""
```

**Note:** Phase 11's `api_ship_update_integrity` uses only `@login_required` (no `@csrf_exempt`). The Django JS client (Axios in `gmConsoleApi.ts`) sends the CSRF token via the `X-CSRFToken` header when the GM is logged in. For GM-only endpoints, `@csrf_exempt` is not actually needed — it was an oversight. The correct fix for `api_set_ship_location` is to add `@login_required` only (remove `@csrf_exempt` or keep it — both work, but matching the Phase 11 pattern means `@login_required` alone).

**Confirmed by reading Phase 11 verification:** Phase 11 VERIFICATION.md Truth #2 states `@login_required` at `terminal/views.py line 1744` — no `@csrf_exempt` on that endpoint. [VERIFIED: 11-VERIFICATION.md]

### Pattern 2: Intentionally Public Player-Facing Endpoint (csrf_exempt only)

**What:** Endpoints called by unauthenticated player terminals use `@csrf_exempt` only. They write only ephemeral state (in-memory) or perform non-destructive actions. Adding `@login_required` would break them.

**Confirmed examples in codebase:** [VERIFIED: grep terminal/views.py]
- `api_hide_terminal` (line 734) — "Public endpoint — players can dismiss terminal"
- `api_hide_doc` (line 771) — "Public endpoint — hide the document overlay (called by players on dismiss)"
- `api_janus_toggle_dialog` (line 1105) — "CSRF exempt since this is called from unauthenticated player terminals"
- `api_bridge_selection` (line 673) — Same category: player terminal calls it from `SharedConsole.tsx`

**Callers of `api_bridge_selection`:** [VERIFIED: grep src/]
- `src/services/terminalApi.ts` lines 76, 80, 84 — `updateBridgeSelection`, `updateBridgeTab`, `updateBridgeLabel`
- Called from `src/entries/SharedConsole.tsx` lines 631, 650 — the unauthenticated player console
- Called from `src/components/domain/dashboard/sections/PersonnelSection.tsx` lines 146, 152
- Called from `src/components/domain/dashboard/sections/LogsSection.tsx` lines 93, 107

**Conclusion:** `api_bridge_selection` must NOT receive `@login_required`. It is correctly `@csrf_exempt`-only. The audit's low-severity classification is appropriate; the fix is documentation, not code.

### Pattern 3: REQUIREMENTS.md Checkbox and Traceability Format

**What:** Requirements use `- [x] **REQ-ID**: description` in the main list and `Complete` status in the traceability table. New requirements follow the same format and are inserted under the relevant section heading.

**ANIM-* section insertion point:** After the "GM Console UI (Phase 8)" section, before "Player Ship Map (Phase 10)" — or create a new "Atmospheric Animations (Phase 13)" section. The latter is cleaner since ANIM-* has no existing section.

**Traceability table entry format:** [VERIFIED: REQUIREMENTS.md existing entries]
```markdown
| ANIM-VIEW | Phase 13 | Complete |
```

**Coverage count:** Current count says "47 total". Adding 4 ANIM-* requirements increases it to 51. Update the coverage comment.

### Pattern 4: VERIFICATION.md Format (Evidence-Referencing Style)

**What:** Lightweight VERIFICATION.md documents for phases with existing UAT evidence follow the same frontmatter + Observable Truths table format as Phase 11, but are populated by referencing UAT pass counts and SUMMARY artifacts rather than re-running checks.

**Frontmatter fields:** [VERIFIED: 11-VERIFICATION.md, 09-VERIFICATION.md]
```yaml
---
phase: {phase-slug}
verified: {ISO-8601 date}
status: passed | human_needed
score: N/N must-haves verified
re_verification: false
---
```

**Key sections (minimal):**
1. Header block (goal, verified date, status)
2. `## Goal Achievement` → Observable Truths table
3. `### Requirements Coverage` table mapping req IDs to evidence
4. `### Gaps Summary` (one line if no gaps)

**Phase 14 VERIFICATION.md already exists** at `.planning/phases/14-rework-bridge-status-tab-ship-systems-remove-armor-add-react/VERIFICATION.md` with status `human_needed` and 12/12 truths verified. [VERIFIED: file read] Phase 20 does NOT need to write Phase 14's VERIFICATION.md — it already exists. Phase 20 only needs to flip the REQUIREMENTS.md `[ ]` → `[x]` checkboxes for STAT-10..14, since Phase 14's VERIFICATION.md already satisfies the "formal verification" gap.

### Architecture Diagram: Phase 20 Task Flow

```
REQUIREMENTS.md         terminal/views.py          encounterApi.ts
     │                        │                          │
     ▼                        ▼                          ▼
Flip [ ]→[x]          Add @login_required       Remove getRoomVisibility
STAT-10..14           to api_set_ship_location   + setRoomVisibility
                                                   from export list
     │
     ▼
Add ANIM-VIEW/OVERLAY/
ROOM/BRIDGE entries
(new section)

     ┌─────────────────────────────────────────────────┐
     │          VERIFICATION.md Authoring              │
     │                                                  │
     │  Phases needing new files:                       │
     │    04 → cite 04-UAT.md (6/6 passed)             │
     │    05 → cite 05-UAT.md (5/5 passed)             │
     │    07 → cite 07-04-SUMMARY.md (6/6 APPROVED)    │
     │    08 → cite 08-UAT.md (9/10 passed, 1 skipped) │
     │    10 → cite 10-UAT.md (6/6 passed)             │
     │    13 → cite 13-UAT.md (7/7 passed)             │
     │                                                  │
     │  Phase needing amendment:                        │
     │    11 → add PORT-03 deviation note               │
     └─────────────────────────────────────────────────┘
```

### Recommended Project Structure (Phase 20 file changes)

```
.planning/
├── REQUIREMENTS.md                  # Edit: flip STAT-10..14, add ANIM-*, update count
├── phases/
│   ├── 04-npc-portrait-system/
│   │   └── 04-VERIFICATION.md       # Create
│   ├── 05-real-time-push-architecture/
│   │   └── 05-VERIFICATION.md       # Create
│   ├── 07-grid-based-encounter-map-redesign/
│   │   └── 07-VERIFICATION.md       # Create
│   ├── 08-rework-gm-console-ui/
│   │   └── 08-VERIFICATION.md       # Create
│   ├── 10-player-ship-map-view/
│   │   └── 10-VERIFICATION.md       # Create
│   ├── 11-close-functional-security-gaps/
│   │   └── 11-VERIFICATION.md       # Amend: add PORT-03 deviation note
│   └── 13-atmospheric-ui-animations.../
│       └── 13-VERIFICATION.md       # Create
src/
└── services/
    └── encounterApi.ts              # Edit: remove 2 export entries (lines 240-241)
terminal/
└── views.py                         # Edit: add @login_required to api_set_ship_location
```

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| GM endpoint auth | Custom session check in view body | `@login_required` decorator | Django standard; tested; handles redirect automatically |
| Requirement checkbox formats | New format | Copy existing `- [x] **REQ-ID**: description` pattern from REQUIREMENTS.md | Consistency — planner and audit tools expect this exact format |

---

## Key Evidence Inventory for VERIFICATION.md Authoring

This section is the primary resource for the planner when drafting the 6 new VERIFICATION.md files.

### Phase 04 — NPC Portrait System
**UAT:** `04-UAT.md` — 6/6 passed, 0 issues [VERIFIED: file read]
- Test 1: NPC PORTRAITS card in GM console — PASS
- Test 2: Show portrait on terminal — PASS
- Test 3: CRT reveal animation — PASS
- Test 4: Multiple portraits tile side-by-side — PASS
- Test 5: Dismiss portrait — PASS
- Test 6: Portraits clear on encounter location switch — PASS

**Requirements to satisfy:** PORT-01 (tests 1+2), PORT-02 (test 1 — name+info visible), PORT-04 (test 4), PORT-05 (test 3)
**Note:** PORT-03 is owned by Phase 11's VERIFICATION.md (with design deviation note).

### Phase 05 — Real-Time Push Architecture
**UAT:** `05-UAT.md` — 5/5 passed, 0 issues [VERIFIED: file read]
- Test 1: Instant view switch — player terminal — PASS
- Test 2: Instant view switch — GM console self-update — PASS
- Test 3: Encounter room reveal propagates in real time — PASS
- Test 4: Token move propagates in real time — PASS
- Test 5: Connection lost warning toast — PASS

**Requirements to satisfy:** RTMA-01 (tests 1+2+3+4), RTMA-02 (in-memory store — SUMMARY evidence), RTMA-03 (Messages in SQLite — SUMMARY evidence), RTMA-04 (DB retained — SUMMARY evidence)

### Phase 07 — Grid-Based Encounter Map Redesign
**UAT:** `07-04-SUMMARY.md` — 6/6 APPROVED (human verification) [VERIFIED: file read]
- Test 1: Visual rendering — PASS (hull polygon, room labels, touching cells)
- Test 2: Room visibility (GM Console) — PASS (HIDE ALL / REVEAL ALL, right-click context menu)
- Test 3: Player terminal visibility — PASS (void on hidden, reveal within ~2s)
- Test 4: Door symbols — PASS
- Test 5: Token placement in multi-rect rooms — PASS
- Test 6: Room list — PASS

**Requirements to satisfy:** GRID-01 through GRID-10 (already `[x]` — Phase 07 VERIFICATION.md is still needed to formally close the "unverified" audit gap for the phase itself)
**Accepted deviations:** Amber walls replaced by hull polygon approach; background void grid not implemented; room click-to-reveal replaced by right-click context menu.

### Phase 08 — Rework GM Console UI
**UAT:** `08-UAT.md` — 9/10 passed, 1 skipped [VERIFIED: file read]
- Test 8 skipped: "BRIDGE main area content TBD" (accepted — closed by Phase 09)
- All other 9 tests passed

**Requirements to satisfy:** GMUI-LAYOUT, GMUI-VIEWRAIL, GMUI-TOOLRAIL, GMUI-SLIDEOUT, GMUI-ENCOUNTER, GMUI-TOOLPANELS, GMUI-MAPFULLSCREEN, GMUI-BRIDGE (Phase 09 gap-closed), GMUI-CHARON, GMUI-STANDBY, GMUI-DISPLAY
**Note on score:** Phase 08 VERIFICATION.md status should be `human_needed` or `passed` — the 1 skip is a known accepted gap closed by Phase 09 per REQUIREMENTS.md.

### Phase 10 — Player Ship Map View
**UAT:** `10-UAT.md` — 6/6 passed, 0 issues [VERIFIED: file read]
- Test 1: Player STATUS Tab — Ship Deck Map Renders — PASS
- Test 2: Player STATUS Tab — Layout — PASS
- Test 3: GM BridgeView — Ship Panel Deck Map — PASS
- Test 4: Set Ship Location — Right-Click Context Menu — PASS
- Test 5: Set Ship Location — Saves and Shows Toast — PASS
- Test 6: Set Ship Location — Context Menu Dismissal — PASS

**Requirements to satisfy:** SHIP-01

### Phase 13 — Atmospheric UI Animations
**UAT:** `13-UAT.md` — 7/7 passed (after bug fixes) [VERIFIED: file read]
**Human checkpoint:** `13-05-SUMMARY.md` — all 4 animation systems APPROVED [VERIFIED: file read]

**Requirements to satisfy + descriptions (Claude's discretion — based on SUMMARY evidence):**
- **ANIM-VIEW:** View-to-view transition uses `useViewTransition` hook — glitch-out (300ms) → dark frame (50ms) → fade-in (150ms) — with `ViewStatusOverlay` typewriter boot label per view type. UAT test 1+2 passed.
- **ANIM-OVERLAY:** Dialog overlays (CharonDialog, DocumentDialog, CommTerminalDialog) animate in with CRT-style entrance and fade-out with scale-down on dismiss. UAT test 3+4+5 passed.
- **ANIM-ROOM:** Encounter room reveal plays CRT digital flicker (~400ms); token cascade follows room reveal with ~200ms delay; multi-room cascade staggers 75ms per room. UAT test 6 passed.
- **ANIM-BRIDGE:** Bridge view panels stagger-animate in sequentially on load with 100ms delays; 6 items animate over ~1.2 seconds total. UAT test 7 passed.

**Note:** The UAT Gaps section in `13-UAT.md` records 3 bugs that were found and fixed during UAT (dialog dismiss animation, comm cascade clip-path). These are resolved — the final test results all show `pass`. Include them in VERIFICATION.md as "found and fixed" to demonstrate thorough testing.

### Phase 14 — VERIFICATION.md Already Exists
**File:** `.planning/phases/14-rework-bridge-status-tab.../VERIFICATION.md` [VERIFIED: file read]
**Status:** `human_needed`, 12/12 truths verified, 6 human items pending
**Phase 20 action:** Do NOT write a new Phase 14 VERIFICATION.md. Only flip STAT-10..14 checkboxes in REQUIREMENTS.md to `[x]`.

---

## Common Pitfalls

### Pitfall 1: `@login_required` Breaking Player Terminal
**What goes wrong:** `api_bridge_selection` is decorated with `@login_required`, causing `POST /api/bridge-selection/` to return a 302 redirect to `/login/` for unauthenticated player sessions. Player bridge map navigation silently breaks.
**Why it happens:** The docstring says "called by the player terminal" but the audit categorizes it as a security gap. Both are true — it is a player-facing public endpoint that happens to write state.
**How to avoid:** Do NOT add `@login_required` to `api_bridge_selection`. The correct resolution is to document it as intentionally public.
**Warning signs:** SharedConsole.tsx calls `terminalApi.updateBridgeSelection` — if that starts getting 401/302 responses, bridge navigation stops working.
**Evidence:** [VERIFIED: grep src/ — SharedConsole.tsx lines 631, 650 call bridge-selection; display_view_react at views.py line 77 has no @login_required — player terminal route is unauthenticated]

### Pitfall 2: Counting GRID Checkboxes as Phase 20 Work
**What goes wrong:** Planner creates a task to "check off GRID-01..10" — but Phase 12 already did this (verified 2026-04-17).
**Why it happens:** The audit was written before Phase 12 executed.
**How to avoid:** The Phase 20 plan should NOT include a task for GRID checkboxes. Verify current state: REQUIREMENTS.md lines 55-64 all show `[x]`. [VERIFIED: grep REQUIREMENTS.md]

### Pitfall 3: Writing Phase 14 VERIFICATION.md When One Already Exists
**What goes wrong:** Planner includes "write Phase 14 VERIFICATION.md" as a task, creating a duplicate or overwriting the existing file.
**Why it happens:** The audit flags Phase 14 as "unverified." The VERIFICATION.md was written shortly after.
**How to avoid:** Phase 14's file exists at `VERIFICATION.md` (not `14-VERIFICATION.md`) with status `human_needed`. The Phase 20 work is only the REQUIREMENTS.md checkbox update. [VERIFIED: file read `.planning/phases/14-.../VERIFICATION.md`]

### Pitfall 4: Removing encounterApi Functions Instead of Just Exports
**What goes wrong:** `getRoomVisibility` and `setRoomVisibility` functions are deleted from encounterApi.ts, breaking the internal callers at lines 128 and 137.
**Why it happens:** CONTEXT.md says "remove the exports" but the phrasing might be read as "remove the functions."
**How to avoid:** Only remove lines 240 and 241 from the export object `{ ..., getRoomVisibility, setRoomVisibility, ... }`. The function definitions at lines 107 and 115 stay.
**Warning signs:** TypeScript errors on `showAllRooms` (line 128) and `hideAllRooms` (line 137) which call `setRoomVisibility` internally. [VERIFIED: encounterApi.ts lines 128, 137]

### Pitfall 5: PORT-03 Deviation Note Goes in Wrong File
**What goes wrong:** The PORT-03 deviation note is added to Phase 04's new VERIFICATION.md or to REQUIREMENTS.md.
**Why it happens:** PORT-03 is a portrait requirement, and Phase 04 is the portrait phase.
**How to avoid:** Per D-02, the note goes in **Phase 11's** VERIFICATION.md (not Phase 04's), because Phase 11 is where `NPCPortraitOverlay` was wired into EncounterView — and subsequently reverted. The Phase 11 file already exists and needs a new note appended.

---

## REQUIREMENTS.md Change Specification

### Checkboxes to flip (`[ ]` → `[x]`):

These 5 are currently `[ ]` and need to become `[x]`: [VERIFIED: grep REQUIREMENTS.md]
- Line 24: `STAT-10`
- Line 25: `STAT-11`
- Line 26: `STAT-12`
- Line 27: `STAT-13`
- Line 28: `STAT-14`

### Traceability table: update `Pending` → `Complete` for STAT-10..14
Lines 150-154 in REQUIREMENTS.md: all five STAT-10..14 rows show `Pending` — change to `Complete`. [VERIFIED: grep REQUIREMENTS.md]

### New section to add (ANIM-* requirements):

Insert as a new v1 section, before or after "Player Ship Map (Phase 10)":

```markdown
### Atmospheric Animations (Phase 13)

- [x] **ANIM-VIEW**: View-to-view transitions use glitch-out/dark-frame/fade-in animation sequence via `useViewTransition` hook; `ViewStatusOverlay` displays per-view typewriter boot label during fade-in
- [x] **ANIM-OVERLAY**: Dialog overlays (CharonDialog, DocumentDialog, CommTerminalDialog) animate in with CRT-style entrance effects and fade-out with scale-down on dismiss
- [x] **ANIM-ROOM**: Encounter room reveal plays CRT digital flicker animation; tokens in newly revealed rooms cascade in with ~200ms delay; multi-room reveals stagger 75ms apart
- [x] **ANIM-BRIDGE**: Bridge view panels animate in with staggered fade-slide sequence (100ms per item, ~1.2s total) on view load
```

### Coverage count update:
Current: "v1 requirements: 47 total (29 original + 12 GMUI-* + 1 SHIP-01 + 5 STAT-10..14; AUDI-01..03 moved to v2)"
Update to: "v1 requirements: 51 total (29 original + 12 GMUI-* + 1 SHIP-01 + 5 STAT-10..14 + 4 ANIM-*; AUDI-01..03 moved to v2)"

### Traceability table: add ANIM-* rows
```markdown
| ANIM-VIEW | Phase 13 | Complete |
| ANIM-OVERLAY | Phase 13 | Complete |
| ANIM-ROOM | Phase 13 | Complete |
| ANIM-BRIDGE | Phase 13 | Complete |
```

---

## Code Examples

### Fix for api_set_ship_location (verified pattern match to Phase 11)

```python
# Source: terminal/views.py — apply @login_required, keep @csrf_exempt if desired
# Phase 11 precedent: api_ship_update_integrity uses @login_required alone (no @csrf_exempt)
# Simplest safe fix — add @login_required, retain @csrf_exempt (belt-and-suspenders, harmless):

@csrf_exempt
@login_required
def api_set_ship_location(request):
    """GM action: set the ship's current galactic position. Writes to ship.yaml + broadcasts SSE."""
    # ... rest of function unchanged
```

Note: Django applies decorators bottom-up, so `@login_required` (innermost) runs first on the actual view function, then `@csrf_exempt` wraps the `login_required`-wrapped function. This is the correct stacking order.

### encounterApi.ts export removal (minimal diff)

```typescript
// Source: src/services/encounterApi.ts lines 235-252 — BEFORE
export const encounterApi = {
  getMapData,
  getAllDecks,
  switchLevel,
  toggleRoom,
  getRoomVisibility,    // ← REMOVE this line
  setRoomVisibility,    // ← REMOVE this line
  showAllRooms,
  hideAllRooms,
  ...
};

// AFTER: getRoomVisibility and setRoomVisibility removed from export object
// The function definitions at lines 107 and 115 remain untouched
```

---

## Runtime State Inventory

Not applicable — this is a housekeeping/docs/security-fix phase. No rename, migration, or data transformation involved.

---

## Environment Availability

Step 2.6 SKIPPED — this phase makes no use of external tools, services, or CLIs beyond the standard project stack (Django, npm). TypeScript typecheck and build are standard project commands already available.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | TypeScript compiler (no unit test framework in use for this phase) |
| Config file | `tsconfig.json` |
| Quick run command | `npm run typecheck` |
| Full suite command | `npm run typecheck && npm run build` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STAT-10..14 | Checkbox flip in REQUIREMENTS.md | Manual inspection | `grep '\[x\] \*\*STAT-1' .planning/REQUIREMENTS.md` | N/A — doc edit |
| ANIM-VIEW..BRIDGE | New entries in REQUIREMENTS.md | Manual inspection | `grep 'ANIM-' .planning/REQUIREMENTS.md` | N/A — doc edit |
| encounterApi export removal | No external imports of getRoomVisibility/setRoomVisibility | TypeScript | `npm run typecheck` | ✅ |
| `@login_required` on api_set_ship_location | Unauthenticated POST blocked | TypeScript + grep | `grep '@login_required' terminal/views.py` after edit | ✅ |
| VERIFICATION.md files | Files created with correct content | Manual inspection | `ls .planning/phases/*/0*-VERIFICATION.md` | ❌ Wave 0 creates them |

### Sampling Rate
- **Per task commit:** `npm run typecheck` (for code changes only)
- **Per wave merge:** `npm run typecheck && npm run build`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] 6 new VERIFICATION.md files (phases 04, 05, 07, 08, 10, 13)
- [ ] Amendment to `11-VERIFICATION.md` (PORT-03 note)

*(All other changes are edits to existing files — no new infrastructure needed)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V4 Access Control | yes | `@login_required` on GM write endpoints |
| V5 Input Validation | no (no new input surfaces) | — |
| V2 Authentication | partial | Clarifying public vs. authenticated endpoint boundary |
| V3 Session Management | no | — |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated GM action (write to ship.yaml) | Tampering | `@login_required` on `api_set_ship_location` |
| Unauthenticated SSE injection (bridge-selection) | Tampering | Accept as intentional — ephemeral state only, document clearly |

---

## Open Questions (RESOLVED)

1. **`api_ship_update_stat` at line 1945 is `@csrf_exempt`-only and writes to ship.yaml**
   - What we know: This endpoint (`POST /api/gm/ship-status/stat/`) writes `thrusters`, `battle`, `systems` stats to ship.yaml. It has the same security profile as `api_set_ship_location`. The audit did not flag it.
   - What's unclear: Is this in Phase 20 scope? The CONTEXT.md only mentions the two audit-identified endpoints.
   - Recommendation: Out of scope for Phase 20 per the audit document. Note as a follow-up tech debt item. If the planner wants to be thorough, add `@login_required` to it in the same task as `api_set_ship_location`.

2. **Phase 08 VERIFICATION.md status — `passed` or `human_needed`?**
   - What we know: 9/10 UAT tests passed, 1 skipped ("BRIDGE main area TBD" — closed by Phase 09).
   - What's unclear: Should the Phase 08 VERIFICATION.md reflect the original 9/10 state (at time of Phase 08 completion) or reference that Phase 09 closed the gap?
   - Recommendation: Use `status: passed` with score `9/10 (1 skip — BRIDGE dashboard closed by Phase 09)`. This accurately reflects Phase 08's own outcome.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Django applies `@csrf_exempt` + `@login_required` stacked decorators as expected (outer→inner = `@csrf_exempt` first, `@login_required` second) | Code Examples | If decorator order matters differently, auth may not be enforced — verify by reading Django source or docs |

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: grep/read terminal/views.py] — Direct inspection of endpoint decorators, function signatures, docstrings
- [VERIFIED: grep src/] — Direct inspection of all frontend callers of bridge-selection and setShipLocation
- [VERIFIED: grep/read .planning/REQUIREMENTS.md] — Current checkbox state of all requirements
- [VERIFIED: read 11-VERIFICATION.md] — Phase 11 decorator pattern confirmation
- [VERIFIED: read 12-VERIFICATION.md] — Phase 12 execution confirmation (GRID-01..10 already `[x]`)
- [VERIFIED: read 14-VERIFICATION.md] — Phase 14 VERIFICATION.md existence and content
- [VERIFIED: read 13-UAT.md, 13-05-SUMMARY.md] — Phase 13 evidence for ANIM-* descriptions
- [VERIFIED: read 04/05/07/08/10-UAT.md] — UAT pass counts for VERIFICATION.md authoring
- [VERIFIED: read encounterApi.ts] — getRoomVisibility/setRoomVisibility internal usage confirmed

### Secondary (MEDIUM confidence)
- [ASSUMED] Django decorator stacking order — well-known Python behavior; `@login_required` innermost (line immediately above `def`) runs first at call time

## Metadata

**Confidence breakdown:**
- Security fix (`api_set_ship_location`): HIGH — direct code inspection, clear precedent
- Security non-fix (`api_bridge_selection`): HIGH — direct code inspection, unauthenticated player callers confirmed
- REQUIREMENTS.md changes: HIGH — exact line numbers verified
- VERIFICATION.md format: HIGH — multiple existing examples read
- ANIM-* requirement wording: MEDIUM — based on SUMMARY evidence + UAT; exact descriptions are Claude's discretion per CONTEXT.md D-01

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (stable — no external dependencies)
