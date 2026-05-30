"""
Shared encounter-map utilities used by both the encounter API view and
the SSE payload builder.
"""


def normalize_deck_poi(deck: dict) -> dict:
    """
    Flatten room-level POI entries into the top-level `poi` list.

    Room-level format (supported):
      rooms:
        - id: airlock
          poi:
            - icon: airlock
              label: "Tender Dock"
              type: item          # optional, default 'item'
              position: {x, y}   # optional, default room center

    Full top-level format still works unchanged.
    Generated IDs use pattern: {room_id}_poi_{index}
    """
    if not deck or not isinstance(deck.get('rooms'), list):
        return deck

    top_poi = list(deck.get('poi') or [])
    existing_ids = {p.get('id') for p in top_poi if p.get('id')}

    for room in deck['rooms']:
        room_poi = room.get('poi')
        if not room_poi:
            continue

        # Compute room center from rects (fallback to circle center or 0,0)
        rects = room.get('rects') or []
        if rects:
            cx = sum(r['x'] + r['w'] / 2 for r in rects) / len(rects)
            cy = sum(r['y'] + r['h'] / 2 for r in rects) / len(rects)
        elif room.get('circle'):
            cx, cy = room['circle']['cx'], room['circle']['cy']
        elif room.get('polygon'):
            pts = room['polygon']
            cx = sum(p[0] for p in pts) / len(pts)
            cy = sum(p[1] for p in pts) / len(pts)
        else:
            cx, cy = 0, 0

        for idx, entry in enumerate(room_poi):
            # Skip if this looks like a fully-specified top-level POI already merged
            if entry.get('room') and entry.get('id') in existing_ids:
                continue
            poi_id = entry.get('id') or f"{room['id']}_poi_{idx}"
            pos = entry.get('position') or {'x': cx, 'y': cy}
            top_poi.append({
                'id': poi_id,
                'type': entry.get('type', 'item'),
                'room': room['id'],
                'position': pos,
                'name': entry.get('label') or entry.get('name') or entry.get('icon', 'POI'),
                'icon': entry.get('icon', ''),
                'status': entry.get('status'),
                'description': entry.get('description'),
            })

    deck = dict(deck)
    deck['poi'] = top_poi
    return deck
