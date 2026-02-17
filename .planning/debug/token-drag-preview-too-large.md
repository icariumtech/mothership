---
status: diagnosed
trigger: "Investigate why dragging a token template from the TokenPalette shows a full-size semi-transparent portrait image instead of a small token-sized drag preview."
created: 2026-02-16T00:00:00Z
updated: 2026-02-16T00:00:00Z
---

## Current Focus

hypothesis: HTML5 drag API creates drag image from full-size source image instead of small token preview
test: Reviewed handleDragStart implementation
expecting: Found the issue
next_action: Return diagnosis (find_root_cause_only mode)

## Symptoms

expected: Small token-sized drag preview when dragging from palette
actual: Full-size semi-transparent portrait image appears as drag ghost
errors: None (cosmetic issue)
reproduction: Drag any token template from TokenPalette
started: Unknown - existing behavior
symptoms_prefilled: true

## Eliminated

N/A - Root cause confirmed on first inspection

## Evidence

- timestamp: 2026-02-16T00:00:00Z
  checked: src/components/gm/TokenPalette.tsx lines 123-133
  found: handleDragStart creates new Image() and calls setDragImage() with full-size source
  implication: Browser uses full source image dimensions, not palette thumbnail

- timestamp: 2026-02-16T00:00:00Z
  checked: Template card rendering (lines 226-246)
  found: Template cards show 32x32px circular thumbnails
  implication: Palette displays correct small preview, but drag uses different image source

- timestamp: 2026-02-16T00:00:00Z
  checked: handleDragStart setDragImage parameters
  found: `e.dataTransfer.setDragImage(img, 16, 16)` - offset correct, but img is full-size
  implication: Offset only controls hotspot position, not image size

## Resolution

root_cause: |
  Lines 128-132 in TokenPalette.tsx create a drag preview using the full-size source image:

  ```typescript
  const img = new Image();
  img.src = template.imageUrl;
  e.dataTransfer.setDragImage(img, 16, 16);
  ```

  The `setDragImage()` API does not scale the image. The browser renders the image at its
  natural dimensions (typically 400x400px portrait). The offset parameters (16, 16) only
  control the cursor hotspot, not the image size.

  The fix requires creating a small canvas element (e.g., 32x32px), drawing the image
  scaled down, and using that canvas as the drag image instead of the raw Image object.

fix: Not applied (goal: find_root_cause_only)

verification: Not applicable (diagnosis-only mode)

files_changed: []
