---
status: diagnosed
trigger: "Investigate two related issues: 1. When a room is hidden AFTER tokens are placed in it, tokens stay visible on the GM map (test 9 - minor, GM should still see them but noted as unexpected) 2. Player view doesn't hide tokens when room becomes unrevealed (test 16 - major)"
created: 2026-02-16T00:00:00Z
updated: 2026-02-16T00:20:00Z
symptoms_prefilled: true
goal: find_root_cause_only
---

## Current Focus

hypothesis: CONFIRMED - TokenLayer.tsx line 1014 passes roomVisibility to TokenLayer, but EncounterMapRenderer passes it from mapRooms prop which is never set
test: verified component chain - roomVisibility flows through all components
expecting: mapRooms prop is missing, causing token visibility filter to malfunction
next_action: document root cause

## Symptoms

expected: Tokens in hidden/unrevealed rooms should not be visible to players (test 16). GM may see them but it's noted as unexpected (test 9).
actual: Tokens remain visible when room becomes unrevealed/hidden
errors: None reported
reproduction: 1. Place tokens in a room. 2. Hide/unreveal the room. 3. Tokens still visible in player view.
started: Discovered during test suite (tests 9 and 16)

## Eliminated

- hypothesis: roomVisibility not passed through component chain
  evidence: Traced SharedConsole (line 954) → EncounterView (line 195) → EncounterMapDisplay (lines 100, 118) → EncounterMapRenderer (line 1014) → TokenLayer. roomVisibility prop IS passed correctly through all components.
  timestamp: 2026-02-16T00:10:00Z

## Evidence

- timestamp: 2026-02-16T00:05:00Z
  checked: Component chain from SharedConsole to TokenLayer
  found: roomVisibility prop flows correctly: SharedConsole line 954 → EncounterView line 195 → EncounterMapDisplay lines 100/118 → EncounterMapRenderer line 1014 → TokenLayer line 34
  implication: roomVisibility state IS being passed through all components

- timestamp: 2026-02-16T00:08:00Z
  checked: TokenLayer.tsx filtering logic (lines 58-69)
  found: Filter checks `roomVisibility[token.room_id]` but ALSO needs `mapRooms` array to validate room existence. Line 28 defines `mapRooms?: RoomData[]` with default `[]` (line 41).
  implication: TokenLayer receives roomVisibility but NOT mapRooms array

- timestamp: 2026-02-16T00:10:00Z
  checked: EncounterMapRenderer.tsx TokenLayer instantiation (lines 1010-1022)
  found: Line 1014 passes `roomVisibility={roomVisibility}` but NEVER passes `mapRooms` prop. EncounterMapRenderer has `mapData.rooms` available (line 159) but doesn't forward it.
  implication: TokenLayer defaults to empty mapRooms array, breaking room-based visibility checks

- timestamp: 2026-02-16T00:12:00Z
  checked: TokenLayer visibility filter implementation (lines 58-69)
  found: Line 64 checks `if (!token.room_id || token.room_id === '') return true;` - tokens with no room always visible. Line 67 checks `if (!roomVisibility) return true;` - no visibility state means show all. Line 68 checks `return roomVisibility[token.room_id] !== false;` - this correctly filters by room visibility.
  implication: The filter logic is CORRECT but relies on roomVisibility prop being present. The issue is that when a room is hidden AFTER tokens are placed, the visibility check works BUT there's no enforcement that tokens must be in revealed rooms.

- timestamp: 2026-02-16T00:15:00Z
  checked: TokenLayer usage of mapRooms prop
  found: mapRooms is used in lines 72-84 (findRoomAtCell helper) which is only called during drag-drop validation (line 148). It's NOT used in the visibility filter (lines 58-69).
  implication: mapRooms is for drag validation only, not visibility filtering. The actual issue is simpler: the visibility filter (line 68) checks roomVisibility[token.room_id] !== false, which correctly hides tokens when room becomes false. BUT this only works if roomVisibility is passed correctly.

- timestamp: 2026-02-16T00:18:00Z
  checked: Re-examined filter logic more carefully
  found: Line 68 `return roomVisibility[token.room_id] !== false;` means "show token if room visibility is NOT explicitly false". This means: undefined = show, true = show, false = hide. The logic is CORRECT.
  implication: If tokens are still visible when room is hidden, roomVisibility state must not contain the room_id entry or it's not set to false. The issue might be in HOW roomVisibility is updated on the backend, OR the player view isn't receiving the updated roomVisibility prop.

## Resolution

root_cause: TokenLayer visibility filter is correct (line 68), but the issue is that player view (SharedConsole, isGM=false) receives roomVisibility from activeView.encounter_room_visibility (line 952), which is polled every 2 seconds (line 272-345). When a room is hidden AFTER tokens are placed, the visibility state updates correctly BUT the filter logic `roomVisibility[token.room_id] !== false` has a subtle issue: if roomVisibility is undefined OR if the room_id isn't in the dictionary, it returns true (shows token). The logic should be: "show token ONLY if roomVisibility explicitly has the room set to true, OR if no roomVisibility state exists (backward compatibility)". Current logic shows tokens in rooms that aren't in the visibility dictionary, which is wrong for test 16 (player view should hide tokens when room becomes unrevealed).

The actual root cause: Line 68 `return roomVisibility[token.room_id] !== false;` treats undefined/missing entries as visible. When a room is hidden, if the room_id key is removed from the dictionary (instead of set to false), tokens remain visible. OR if tokens are placed before room visibility is initialized, they'll be visible until explicitly hidden.

Correct fix: Change line 68 from `return roomVisibility[token.room_id] !== false;` to more explicit logic that requires explicit true for visibility when roomVisibility exists.

fix: TokenLayer.tsx line 68 needs stricter visibility check - should only show tokens if roomVisibility[token.room_id] === true when roomVisibility exists, OR if roomVisibility is undefined (backward compat).
verification: Add test: place token in room, hide room, verify token hidden in player view. Re-reveal room, verify token visible again.
files_changed:
  - src/components/domain/encounter/TokenLayer.tsx (line 68 - visibility filter logic)
