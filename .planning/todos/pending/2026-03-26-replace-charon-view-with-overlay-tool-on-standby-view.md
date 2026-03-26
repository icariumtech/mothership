---
created: 2026-03-26T15:33:00.649Z
title: Replace CHARON view with overlay tool on standby view
area: ui
files:
  - src/components/gm/layout/ViewRail.tsx
  - src/entries/GMConsole.tsx
  - src/components/gm/views/StandbyView.tsx
  - src/components/domain/charon/
---

## Problem

The CHARON terminal currently exists as a dedicated view in the left ViewRail, requiring a full view switch to access it. This is heavier than necessary — the CHARON terminal doesn't need its own view since it could live as an overlay on top of the standby view.

## Solution

- Remove the CHARON_TERMINAL entry from the ViewRail (left view bar)
- Add a CHARON tool button to the StandbyView (likely in a ToolRail or as a floating button)
- When activated, overlay the CHARON terminal on top of the standby view rather than switching views
- This keeps the standby view visible in the background with the terminal rendered on top
