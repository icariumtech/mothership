# Backend Architecture

**Last Updated**: 2026-02-02T00:00:00Z

## Django Project Structure

```
mothership_gm/          # Django project
├── __init__.py
├── settings.py         # Configuration (DB, static files, apps)
├── urls.py             # URL routing (includes terminal.urls)
├── wsgi.py             # WSGI entry point
└── asgi.py             # ASGI entry point

terminal/               # Main Django app
├── __init__.py
├── apps.py             # App configuration
├── admin.py            # Django admin registration
├── models.py           # ActiveView, Message models
├── views.py            # API endpoints and template views
├── urls.py             # URL patterns
├── data_loader.py      # File-based data loading
├── charon_ai.py        # CHARON AI response generation
├── charon_session.py   # In-memory CHARON conversation management
├── charon_knowledge.py # CHARON location-specific knowledge
└── templates/          # HTML template wrappers
```

## Models (SQLite)

### ActiveView (Singleton)
**Purpose**: Tracks what the shared terminal is currently displaying.

**Fields**:
- `view_type`: STANDBY, BRIDGE, ENCOUNTER, COMM_TERMINAL, MESSAGES, SHIP_DASHBOARD, CHARON_TERMINAL
- `location_slug`: Directory name under data/galaxy/
- `view_slug`: Specific terminal/map slug
- `overlay_location_slug`: Location of terminal overlay
- `overlay_terminal_slug`: Terminal slug for overlay
- `charon_mode`: DISPLAY, QUERY
- `charon_location_path`: Path to active CHARON instance
- `charon_dialog_open`: Whether CHARON dialog is visible
- `encounter_level`: Current deck/level (1-indexed)
- `encounter_deck_id`: ID of current deck (e.g., "deck_1")
- `encounter_room_visibility`: JSON map of room_id → visible (bool)
- `encounter_door_status`: JSON map of connection_id → door_status string
- `updated_at`: Timestamp (auto-updated)
- `updated_by`: ForeignKey to User

**Methods**:
- `get_current()`: Get or create singleton instance
- `save()`: Ensures only one record exists

### Message
**Purpose**: Broadcast messages sent from ship/station AI to crew.

**Fields**:
- `sender`: Name of AI system (default "CHARON")
- `content`: Message text
- `priority`: LOW, NORMAL, HIGH, CRITICAL
- `created_at`: Timestamp (auto-added)
- `created_by`: ForeignKey to User (GM)
- `recipients`: ManyToManyField to User (empty = broadcast)
- `is_read`: Boolean acknowledgment flag

**Ordering**: `-created_at` (newest first)

## Data Loader (File-based)

### DataLoader Class
**Purpose**: Loads campaign data from `data/` directory without DB sync.

**Key Methods**:

#### Location Hierarchy
- `load_all_locations()`: Recursive load of all locations from galaxy/
- `load_location_recursive(location_dir)`: Load location + children
- `find_location_by_slug(slug)`: Search hierarchy for location
- `get_location_path(slug)`: Return full path as list (e.g., ['sol', 'earth', 'base'])
- `get_location_by_path(path_slugs)`: Navigate to location by path

#### Maps
- `load_star_map()`: Load galaxy-level visualization (star_map.yaml)
- `load_system_map(system_slug)`: Load solar system data (system_map.yaml)
- `load_orbit_map(system_slug, body_slug)`: Load orbital data (orbit_map.yaml)
- `load_map(location_dir)`: Load encounter map (supports multi-deck manifests)
- `load_encounter_manifest(location_dir)`: Load manifest.yaml for multi-deck maps
- `load_deck_map(location_dir, deck_id)`: Load specific deck's YAML

#### Terminals
- `load_terminals(location_dir)`: Load all terminals in comms/
- `load_terminal(terminal_dir)`: Load terminal with inbox/sent messages
- `load_central_messages(messages_dir)`: Load messages from comms/messages/
- `filter_messages_for_recipient(messages, owner)`: Filter inbox
- `filter_messages_for_sender(messages, owner)`: Filter sent
- `parse_message_file(message_file)`: Parse markdown + YAML frontmatter

#### Campaign Data
- `load_crew()`: Load crew roster from data/campaign/crew.yaml

**Design Pattern**: Lazy loading on API request (no caching, always fresh from disk).

## Views (API Endpoints)

### Template Views (HTML)
- `display_view_react()`: Renders shared_console_react.html (shared terminal)
- `gm_console_react()`: Renders gm_console_react.html (GM control panel)
- `terminal_view_react()`: Renders player_console_react.html (player messages)
- `logout_view()`: Custom logout confirmation

### Public API (No Auth)
- `get_active_view_json()`: Current terminal state (polled every 2s)
- `get_messages_json()`: Broadcast messages (optional `since` param)
- `get_star_map_json()`: Galaxy visualization data
- `get_system_map_json(system_slug)`: Solar system data + facility counts
- `get_orbit_map_json(system_slug, body_slug)`: Orbital data
- `api_encounter_map_data(location_slug)`: Encounter map + room visibility
- `api_encounter_all_decks(location_slug)`: All decks for multi-level maps
- `api_terminal_data(location_slug, terminal_slug)`: Terminal messages
- `api_charon_conversation()`: Current CHARON conversation (public)
- `api_charon_submit_query()`: Player submits query (CSRF exempt)
- `api_charon_toggle_dialog()`: Toggle CHARON dialog (CSRF exempt)
- `api_hide_terminal()`: Hide terminal overlay (CSRF exempt)

### GM API (Login Required)
- `api_locations()`: Location tree for GM Console
- `api_switch_view()`: Switch active view type/location
- `api_show_terminal()`: Show terminal overlay on shared display
- `api_broadcast()`: Send broadcast message
- `api_encounter_switch_level()`: Switch encounter deck
- `api_encounter_toggle_room()`: Toggle room visibility
- `api_encounter_room_visibility()`: Get/set room visibility
- `api_encounter_set_door_status()`: Set door status (OPEN, CLOSED, LOCKED, etc.)
- `api_charon_switch_mode()`: Switch CHARON mode (DISPLAY/QUERY)
- `api_charon_set_location()`: Set active CHARON instance location
- `api_charon_send_message()`: GM sends CHARON message directly
- `api_charon_generate()`: Generate AI response for GM review
- `api_charon_pending()`: Get pending AI responses
- `api_charon_approve()`: Approve pending response
- `api_charon_reject()`: Reject pending response
- `api_charon_clear()`: Clear CHARON conversation

### Helper Functions
- `get_charon_location_path(active_view)`: Derive CHARON location context
  - Priority: ENCOUNTER view location → explicit charon_location_path

## CHARON AI System

### CharonSessionManager (charon_session.py)
**Purpose**: In-memory conversation management (no DB persistence).

**Storage**:
- `_conversation`: List of CharonMessage objects
- `_pending_responses`: List of pending AI responses for GM approval

**Methods**:
- `get_conversation()`: Return conversation history
- `add_message(message)`: Add message to conversation
- `add_pending_response(query, response, query_id)`: Queue for approval
- `approve_response(pending_id, modified_content)`: Approve and add to conversation
- `reject_response(pending_id)`: Discard pending response
- `clear_conversation()`: Reset conversation
- `get_pending_responses()`: List pending for GM

### CharonAI (charon_ai.py)
**Purpose**: Generate AI responses with location-specific knowledge.

**Features**:
- Location-aware context (system, planet, facility)
- Knowledge base from `data/charon/context.yaml`
- Anthropic Claude integration (planned)
- Character voice consistency (terse, technical, ominous)

### CharonKnowledge (charon_knowledge.py)
**Purpose**: Load location-specific knowledge for CHARON context.

**Methods**:
- `load_system_knowledge(system_slug)`: Load system-level context
- `load_location_knowledge(location_path)`: Load facility-specific context
- `build_context_prompt(location_path)`: Build full context string for AI

## URL Routing

### Public URLs
```
/                        → display_view_react (shared terminal)
/terminal/               → terminal_view_react (player messages)
/logout/                 → logout_view

/api/active-view/        → get_active_view_json
/api/messages/           → get_messages_json
/api/star-map/           → get_star_map_json
/api/system-map/<slug>/  → get_system_map_json
/api/orbit-map/<sys>/<body>/ → get_orbit_map_json
/api/encounter-map/<slug>/ → api_encounter_map_data
/api/terminal/<loc>/<term>/ → api_terminal_data
/api/charon/conversation/ → api_charon_conversation
/api/charon/submit-query/ → api_charon_submit_query
/api/charon/toggle-dialog/ → api_charon_toggle_dialog
/api/hide-terminal/      → api_hide_terminal
```

### GM URLs (Login Required)
```
/gmconsole/              → gm_console_react

/api/locations/          → api_locations
/api/switch-view/        → api_switch_view
/api/show-terminal/      → api_show_terminal
/api/broadcast/          → api_broadcast
/api/encounter/switch-level/ → api_encounter_switch_level
/api/encounter/toggle-room/ → api_encounter_toggle_room
/api/charon/*            → CHARON GM endpoints
```

## Data Access Patterns

### Typical Request Flow
```
1. Browser requests /api/active-view/
2. views.get_active_view_json()
3. ActiveView.get_current() (DB query)
4. For ENCOUNTER: DataLoader.find_location_by_slug() (file read)
5. JSON serialization
6. HTTP response
```

### Multi-Deck Encounter Loading
```
1. API request /api/encounter-map/{slug}/?deck_id=deck_2
2. DataLoader.find_location_by_slug(slug)
3. DataLoader.load_encounter_manifest(location_dir)
4. DataLoader.load_deck_map(location_dir, 'deck_2')
5. Merge with ActiveView.encounter_room_visibility
6. Return JSON with manifest + current deck + visibility
```

### Terminal Message Loading
```
1. API request /api/terminal/{location}/{terminal}/
2. DataLoader.find_location_by_slug(location)
3. DataLoader.load_terminal(terminal_dir)
4. Check for comms/messages/ (central store)
5. Filter messages by owner (inbox: to matches, sent: from matches)
6. Return JSON with inbox/sent arrays
```

## Error Handling

### File Not Found
- Map files: Return 404 with error message JSON
- Locations: Return `None`, caller handles gracefully

### Invalid Requests
- Missing required fields: 400 Bad Request
- Invalid JSON: 400 Bad Request
- Auth required: 302 Redirect to login

### CSRF Protection
- Enabled for all POST endpoints except public player actions
- CSRF exempt: `api_charon_submit_query`, `api_charon_toggle_dialog`, `api_hide_terminal`
