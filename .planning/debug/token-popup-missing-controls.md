---
status: investigating
trigger: "Investigate why clicking a token in the GM console map preview shows nothing (no popup), and why in the player terminal it only shows name and type but no status toggles or remove button."
created: 2026-02-16T00:00:00Z
updated: 2026-02-16T00:00:00Z
---

## Current Focus

hypothesis: MapPreview is not managing selectedTokenId state or passing onTokenSelect to TokenLayer
test: checking MapPreview props flow to TokenLayer
expecting: MapPreview should have useState for selectedTokenId and pass it to TokenLayer, but it likely doesn't
next_action: analyze MapPreview.tsx and TokenLayer integration

## Symptoms

expected: Clicking a token in GM console map preview should show a popup with name, type, status tags, status toggle buttons, and remove button
actual: No popup appears when clicking token in GM console. In player terminal, popup shows name/type only, missing GM controls
errors: None (no errors, just missing functionality)
reproduction:
1. GM Console: Place a token on map preview, click it → no popup
2. Player Terminal: View token on encounter map, click it → popup shows but missing status toggles and remove button
started: Unknown - discovered during UAT testing (tests 11, 12, 13)

## Eliminated

## Evidence

- timestamp: 2026-02-16T00:00:00Z
  checked: MapPreview.tsx lines 651-663 (TokenLayer integration)
  found: MapPreview renders TokenLayer but does NOT pass selectedTokenId or onTokenSelect props
  implication: TokenLayer defaults to selectedTokenId=null, onTokenSelect=undefined, so token selection doesn't work

- timestamp: 2026-02-16T00:00:00Z
  checked: TokenLayer.tsx lines 26-27, 39-40 (prop defaults)
  found: selectedTokenId defaults to null, onTokenSelect is optional and defaults to undefined
  implication: Without these props from parent, TokenLayer cannot track selection state

- timestamp: 2026-02-16T00:00:00Z
  checked: TokenLayer.tsx lines 221-235 (popup rendering logic)
  found: Popup only renders when selectedTokenId is set AND onTokenSelect callback exists
  implication: Since MapPreview doesn't pass these props, popup never renders in GM console

- timestamp: 2026-02-16T00:00:00Z
  checked: EncounterMapRenderer.tsx lines 114, 1019-1020 (how it should work)
  found: EncounterMapRenderer manages selectedTokenId state (line 114) and passes it to TokenLayer (lines 1019-1020)
  implication: This is the correct pattern - MapPreview should follow the same pattern

- timestamp: 2026-02-16T00:00:00Z
  checked: TokenPopup.tsx lines 97-136 (GM controls rendering)
  found: Status toggle buttons and remove button are conditionally rendered based on isGM prop (line 97)
  implication: TokenPopup has the right logic, but isGM needs to be passed correctly from MapPreview through TokenLayer

- timestamp: 2026-02-16T00:00:00Z
  checked: MapPreview.tsx line 98, 657 (isGM prop)
  found: MapPreview receives isGM prop (default false) and passes it to TokenLayer (line 657)
  implication: isGM flow is correct, but without selection state, popup never renders to use it

## Resolution

root_cause: MapPreview does not manage selectedTokenId state or pass onTokenSelect callback to TokenLayer. This causes:
1. GM Console: No popup appears because TokenLayer cannot track which token is selected
2. Player Terminal: If popup appears (through EncounterMapRenderer), it should show GM controls correctly when isGM=true

The fix requires:
1. Add useState for selectedTokenId in MapPreview
2. Add onTokenSelect handler in MapPreview
3. Pass both props to TokenLayer (similar to EncounterMapRenderer pattern)

fix:
verification:
files_changed: []
