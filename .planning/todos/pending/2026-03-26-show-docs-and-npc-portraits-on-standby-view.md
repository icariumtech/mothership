---
created: 2026-03-26T15:33:00.649Z
title: Show docs and NPC portraits on standby view
area: ui
files:
  - src/components/gm/views/StandbyView.tsx
  - src/components/domain/charon/
---

## Problem

The standby view is currently just an idle/animated screen. The GM has no way to surface campaign documents or NPC portraits on it — these are only accessible through other views. The standby view should become a more useful "display" surface for showing content to players.

## Solution

Add tool buttons to the standby view (ToolRail or similar) that allow the GM to:
- Open and display a campaign document (markdown with frontmatter title) as an overlay — connects to the docs feature (see: add-documents-tool-to-encounter-view-toolbar todo)
- Show an NPC portrait overlay on the standby view (similar to NPCPortraitOverlay already in EncounterView)

The standby view background remains visible behind the overlaid content, maintaining the atmospheric idle aesthetic.
