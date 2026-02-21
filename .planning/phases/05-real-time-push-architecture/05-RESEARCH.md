# Phase 5: Real-Time Push Architecture - Research

**Researched:** 2026-02-21
**Domain:** Server-Sent Events (SSE), Django StreamingHttpResponse, In-Memory State, Frontend EventSource API
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- SSE covers ActiveView state only — messages (/api/messages/) keep their current polling behavior
- Write operations (POST endpoints for set-active-view, toggle-token, toggle-portrait, etc.) stay as REST calls — only the subscribe/read path uses SSE
- Silent auto-reconnect: On disconnect, both clients attempt to reconnect silently in the background
- Warning after repeated failures: If reconnect fails beyond a threshold, show a small toast/banner at the top of the screen ("Connection lost — retrying...") — applies to both GM console and player terminal
- Re-fetch on reconnect: When SSE reconnects successfully, the client immediately fetches full current state (via REST or SSE initial event) to catch any missed updates
- Asymmetric tolerance: Player terminal is more tolerant — waits longer before showing the failure warning. GM console surfaces the warning sooner since the GM needs to know immediately.
- Auto-dismiss toast: When SSE reconnects, the warning toast auto-dismisses — no manual close required
- No persistent connection indicator (no always-on dot/badge)
- Warning appears only on failure (toast at top of screen)
- Both GM console and player terminal show the warning (player terminal just has a longer delay before showing it)
- In-memory only — no persistence, no file write, no cache framework
- Server restart clears state and resets to STANDBY — GM re-navigates to current encounter
- Remove polling loops from all clients (SharedConsole, GMConsole terminal) — full replacement, not coexistence
- Write endpoints are unaffected — still REST POST

### Claude's Discretion
- In-memory store implementation (module singleton vs Django cache locmem)
- ActiveView DB model removal strategy (drop table or tombstone)
- Initial state delivery on SSE connect (first SSE event vs separate REST call)
- SSE event structure and field names
- Exact reconnect retry timing and thresholds

### Deferred Ideas (OUT OF SCOPE)
- None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| RTMA-01 | Server-Sent Events replace 2-second polling for terminal state updates | Django StreamingHttpResponse with sync generator pattern; EventSource API on frontend |
| RTMA-02 | ActiveView ephemeral state moved out of SQLite (in-memory or cache-backed) | Module-level singleton dict pattern; migration to drop ActiveView table |
| RTMA-03 | Messages remain in SQLite as persistent data | No change to Message model or polling; confirmed by reading existing code |
| RTMA-04 | Database retained and prepared for future auth/credentials use | Drop only ActiveView table; keep SQLite db file and Message model intact |
</phase_requirements>

---

## Summary

Phase 5 replaces the 2-second polling loop with Server-Sent Events (SSE) so the player terminal (`SharedConsole`) and GM console receive ActiveView state pushes instantly. This eliminates the worst-case 2-second lag during token moves and portrait reveals — the two highest-latency-sensitive operations identified in CONTEXT.md.

The implementation has three parts: (1) a server-side SSE endpoint using Django's `StreamingHttpResponse` with a module-level pub/sub broadcaster, (2) migrating `ActiveView` state from SQLite into a Python module singleton (in-memory dict), and (3) replacing the `setInterval` polling loops in `SharedConsole.tsx` and `GMConsole.tsx` with `EventSource` connections that use silent reconnect with asymmetric failure thresholds.

The project runs as a single Django dev server (WSGI, threaded mode), which makes this straightforward: no Redis, no Channels, no multi-process fan-out. Django's default `runserver` runs in threaded mode (`--nothreading` disables it), so a `queue.Queue`-per-listener pattern safely broadcasts to all connected clients from a single process.

**Primary recommendation:** Module singleton `MessageAnnouncer` with per-listener `queue.Queue`; `StreamingHttpResponse` with sync generator; `EventSource` on frontend with manual reconnect tracking for toast threshold logic.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Django `StreamingHttpResponse` | Built-in (5.2.7) | Server-side SSE endpoint | No additional dependencies; works with WSGI sync generators |
| Python `queue.Queue` | stdlib | Thread-safe per-listener message queue | Thread-safe, no dependencies, works in single-process WSGI |
| Python `threading` | stdlib | Lock for listener list mutations | Ensures safe add/remove of listeners during broadcast |
| Browser `EventSource` | Web API | Client SSE subscription | Native API, handles reconnect protocol automatically |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `json` | stdlib | Serialize ActiveView state for SSE payload | Every event; keeps event data self-contained |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Module singleton | Django `cache.locmem` | cache backend is already file-based in this project (`FileBasedCache`), making it unsuitable for in-memory pub-sub signaling; module singleton is simpler and correct for single-process |
| Module singleton | Django Channels / Redis | Overkill; the system is single-process dev server only; no distributed requirement |
| `queue.Queue` broadcaster | `threading.Condition` | Queue is simpler; Condition requires manual notify_all + shared list traversal; Queue handles full-queue cleanup automatically |
| Native `EventSource` | `reconnecting-eventsource` lib | Native EventSource already auto-reconnects; the only addition needed is a failure counter tracked manually in a wrapper; no new library needed |

**No installation required** — all server-side dependencies are stdlib. No new npm packages needed for frontend.

---

## Architecture Patterns

### Recommended Project Structure (new files only)

```
terminal/
├── sse_broadcaster.py     # Module singleton: MessageAnnouncer + format_sse()
├── views.py               # Add: api_active_view_stream() SSE view
├── urls.py                # Add: path('api/active-view/stream/', ...)
└── migrations/
    └── 0017_delete_activeview.py   # Remove ActiveView model

src/
├── hooks/
│   └── useSSE.ts          # Custom hook: EventSource lifecycle + reconnect tracking
├── entries/
│   ├── SharedConsole.tsx  # Replace polling with useSSE
│   └── GMConsole.tsx      # Replace polling with useSSE
└── components/ui/
    └── SSEConnectionToast.tsx  # Toast shown on repeated failures
```

### Pattern 1: Module Singleton Broadcaster (server)

**What:** A module-level `MessageAnnouncer` instance holds a list of `queue.Queue` objects, one per connected SSE client. When ActiveView state changes, every write endpoint calls `broadcaster.announce(data)` to push to all queues simultaneously.

**When to use:** Single-process WSGI servers (Django dev server). Safe because Python's GIL protects dict/list operations and `queue.Queue` is internally thread-safe.

**Example:**
```python
# terminal/sse_broadcaster.py
import queue
import threading
import json

class MessageAnnouncer:
    def __init__(self):
        self.listeners: list[queue.Queue] = []
        self._lock = threading.Lock()

    def listen(self) -> queue.Queue:
        q = queue.Queue(maxsize=5)
        with self._lock:
            self.listeners.append(q)
        return q

    def unlisten(self, q: queue.Queue) -> None:
        with self._lock:
            try:
                self.listeners.remove(q)
            except ValueError:
                pass

    def announce(self, data: dict) -> None:
        msg = format_sse(json.dumps(data))
        with self._lock:
            listeners = list(self.listeners)
        for i in reversed(range(len(listeners))):
            try:
                listeners[i].put_nowait(msg)
            except queue.Full:
                # Listener is not consuming fast enough — remove it
                self.unlisten(listeners[i])

def format_sse(data: str, event: str | None = None) -> str:
    msg = f'data: {data}\n\n'
    if event is not None:
        msg = f'event: {event}\n{msg}'
    return msg

# Module-level singleton — one instance per process
broadcaster = MessageAnnouncer()
```

### Pattern 2: In-Memory ActiveView State Store

**What:** A module-level dict replaces the SQLite `ActiveView` row. All write views mutate this dict directly. The SSE endpoint reads from it for the initial event on connect. The `ActiveView` Django model and its database table are removed entirely.

**When to use:** Replacing any singleton database row used purely for ephemeral runtime state.

**Example:**
```python
# terminal/active_view_store.py
import threading

_lock = threading.Lock()

_state: dict = {
    'view_type': 'STANDBY',
    'location_slug': '',
    'view_slug': '',
    'overlay_location_slug': '',
    'overlay_terminal_slug': '',
    'charon_mode': 'DISPLAY',
    'charon_location_path': '',
    'charon_dialog_open': False,
    'charon_active_channel': 'story',
    'encounter_level': 1,
    'encounter_deck_id': '',
    'encounter_room_visibility': {},
    'encounter_door_status': {},
    'encounter_tokens': {},
    'encounter_active_portraits': [],
    'ship_system_overrides': {},
}

def get_state() -> dict:
    with _lock:
        return dict(_state)

def update_state(**kwargs) -> dict:
    with _lock:
        _state.update(kwargs)
        return dict(_state)
```

### Pattern 3: SSE Streaming View (server)

**What:** A Django view that returns a `StreamingHttpResponse` with a sync generator. The generator blocks on `queue.Queue.get()` until a message arrives. On client disconnect, the generator exits and the listener is cleaned up.

**When to use:** Any SSE endpoint in a WSGI Django app.

**Example:**
```python
# In terminal/views.py
from terminal.sse_broadcaster import broadcaster, format_sse
from terminal.active_view_store import get_state
import json

def api_active_view_stream(request):
    def event_stream():
        # Send initial state immediately on connect
        initial = get_state()
        # Build the full enriched payload (same as current get_active_view_json logic)
        payload = build_active_view_payload(initial)
        yield format_sse(json.dumps(payload), event='activeview')

        # Register as listener and stream subsequent events
        q = broadcaster.listen()
        try:
            while True:
                try:
                    msg = q.get(timeout=30)  # timeout sends keepalive
                    yield msg
                except queue.Empty:
                    yield ': keepalive\n\n'  # SSE comment keeps connection alive
        finally:
            broadcaster.unlisten(q)

    response = StreamingHttpResponse(
        event_stream(),
        content_type='text/event-stream'
    )
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'  # Disable nginx buffering if ever proxied
    return response
```

### Pattern 4: Write Endpoints Emit to Broadcaster

**What:** Every existing POST view that mutates ActiveView state must call `broadcaster.announce(payload)` after the mutation. This is the only change to write views.

**Example:**
```python
# In api_switch_view (and every other write endpoint):
from terminal.sse_broadcaster import broadcaster

def api_switch_view(request):
    # ... existing mutation logic, but now mutating active_view_store ...
    new_state = update_state(view_type=new_view_type, location_slug=new_location_slug, ...)
    payload = build_active_view_payload(new_state)
    broadcaster.announce(payload)
    return JsonResponse({'success': True, ...})
```

### Pattern 5: Frontend EventSource with Reconnect Tracking

**What:** A `useSSE` custom React hook wraps `EventSource`. It tracks consecutive failed reconnect attempts with a counter. When the counter exceeds a threshold, it sets a boolean that triggers the toast. On successful reconnect, it resets the counter and dismisses the toast. On connect/reconnect, it fires a callback to re-fetch full state via REST.

**When to use:** Replacing `setInterval` polling in `SharedConsole.tsx` and `GMConsole.tsx`.

**Example:**
```typescript
// src/hooks/useSSE.ts
import { useEffect, useRef, useCallback, useState } from 'react';

interface UseSSEOptions {
  url: string;
  onEvent: (data: unknown) => void;
  onConnect?: () => void;           // Called on (re)connect — triggers REST state re-fetch
  failureThreshold?: number;        // Attempts before showing toast
  retryDelayMs?: number;            // Delay between manual reconnect attempts
}

export function useSSE({
  url,
  onEvent,
  onConnect,
  failureThreshold = 3,
  retryDelayMs = 3000,
}: UseSSEOptions) {
  const [connectionLost, setConnectionLost] = useState(false);
  const failureCount = useRef(0);
  const esRef = useRef<EventSource | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => {
      failureCount.current = 0;
      setConnectionLost(false);
      onConnect?.();
    };

    es.addEventListener('activeview', (e: MessageEvent) => {
      try {
        onEvent(JSON.parse(e.data));
      } catch {
        console.error('[SSE] Failed to parse event data');
      }
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;
      failureCount.current += 1;
      if (failureCount.current >= failureThreshold) {
        setConnectionLost(true);
      }
      // Schedule reconnect
      retryTimer.current = setTimeout(connect, retryDelayMs);
    };
  }, [url, onEvent, onConnect, failureThreshold, retryDelayMs]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [connect]);

  return { connectionLost };
}
```

### Pattern 6: Removing ActiveView from Django

**What:** A migration that removes the `ActiveView` model and drops the table. The model class is also deleted from `models.py`.

**Safe removal sequence:**
1. Create migration `0017_delete_activeview.py` with `DeleteModel('ActiveView')`
2. Remove `ActiveView` class from `terminal/models.py`
3. Remove all `from terminal.models import ActiveView` imports from `views.py`
4. Replace all `ActiveView.get_current()` calls with `active_view_store.get_state()` or `active_view_store.update_state()`
5. Keep `Message` model untouched (RTMA-03, RTMA-04)

**Migration example:**
```python
# terminal/migrations/0017_delete_activeview.py
from django.db import migrations

class Migration(migrations.Migration):
    dependencies = [
        ('terminal', '0016_add_encounter_active_portraits'),
    ]
    operations = [
        migrations.DeleteModel(name='ActiveView'),
    ]
```

### Anti-Patterns to Avoid

- **Keeping polling alongside SSE:** The user decision requires full replacement. Coexistence creates split-brain state.
- **Using `django.core.cache` for in-memory state:** The project's cache backend is `FileBasedCache` (`/tmp/django_cache`). It does not support thread notification/signaling. Don't use it for the broadcaster.
- **Using `threading.Event` for broadcast:** `threading.Event.wait()` with `notify_all()` wakes all threads simultaneously but does not deliver data. Each listener needs its own `queue.Queue` to receive the payload.
- **Disabling `X-Accel-Buffering`:** Must set `X-Accel-Buffering: no` header on the SSE response — some proxies (and Vite dev proxy) buffer streaming responses, destroying real-time delivery.
- **Forgetting keepalive pings:** Without keepalive events (~30s), nginx/proxies time out idle SSE connections. SSE comment lines (`: keepalive\n\n`) keep connections alive without triggering client event handlers.
- **Not cleaning up listeners on disconnect:** The `finally` block in the generator must call `broadcaster.unlisten(q)` to prevent memory leak as clients connect/disconnect.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Thread-safe queue per listener | Custom lock + list | `queue.Queue(maxsize=5)` | Thread-safe by design; handles full-queue as indicator of dead listener |
| SSE event formatting | Custom string builder | `format_sse()` helper (3 lines) | SSE format is simple but the double-newline requirement is easy to forget |
| EventSource reconnect | Manual `setTimeout` retry | Native `EventSource` auto-reconnect + counter wrapper | Browser handles reconnect timing; only need a counter for toast threshold |
| In-memory pub-sub | Redis / Django Channels | Module singleton + stdlib | Single-process WSGI; no distributed requirements |

**Key insight:** The queue-per-listener pattern with `queue.Full` cleanup is the correct idiom for single-process WSGI SSE. When a listener's queue is full, the client is not consuming fast enough — treat this as a disconnect and remove them.

---

## Common Pitfalls

### Pitfall 1: Buffering Kills Real-Time Delivery

**What goes wrong:** SSE events don't arrive at the client for seconds, defeating the purpose.
**Why it happens:** Django, Vite's dev proxy, or nginx buffer the streaming response body before forwarding.
**How to avoid:**
- Set `Cache-Control: no-cache` on the SSE response
- Set `X-Accel-Buffering: no` to disable nginx buffering
- Vite's dev proxy (`vite.config.ts`) may need `configure` to pass SSE through: the proxy must not buffer. Check if Vite's proxy works for streaming by testing with `curl -N http://localhost:8000/api/active-view/stream/` — events should arrive immediately.
**Warning signs:** Events arrive in batches rather than individually; `curl --no-buffer` works but browser doesn't.

### Pitfall 2: Django's `runserver` Auto-Reloader Restarts the Process

**What goes wrong:** When Django reloads due to a code change, the in-memory `active_view_store` resets to STANDBY. All connected SSE clients get disconnected.
**Why it happens:** Django's development server watches files and restarts the Python process on change.
**How to avoid:** This is expected behavior and the user has accepted it (CONTEXT.md: "GM re-navigates to current encounter"). No mitigation required — document it as known behavior.
**Warning signs:** State resets on code changes during development — expected.

### Pitfall 3: `EventSource` Cannot Send Credentials Without CORS Config

**What goes wrong:** The SSE endpoint returns 403 or the `EventSource` can't authenticate.
**Why it happens:** `EventSource` does not send cookies by default for cross-origin requests. For same-origin (which this is — both served by Django at `localhost:8000`), cookies are sent automatically.
**How to avoid:** This project serves everything from the same origin, so no action needed. The GM console SSE endpoint is `@login_required`-gated — session cookie is sent automatically.
**Warning signs:** 403 on SSE endpoint for GM console; check that the GM SSE endpoint correctly reads the session.

### Pitfall 4: Memory Leak from Stale Listeners

**What goes wrong:** Server RAM grows as clients connect and disconnect without cleanup.
**Why it happens:** If the `finally` block in the generator is never reached (exception suppression, or incorrect flow), listeners accumulate.
**How to avoid:** The `finally: broadcaster.unlisten(q)` pattern ensures cleanup even when generator is garbage-collected. Also, `queue.Full` detection in `announce()` provides a secondary cleanup path.
**Warning signs:** `len(broadcaster.listeners)` grows unboundedly; monitor during testing.

### Pitfall 5: All Write Endpoints Must Announce — Missing One Breaks Clients

**What goes wrong:** Some state changes (e.g., `api_charon_toggle_dialog`) don't push SSE updates, so clients have stale state until they re-fetch.
**Why it happens:** Forgetting to add `broadcaster.announce()` to one of the ~15 write endpoints.
**How to avoid:** The planner should explicitly list every write endpoint that must be updated. On reconnect, the client always re-fetches full state, which provides recovery. But missed announces mean intermediate state is invisible.
**Warning signs:** Toggling a feature in GM console doesn't immediately appear on player terminal.

### Pitfall 6: `build_active_view_payload()` is Expensive (File I/O)

**What goes wrong:** SSE push triggers NPC data reload and location YAML reads on every state change, adding latency to token moves.
**Why it happens:** The current `get_active_view_json` view loads NPC data and encounter location metadata on every response via `DataLoader`. When this logic moves to the SSE broadcast path, it runs on every write operation.
**How to avoid:** Extract a `build_active_view_payload(state: dict) -> dict` helper function. For the SSE broadcast (which needs to be fast), the payload builder should be lean — only include encounter_npc_data when `view_type == 'ENCOUNTER'`. Cache the NPC data in-memory rather than re-reading YAML on every announce. Alternative: announce the raw state dict and let the SSE initial-state endpoint do the full enrichment.
**Warning signs:** Token move latency is higher than expected; profile `build_active_view_payload`.

### Pitfall 7: GM Console and SharedConsole Have Different Auth Requirements

**What goes wrong:** The GM SSE endpoint requires login; the player terminal SSE endpoint is public.
**Why it happens:** Same pattern as existing `get_active_view_json` (public) vs `api_switch_view` (login_required).
**How to avoid:** Use one public SSE endpoint for all clients (`/api/active-view/stream/`). The GM console can use the same stream — it doesn't need a separate authenticated stream for reading ActiveView. Write operations are already protected by `@login_required`.
**Warning signs:** GM console shows 403 on SSE endpoint if incorrectly gated.

---

## Code Examples

### Complete SSE View

```python
# Source: Pattern derived from https://maxhalford.github.io/blog/flask-sse-no-deps/
# adapted for Django StreamingHttpResponse

import queue
from django.http import StreamingHttpResponse
from terminal.sse_broadcaster import broadcaster, format_sse
from terminal.active_view_store import get_state
import json

def api_active_view_stream(request):
    """
    SSE endpoint — streams ActiveView state changes to all connected clients.
    Public endpoint — no login required (same as existing /api/active-view/).
    """
    def event_stream():
        # Send full current state as first event so client is immediately in sync
        initial_payload = build_active_view_payload(get_state())
        yield format_sse(json.dumps(initial_payload), event='activeview')

        q = broadcaster.listen()
        try:
            while True:
                try:
                    msg = q.get(timeout=30)
                    yield msg
                except queue.Empty:
                    yield ': keepalive\n\n'
        finally:
            broadcaster.unlisten(q)

    response = StreamingHttpResponse(event_stream(), content_type='text/event-stream')
    response['Cache-Control'] = 'no-cache'
    response['X-Accel-Buffering'] = 'no'
    return response
```

### Frontend Hook Integration in SharedConsole

```typescript
// Source: Pattern derived from MDN EventSource docs + project patterns

function SharedConsole() {
  const [activeView, setActiveView] = useState<ActiveView | null>(null);

  // Called on SSE (re)connect — re-fetch full state to catch missed updates
  const handleSSEConnect = useCallback(async () => {
    // SSE sends initial event on connect, so this may be optional,
    // but is kept as a safety net for reconnect scenarios
  }, []);

  const { connectionLost } = useSSE({
    url: '/api/active-view/stream/',
    onEvent: (data) => {
      const view = data as ActiveView;
      setActiveView(view);
      // Apply same side-effects as current poll handler
      if (view.encounter_tokens && !tokenMoveInFlight.current) {
        setEncounterTokens(view.encounter_tokens);
      }
      // ... rest of state sync logic
    },
    onConnect: handleSSEConnect,
    failureThreshold: 5,      // Player terminal: more tolerant
    retryDelayMs: 3000,
  });

  // GM Console would use failureThreshold: 2 — warns sooner

  return (
    <>
      {connectionLost && (
        <SSEConnectionToast message="Connection lost — retrying..." />
      )}
      {/* ... existing JSX ... */}
    </>
  );
}
```

### URL Registration

```python
# terminal/urls.py — add one line:
path('api/active-view/stream/', views.api_active_view_stream, name='active_view_stream'),
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `setInterval` 2s polling | SSE push | Phase 5 | Token/portrait latency drops from 0-2000ms to ~0ms |
| `ActiveView` SQLite row | In-memory module dict | Phase 5 | Eliminates DB write on every GM action; faster write path |
| `auto_now=True updated_at` comparison | SSE event delivery | Phase 5 | No more timestamp diffing to detect changes |

**Deprecated/outdated after this phase:**
- `ActiveView` model class and Django table: removed entirely
- `setInterval` polling in `SharedConsole.tsx` (the 2000ms loop at line 297-369)
- `setInterval` polling in `GMConsole.tsx` (the 5000ms loop at lines 62-73)
- `ActiveView.get_current()` singleton method: removed with model
- `active_view.save()` calls in all write views: replaced with `active_view_store.update_state()` + `broadcaster.announce()`

---

## Implementation Scope: All Views That Must Announce

Every write endpoint that currently calls `active_view.save()` must instead call `active_view_store.update_state(...)` and `broadcaster.announce(payload)`. The full list (from `views.py`):

1. `api_switch_view` — view type and location
2. `api_show_terminal` — overlay slug
3. `api_hide_terminal` — overlay clear
4. `api_charon_switch_mode` — charon mode
5. `api_charon_set_location` — charon location
6. `api_charon_toggle_dialog` — dialog open/close
7. `api_encounter_switch_level` — deck level
8. `api_encounter_toggle_room` — room visibility
9. `api_encounter_room_visibility` (POST) — bulk room visibility
10. `api_encounter_set_door_status` — door state
11. `api_encounter_place_token` — token placement
12. `api_encounter_move_token` — token move
13. `api_encounter_remove_token` — token removal
14. `api_encounter_update_token_status` — token status (wounded/dead/panicked)
15. `api_encounter_clear_tokens` — clear all tokens
16. `api_encounter_toggle_portrait` — portrait show/hide
17. `api_ship_toggle_system` — ship system override

**Also reads ActiveView (GET, no announce needed):**
- `get_active_view_json` — keep this endpoint for compatibility or make it a thin wrapper over `get_state()`
- `api_encounter_map_data` — reads `encounter_room_visibility`, `encounter_deck_id`
- `api_encounter_all_decks` — reads `encounter_room_visibility`
- `api_ship_status` — reads `ship_system_overrides`
- `display_view_react` — reads initial state for page render
- `api_charon_conversation` — reads `charon_mode`

---

## Open Questions

1. **Vite dev proxy and SSE buffering**
   - What we know: Vite's `proxy` config in `vite.config.ts` is used during development. Vite proxies requests from `localhost:5173` to `localhost:8000`.
   - What's unclear: Whether Vite's http-proxy buffers streaming responses, or passes them through chunk-by-chunk.
   - Recommendation: Test with `curl -N http://localhost:8000/api/active-view/stream/` first (direct), then test through Vite dev proxy. If Vite buffers, add `selfHandleResponse: true` and manually pipe chunks in the proxy config.

2. **`display_view_react` initial page data**
   - What we know: The Django view passes initial data to the React app via `window.INITIAL_DATA`, including `active_view` state built from the old `ActiveView.get_current()`.
   - What's unclear: Whether to keep this initial data path or let the SSE first-event be the source of truth.
   - Recommendation: Keep the initial data pass-through from the Django template view — it avoids a flash of empty state before SSE connects. The template view reads from `active_view_store.get_state()` instead of `ActiveView.get_current()`.

3. **GM console polling for channel unreads**
   - What we know: `GMConsole.tsx` has a second poll loop (5s) for CHARON channel unread counts (lines 76-96). This is separate from the ActiveView poll.
   - What's unclear: Whether this poll is in-scope for Phase 5.
   - Recommendation: This is NOT covered by the RTMA requirements (which are about ActiveView push). Keep the channel unread polling as-is. This is consistent with messages staying on polling (CONTEXT.md decision).

---

## Sources

### Primary (HIGH confidence)
- Django 5.2 `StreamingHttpResponse` docs — confirmed sync generator works under WSGI; content_type header required
  - https://django.readthedocs.io/en/5.2.x/ref/request-response.html
- MDN `EventSource` API — confirmed auto-reconnect behavior, `retry:` field, error event, named events
  - https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events
- Flask SSE without dependencies (Max Halford) — confirmed `queue.Queue` per-listener pattern; `queue.Full` cleanup strategy; `format_sse()` helper
  - https://maxhalford.github.io/blog/flask-sse-no-deps/
- Project codebase — confirmed: threaded runserver, FileBasedCache backend, polling locations in SharedConsole.tsx + GMConsole.tsx, all 17 write endpoints, existing `build_active_view_payload` complexity

### Secondary (MEDIUM confidence)
- Minimalist Django SSE article — confirms async generator approach for ASGI; by contrast confirms sync generator is the correct approach for WSGI
  - https://minimalistdjango.com/TIL/2024-04-21-server-sent-events/
- Django Streaming HTTP Responses blog — confirms performance caveat (worker per SSE connection); acceptable for single-process dev server
  - https://blog.pecar.me/django-streaming-responses

### Tertiary (LOW confidence)
- Django Forum: SSE with async/ASGI — describes async alternative; not applicable to this project's WSGI setup
  - https://forum.djangoproject.com/t/server-sent-event-in-django/17205

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — stdlib-only server side; native browser API; confirmed Django 5.2 WSGI streaming works
- Architecture patterns: HIGH — queue-per-listener is well-established pattern for single-process streaming; sourced from Flask reference implementation
- Pitfalls: HIGH — buffering and listener cleanup pitfalls are documented; write-endpoint completeness risk is code-specific (confirmed by reading all 17 endpoints)
- Vite proxy behavior: MEDIUM — flagged as Open Question; recommend testing early in plan execution

**Research date:** 2026-02-21
**Valid until:** 2026-08-21 (Django StreamingHttpResponse API is stable; EventSource is a web standard)
