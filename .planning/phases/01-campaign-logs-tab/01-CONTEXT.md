# Phase 1: Campaign Logs Tab - Context

**Gathered:** 2026-02-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Rename the existing NOTES bridge tab to LOGS and populate it with campaign session log entries loaded from markdown files with YAML frontmatter. Session list on the left, content panel on the right. Data loaded from `data/campaign/sessions/` directory.

</domain>

<decisions>
## Implementation Decisions

### Log entry content
- Each entry has: session number, date, title, body text, location, and notable NPCs
- GM writes entries manually between sessions as recaps
- Entry length varies widely — UI must handle both short paragraphs and multi-paragraph narratives
- Body content is markdown (supports bold, lists, headers) — rendered in the UI

### Visual presentation
- Two-panel layout matching the PERSONNEL tab pattern: session list on the left sidebar, selected entry content on the right
- Data terminal feel — structured fields and labels, compact, consistent with other bridge panels
- Right panel shows a header block with labeled metadata fields (session #, date, title, location, notable NPCs) above the body text

### Data format
- One file per session in `data/campaign/sessions/` (e.g., `session-007.md`)
- Markdown with YAML frontmatter — frontmatter contains session number, date, title, location, notable NPCs; body is markdown narrative
- Follows existing data patterns (YAML frontmatter + markdown content)

### Entry ordering & navigation
- Sidebar list shows newest session first (most recent at top)
- Each list item shows: session number + title + date
- Most recent session auto-selected when opening LOGS tab
- Simple scrollable list for handling many sessions

### Claude's Discretion
- Exact YAML frontmatter field names and schema
- Markdown rendering approach in the right panel
- Sidebar styling details and spacing
- Empty state when no session files exist
- How location and notable NPCs are formatted in the header block

</decisions>

<specifics>
## Specific Ideas

- Layout should mirror the PERSONNEL tab's two-panel design (list left, detail right)
- Keep the data terminal aesthetic — this is a ship's log viewer, not a blog

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-campaign-logs-tab*
*Context gathered: 2026-02-11*
