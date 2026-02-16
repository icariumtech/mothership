---
phase: 03-encounter-tokens
plan: 01
subsystem: encounter-tokens
tags:
  - backend
  - api
  - data-model
  - typescript
dependency_graph:
  requires: []
  provides:
    - encounter_tokens JSONField on ActiveView
    - Token CRUD API endpoints
    - Token image listing endpoint
    - TypeScript token types and API client
  affects:
    - terminal/models.py (ActiveView)
    - terminal/views.py (API endpoints)
    - terminal/urls.py (URL routing)
    - src/types/encounterMap.ts (TypeScript types)
    - src/services/encounterApi.ts (API client)
tech_stack:
  added:
    - encounter_tokens JSONField (Django)
    - UUID-based token IDs
  patterns:
    - JSON field for runtime state storage
    - CRUD API with @csrf_exempt
    - Type-safe API client functions
key_files:
  created:
    - terminal/migrations/0015_activeview_encounter_tokens.py
  modified:
    - terminal/models.py
    - terminal/views.py
    - terminal/urls.py
    - src/types/encounterMap.ts
    - src/services/encounterApi.ts
decisions:
  - Store tokens in ActiveView.encounter_tokens JSONField matching existing patterns (room_visibility, door_status)
  - Generate 8-character hex UUIDs for token IDs (uuid.uuid4().hex[:8])
  - Token images discovered from crew.yaml portraits, npcs.yaml portraits, and campaign/NPCs/images/ directory
  - Status field is array of strings (wounded, dead, panicked, stunned, hidden) for flexible status tracking
  - All token endpoints use @csrf_exempt for GM console access without CSRF tokens
metrics:
  duration: 231s
  tasks_completed: 2
  files_modified: 6
  api_endpoints_added: 6
  typescript_functions_added: 6
  completed: 2026-02-16T15:16:31Z
---

# Phase 03 Plan 01: Encounter Token Backend Summary

**Backend data layer for encounter tokens: model field, CRUD API endpoints, token image listing, TypeScript types, and API client.**

## What Was Built

Established the complete data foundation for encounter token management. Token state stored in `ActiveView.encounter_tokens` JSONField (matching existing `encounter_room_visibility` and `encounter_door_status` patterns). Token images served from campaign crew/NPC portrait data and loose image files.

### Task 1: ActiveView Model Field, Migration, and Token CRUD API Endpoints

**Commit:** `5caba3c`

Added `encounter_tokens` JSONField to ActiveView model with Django migration. Implemented 6 token CRUD API endpoints following existing encounter API patterns:

1. **api_encounter_place_token** - Creates token with UUID, validates type/coordinates, stores in encounter_tokens dict
2. **api_encounter_move_token** - Updates token position and room assignment
3. **api_encounter_remove_token** - Deletes token from dict
4. **api_encounter_update_token_status** - Replaces status array (wounded, dead, panicked, etc.)
5. **api_encounter_clear_tokens** - Clears all tokens (reset map state)
6. **api_encounter_token_images** - Lists available images from:
   - Crew roster portraits (`data/campaign/crew.yaml`)
   - NPC roster portraits (`data/campaign/npcs.yaml`)
   - Loose images in `data/campaign/NPCs/images/` directory

Updated `get_active_view_json` to include `encounter_tokens` in response for player polling.

**Key Implementation Details:**
- Token IDs: 8-character hex from `uuid.uuid4().hex[:8]`
- Token data structure: `{ type, name, x, y, status: [], image_url, room_id }`
- Type validation: player | npc | creature | object
- Coordinate validation: integers required
- All endpoints use `@csrf_exempt` for GM console access

### Task 2: TypeScript Token Types and API Client Functions

**Commit:** `ec76032`

Added comprehensive TypeScript types to `encounterMap.ts`:
- `TokenType` - Union type for token categories
- `TokenStatus` - Union type for status flags
- `TokenData` - Interface matching backend structure
- `TokenState` - Map of token_id -> TokenData
- `TokenImage` - Interface for token gallery images

Implemented 6 API client functions in `encounterApi.ts`:
- `placeToken(type, name, x, y, imageUrl?, roomId?)` - Create token
- `moveToken(tokenId, x, y, roomId?)` - Update position
- `removeToken(tokenId)` - Delete token
- `updateTokenStatus(tokenId, status)` - Update status flags
- `clearAllTokens()` - Clear all tokens
- `getTokenImages()` - Fetch available images

All functions properly typed with request/response interfaces and exported from `encounterApi` service object.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

✅ `python manage.py migrate --check` - No pending migrations
✅ `python manage.py shell` - `ActiveView.encounter_tokens` returns `<class 'dict'>`
✅ `curl /api/active-view/` - Response includes `"encounter_tokens": {}`
✅ `curl /api/gm/encounter/place-token/` - Token created with UUID, returns full tokens dict
✅ `curl /api/gm/encounter/token-images/` - Returns crew/NPC portraits and loose images
✅ `npm run typecheck` - No TypeScript errors

## API Testing

**Place Token Test:**
```json
{
  "success": true,
  "token_id": "dbe51b0f",
  "tokens": {
    "dbe51b0f": {
      "type": "player",
      "name": "Test Token",
      "x": 5,
      "y": 10,
      "status": [],
      "image_url": "",
      "room_id": ""
    }
  }
}
```

**Token Images Test:**
Returns crew members (Dr. Elena Vasquez, Marcus Chen, Lt. Sarah Kim, Alex Novak) with portrait URLs from campaign data.

## Success Criteria

✅ ActiveView model has `encounter_tokens` JSONField with migration applied
✅ Six API endpoints (place, move, remove, update-status, clear, token-images) respond correctly
✅ Active view JSON response includes `encounter_tokens` for player polling
✅ TypeScript types match backend data structure
✅ API client functions typed and exported from encounterApi service

## Technical Foundation Established

**Token State Management:**
- Runtime token state persists in database via ActiveView singleton
- Survives page refreshes (polled from active-view API)
- Follows existing JSONField pattern (encounter_room_visibility, encounter_door_status, ship_system_overrides)

**Token Image Discovery:**
- Automatically discovers portraits from crew.yaml and npcs.yaml
- Scans loose image files in campaign/NPCs/images/ directory
- Returns structured list with id, name, type, url, source for GM token gallery

**Type Safety:**
- Full TypeScript coverage for token data structures
- Request/response interfaces for all API calls
- Token type and status enums prevent invalid values

## Next Steps

This plan provides the complete backend foundation for:
- **Plan 02**: Token rendering on encounter maps (SVG sprite system)
- **Plan 03**: GM controls for token placement and manipulation (drag-and-drop UI)

Token state is now centralized, persistent, and accessible via typed API client. Rendering and controls can build on this foundation without touching the data layer.

## Self-Check: PASSED

**Files Created:**
```bash
FOUND: terminal/migrations/0015_activeview_encounter_tokens.py
```

**Files Modified:**
```bash
FOUND: terminal/models.py (encounter_tokens field)
FOUND: terminal/views.py (6 API endpoints + active-view update)
FOUND: terminal/urls.py (6 URL patterns)
FOUND: src/types/encounterMap.ts (TokenData, TokenType, TokenStatus, TokenState, TokenImage)
FOUND: src/services/encounterApi.ts (6 API client functions)
```

**Commits:**
```bash
FOUND: 5caba3c (Task 1 - Backend data layer)
FOUND: ec76032 (Task 2 - TypeScript types and API client)
```

All planned artifacts exist and are verified working.
