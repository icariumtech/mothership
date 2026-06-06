# 30-03 Summary — MCP tools + schema docs

**Status:** Complete. `mcp_server.py` parses; schema doc updated.

## What was built
- `mcp_server.py`:
  - `find_map_element(deckplan, query)` — GET `?q=` to the resolver; returns candidates + strategy.
  - `edit_map_element(deckplan, target, set?, add_poi?, remove_poi?)` — POSTs the chosen op; omits
    None fields; on 404/409 returns the body (suggestions/candidates) instead of raising, so the AI
    can ask the GM which element. Docstrings state the one-op rule and steer away from whole-file rewrites.
- `docs/schemas/schema-encounters.md` (canonical; auto-syncs to janus-skills): new "Editing a single
  element" subsection with worked examples + pitfall **P-edit** (don't read_file+write_file for one element)
  and the id conventions (room slugs, `<roomA>__<roomB>__<index>` doors).

## Deviations
- Backend exposes resolution as `GET ?q=` on the same `data-map-edit` endpoint (not a separate route);
  `find_map_element` wraps that. Matches the "Claude's discretion" note in 30-CONTEXT D-06.

## Follow-ups (optional, not blocking)
- The janus-skills repo skill `janus-player-ship` / any map skill could mention `edit_map_element`;
  the schema doc (synced automatically) already covers it.
- Live end-to-end check with the MCP server running against a real deckplan (tests cover the HTTP layer).
