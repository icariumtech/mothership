---
created: 2026-03-26T15:07:10.759Z
title: Fix comm-terminal panel missing chamfer corners
area: ui
files:
  - src/components/domain/dashboard/CommTerminalView.tsx
  - src/components/ui/
---

## Problem

On the player terminal, the comm-terminal panel is missing chamfer (angled corner) lines on three corners: lower-left, lower-right, and upper-right. Only the upper-left corner appears to have the chamfer styling applied correctly.

## Solution

Inspect the CommTerminalView component and its associated CSS/panel configuration. Verify that the DashboardPanel or CompactPanel wrapper has chamfer applied to all four corners. The chamfer style (12px angular cuts) should appear consistently on all corners per the STYLE_GUIDE.md spec.
