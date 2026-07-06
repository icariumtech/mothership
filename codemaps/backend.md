# Backend Architecture

**Last Updated**: 2026-07-02

## Django Project Structure

```
config/                     # Django project
├── settings.py             # Config (DATA_DIR, LocMemCache, workers=1 constraint noted)
└── urls.py                 # Includes core.urls at root; DEBUG-only static/data serving

core/                       # Main (only) Django app
├── models.py               # Message ORM model only (52 lines, largely vestigial)
├── urls.py                 # ONE flat urlpatterns list (~75 routes). ORDER MATTERS:
│                           #   fixed /api/gm/data/... paths must precede <path:filepath>
├── active_view_store.py    # ★ Runtime view state: threadsafe module-level dict,
│                           #   persisted to var/active_view.json (atomic tmp+os.replace).
│                           #   NOT in the DB. Survives gunicorn max_requests recycles.
├── payload_builder.py      # Builds enriched SSE payload from raw state.
│                           #   Caches NPCs + ship deckplan (30s TTL).
│                           #   invalidate_stable_cache() is called via
│                           #   gm_data._announce_data_changed() on data edits.
├── sse_broadcaster.py      # SSE fan-out singleton (per-process listener queues)
├── encounter_state.py      # Centralized get→copy→mutate→sync for encounter dicts
├── encounter_utils.py      # normalize_deck_poi etc.
├── data_loader.py          # YAML/MD loader (see below)
├── janus_controller.py     # JANUS orchestration (submit_query / gm_generate)
├── janus_ai.py             # Claude API wrapper; per-location instance cache
├── janus_session.py        # Conversations + pending-approval queue (LocMemCache, 4h TTL)
├── janus_knowledge.py      # Lore/context loader (data/janus/context.yaml + janus.yaml)
├── views/                  # Function-based views (no DRF), JsonResponse
│   ├── __init__.py         # Barrel re-exporting all view names (urls.py uses views.*)
│   ├── helpers.py          # ★ @post_only / @post_json decorators — POST guard +
│   │                       #   JSON body parse. @post_json passes parsed body as 2nd
│   │                       #   arg: def view(request, data, ...). Use for new endpoints.
│   ├── active_view.py      # sync_state() = THE choke point: update store → build
│   │                       #   payload → broadcast. Also SSE stream endpoint +
│   │                       #   invalidate_payload_cache().
│   ├── navigation.py       # View switching, overlays, bridge selection
│   ├── encounter.py        # Room/door/vent/token/portrait endpoints
│   ├── ship.py             # Ship status endpoints; _broadcast_ship_status() helper
│   ├── janus.py            # Classic + per-<channel> JANUS endpoints (duplicated pairs)
│   ├── campaign.py         # Crew/NPC/sessions/docs, data-file serving
│   ├── gm_data_files.py    # AI-agent file CRUD (list/read/write/patch/delete/
│   │                       #   rename/list-append) + shared helpers: safe_write_yaml,
│   │                       #   _announce_data_changed (invalidates payload+janus
│   │                       #   caches then broadcasts data-changed), _deep_merge
│   ├── gm_data_mapedit.py  # Deckplan element resolver (_resolve_map_element:
│   │                       #   exact→slug→glob→prefix→fuzzy) + surgical set/add_poi/
│   │                       #   remove_poi edits. Imports helpers from gm_data_files.
│   ├── gm_data_uploads.py  # SVG deckplan upload (runs tools/svg_to_map.py) +
│   │                       #   image upload (portrait/logo/map/misc)
│   ├── maps.py             # Star/system/orbit map JSON
│   └── display.py          # HTML shell template views
└── tests/                  # Django TestCase package (test_gm_api, test_data_loader,
                            #   test_upload_image). Run: python manage.py test core

mcp_server.py (root)        # FastMCP process; tools are httpx proxies to /api/gm/...
                            #   Unauthenticated by design (trust-network model, D-09)
```

## State Model — IMPORTANT

There is no ActiveView DB model. Runtime view state lives in
`core/active_view_store.py` (module dict + JSON file at `var/active_view.json`).
The only ORM model is `Message`. All campaign content is file-based YAML/Markdown
under `data/` loaded through `DataLoader`.

State keys (see `_DEFAULT_STATE` in active_view_store.py): `view_type`,
`location_slug`, `view_slug`, `bridge_tab/map_mode/label`, `overlay_*_slug`,
`janus_mode/location_path/dialog_open/active_channel`, `encounter_level/deck_id/
room_visibility/door_status/vents_visible/tokens_by_location/active_portraits`.

**Mutation pattern**: never write the store directly from views — call
`sync_state(**kwargs)` (views/active_view.py) or the wrappers in
`encounter_state.py`. This persists + broadcasts in one step.

## DataLoader (`core/data_loader.py`)

Facade over `_TerminalReader` (comms/messages) and `_CampaignReader`
(crew/NPCs/sessions/docs); DataLoader delegates via thin wrappers.
`get_loader()` memoizes a single instance; methods re-read disk on every call
(no result caching — PayloadBuilder caches one layer up).

Key methods:
- `load_all_locations()` — walks data/galaxy/ recursively, injects ships from
  data/ships/ and campaign ship. ⚠ Called by `find_location_by_slug`,
  `get_location_path`, `load_orbit_map` — each call re-walks the tree.
- `load_deckplan(location_dir)` — reads `deckplan.yaml` (single file per
  location; the legacy `map/` + manifest format is gone).
- `load_star_map()` / `load_system_map(slug)` / `load_orbit_map(sys, body)`
- `load_ship_status()` / `save_ship_*` — ship.yaml read/write. Writes go
  through `_mutate_ship_yaml()`: module lock + atomic tmp-file replace.
- Terminals: `load_terminals`, `load_terminal`, message filtering by owner.

## SSE / Real-time Flow

```
GM action → view → sync_state()/encounter_state helper
  → active_view_store.update_state() (persist to var/)
  → PayloadBuilder.build(state)  (enrich: NPCs, deckplan, location)
  → sse_broadcaster.announce()   (event: activeview)
Client: useSSE hook listens for 'activeview', 'shipstatus', 'data-changed'
```

Data-file edits (gm_data write/patch/delete/rename/list-append/map-edit/svg-upload)
go through `_announce_data_changed()`, which invalidates PayloadBuilder + JanusAI
caches and emits `data-changed`.

**Scaling constraint**: SSE listeners, JANUS conversations, and pending approvals
are per-process in-memory — deployment is pinned to gunicorn `workers=1`.

## View Conventions

- JSON POST endpoint: decorate with `@post_json` (from `views/helpers.py`),
  signature `def view(request, data)`. POST-without-body: `@post_only`.
  Both return the standard `{'error': ...}` JSON shapes (405/400).
- Auth: `@login_required` for GM endpoints (outermost decorator); player-facing
  endpoints are public and often `@csrf_exempt` (players are unauthenticated).
- Broadcast failures must never fail the request (wrap or use provided helpers).

## JANUS AI Pipeline

```
views/janus.py → JanusController → JanusSessionManager (LocMemCache convos)
                                 → JanusAI (Claude API; per-location cache)
                                 → JanusKnowledgeLoader (context.yaml + janus.yaml)
```

- Human-in-the-loop: AI output lands in a pending queue; GM must approve/reject
  before players see it.
- Channels: `story`, `bridge`, `encounter-<location_slug>`; classic (no-channel)
  endpoint variants still exist alongside `<channel>` ones.
- Model id is hard-coded at `janus_ai.py:148`; no `ANTHROPIC_API_KEY` in env →
  degrades to configured `fallback_responses`.

## URL Map (high-value routes; see core/urls.py for all ~75)

```
/                    shared terminal (players)     /gmconsole/   GM console
/api/active-view/    current state (GET, public)
/api/active-view/stream/  SSE stream (public)
/api/ship-status/    ship.yaml JSON (public)
/api/gm/data/...     AI-agent file CRUD (list/read/write/patch/rename/
                     list-append/map-edit/upload-svg-map/upload-image)
/api/gm/janus/<channel>/{send,pending,approve,reject,generate,clear,mark-read}/
/api/janus/<channel>/{conversation,submit}/       (public, csrf_exempt)
/api/gm/encounter/...  room/door/vent/token/portrait mutations
```

## Testing

`python manage.py test core` — 63 tests. Coverage is concentrated on the
gm_data file API; the JANUS pipeline, encounter_state, payload_builder,
active_view_store, sse_broadcaster and ship endpoints have no tests yet.
Some data_loader tests skip when sample ship data is absent.
