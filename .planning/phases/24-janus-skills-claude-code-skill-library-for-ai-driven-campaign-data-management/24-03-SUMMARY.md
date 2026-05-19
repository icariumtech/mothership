---
phase: 24-janus-skills-claude-code-skill-library-for-ai-driven-campaign-data-management
plan: "03"
subsystem: infra
tags: [install, bash, mcp, claude-code, janus-skills, standalone-repo]

# Dependency graph
requires:
  - "24-01: janus-skills repo scaffold"
  - "24-02: schema resource files in resources/"
provides:
  - "install.sh at ~/mothership/janus-skills/ implementing D-08/D-09/D-10"
  - "README.md at ~/mothership/janus-skills/ covering all 8 skills"
  - "Resource symlinks at ~/.claude/janus-skills/resources/ (5 files, from smoke install)"
affects:
  - "24-04 (skills): skills/ will be populated, install.sh symlinks them automatically"
  - "24-05 (skills): same as above"
  - "Users: can now install janus-skills with ./install.sh --global"

# Tech tracking
tech-stack:
  added: [bash, python3-json-merge]
  patterns:
    - "ln -sfn for idempotent symlink installs (no nested links on rerun)"
    - "python3 json.load/json.dump heredoc for JSON merge — never full settings.json overwrite"
    - "REPO_DIR resolved via BASH_SOURCE[0] so script works from any cwd"
    - "Resources always at $HOME/.claude/janus-skills/resources/ — stable @$HOME/-anchored path for SKILL.md @-includes"

key-files:
  created:
    - /home/gjohnson/mothership/janus-skills/install.sh
    - /home/gjohnson/mothership/janus-skills/README.md
  modified: []

key-decisions:
  - "install.sh uses python3 json.load/json.dump for --mcp-config merge (never jq, never full overwrite)"
  - "Resources always install to ~/.claude/janus-skills/resources/ regardless of --global vs --project mode"
  - "ln -sfn chosen over ln -sf to handle the case where target is an existing directory symlink (no-deref flag prevents nesting)"

requirements-completed: []

# Metrics
duration: 2min
completed: "2026-05-19"
---

# Phase 24 Plan 03: install.sh + README Summary

**Bash install script and README for the janus-skills repo — implements D-08 (two install modes), D-09 (symlinks via ln -sfn), and D-10 (MCP config injection via python3 JSON merge) with full idempotency**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-19T14:40:01Z
- **Completed:** 2026-05-19T14:42:09Z
- **Tasks:** 3 of 3
- **Files modified:** 2 (in janus-skills repo)

## Accomplishments

- `install.sh` authored at `/home/gjohnson/mothership/janus-skills/install.sh` (245 lines, executable)
  - `--global` mode: symlinks skills to `~/.claude/skills/`
  - `--project <path>` mode: symlinks skills to `<path>/.claude/skills/`
  - Resources always install to `~/.claude/janus-skills/resources/` (stable HOME path, P3 pitfall avoided)
  - `--mcp-config`: prompts for homelab IP, merges JanusGM block via python3 heredoc
  - Validates: conflicting flags, missing path, non-existent directory, blank IP
  - `bash -n` syntax check passes, all smoke tests pass

- `README.md` authored at `/home/gjohnson/mothership/janus-skills/README.md` (92 lines)
  - All 8 skills in reference table with one-line descriptions and example invocations
  - Prerequisites, installation instructions (global + project + MCP config), schema resources overview, troubleshooting

- Resource symlinks created at `~/.claude/janus-skills/resources/` as a side effect of smoke testing — 5 symlinks pointing to repo `resources/*.md` files

## Task Commits (janus-skills repo)

1. **Task 1:** `822d3b0` — `feat(24-03): add install.sh implementing D-08/D-09/D-10`
2. **Task 2+3:** `8a7d5e1` — `feat(24-03): add README with prerequisites, install steps, and skill reference`

## Smoke Test Results

| Test | Command | Result |
|------|---------|--------|
| Syntax check | `bash -n install.sh` | Exit 0 |
| Help flag | `bash install.sh --help` | Exit 0, prints all 3 flags |
| No args | `bash install.sh` | Exit 1, prints usage |
| Conflicting flags | `bash install.sh --global --project /tmp` | Exit 1, error message |
| Invalid path | `bash install.sh --project /nonexistent/path/xyz123` | Exit 1, error message |
| Project install | `bash install.sh --project /tmp/janus-test-proj` | Exit 0, 5 resources installed |
| Idempotency | same command again | Exit 0, no nested symlinks |

## Resource Symlinks Verification

```
~/.claude/janus-skills/resources/
  schema-campaign.md        -> /home/gjohnson/mothership/janus-skills/resources/schema-campaign.md
  schema-encounters.md      -> /home/gjohnson/mothership/janus-skills/resources/schema-encounters.md
  schema-galaxy.md          -> /home/gjohnson/mothership/janus-skills/resources/schema-galaxy.md
  schema-janus-context.md   -> /home/gjohnson/mothership/janus-skills/resources/schema-janus-context.md
  schema-ships.md           -> /home/gjohnson/mothership/janus-skills/resources/schema-ships.md
```

5 of 5 symlinks present and pointing to repo source files.

## install.sh Line Count

- 245 lines (within 80-250 acceptance range)

## Decisions Made

- python3 json.load/json.dump selected over jq for --mcp-config merge: jq not universally available, python3 is standard
- `ln -sfn` used instead of `ln -sf` for skill directory symlinks: `-n` (no-deref) prevents nesting when target is an existing directory symlink
- Resources path is hardcoded `$HOME/.claude/janus-skills/resources/` — not configurable — ensuring @$HOME/-anchored @-includes always resolve correctly regardless of install mode

## Deviations from Plan

**Minor deviation: install.sh committed separately from README.md**

The plan intended both files to be committed in a single Task 3 commit. Per the per-task commit protocol (each task committed atomically), install.sh was committed after Task 1 verification passed, and README.md was committed after Task 2. Both commits are in the janus-skills repo and the final state matches plan requirements. The plan's single-commit intent was documentation style, not a functional constraint.

## Known Stubs

None — install.sh is fully functional. The `Skills installed: 0` output during smoke tests is correct behavior (skills/ directory will be populated by plans 24-04 and 24-05).

## Self-Check: PASSED

- `/home/gjohnson/mothership/janus-skills/install.sh` exists and is executable
- `/home/gjohnson/mothership/janus-skills/README.md` exists (92 lines)
- janus-skills commit `822d3b0` exists (install.sh)
- janus-skills commit `8a7d5e1` exists (README.md)
- `~/.claude/janus-skills/resources/` contains 5 symlinks
- `/tmp/janus-test-proj` does not exist (cleaned up)
