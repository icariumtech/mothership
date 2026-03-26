---
created: 2026-03-26T15:33:00.649Z
title: Add personal logs tab to comm-terminal
area: ui
files:
  - src/components/domain/dashboard/CommTerminalView.tsx
---

## Problem

The comm-terminal currently has Inbox and Sent tabs for messages. There is no place for the terminal user (player character) to create and store personal log entries — journal-style notes written from the character's perspective.

## Solution

Add a "Logs" tab alongside the existing Inbox and Sent tabs in the comm-terminal UI. Personal logs are user-created entries (not received messages), so this tab needs:
- A list view of existing log entries
- A way to create new log entries (title + body text)
- Storage for log entries (likely new Django model or YAML-based, TBD)
- Keep the existing Inbox/Sent tabs and their functionality unchanged
