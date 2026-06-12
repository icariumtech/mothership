# Phase 24: JANUS Skills — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-18
**Phase:** 24-JANUS Skills
**Areas discussed:** Skill structure, Schema bundling, MCP config location, MVP skill set

---

## Skill Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Separate skills per operation | /janus-add-npc, /janus-move-ship etc — focused and tab-discoverable | ✓ |
| One umbrella /janus skill | Single entry point with subcommands — simpler install but not tab-discoverable | |
| Hybrid | Simple ops in one skill, complex ops separate | |

**User's choice:** Separate skills per operation, `janus-` prefix

| Option | Description | Selected |
|--------|-------------|----------|
| janus- prefix | /janus-add-npc style — consistent with gsd-* | ✓ |
| Short names | /add-npc — less typing but collision risk | |

**User's choice:** janus- prefix

| Option | Description | Selected |
|--------|-------------|----------|
| Global ~/.claude/skills/ | Available in every Claude Code session | |
| Project-local | Only when opened in that project | |
| Install script with both modes | --global and --project <path> flags | ✓ |

**Notes:** User clarified they want the install script to support both modes, not locked to one.

---

## Schema Bundling

| Option | Description | Selected |
|--------|-------------|----------|
| Shared resource file | One schema-reference.md, all skills @-include | — (evolved) |
| Inline per-skill | Each skill has its own schema snippet | |
| Runtime-only via MCP | Skills call get_data_schema() at runtime | |

**User's choice:** Shared resource files (plural) — DATA_DIRECTORY_GUIDE split by topic domain

| Option | Description | Selected |
|--------|-------------|----------|
| Condensed summary | ~200-400 lines per resource, key schemas only | ✓ |
| Full DATA_DIRECTORY_GUIDE copy | Complete reference, expensive | |

**Notes:** User's key insight — the whole point is NOT to burn context loading the full DATA_DIRECTORY_GUIDE every time. Split into schema-campaign.md, schema-galaxy.md, schema-ships.md, schema-encounters.md, schema-janus-context.md. Each skill loads only what it needs.

---

## MCP Config Location

| Option | Description | Selected |
|--------|-------------|----------|
| Template in janus-skills repo | mcp-config-template.json, install.sh optionally writes it | ✓ |
| Documented only in README | User adds manually | |
| In janus-deploy | Lives on server, not dev machine | |

**User's choice:** Template in janus-skills repo, optionally written by install.sh

---

## MVP Skill Set

**Selected:** All four initially presented plus four galaxy management skills:

- /janus-generate-context ✓
- /janus-add-npc ✓
- /janus-add-location ✓
- /janus-session-prep ✓
- /janus-add-system ✓ (user-requested)
- /janus-add-body ✓ (user-requested)
- /janus-add-ship ✓ (user-requested)
- /janus-update-galaxy ✓ (user-requested)

**Notes:** User specifically requested galaxy management skills — "we also need skills for adding galaxy information, i.e. stars, fields, shipping lanes, solar systems, orbit maps etc."

---

## Claude's Discretion

- YAML field ordering and comment style in generated files
- Symlinks vs copies in install.sh (symlinks recommended)
- Exact MCP config template structure (follow current Claude Code mcpServers format)

## Deferred Ideas

- Crew/character update skills (update-health, update-stress)
- /janus-add-comm-terminal
- Automated Obsidian sync scheduling
- CI/CD for the janus-skills repo
