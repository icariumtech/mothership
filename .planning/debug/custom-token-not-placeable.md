---
status: investigating
trigger: "Investigate why custom token creation in TokenPalette shows a 'created' notification but the token can't be placed on the map. There's nothing to select or drag after clicking Create."
created: 2026-02-16T00:00:00Z
updated: 2026-02-16T00:00:00Z
---

## Current Focus

hypothesis: Custom token is set as selectedTemplate but not made draggable because it's not in the templates array
test: Code analysis of handleCreateCustom and drag/drop implementation
expecting: Custom template is selected but not rendered in the draggable templates grid
next_action: Analyze template rendering and drag handlers

## Symptoms

expected: After clicking CREATE, custom token should be draggable/placeable on the map
actual: Notification shows "ready to place" but nothing to drag or select
errors: None reported
reproduction:
1. Fill in custom token name
2. Select type (player/npc/creature/object)
3. Optionally select image from gallery
4. Click CREATE button
5. See success message but no draggable token appears
started: Unknown, reported issue

## Eliminated

## Evidence

- timestamp: 2026-02-16T00:00:01Z
  checked: TokenPalette.tsx handleCreateCustom function (lines 99-113)
  found: Creates customTemplate object and sets it as selectedTemplate, shows success message
  implication: Custom token is stored in state but not added to templates array

- timestamp: 2026-02-16T00:00:02Z
  checked: Templates rendering logic (lines 195-290)
  found: Only renders templates from the templates state array, not selectedTemplate
  implication: Custom tokens are never rendered in the UI, only stored in selectedTemplate state

- timestamp: 2026-02-16T00:00:03Z
  checked: Drag handler (lines 122-133)
  found: handleDragStart requires template to be rendered in the grid to be draggable
  implication: Custom tokens can't be dragged because they're not rendered

- timestamp: 2026-02-16T00:00:04Z
  checked: Selected template indicator (lines 402-420)
  found: Shows "SELECTED: {name} ({type})" with instruction "Drag to map or click map cell to place"
  implication: UI claims token can be dragged but provides no draggable element

## Resolution

root_cause: Custom tokens are set as selectedTemplate but never added to the templates array. The templates grid only renders items from the templates array (line 195), so custom tokens have no visual representation to drag. The selectedTemplate indicator (lines 402-420) appears but provides no draggable element - it only shows text instructions.

fix:

artifacts:
- TokenPalette.tsx lines 99-113: handleCreateCustom creates template but doesn't add to templates array
- TokenPalette.tsx lines 195-290: Template grid only renders from templates array
- TokenPalette.tsx lines 402-420: Selected indicator shows but isn't draggable

missing:
1. Add custom template to templates array when created (so it renders in grid)
2. OR make selected template indicator draggable
3. OR create separate "staged custom token" UI element that is draggable

files_changed: []
