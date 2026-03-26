---
created: 2026-03-26T15:33:00.649Z
title: Add documents tool to encounter view toolbar
area: ui
files:
  - src/components/gm/views/EncounterView.tsx
  - src/components/gm/layout/ToolRail.tsx
  - src/components/gm/layout/SlideOutPanel.tsx
  - data/
---

## Problem

The GM encounter view toolbar (ToolRail) has no way to surface reference documents during a session. GMs need to quickly pull up handouts, lore entries, or campaign notes while running an encounter without leaving the view.

## Solution

Add a "Documents" tool button to the EncounterView ToolRail. Clicking it opens a SlideOutPanel showing a list of markdown documents sourced from a new `docs/` section in the campaign data directory (e.g. `data/campaign/docs/`).

Key details:
- Markdown files use YAML frontmatter at the top with a `title:` field — this becomes the panel header when the doc is displayed
  ```
  ---
  title: Something
  ---
  ```
- Document list view shows titles; clicking a doc renders the markdown content in the panel
- Files are served from the backend (similar to existing data tree reads)
- "Random md" phrasing in the request likely means arbitrary markdown files, not a random-selection feature
