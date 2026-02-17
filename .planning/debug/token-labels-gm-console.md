---
status: investigating
trigger: "Investigate why token labels in the GM console map preview always show full name (instead of initial by default) and the text color is black (unreadable against dark background)."
created: 2026-02-16T00:00:00Z
updated: 2026-02-16T00:00:00Z
---

## Current Focus

hypothesis: CSS hover rules from EncounterMapRenderer.css are not being loaded/applied in the GM console context
test: Check if EncounterMapRenderer.css is imported in MapPreview component
expecting: If CSS is missing, MapPreview doesn't have the token label hover/display rules
next_action: Examine imports and CSS loading in MapPreview.tsx

## Symptoms

expected: Token labels should show initial by default, full name on hover. Text should be light gray (#9a9a9a)
actual: Labels always show full name. Text color appears black (unreadable)
errors: None - visual rendering issue only
reproduction: Open GM console, view any encounter map with tokens
started: Unknown (likely since MapPreview component was created)

## Eliminated

## Evidence

- timestamp: 2026-02-16T00:00:00Z
  checked: Token.tsx component (lines 163-179)
  found: |
    Token renders TWO text elements:
    - Line 164-171: Initial label with class "encounter-map__token-label--initial"
    - Line 172-179: Full name label with class "encounter-map__token-label--full"

    Both use className "encounter-map__token-label" as base class.
  implication: Component expects CSS to control which label is visible (display:none/block)

- timestamp: 2026-02-16T00:00:00Z
  checked: EncounterMapRenderer.css (lines 322-326)
  found: |
    CSS rules for token labels:
    Line 323: .encounter-map__token-label { fill: #9a9a9a; font-size: 10px; ... }
    Line 324: .encounter-map__token-label--full { display: none; }
    Line 325: .encounter-map__token:hover .encounter-map__token-label--full { display: block; }
    Line 326: .encounter-map__token:hover .encounter-map__token-label--initial { display: none; }
  implication: CSS controls visibility toggle AND sets text color to light gray (#9a9a9a)

- timestamp: 2026-02-16T00:00:00Z
  checked: MapPreview.tsx imports (lines 1-23)
  found: |
    No CSS import for EncounterMapRenderer.css.
    MapPreview imports React, types, components, and utils only.
    No stylesheet imports at all.
  implication: MapPreview component does NOT load the token label CSS rules

- timestamp: 2026-02-16T00:00:00Z
  checked: MapPreview.tsx token rendering (lines 651-663)
  found: |
    MapPreview renders TokenLayer component (line 653-663).
    TokenLayer renders Token components (TokenLayer.tsx lines 185-200).
    Token components generate the text elements with CSS classes.
    But without EncounterMapRenderer.css, those classes have no styling.
  implication: Token labels render with browser defaults (black text, both visible)

## Resolution

root_cause: MapPreview.tsx does not import EncounterMapRenderer.css, so the token label CSS rules (.encounter-map__token-label { fill: #9a9a9a }, .encounter-map__token-label--full { display: none }, hover rules) are not applied in the GM console context. Without these rules, SVG text elements default to black fill color and both labels are visible.

fix: Add import statement to MapPreview.tsx: `import '@/components/domain/encounter/EncounterMapRenderer.css';`

verification: After fix, verify in GM console that token labels show only initial by default (full name hidden), hover shows full name (initial hidden), and text color is light gray (#9a9a9a)

files_changed:
  - src/components/gm/MapPreview.tsx
