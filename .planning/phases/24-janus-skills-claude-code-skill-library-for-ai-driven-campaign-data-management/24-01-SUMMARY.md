---
phase: 24-janus-skills-claude-code-skill-library-for-ai-driven-campaign-data-management
plan: "01"
subsystem: infra
tags: [git, mcp, claude-code, janus-skills, standalone-repo]

# Dependency graph
requires: []
provides:
  - "Standalone git repo at ~/mothership/janus-skills/ on branch main"
  - "resources/ and skills/ placeholder directories tracked via .gitkeep"
  - "mcp-config-template.json with JanusGM HTTP MCP server entry and HOMELAB_IP placeholder"
  - "Initial commit 153d824 with all 4 tracked files"
affects:
  - "24-02 (resources): writes schema-*.md files into resources/"
  - "24-03 (skills + install.sh): writes SKILL.md subdirs into skills/"
  - "All downstream phase 24 plans: repo shell must exist before content can be added"

# Tech tracking
tech-stack:
  added: [git, bash]
  patterns:
    - "Standalone repo pattern: janus-skills lives at ~/mothership/janus-skills/ (sibling to charon, no coupling)"
    - "MCP config template uses HOMELAB_IP literal placeholder (not angle-bracket style)"
    - "Resources installed to ~/.claude/janus-skills/resources/ regardless of skills destination (for @$HOME/... include resolution)"

key-files:
  created:
    - /home/gjohnson/mothership/janus-skills/.gitignore
    - /home/gjohnson/mothership/janus-skills/mcp-config-template.json
    - /home/gjohnson/mothership/janus-skills/resources/.gitkeep
    - /home/gjohnson/mothership/janus-skills/skills/.gitkeep
  modified: []

key-decisions:
  - "janus-skills is a standalone repo at ~/mothership/janus-skills/ — NOT nested in charon"
  - "MCP config key is JanusGM (case-sensitive) matching FastMCP('JanusGM') in mcp_server.py"
  - "URL placeholder is literal HOMELAB_IP (no angle brackets) for sed-friendly replacement by install.sh"
  - "Initial commit includes all 4 files in a single atomic commit"

patterns-established:
  - "All janus-skills commits go to ~/mothership/janus-skills/ git repo, not to charon"
  - "mcp-config-template.json shape: mcpServers.JanusGM.{type:http, url:http://HOMELAB_IP:8001/mcp/, description}"

requirements-completed: []

# Metrics
duration: 1min
completed: "2026-05-19"
---

# Phase 24 Plan 01: janus-skills Repo Scaffold Summary

**Standalone git repo initialized at ~/mothership/janus-skills/ with resources/ and skills/ placeholder directories and a valid mcp-config-template.json wiring the JanusGM HTTP MCP server**

## Performance

- **Duration:** ~1 min
- **Started:** 2026-05-19T14:30:42Z
- **Completed:** 2026-05-19T14:31:37Z
- **Tasks:** 2 of 2
- **Files modified:** 4 (in janus-skills repo)

## Accomplishments

- Standalone git repo created at `/home/gjohnson/mothership/janus-skills/` on branch `main` — verified as sibling to charon (not nested)
- `resources/` and `skills/` subdirectories created with `.gitkeep` placeholders so git tracks them
- `mcp-config-template.json` written with valid JSON, `JanusGM` server key (case-sensitive match to `FastMCP("JanusGM")` in `mcp_server.py`), literal `HOMELAB_IP` placeholder, and descriptive field
- Initial commit `153d824` on `main` includes all 4 tracked files; working tree clean

## Initial Commit Contents

Commit `153d82417ef29a18964313d4d9e9a7d02bec6886` on `main`:
- `.gitignore` — 7 entries (.DS_Store, *.swp, *.swo, .idea/, .vscode/, node_modules/, __pycache__/)
- `resources/.gitkeep` — zero-byte placeholder
- `skills/.gitkeep` — zero-byte placeholder
- `mcp-config-template.json` — MCP server config template

## mcp-config-template.json Exact Shape

Downstream plans can rely on this exact structure:

```json
{
  "mcpServers": {
    "JanusGM": {
      "type": "http",
      "url": "http://HOMELAB_IP:8001/mcp/",
      "description": "JANUS GM campaign data server — reads and writes campaign YAML files"
    }
  }
}
```

Key guarantees:
- `mcpServers.JanusGM.type` = `"http"`
- `mcpServers.JanusGM.url` = `"http://HOMELAB_IP:8001/mcp/"` (literal placeholder, no angle brackets)
- `mcpServers.JanusGM.description` = non-empty string
- File uses 2-space indentation with trailing newline
- Exactly one occurrence of `"JanusGM"` as the server key

## Sibling Layout Verification

```
/home/gjohnson/mothership/
├── charon/   (existing — Janus GM tool)
├── janus-deploy/   (existing)
├── janus-skills/   (NEW — this plan)
└── planning/   (existing)
```

`realpath` confirmed both paths share parent `/home/gjohnson/mothership/`. janus-skills is NOT a subdirectory of charon.

## Task Commits

Both tasks combined into a single initial commit in the janus-skills repo (per plan instruction to defer commit until after Task 2):

1. **Task 1: Initialize janus-skills repo with directory skeleton** — staged (no separate commit)
2. **Task 2: Write mcp-config-template.json + initial commit** — `153d824` (chore: initialize janus-skills repository)

Note: Tasks 1 and 2 share a single commit by plan design — Task 1 explicitly deferred committing until Task 2 was complete so all 4 files land in one initial commit.

## Files Created

- `/home/gjohnson/mothership/janus-skills/.gitignore` — Standard Python/editor ignores
- `/home/gjohnson/mothership/janus-skills/resources/.gitkeep` — Placeholder for schema resource files
- `/home/gjohnson/mothership/janus-skills/skills/.gitkeep` — Placeholder for SKILL.md subdirectories
- `/home/gjohnson/mothership/janus-skills/mcp-config-template.json` — Claude Code MCP server config template

## Decisions Made

- Confirmed MCP server key `"JanusGM"` is case-sensitive and must match `FastMCP("JanusGM")` in `mcp_server.py` line 22 — downstream plans must use `mcp__JanusGM__*` as the tool prefix in `allowed-tools`
- Used literal `HOMELAB_IP` placeholder (not `<HOMELAB_IP>` or `${HOMELAB_IP}`) for easy `sed` replacement in `install.sh`
- Used `git init --initial-branch=main` to set branch name at init time rather than post-init renaming

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required for repo scaffolding.

## Next Phase Readiness

- `resources/` directory is ready to receive the 5 schema markdown files (Plan 24-02)
- `skills/` directory is ready to receive the 8 `janus-*/SKILL.md` subdirectories (Plan 24-03)
- `mcp-config-template.json` shape is locked; `install.sh` (Plan 24-03) can rely on the `HOMELAB_IP` placeholder format
- No blockers for downstream plans

---
*Phase: 24-janus-skills-claude-code-skill-library-for-ai-driven-campaign-data-management*
*Completed: 2026-05-19*
