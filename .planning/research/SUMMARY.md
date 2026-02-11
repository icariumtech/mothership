# Research Summary: Mothership GM Tool — Milestone 2

## Key Findings

### Stack
No new dependencies needed. All features built with existing React 19 + TypeScript + Zustand + Django patterns. Token dragging uses native pointer events. Dashboards and tabs are standard React components reading YAML data via API.

### Table Stakes Features
- **Encounter tokens**: GM places/moves tokens on grid, players see via polling
- **NPC portraits**: Panel overlay triggered by GM, CRT-styled
- **Ship dashboard**: System status panels (hull, engines, life support) with operational states
- **Bridge tabs**: Crew roster with stress/stats, NPC contacts directory, campaign logs

### Architecture
- Bridge tabs and ship dashboard follow existing data flow: YAML → DataLoader → API → React
- Encounter tokens need runtime state in ActiveView (not just YAML) for live movement
- NPC portraits triggered via ActiveView field, rendered as encounter overlay
- New Zustand stores recommended for encounter and dashboard state (keep sceneStore focused on 3D)
- 6 new API endpoints needed

### Watch Out For
1. **Token drag on mobile** — use pointer events, large touch targets, `touch-action: none`
2. **Polling latency for tokens** — evaluate if 2s is adequate before adding complexity
3. **YAML schema sprawl** — design all schemas upfront for consistency
4. **Encounter view complexity** — decompose into layers (map, tokens, portraits)
5. **Bridge vs Ship Dashboard confusion** — define clear purpose for each view

### Build Order
1. Bridge tabs (lowest risk, validates patterns)
2. Ship dashboard (new view, builds on data patterns)
3. Encounter tokens (state sync complexity)
4. NPC portraits (can parallel with tokens)

## Files

- `STACK.md` — Library recommendations (no new deps)
- `FEATURES.md` — Feature categorization with complexity estimates
- `ARCHITECTURE.md` — Integration patterns and data flow
- `PITFALLS.md` — 7 identified risks with prevention strategies
