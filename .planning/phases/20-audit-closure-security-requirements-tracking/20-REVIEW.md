---
phase: 20-audit-closure-security-requirements-tracking
reviewed: 2026-05-07T00:00:00Z
depth: standard
files_reviewed: 2
files_reviewed_list:
  - terminal/views.py
  - src/services/encounterApi.ts
findings:
  critical: 4
  warning: 5
  info: 1
  total: 10
status: issues_found
---

# Phase 20: Code Review Report

**Reviewed:** 2026-05-07
**Depth:** standard
**Files Reviewed:** 2
**Status:** issues_found

## Summary

`terminal/views.py` (2,637 lines) contains all Django view/API logic. `src/services/encounterApi.ts` (259 lines) is the TypeScript client that calls those endpoints.

The most severe finding is a guaranteed runtime crash in `api_ship_reactor_power` due to a reference to an undefined variable. Four endpoints under `/api/gm/` URL paths that should be GM-only are decorated `@csrf_exempt` but carry no `@login_required`, allowing unauthenticated callers to mutate server state. These are the primary blockers.

---

## Critical Issues

### CR-01: `api_ship_reactor_power` references undefined variable `power_grid` — guaranteed NameError crash

**File:** `terminal/views.py:2154`
**Issue:** The function builds and saves a power allocation, then returns `JsonResponse({'success': True, 'power_grid': power_grid})`. The variable `power_grid` is never assigned anywhere in the function. Every successful call to `POST /api/ship/reactor/power/` raises `NameError: name 'power_grid' is not defined`, returning a 500 to the caller.

**Fix:**
```python
# After loader.save_system_power(system_name, amount), reload ship data
ship_broadcast_data = loader.load_ship_status()
power_grid = {
    k: (v.get('power') or {}).get('allocated', 0)
    for k, v in (ship_broadcast_data or {}).get('systems', {}).items()
    if k != 'reactor'
}
return JsonResponse({'success': True, 'power_grid': power_grid})
```

---

### CR-02: Encounter token endpoints under `/api/gm/` have no authentication — unauthenticated writes accepted

**File:** `terminal/views.py:1300-1532`
**Issue:** Five mutating endpoints are decorated `@csrf_exempt` with no `@login_required`:
- `api_encounter_place_token` (line 1300)
- `api_encounter_move_token` (line 1371)
- `api_encounter_remove_token` (line 1423)
- `api_encounter_update_token_status` (line 1464)
- `api_encounter_clear_tokens` (line 1511)

All five are registered under `/api/gm/encounter/` URLs (urls.py lines 63–67), which by naming convention should be GM-only. But there is no authentication check on any of them. Any unauthenticated network request can place, move, delete, and clear all encounter tokens, disrupting the live game session.

The comment pattern elsewhere (e.g. `api_hide_terminal`, `api_bridge_selection`) documents intentional public access with explicit rationale. These five endpoints have no such documentation and no justification for unauthenticated access.

**Fix:** Add `@login_required` to all five, stacking with `@csrf_exempt`:
```python
@csrf_exempt
@login_required
def api_encounter_place_token(request):
    ...
```
Apply the same pattern to `move_token`, `remove_token`, `update_token_status`, and `clear_tokens`. Note: `@login_required` on a CSRF-exempt view still enforces authentication; the two decorators are independent.

---

### CR-03: `api_ship_update_stat` has no authentication — unauthenticated writes to `ship.yaml`

**File:** `terminal/views.py:1958-1993`
**Issue:** `api_ship_update_stat` is `@csrf_exempt` with no `@login_required`. It is registered at `api/gm/ship-status/stat/` (urls.py line 21). It accepts `{ stat, value }` and writes directly to `ship.yaml` via `loader.save_ship_stat(stat, value)`. Any unauthenticated caller can silently overwrite the thrusters, battle, or systems stat values that are displayed to all players.

**Fix:**
```python
@csrf_exempt
@login_required
def api_ship_update_stat(request):
    ...
```

---

### CR-04: `api_encounter_token_images` has no authentication

**File:** `terminal/views.py:1574-1625`
**Issue:** `api_encounter_token_images` is `@csrf_exempt` with no `@login_required`. Registered at `/api/gm/encounter/token-images/` (urls.py line 69). It reads NPC portrait filenames and crew portrait paths from the campaign data directory and returns them, including loose image filenames from the NPC images directory. While it does not write data, it exposes the full portrait and crew roster inventory to unauthenticated callers. If this is intentionally public (players could need it), it should be documented explicitly; if it is GM-only, it needs `@login_required`.

**Fix (if GM-only intent):**
```python
@login_required
def api_encounter_token_images(request):
    ...
```
Remove `@csrf_exempt` if the intent is to add authentication, since only GM sessions (with Django session cookies) call this endpoint.

---

## Warnings

### WR-01: `api_ship_toggle_system` passes `int()` cast without guarding against ValueError

**File:** `terminal/views.py:1853`
**Issue:** `fields['condition'] = int(data['condition'])` has no exception handling. If the caller sends `"condition": "abc"` or `"condition": null`, this raises `ValueError`/`TypeError` and returns an unhandled 500. The same pattern appears at line 1933 (`api_ship_update_integrity`) and line 1898 (`api_ship_update_fault`).

**Fix:**
```python
if 'condition' in data:
    try:
        fields['condition'] = int(data['condition'])
    except (ValueError, TypeError):
        return JsonResponse({'error': 'condition must be an integer'}, status=400)
```

---

### WR-02: `api_broadcast` accepts unvalidated `priority` field written directly to the database

**File:** `terminal/views.py:820`
**Issue:** `priority=data.get('priority', 'NORMAL')` passes caller-controlled input directly to `Message.objects.create(priority=...)`. There is no whitelist check against valid priority values. If the `priority` field is a `CharField` with `choices`, the Django model layer may silently accept invalid values (it does not enforce `choices` at the DB level). This allows a logged-in user to write arbitrary strings into the `priority` column.

**Fix:**
```python
VALID_PRIORITIES = ('NORMAL', 'HIGH', 'CRITICAL', 'SYSTEM')
priority = data.get('priority', 'NORMAL')
if priority not in VALID_PRIORITIES:
    return JsonResponse({'error': f'Invalid priority. Must be one of: {", ".join(VALID_PRIORITIES)}'}, status=400)
message = Message.objects.create(
    sender=data.get('sender', 'JANUS'),
    content=content,
    priority=priority,
    created_by=request.user
)
```

---

### WR-03: `api_janus_channel_conversation` and `api_janus_channel_submit` accept arbitrary channel names without validation

**File:** `terminal/views.py:2318-2382`
**Issue:** Both `@csrf_exempt` public endpoints accept `channel` as a URL path parameter (`<str:channel>`) and pass it without any length check or character validation to `JanusSessionManager.get_conversation(channel)` and `add_message(..., channel)`. An attacker can create arbitrarily named channels (e.g. path-traversal-style strings like `../../admin`) in the in-memory session store, polluting the channel list returned by the GM endpoint and potentially causing unexpected behavior in downstream `startswith('encounter-')` logic in `api_janus_channel_generate`.

**Fix:** Validate the channel name against an allowlist pattern before use:
```python
import re
VALID_CHANNEL_RE = re.compile(r'^[a-zA-Z0-9_-]{1,64}$')

def api_janus_channel_conversation(request, channel):
    if not VALID_CHANNEL_RE.match(channel):
        return JsonResponse({'error': 'Invalid channel name'}, status=400)
    ...
```

---

### WR-04: `api_ship_reactor_power` calls private `_save_ship_yaml` directly from view code

**File:** `terminal/views.py:2193`
**Issue:** The `emergency_shutdown` branch calls `loader._save_ship_yaml(ship_data)` directly, bypassing the public save helper API (`save_ship_system`, `save_ship_stat`, etc.). This couples the view to internal DataLoader implementation details and may bypass any future validation or hook logic added to the public save methods.

**Fix:** Refactor the `emergency_shutdown` logic into a dedicated `DataLoader` method such as `loader.execute_emergency_shutdown()` that handles the atomic multi-field update internally and exposes a clean public interface.

---

### WR-05: Dead code in `encounterApi.ts` suppressed by `void` expression rather than removed

**File:** `src/services/encounterApi.ts:254-258`
**Issue:** `getRoomVisibility` is defined (lines 107-110) but intentionally omitted from the `encounterApi` export object. The comment explains a "D-03" decision not to expose it. Rather than removing the function, the code uses `void getRoomVisibility` to silence the TypeScript TS6133 "declared but never read" error. This is dead code that will mislead future maintainers about what the exported API surface is.

**Fix:** Remove the `getRoomVisibility` function entirely if it is not needed. If it may be needed in the future, the appropriate action is to track that intent in a comment on the `encounterApi` export object, not to retain a dead function and suppress the compiler warning:
```typescript
// Removed: getRoomVisibility — endpoint exists but intentionally not in public API surface.
// Re-expose if needed: GET /gm/encounter/room-visibility/
```

---

## Info

### IN-01: `logout_view` handles GET without CSRF protection (minor)

**File:** `terminal/views.py:64-73`
**Issue:** `logout_view` accepts GET requests and renders a confirmation page, which is the correct pattern. However, it does not use `@login_required` — a GET to `/logout/` by an unauthenticated user renders the logout confirmation template. This is a cosmetic issue (the template likely just shows a "you're already logged out" state), but it is inconsistent with the rest of the authenticated views.

**Fix:** Add `@login_required` to `logout_view`, or explicitly return a redirect if the user is not authenticated. This removes the anonymous GET rendering path.

---

_Reviewed: 2026-05-07_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
