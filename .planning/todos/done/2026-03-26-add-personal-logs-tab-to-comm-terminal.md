---
created: 2026-03-26T15:33:00.649Z
title: Add logs tab to NPC comm-terminal
area: ui
files:
  - src/components/domain/terminal/CommTerminalDialog.tsx
  - src/services/terminalApi.ts
  - terminal/views.py
  - terminal/data_loader.py
  - data/galaxy/*/comms/*/
---

## Problem

NPC comm-terminals (e.g. `commanders_terminal`) have inbox and sent folders but no logs. GMs want to add static log entries to a terminal's data — personal journal-style entries authored as YAML files, visible in a Logs tab.

## Solution

Static file approach — same pattern as inbox/sent:

**Data**: Add a `logs/` folder under each terminal directory. Each log is a YAML file with `title`, `timestamp`, `author`, `content`.

**Backend**: Extend `api_terminal_data` (views.py) to load `terminal.get('logs', [])` and include it in the response. DataLoader already reads the folder structure.

**Frontend**:
- Extend `ViewMode` to include `'logs'`
- Add LOGS tab button in `CommTerminalDialog`
- Render log entries in the main area — no from/to/priority fields, just title, date, author, content
- Log list in sidebar follows the same pattern as message list

No Django model, no write UI, no migration needed.
