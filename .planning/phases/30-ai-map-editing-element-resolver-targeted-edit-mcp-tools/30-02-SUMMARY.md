# 30-02 Summary — Stable element ids (svg_to_map)

**Status:** Closed as **already satisfied / descoped** — no code change needed.

## Findings
- **Rooms/corridors already get unique slug ids.** `tools/svg_to_map.py` has `to_snake` (slugify) +
  `_unique_id` (deterministic numeric suffix on collision), applied to rooms (`to_snake(label)`) and
  corridors (`to_snake(label)` or `corridor_N`). Two rooms labelled "Coolant Tanks" already become
  `coolant_tanks` / `coolant_tanks_2`. Requirement E-06 for rooms/corridors: met by existing code.
- **Doors should NOT carry authored ids.** `svg_to_map` deliberately emits doors with no `id`; the
  canonical door id is derived downstream by `doorNormalizer.deriveId` as
  `<roomA>__<roomB|exterior>__<index>`, and that derived id is what door-status persistence and the
  renderer key on. Writing explicit door ids into the YAML would risk **diverging** from `deriveId`
  and could break door-status. So the planned door-id writing was **dropped** as counterproductive.

## Outcome
- The resolver in 30-01 replicates `deriveId` (`_derive_door_id`) so doors are addressable by their
  canonical id without changing the file format. E-06 is satisfied without touching `svg_to_map.py`.
- No regeneration of live maps required; door ids stay consistent with the rest of the app.
