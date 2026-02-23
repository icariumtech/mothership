---
status: complete
phase: 04-npc-portrait-system
source: 04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md, 04-04-SUMMARY.md
started: 2026-02-23T00:00:00Z
updated: 2026-02-23T00:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. NPC PORTRAITS card in GM console
expected: Open the GM console and navigate to the Encounter view. There should be an "NPC PORTRAITS" section visible in the EncounterPanel (same panel as ROOM VISIBILITY and TOKENS). It should list the campaign's NPCs with a SHOW button for each one not currently displayed.
result: pass

### 2. Show portrait on terminal
expected: In the GM console EncounterPanel, click SHOW for an NPC. Within ~2 seconds (one poll cycle), a portrait card appears on the player terminal screen overlaying the encounter map. The button for that NPC in the GM console changes from SHOW to DISMISS.
result: pass

### 3. CRT reveal animation
expected: When a portrait appears on the terminal, it plays a 3-phase CRT animation: (1) brief screen flicker, (2) a top-to-bottom scan-wipe that reveals the portrait image, (3) the NPC name types out character by character below the image.
result: pass

### 4. Multiple portraits tile side-by-side
expected: Show a second NPC portrait while the first is still displayed. Both portrait cards appear side-by-side horizontally on the terminal. The second card plays its own CRT reveal animation independently.
result: pass

### 5. Dismiss portrait
expected: In the GM console, click DISMISS for an active portrait. The portrait card on the terminal plays a fade-out animation and then disappears. Other portrait cards remain unaffected.
result: pass

### 6. Portraits clear on encounter location switch
expected: While portraits are active, use the GM console to switch to a different encounter location. All portrait cards should disappear from the terminal (they clear when the encounter location changes).
result: pass

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0

## Gaps

[none]
