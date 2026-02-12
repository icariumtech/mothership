# Phase 1: Campaign Logs Tab - Research

**Researched:** 2026-02-11
**Domain:** React UI components with YAML+Markdown data loading
**Confidence:** HIGH

## Summary

This phase implements a campaign session log viewer by renaming the existing NOTES bridge tab to LOGS and populating it with session entries loaded from markdown files with YAML frontmatter. The implementation follows established patterns from the PersonnelSection (two-panel list/detail layout) and DataLoader (file-based YAML loading with frontmatter parsing). Session logs will be stored in `data/campaign/sessions/` as markdown files with YAML frontmatter containing metadata (session number, date, title, location, NPCs) and markdown body content for the narrative recap.

**Primary recommendation:** Use react-markdown for safe markdown rendering, follow PersonnelSection's split-panel pattern, add load_sessions() method to DataLoader mirroring load_crew() pattern, pass session data via INITIAL_DATA in shared_console_react.html.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
1. **Log entry content:** Each entry has session number, date, title, body text, location, and notable NPCs. GM writes entries manually between sessions as recaps. Entry length varies widely (short paragraphs to multi-paragraph narratives). Body content is markdown (supports bold, lists, headers) and must be rendered in the UI.

2. **Visual presentation:** Two-panel layout matching PERSONNEL tab pattern with session list on left sidebar and selected entry content on right. Data terminal feel with structured fields and labels, compact, consistent with other bridge panels. Right panel shows header block with labeled metadata fields (session #, date, title, location, notable NPCs) above body text.

3. **Data format:** One file per session in `data/campaign/sessions/` (e.g., `session-007.md`). Markdown with YAML frontmatter containing session number, date, title, location, notable NPCs in frontmatter and markdown narrative in body. Follows existing data patterns (YAML frontmatter + markdown content).

4. **Entry ordering & navigation:** Sidebar list shows newest session first (most recent at top). Each list item shows session number + title + date. Most recent session auto-selected when opening LOGS tab. Simple scrollable list for handling many sessions.

### Claude's Discretion
- Exact YAML frontmatter field names and schema
- Markdown rendering approach in the right panel
- Sidebar styling details and spacing
- Empty state when no session files exist
- How location and notable NPCs are formatted in the header block

### Deferred Ideas (OUT OF SCOPE)
None - discussion stayed within phase scope

</user_constraints>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-markdown | ^9.0+ | Markdown-to-React rendering | Industry standard for TypeScript projects, safe by default (no XSS), 100% CommonMark compliant, extensive plugin ecosystem |
| PyYAML | (existing) | YAML parsing in Python backend | Already used throughout DataLoader for parsing frontmatter |
| React 19 | 19.2.3 (existing) | UI framework | Already in use |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| remark-gfm | ^4.0+ | GitHub Flavored Markdown | If GM needs strikethrough, tables, task lists, or auto-linking URLs in session logs |
| remark-breaks | ^4.0+ | Convert line breaks to `<br>` | If GM wants single line breaks to render (useful for poetry/formatted text) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-markdown | markdown-to-jsx | Lighter bundle size (~30% smaller), slightly faster, but fewer plugins and less Markdown feature coverage |
| react-markdown | marked + dangerouslySetInnerHTML | Faster but unsafe (XSS risk), not idiomatic React |

**Installation:**
```bash
npm install react-markdown remark-gfm
```

## Architecture Patterns

### Recommended Project Structure
```
src/components/domain/dashboard/sections/
├── LogsSection.tsx          # Main logs section component
├── LogsSection.css          # Styling (follows PersonnelSection pattern)
└── NotesSection.tsx         # Rename this to LogsSection.tsx

data/campaign/
└── sessions/                # New directory for session logs
    ├── session-001.md
    ├── session-002.md
    └── session-003.md
```

### Pattern 1: Two-Panel List/Detail Layout (Reuse PersonnelSection Pattern)

**What:** Split panel with scrollable list on left (280px fixed width), detail view on right (flex: 1). Same internal structure as PersonnelSection.

**When to use:** When displaying a list of items with detailed content for selected item. Already used successfully in PersonnelSection.

**Example:**
```tsx
// Source: PersonnelSection.tsx (existing pattern)
<div className="logs-split">
  {/* Left side - scrollable session list */}
  <div className="logs-list">
    {sessions.map(session => (
      <div
        key={session.id}
        className={`logs-row ${selected === session.id ? 'selected' : ''}`}
        onClick={() => setSelected(session.id)}
      >
        <div className="logs-row-checkbox" />
        <div className="logs-row-info">
          <div className="logs-row-title">SESSION {session.number}: {session.title}</div>
          <div className="logs-row-date">{session.date}</div>
        </div>
      </div>
    ))}
  </div>

  {/* Right side - detail view */}
  <div className="logs-detail">
    {selectedSession ? (
      <LogsDetailView session={selectedSession} />
    ) : (
      <div className="logs-detail-empty">
        &gt; SELECT SESSION TO VIEW LOG
      </div>
    )}
  </div>
</div>
```

### Pattern 2: YAML Frontmatter Parsing (Existing DataLoader Pattern)

**What:** Python backend parses markdown files with YAML frontmatter (delimited by `---`), returns structured data with metadata fields + content.

**When to use:** For all file-based campaign data that combines structured metadata with freeform content.

**Example:**
```python
# Source: terminal/data_loader.py - parse_message_file() method
def load_sessions(self) -> List[Dict[str, Any]]:
    """Load campaign session logs from data/campaign/sessions/."""
    sessions_dir = self.data_dir / "campaign" / "sessions"

    if not sessions_dir.exists():
        return []

    sessions = []
    for session_file in sorted(sessions_dir.glob("*.md")):
        session_data = self.parse_session_file(session_file)
        sessions.append(session_data)

    # Sort by session number descending (newest first)
    sessions.sort(key=lambda s: s.get('session_number', 0), reverse=True)
    return sessions

def parse_session_file(self, session_file: Path) -> Dict[str, Any]:
    """Parse session markdown file with YAML frontmatter."""
    with open(session_file, 'r') as f:
        content = f.read()

    # Split frontmatter and content (matches parse_message_file pattern)
    if content.startswith('---'):
        parts = content.split('---', 2)
        if len(parts) >= 3:
            frontmatter = yaml.safe_load(parts[1])
            body = parts[2].strip()
        else:
            frontmatter = {}
            body = content
    else:
        frontmatter = {}
        body = content

    return {
        'body': body,  # Markdown content
        'filename': session_file.name,
        **frontmatter  # session_number, date, title, location, npcs
    }
```

### Pattern 3: INITIAL_DATA Injection (Existing Pattern)

**What:** Django view loads data from DataLoader, passes to template as JSON, React hydrates from window.INITIAL_DATA.

**When to use:** For initial page load data that doesn't need real-time updates.

**Example:**
```python
# Source: terminal/views.py - display_view_react()
def display_view_react(request):
    loader = DataLoader()
    sessions_data = loader.load_sessions()
    sessions_json = json.dumps(sessions_data)

    return render(request, 'terminal/shared_console_react.html', {
        'sessions_json': sessions_json,
        # ... other data
    })
```

```html
<!-- Source: terminal/templates/terminal/shared_console_react.html -->
<script>
    window.INITIAL_DATA = {
        // ... existing data
        sessions: {{ sessions_json|safe|default:'[]' }},
    };
</script>
```

```tsx
// Source: SharedConsole.tsx
interface InitialData {
  activeView: ActiveView;
  crew?: CrewMember[];
  npcs?: NPC[];
  sessions?: SessionLog[];  // Add this
}

// Read from window.INITIAL_DATA in LogsSection
function getSessionData(): SessionLog[] {
  return window.INITIAL_DATA?.sessions || [];
}
```

### Pattern 4: React Markdown Rendering (New)

**What:** Use react-markdown component to safely render markdown content with custom styling.

**When to use:** Whenever displaying user-authored markdown content (session logs, notes, descriptions).

**Example:**
```tsx
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function LogsDetailView({ session }: { session: SessionLog }) {
  return (
    <div className="logs-detail-body visible">
      {/* Header with metadata fields */}
      <div className="logs-detail-header">
        <div className="logs-detail-fields">
          <p><span className="info-label">SESSION:</span> <span className="info-value">{session.session_number}</span></p>
          <p><span className="info-label">DATE:</span> <span className="info-value">{session.date}</span></p>
          <p><span className="info-label">TITLE:</span> <span className="info-value">{session.title}</span></p>
          <p><span className="info-label">LOCATION:</span> <span className="info-value">{session.location}</span></p>
          {session.npcs && session.npcs.length > 0 && (
            <p><span className="info-label">NOTABLE NPCS:</span> <span className="info-value">{session.npcs.join(', ')}</span></p>
          )}
        </div>
      </div>

      {/* Markdown body content */}
      <div className="logs-detail-content">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {session.body}
        </ReactMarkdown>
      </div>
    </div>
  );
}
```

### Anti-Patterns to Avoid
- **Using dangerouslySetInnerHTML for markdown:** Opens XSS vulnerabilities. Use react-markdown instead.
- **Loading sessions via API on every render:** Sessions are static campaign data, should be loaded once on page load via INITIAL_DATA.
- **Complex state management for session list:** Sessions don't change during session, simple useState is sufficient.
- **Overloading markdown features:** Keep it simple - basic formatting (bold, italic, lists, headers) is enough for session recaps.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Markdown parsing | Custom regex-based markdown parser | react-markdown | Handles edge cases (nested lists, code blocks, escaping), security (XSS prevention), spec compliance (CommonMark) |
| YAML frontmatter parsing | String splitting and manual parsing | Existing DataLoader.parse_message_file() pattern | Already handles edge cases (missing frontmatter, malformed YAML, date parsing) |
| Two-panel layout | Custom flexbox from scratch | PersonnelSection.css pattern | Already tested and responsive, maintains visual consistency |
| Empty state styling | Inline styles | .section-empty class from Section.css | Maintains consistency with other sections |

**Key insight:** The codebase already has proven patterns for every piece of this feature. The implementation is primarily "assembly" work - connecting existing patterns together with minimal new code.

## Common Pitfalls

### Pitfall 1: Markdown Rendering Performance with Long Sessions
**What goes wrong:** Re-rendering large markdown content on every React update causes stuttering.
**Why it happens:** react-markdown parses and renders the entire markdown tree on each render.
**How to avoid:** Wrap LogsDetailView in React.memo() to prevent unnecessary re-renders. Markdown only re-renders when selected session changes.
**Warning signs:** Noticeable lag when typing in other components or switching tabs.

```tsx
const LogsDetailView = React.memo(({ session }: { session: SessionLog }) => {
  // ... render logic
});
```

### Pitfall 2: Date Formatting Inconsistency
**What goes wrong:** Session dates display inconsistently (some show timestamps, some don't).
**Why it happens:** YAML allows flexible date formats, but UI needs consistent formatting.
**How to avoid:**
1. Document expected date format in data guide (YYYY-MM-DD recommended)
2. Backend validates/normalizes dates during loading
3. Frontend formats for display consistently
**Warning signs:** Some sessions show "2183-06-14" while others show "2183-06-14 14:30:00".

```python
# Backend normalization in parse_session_file()
if 'date' in frontmatter:
    # Normalize to YYYY-MM-DD format
    date_str = str(frontmatter['date'])
    frontmatter['date'] = date_str.split()[0]  # Take only date part
```

### Pitfall 3: Tab Renaming Breaking Existing State
**What goes wrong:** Renaming 'notes' tab to 'logs' breaks users who have 'notes' saved in sessionStorage.
**Why it happens:** BridgeView saves activeTab state to sessionStorage for persistence.
**How to avoid:** Add migration logic in SharedConsole.tsx to map old 'notes' value to new 'logs' value.
**Warning signs:** Tab reverts to 'map' after refresh for users who previously had 'notes' selected.

```tsx
// In SharedConsole.tsx tab restoration logic
const savedTab = sessionStorage.getItem('activeTab') as BridgeTab | null;
// Migrate old 'notes' tab to 'logs'
if (savedTab === 'notes') {
  sessionStorage.setItem('activeTab', 'logs');
  setActiveTab('logs');
} else if (savedTab) {
  setActiveTab(savedTab);
}
```

### Pitfall 4: NPCs List Rendering Issues
**What goes wrong:** If npcs field is a string instead of array, rendering fails or shows "[object Object]".
**Why it happens:** YAML allows both `npcs: "Alice, Bob"` and `npcs: [Alice, Bob]` syntax.
**How to avoid:** Backend normalizes npcs field to always be an array, frontend checks type before rendering.
**Warning signs:** TypeError or garbled text in Notable NPCs field.

```python
# Backend normalization
if 'npcs' in frontmatter:
    npcs = frontmatter['npcs']
    if isinstance(npcs, str):
        # Split comma-separated string into array
        frontmatter['npcs'] = [n.strip() for n in npcs.split(',')]
    elif not isinstance(npcs, list):
        frontmatter['npcs'] = [str(npcs)]
```

## Code Examples

Verified patterns from codebase:

### Loading Campaign Data in Django View
```python
# Source: terminal/views.py - display_view_react()
# Pattern: Load campaign data from DataLoader, serialize to JSON, pass to template

from terminal.data_loader import DataLoader
import json

def display_view_react(request):
    loader = DataLoader()

    # Load sessions using same pattern as crew/npcs
    sessions_data = loader.load_sessions()
    sessions_json = json.dumps(sessions_data)

    return render(request, 'terminal/shared_console_react.html', {
        'sessions_json': sessions_json,
        # ... other context
    })
```

### Two-Panel Section Component
```tsx
// Source: PersonnelSection.tsx (adapted for logs)
// Pattern: Split panel with list left, detail right

import { useState, useMemo } from 'react';
import { DashboardPanel } from '@components/ui/DashboardPanel';

export function LogsSection() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const sessions = useMemo(() => getSessionData(), []);

  // Auto-select most recent session (first in list)
  useEffect(() => {
    if (sessions.length > 0 && !selectedId) {
      setSelectedId(sessions[0].id);
    }
  }, [sessions, selectedId]);

  const selectedSession = useMemo(() =>
    sessions.find(s => s.id === selectedId),
    [sessions, selectedId]
  );

  return (
    <div className="section-logs">
      <DashboardPanel title="CAMPAIGN LOGS" chamferCorners={['tl', 'br']} padding={0}>
        <div className="logs-split">
          {/* Left: Session list */}
          <div className="logs-list">
            {sessions.map(session => (
              <div
                key={session.id}
                className={`logs-row ${selectedId === session.id ? 'selected' : ''}`}
                onClick={() => setSelectedId(session.id)}
              >
                <div className={`logs-row-checkbox ${selectedId === session.id ? 'checked' : ''}`} />
                <div className="logs-row-info">
                  <div className="logs-row-title">
                    SESSION {session.session_number}: {session.title}
                  </div>
                  <div className="logs-row-date">{session.date}</div>
                </div>
              </div>
            ))}

            {sessions.length === 0 && (
              <p className="logs-empty-message">
                &gt; No session logs found
              </p>
            )}
          </div>

          {/* Right: Session detail */}
          <div className="logs-detail">
            {selectedSession ? (
              <LogsDetailView session={selectedSession} />
            ) : (
              <div className="logs-detail-empty">
                &gt; SELECT SESSION TO VIEW LOG
              </div>
            )}
          </div>
        </div>
      </DashboardPanel>
    </div>
  );
}
```

### Markdown Rendering with Custom Styles
```tsx
// Pattern: Safe markdown rendering with styled components

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

// Custom component overrides for terminal aesthetic
const markdownComponents: Partial<Components> = {
  // Style headers
  h1: ({ children }) => <h1 className="logs-h1">{children}</h1>,
  h2: ({ children }) => <h2 className="logs-h2">{children}</h2>,
  h3: ({ children }) => <h3 className="logs-h3">{children}</h3>,

  // Style lists
  ul: ({ children }) => <ul className="logs-ul">{children}</ul>,
  ol: ({ children }) => <ol className="logs-ol">{children}</ol>,
  li: ({ children }) => <li className="logs-li">{children}</li>,

  // Style emphasis
  strong: ({ children }) => <strong className="logs-strong">{children}</strong>,
  em: ({ children }) => <em className="logs-em">{children}</em>,

  // Style paragraphs
  p: ({ children }) => <p className="logs-p">{children}</p>,
};

function LogsDetailView({ session }: { session: SessionLog }) {
  return (
    <div className="logs-detail-body visible">
      {/* Metadata header */}
      <div className="logs-detail-header">
        <p><span className="info-label">SESSION:</span> <span className="info-value">{session.session_number}</span></p>
        <p><span className="info-label">DATE:</span> <span className="info-value">{session.date}</span></p>
        <p><span className="info-label">TITLE:</span> <span className="info-value">{session.title}</span></p>
        <p><span className="info-label">LOCATION:</span> <span className="info-value">{session.location}</span></p>
        {session.npcs && session.npcs.length > 0 && (
          <p><span className="info-label">NOTABLE NPCS:</span> <span className="info-value">{session.npcs.join(', ')}</span></p>
        )}
      </div>

      {/* Markdown body */}
      <div className="logs-detail-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {session.body}
        </ReactMarkdown>
      </div>
    </div>
  );
}
```

### CSS Styling (Reuse Personnel Patterns)
```css
/* Source: PersonnelSection.css (adapted for logs) */

.section-logs {
  position: absolute;
  top: 30px;
  bottom: 128px;
  left: 50%;
  transform: translateX(-50%);
  width: 75vw;
  max-width: 1024px;
  z-index: 50;
}

.logs-split {
  display: flex;
  height: 100%;
  gap: 1px;
  background-color: var(--color-border-subtle);
}

.logs-list {
  width: 280px;
  flex-shrink: 0;
  overflow-y: auto;
  padding: 8px;
  background-color: var(--color-bg-panel-dark);
}

.logs-detail {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background-color: var(--color-bg-panel-dark);
}

/* Row styling - matches personnel-row pattern */
.logs-row {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  margin-bottom: 8px;
  background-color: rgba(15, 21, 21, 0.4);
  border: 1px solid var(--color-border-subtle);
  cursor: pointer;
  transition: all 0.2s ease;
}

.logs-row:hover {
  background-color: rgba(74, 107, 107, 0.2);
  border-color: var(--color-teal);
}

.logs-row.selected {
  background-color: rgba(74, 107, 107, 0.3);
  border-color: var(--color-teal);
}

/* Markdown content styling */
.logs-detail-content {
  margin-top: 16px;
  border-top: 1px solid var(--color-border-subtle);
  padding-top: 16px;
}

.logs-h2 {
  color: var(--color-teal);
  font-size: 14px;
  margin: 16px 0 8px 0;
  text-transform: uppercase;
  letter-spacing: 1px;
}

.logs-p {
  color: var(--color-text-primary);
  font-size: 12px;
  line-height: 1.8;
  margin: 8px 0;
}

.logs-strong {
  color: var(--color-amber);
  font-weight: bold;
}

.logs-ul {
  margin: 8px 0;
  padding-left: 20px;
}

.logs-li {
  color: var(--color-text-primary);
  font-size: 12px;
  line-height: 1.6;
  margin: 4px 0;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| markdown-it + raw HTML injection | react-markdown with component mapping | 2024+ | Safer (no XSS), more React-idiomatic, better TypeScript support |
| Separate markdown editor libraries | react-markdown for read-only viewing | 2025+ | Lighter bundle, simpler API for non-editing use cases |
| Custom frontmatter parsing libraries | Built-in YAML + string splitting | Always stable | PyYAML handles all edge cases, no need for python-frontmatter |

**Deprecated/outdated:**
- **python-frontmatter library:** Not needed - PyYAML + manual split is simpler and already used in codebase
- **marked library for React:** Use react-markdown instead - better React integration and safety

## Open Questions

1. **Should session logs support inline images?**
   - What we know: Markdown supports `![alt](path)` syntax, react-markdown handles it by default
   - What's unclear: Where would images be stored (static assets? campaign directory?), how would paths be resolved
   - Recommendation: Start without image support, add if GM requests it. If needed, store in `data/campaign/sessions/images/` and use relative paths.

2. **Should old sessions be archived/hidden?**
   - What we know: Simple scrollable list works for "many sessions" but unclear how many is "many"
   - What's unclear: At what point does list become unwieldy (50 sessions? 100? 200?)
   - Recommendation: Start with simple list showing all sessions. If performance becomes an issue, add pagination or filter by date range.

3. **Should session list be grouped by date/campaign arc?**
   - What we know: User said "simple scrollable list" and "newest first"
   - What's unclear: Whether GMs would benefit from grouping (e.g., "Campaign Arc 1", "Campaign Arc 2")
   - Recommendation: Start with flat list. Can add optional grouping later via frontmatter field like `arc: "The Veil Incident"`.

## Sources

### Primary (HIGH confidence)
- Existing codebase: `/home/gjohnson/mothership/charon/src/components/domain/dashboard/sections/PersonnelSection.tsx` - Two-panel layout pattern
- Existing codebase: `/home/gjohnson/mothership/charon/terminal/data_loader.py` - YAML frontmatter parsing pattern (parse_message_file method)
- Existing codebase: `/home/gjohnson/mothership/charon/terminal/views.py` - Django view data injection pattern
- [react-markdown GitHub](https://github.com/remarkjs/react-markdown) - Official documentation and TypeScript examples
- [react-markdown npm](https://www.npmjs.com/package/react-markdown) - Package details and version info

### Secondary (MEDIUM confidence)
- [React Markdown Complete Guide 2025: Security & Styling Tips](https://strapi.io/blog/react-markdown-complete-guide-security-styling) - Security best practices and styling patterns
- [5 Best Markdown Editors for React Compared](https://strapi.io/blog/top-5-markdown-editors-for-react) - Comparison of markdown libraries
- [markdown-to-jsx vs react-markdown comparison](https://moiva.io/?npm=markdown-to-jsx+react-markdown) - Performance and bundle size comparison

### Tertiary (LOW confidence)
None - all findings verified with codebase inspection or official documentation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - react-markdown is verified industry standard, PyYAML already in use
- Architecture: HIGH - All patterns exist in codebase and proven working
- Pitfalls: MEDIUM-HIGH - Based on common React/markdown issues, some project-specific (tab renaming migration)

**Research date:** 2026-02-11
**Valid until:** 60 days (stable stack, patterns unlikely to change)

---

**Sources:**
- [GitHub - remarkjs/react-markdown](https://github.com/remarkjs/react-markdown)
- [react-markdown - npm](https://www.npmjs.com/package/react-markdown)
- [React Markdown Complete Guide 2025: Security & Styling Tips](https://strapi.io/blog/react-markdown-complete-guide-security-styling)
- [5 Best Markdown Editors for React Compared](https://strapi.io/blog/top-5-markdown-editors-for-react)
- [markdown-to-jsx vs react-markdown: Detailed Comparison](https://moiva.io/?npm=markdown-to-jsx+react-markdown)
