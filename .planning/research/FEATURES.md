# Features Research: Mothership GM Tool — Milestone 2

## Context

Researched VTT (virtual tabletop) tools, GM dashboards, and sci-fi RPG digital aids. Focused on what Mothership-specific features make sense given the existing CRT aesthetic and local-network architecture.

## Feature Categories

### 1. Encounter Map Tokens

**Table Stakes:**
- GM can place tokens on map grid — LOW complexity
- Tokens snap to grid cells — LOW complexity
- Different token types (player, NPC, creature, object) with visual distinction — MEDIUM complexity
- GM can move tokens, players see updates — MEDIUM complexity (needs state sync)

**Differentiators:**
- Token size support (1x1, 2x2 for large creatures) — MEDIUM complexity
- Token status indicators (wounded, dead, panicked) — LOW complexity
- Fog of war / visibility per token — HIGH complexity
- Token health bars — LOW complexity

**Anti-features:**
- Player-controlled token movement — breaks GM-controlled paradigm; Mothership is theater-of-mind with occasional tactical maps, not a full VTT
- Complex initiative/turn tracking on map — overkill for Mothership's fast combat
- Animated token movement — unnecessary visual complexity for CRT aesthetic

**Dependencies:** Requires encounter map system (existing)

### 2. NPC Portrait Display

**Table Stakes:**
- Show NPC portrait when GM triggers it — LOW complexity
- Portrait fills a panel with name and basic info — LOW complexity
- Amber/CRT-styled portrait (consistent with aesthetic) — LOW complexity (script exists)

**Differentiators:**
- Portrait appears as overlay during encounter — MEDIUM complexity
- Multiple portraits for group conversations — MEDIUM complexity
- Portrait linked to NPC data (stats, faction, notes) — MEDIUM complexity
- Animated reveal (typewriter name, fade-in portrait) — LOW complexity (patterns exist)

**Anti-features:**
- AI-generated portraits on the fly — unnecessary complexity, GM curates portraits
- Portrait customization by players — read-only paradigm
- Full NPC character sheets visible to players — GM controls info disclosure

**Dependencies:** Requires NPC data schema, portrait image assets

### 3. Ship Dashboard

**Table Stakes:**
- Ship name, class, status overview — LOW complexity
- Hull integrity / armor display — LOW complexity
- System status (life support, engines, weapons, comms) with operational states — MEDIUM complexity
- Crew count / capacity — LOW complexity

**Differentiators:**
- Animated status changes (system goes from OPERATIONAL to WARNING) — LOW complexity
- GM can toggle system states from console — MEDIUM complexity
- Stress-inducing visual effects when systems fail (screen flicker, warning colors) — MEDIUM complexity
- Fuel/supply tracking — LOW complexity
- Jump drive status / countdown — LOW complexity

**Anti-features:**
- Complex ship combat simulation — Mothership handles this with dice, not software
- Editable ship stats by players — GM-controlled
- Real-time physics simulation — not relevant to tabletop play

**Dependencies:** New YAML schema for ship status data

### 4. Bridge Tabs

#### CREW Tab
**Table Stakes:**
- Player character list with names and classes — LOW complexity
- Key stats (Strength, Speed, Intellect, Combat) — LOW complexity
- Stress level display (core Mothership mechanic) — LOW complexity
- Save values (Sanity, Fear, Body) — LOW complexity

**Differentiators:**
- Health/wound status — LOW complexity
- Equipment/inventory summary — MEDIUM complexity
- Character portrait thumbnails — LOW complexity
- Stress level visual indicators (color-coded, pulsing at high stress) — LOW complexity

#### CONTACTS Tab
**Table Stakes:**
- NPC directory with names and roles — LOW complexity
- Faction affiliations — LOW complexity
- Last known location — LOW complexity

**Differentiators:**
- Relationship status (friendly, neutral, hostile) — LOW complexity
- Portrait thumbnails — LOW complexity
- Linked to communication terminals — MEDIUM complexity

#### LOGS Tab
**Table Stakes:**
- Campaign session log entries — LOW complexity
- Chronological ordering — LOW complexity
- Session date/number display — LOW complexity

**Differentiators:**
- Filterable by session — LOW complexity
- Auto-generated from GM actions — HIGH complexity
- Searchable — MEDIUM complexity

**Dependencies:** Campaign YAML data (partially exists in `data/campaign/`)

## Complexity Summary

| Feature | Table Stakes Effort | With Differentiators |
|---------|-------------------|---------------------|
| Encounter Tokens | MEDIUM | HIGH |
| NPC Portraits | LOW | MEDIUM |
| Ship Dashboard | MEDIUM | MEDIUM |
| Bridge: CREW | LOW | LOW |
| Bridge: CONTACTS | LOW | MEDIUM |
| Bridge: LOGS | LOW | MEDIUM |

## Recommended v1 Scope

Focus on table stakes + select differentiators that enhance atmosphere:
- Tokens: basic placement/movement with type distinction and status indicators
- Portraits: panel overlay with animated reveal
- Ship dashboard: full system status with animated state changes
- Bridge tabs: all three with core data displays and stress indicators for crew
