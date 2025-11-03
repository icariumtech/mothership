# Development Session Notes

## Latest Session - File-Based Campaign Data System

### Completed (2025-01-XX)

#### Architecture Decisions
- **File-based data storage**: Campaign data stored as markdown with YAML frontmatter
- **On-demand loading**: No database sync - data loaded from disk when needed
- **Conversation threading**: Messages linked via `conversation_id` and `in_reply_to`
- **ActiveView singleton**: Database only tracks which view is currently displayed

#### Implemented Components

1. **Data Structure** (`data/locations/`)
   - Location hierarchy: locations → comms → terminals → inbox/sent → contacts
   - YAML metadata for locations and terminals
   - Markdown messages with YAML frontmatter
   - Example: Research Base Alpha with 2 terminals, 5 messages

2. **Data Loader** (`terminal/data_loader.py`)
   - `DataLoader` class: Parses directory structure
   - `load_location()`: Load location with all terminals
   - `load_terminal()`: Load terminal with inbox/sent messages
   - `group_messages_by_conversation()`: Group by conversation_id
   - `build_conversation_thread()`: Build chronological thread

3. **Database Models** (`terminal/models.py`)
   - `ActiveView`: Singleton tracking display state (location_slug, view_type, view_slug)
   - `Message`: Existing broadcast message system (unchanged)

4. **Documentation**
   - Updated `CLAUDE.md` with architecture details
   - Documented data models and access patterns
   - Listed implemented vs planned features

#### Commits
```
a363d62 - Add file-based campaign data system with conversation threading
d6be952 - Update CLAUDE.md with implemented file-based architecture
```

### Next Steps (Priority Order)

#### 1. Update GM Console UI ⬅️ START HERE
**Goal**: Allow GM to browse locations/terminals and switch active view

**Tasks**:
- [ ] Update `terminal/views.py::gm_console()` view
- [ ] Add view switching functionality
- [ ] Load all locations from disk using `load_all_locations()`
- [ ] Display location → terminals hierarchy
- [ ] Add buttons/links to switch active view
- [ ] Update `ActiveView` when GM selects a view

**Template Changes** (`terminal/templates/terminal/gm_console.html`):
```html
<!-- Add sidebar with location browser -->
<div class="location-browser">
  {% for location in locations %}
    <div class="location">
      <h3>{{ location.name }}</h3>
      <div class="terminals">
        {% for terminal in location.terminals %}
          <button onclick="switchView('{{ location.slug }}', 'COMM_TERMINAL', '{{ terminal.slug }}')">
            {{ terminal.terminal_id }} - {{ terminal.owner }}
          </button>
        {% endfor %}
      </div>
    </div>
  {% endfor %}
</div>
```

**Backend** (`terminal/views.py`):
```python
from terminal.data_loader import load_all_locations
from terminal.models import ActiveView

@login_required
def gm_console(request):
    # Load all campaign data
    locations = load_all_locations()

    # Get current active view
    active_view = ActiveView.get_current()

    # Handle view switching POST
    if request.method == 'POST' and 'switch_view' in request.POST:
        active_view.location_slug = request.POST['location_slug']
        active_view.view_type = request.POST['view_type']
        active_view.view_slug = request.POST['view_slug']
        active_view.updated_by = request.user
        active_view.save()

    return render(request, 'terminal/gm_console.html', {
        'locations': locations,
        'active_view': active_view,
    })
```

#### 2. Create API Endpoints
**Goal**: Allow shared terminal to poll for view changes

**New URLs** (`terminal/urls.py`):
```python
path('api/current-view/', views.get_current_view, name='current_view_api'),
path('api/terminal/<location_slug>/<terminal_slug>/', views.get_terminal_data, name='terminal_data_api'),
```

**New Views** (`terminal/views.py`):
```python
def get_current_view(request):
    """Return currently active view configuration"""
    active_view = ActiveView.get_current()
    return JsonResponse({
        'view_type': active_view.view_type,
        'location_slug': active_view.location_slug,
        'view_slug': active_view.view_slug,
        'updated_at': active_view.updated_at.isoformat(),
    })

def get_terminal_data(request, location_slug, terminal_slug):
    """Return full terminal data including messages"""
    from terminal.data_loader import load_location, group_messages_by_conversation

    location = load_location(location_slug)
    terminal = next((t for t in location['terminals'] if t['slug'] == terminal_slug), None)

    if not terminal:
        return JsonResponse({'error': 'Terminal not found'}, status=404)

    # Include conversation grouping
    conversations = group_messages_by_conversation(terminal['messages'])

    return JsonResponse({
        'terminal': terminal,
        'conversations': conversations,
    })
```

#### 3. Update Terminal Display View
**Goal**: Display terminal with conversation threading

**Tasks**:
- [ ] Update `terminal/views.py::display_view()`
- [ ] Check active view type
- [ ] If `COMM_TERMINAL`, load terminal data and render conversation view
- [ ] Create new template `terminal/templates/terminal/comm_terminal.html`
- [ ] Add JavaScript polling for view changes

### Technical Notes

**Testing Data Loader**:
```python
# Django shell
from terminal.data_loader import load_location, build_conversation_thread

location = load_location('research_base_alpha')
terminal = next(t for t in location['terminals'] if t['slug'] == 'commanders_terminal')

# View conversation
thread = build_conversation_thread(terminal['messages'], 'conv_lab_incident_001')
for msg in thread:
    print(f"[{msg['folder'].upper()}] {msg['from']} -> {msg['to']}: {msg['subject']}")
```

**File Structure Reference**:
```
data/locations/research_base_alpha/
├── location.yaml
└── comms/
    ├── commanders_terminal/
    │   ├── terminal.yaml
    │   ├── inbox/
    │   │   ├── charon/           # Station AI messages
    │   │   └── dr_chen/          # Messages from Dr. Chen
    │   └── sent/
    │       └── dr_chen/          # Replies to Dr. Chen
    └── science_lab_07/
        ├── terminal.yaml
        ├── inbox/
        │   └── commander_drake/
        └── sent/
            └── commander_drake/
```

### Questions/Decisions Needed

1. **View Switching UX**: Should terminal smoothly transition or just reload?
2. **Polling Frequency**: How often should `/terminal/` check for view changes? (2-3 seconds?)
3. **Conversation Display**: Show all messages or group by conversation threads?
4. **Read Status**: Should we track which messages have been displayed to players?

### Dependencies

All dependencies already installed:
- Django 5.2.7
- PyYAML 6.0.3

No additional packages needed for next steps.
