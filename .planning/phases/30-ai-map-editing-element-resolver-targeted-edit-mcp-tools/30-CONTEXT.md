# Phase 30: AI Map Editing — Element Resolver + Targeted Edit MCP Tools — Context

**Gathered:** 2026-06-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Give the JANUS AI (MCP server) the ability to edit **one element inside a deckplan** — a
room, corridor, or door — and to add/remove POIs, **without reading or rewriting the whole
`deckplan.yaml`**. Today the only path is `read_file` → mutate the full document → `write_file`,
which burns tokens proportional to the entire map for a one-field change. This phase closes
that gap with a server-side targeted-edit endpoint plus two MCP tools.

The work is **backend + MCP tooling only**. No frontend. It is independently valuable for
AI-driven editing and also lays the data/resolution layer that a future GUI editor (Phase 29)
can reuse.

**In scope:**
- A read-only **resolver** that turns a natural reference ("mess hall", "coolant_tanks", a glob)
  into a concrete element id, or a candidate list when ambiguous.
- A **targeted edit endpoint** that applies field merges and POI list mutations to a single
  resolved element, atomically, with a `data-changed` SSE broadcast.
- Two MCP tools wrapping the above: `find_map_element`, `edit_map_element`.
- Deterministic, human-readable element ids from `svg_to_map.py` (rooms, corridors, doors).
- Schema + skill documentation so the AI prefers these tools over read/modify/write.

**Out of scope:**
- Any GUI / interactive editor / live preview (that is Phase 29).
- Legacy `map/manifest.yaml` multi-file format — new single-file `deckplan.yaml` only.
- Editing non-map YAML (campaign, ships) — `patch_yaml` / `append_list_item` already cover those.
- Creating or deleting whole decks; geometry editing (moving room vertices). Field edits + POIs only.

</domain>

<requirements>
Phase-local requirement ids (E = element editing):

| ID | Requirement |
|----|-------------|
| E-01 | The AI can resolve a natural map reference to a single element id (exact id, slugified label, glob/prefix, or fuzzy match). |
| E-02 | An ambiguous reference returns the candidate ids **with their labels**, so the AI can stop and ask the GM which one. |
| E-03 | The AI can edit an element's scalar/mapping fields (e.g. `description`, `label_offset`, `status`) by sending only the changed fields — no whole-file read. |
| E-04 | The AI can add a POI to a named room without resending that room's existing POIs. |
| E-05 | The AI can remove a POI from a room by label or by index. |
| E-06 | Every room, corridor, and door emitted by `svg_to_map.py` has a stable, human-readable, file-unique id. |
| E-07 | Every successful edit writes atomically and fires a `data-changed` SSE broadcast (same contract as the existing data endpoints). |
</requirements>

<decisions>
## Design Decisions (agreed in discussion 2026-06-06)

### D-01: Two tools — a read-only resolver and a mutating editor
- `find_map_element(deckplan, query)` → returns `[{id, kind, label, deck}]`. Read-only, tiny payload.
- `edit_map_element(deckplan, target, set?, add_poi?, remove_poi?)` → mutates one element.
- The editor **also** runs resolution on `target`: if it resolves to exactly one element it proceeds;
  if it is ambiguous it returns the candidates (HTTP 409) and makes no change. This means the common
  unambiguous case is a single round-trip, while ambiguity (the "coolant_tanks vs coolant_tanks_2"
  case) correctly forces a question.

### D-02: Hybrid edit semantics — merge for fields, explicit verbs for lists
- `set` = JSON-merge-patch the element's fields (deep merge; reuses `_deep_merge`). Open-ended:
  works for any current or future scalar/mapping field without a new verb.
- List mutations get **named verbs** because JSON merge patch replaces lists wholesale (the exact
  token waste we are eliminating): `add_poi` (append), `remove_poi` (by label or index).
- Rationale: the alternative, generic RFC-6902 JSON Patch, addresses by **position**
  (`/decks/0/rooms/3/poi/-`), which would force the AI to read the file to learn the index —
  reintroducing the waste. Domain verbs ride on top of the resolver instead.

### D-03: Resolution strategy (in priority order)
1. **Exact id** match (`mess_hall`, `command_center_door_0`).
2. **Slugified label** — lowercase the room `name`, spaces → `_` ("Mess Hall" → `mess_hall`).
3. **Glob / prefix** — `coolant_tanks*` matches `coolant_tanks` and `coolant_tanks_2`.
4. **Fuzzy** (difflib close-match) as a last resort.
- One match → resolved. Zero → 404 with the closest suggestions. >1 → 409 with all candidates + labels.
- Resolution searches **all decks** in the file; element ids are file-unique, so the GM never
  needs to name a deck.

### D-04: POI addressing
- POIs have **no authored id** (the backend generates it from the parent room). So POIs are not
  resolver targets — they are always reached **through** their room: `add_poi(target="mess_hall", …)`.
- `remove_poi` accepts either the POI `label` (preferred, human-friendly) or a 0-based index.

### D-05: Stable element ids from `svg_to_map.py`
- Rooms/corridors already get slug ids from their layer labels (`command_center`, `main_corridor`).
  This phase guarantees uniqueness (numeric suffix on collision: `coolant_tanks`, `coolant_tanks_2`)
  and documents the convention.
- Doors already get `<roomA>_door_<N>`. Improve readability to encode **both** connected rooms
  where unambiguous (`executive_office__main_corridor`), keeping deterministic ordering so ids do
  not churn on re-export. Single-room (exterior) doors keep `<room>_door_<N>`.

### D-06: Reuse existing infrastructure
- New endpoint lives beside the others in `core/views/gm_data.py`; reuses `_deep_merge`,
  `safe_write_yaml`, and `broadcaster.announce_generic('data-changed', …)`.
- URL route registered **before** the `api/gm/data/<path:filepath>` catch-all (see existing note
  in `core/urls.py`).

### Claude's Discretion
- Exact fuzzy threshold and how many candidates to return (suggest cap at ~8).
- Endpoint verb/shape (`PATCH /api/gm/data-map-edit/<path>` vs `POST`) — pick what reads cleanly.
- Whether `find_map_element` is its own endpoint or a `?resolve=` mode on the edit endpoint.
- Door double-room id format details and tie-breaking when a pair shares multiple edges.
</decisions>

<deckplan_structure>
## Reference: deckplan.yaml shape (verified against data/)

```yaml
name: Base Alpha
decks:
  - id: deck_1
    level: 1
    default: true
    unit_size: 30
    rooms:                      # rooms AND corridors live here together
      - id: command_center      # room: meaningful slug id
        name: Command Center
        type: bridge
        poi:                    # optional list, addressed via the room
          - {icon: reactor core, label: Reactor, position: {x: 2, y: 3}}
      - id: main_corridor        # corridor: type: corridor, name often ""
        type: corridor
    doors:                      # top-level on the deck; already have ids
      - {id: command_center_door_0, rooms: [command_center, main_corridor], status: CLOSED}
      - {id: command_center_door_1, rooms: [command_center], status: OPEN}   # exterior
```

Resolver traversal: for each deck → scan `rooms[]` (kind=room/corridor by `type`) and `doors[]`
(kind=door) → match `id` / slug(name) / glob / fuzzy.
</deckplan_structure>
