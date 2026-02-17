---
status: complete
phase: 03-encounter-tokens
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md]
started: 2026-02-16T18:30:00Z
updated: 2026-02-16T18:45:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Token palette shows crew/NPC templates
expected: In the GM Console encounter panel, a TOKENS card shows pre-configured templates auto-populated from crew roster and NPCs with circular portrait thumbnails and type badges.
result: pass

### 2. Place token via drag-from-palette
expected: Drag a crew template from the TOKENS palette onto the encounter map preview. Token should appear on the map at a grid-snapped position (not floating between cells). The token should show as a circular image with the crew member's portrait and an amber glow (player type).
result: issue
reported: "This does work but I don't like on the GM console when I drag the token I get a semi transparent image of the picture full size. When dragging a token from the templates I would rather have it just show me dragging the token"
severity: cosmetic

### 3. Template stays selected after placement
expected: After placing a token, the same template should remain selected/highlighted in the palette (amber border). You can immediately click or drag to place another copy of the same token without reselecting.
result: skipped
reason: User doesn't need this functionality

### 4. Custom token creation
expected: In the TOKENS palette, use the custom token section: enter a name, select a type (Player/NPC/Creature/Object), optionally select an image from the gallery. Click Create — the custom token becomes the selected template and can be placed on the map.
result: issue
reported: "When I click create I get a notification that it was created but I can't add it to the map, there is nothing to select or place. Not sure if it should show up in the template area or somewhere else"
severity: major

### 5. Token image gallery
expected: Click "Select Image" in the custom token creator. A modal appears showing available images grouped by CREW, NPCs, and OTHER IMAGES, displayed as 48px circular thumbnails with names. Click an image to select it and close the gallery.
result: pass

### 6. Token type colors
expected: Place tokens of different types. Player tokens have amber glow, NPC tokens have teal glow, Creature tokens have burgundy/red glow, Object tokens have gray glow. Each type is visually distinguishable at a glance.
result: pass

### 7. Token label shows initial, full name on hover
expected: Each placed token shows its first initial as a label. When you hover over a token, the label changes to show the full name instead.
result: issue
reported: "Pass on the terminal view but on the GM console it is always their full name and the text is black so can't read the name"
severity: minor

### 8. Overlap prevention
expected: Try to place a second token on a grid cell that already has a token. The placement should be rejected — the token should NOT stack on top of the existing one.
result: pass

### 9. Tokens only in revealed rooms
expected: If you have rooms with visibility toggled off (unrevealed), try to drop a token into an unrevealed room area. The placement should be rejected. Tokens can only be placed in revealed rooms.
result: issue
reported: "pass but if I hide the room then the tokens just stay there"
severity: minor

### 10. Drag-to-move existing tokens
expected: On the GM map preview, click and drag an existing placed token. A ghost preview should show at the snapped grid position as you drag. On release, the token moves to the new cell. Only one API call fires (on drop, not during drag).
result: pass

### 11. Token popup on click
expected: Click a placed token on the map. An inline popup appears near the token showing: token name, type label, current status tags. In GM view it should also show status toggle buttons (wounded, panicked, stunned) and a REMOVE button.
result: issue
reported: "This does not happen, clicking the token in the gmconsole shows nothing and in the terminal it just gives me a popup that the name and token type."
severity: major

### 12. Toggle token status
expected: In the token popup, click a status button (e.g., "wounded"). The token should gain a visual overlay — wounded shows a pulsing red dot at top-right. Click "panicked" — a dashed amber ring appears around the token. Click wounded again to remove it.
result: issue
reported: "This does not happen, clicking the token has no effect"
severity: major

### 13. Remove token via popup
expected: In the token popup, click the REMOVE button. The token disappears from the map immediately.
result: issue
reported: "There is no popup"
severity: major

### 14. Clear All Tokens
expected: In the TOKENS palette, click "CLEAR ALL TOKENS" button. A confirmation dialog appears warning about removing all tokens. Confirm — all tokens are removed from the map.
result: pass

### 15. Player terminal shows tokens via polling
expected: With the Django server and Vite dev server running, open the terminal view (/terminal/) in a separate browser tab/window. Place tokens via the GM Console. Within a few seconds, the tokens should appear on the player's encounter map view. Players see tokens as read-only (no popup edit controls).
result: pass

### 16. Player view hides tokens in unrevealed rooms
expected: Place a token in a revealed room — it appears on the player terminal. Toggle that room to unrevealed in the GM Console. The token should disappear from the player's view (but GM still sees it).
result: issue
reported: "No, the token is still visible"
severity: major

## Summary

total: 16
passed: 7
issues: 8
pending: 0
skipped: 1

## Gaps

- truth: "Drag preview shows token-sized image, not full-size portrait"
  status: failed
  reason: "User reported: semi transparent image of the picture full size when dragging from templates"
  severity: cosmetic
  test: 2
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Custom token can be placed on the map after creation"
  status: failed
  reason: "User reported: clicking create shows notification but nothing to select or place on map"
  severity: major
  test: 4
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "GM console token labels show initial by default with readable text color"
  status: failed
  reason: "User reported: GM console always shows full name and text is black so can't read"
  severity: minor
  test: 7
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Tokens in rooms that become unrevealed are hidden from GM map preview"
  status: failed
  reason: "User reported: if I hide the room then the tokens just stay there"
  severity: minor
  test: 9
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Clicking a token in GM console shows popup with status toggles and remove button"
  status: failed
  reason: "User reported: clicking the token in the gmconsole shows nothing and in the terminal it just gives a popup with name and token type"
  severity: major
  test: 11
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Token status can be toggled via popup and visual overlays appear"
  status: failed
  reason: "User reported: clicking the token has no effect"
  severity: major
  test: 12
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Remove button in popup removes token from map"
  status: failed
  reason: "User reported: there is no popup"
  severity: major
  test: 13
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Player view hides tokens when their room becomes unrevealed"
  status: failed
  reason: "User reported: token is still visible after hiding room"
  severity: major
  test: 16
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""
