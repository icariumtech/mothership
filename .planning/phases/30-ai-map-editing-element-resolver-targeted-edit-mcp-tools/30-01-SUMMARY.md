# 30-01 Summary — Backend resolver + map-edit endpoint

**Status:** Complete. 43 tests pass (19 new), `manage.py check` clean.

## What was built
- `core/views/gm_data.py`:
  - `_slugify`, `_derive_door_id`, `_index_map_elements`, `_resolve_map_element`, `_public_element`.
  - `api_gm_data_map_edit(request, filepath)` — `GET ?q=` resolves (read-only); `POST` applies
    exactly one of `set` (deep-merge), `add_poi` (append to room), `remove_poi` (label or index).
    404+suggestions on no match, 409+candidates (no write) on ambiguity, atomic write + `data-changed` SSE.
- `core/urls.py`: `api/gm/data-map-edit/<path:filepath>` registered before the `data/<path>` catch-all.
- `core/views/__init__.py`: export `api_gm_data_map_edit`.
- `core/tests/test_gm_api.py`: `MapEditResolverTests` (7) + `MapEditApiTests` (12).

## Deviations from plan
- **Door ids are derived, not authored.** `svg_to_map.py` emits doors with no `id`; the canonical id
  comes from the frontend `doorNormalizer.deriveId` as `<roomA>__<roomB|exterior>__<index>` and is what
  door-status keys on. So `_derive_door_id` replicates that exactly instead of reading `door['id']`.
  An explicit authored `id` (if ever present) still wins.
- **Door label collision fix.** A door's label is just its connected room name(s), which collided
  with the room itself ("Mess Hall" matched both the room and its exterior door). Resolver now applies
  label-based matching to rooms/corridors only; doors are matched by id. (Covered by
  `test_room_name_does_not_match_its_door`.)
- Resolver added a **prefix** strategy (between glob and fuzzy) for ergonomics; not in the original list.

## Notes
- Like the existing PATCH endpoint, a successful write re-serializes via `yaml.dump` (block style);
  authored comments / flow-style door lines are not preserved. Documented in the endpoint docstring.
