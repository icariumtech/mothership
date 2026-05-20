---
phase: 24-janus-skills-claude-code-skill-library-for-ai-driven-campaign-data-management
plan: "06"
subsystem: infra
tags: [bash, install, symlinks, python, atomic-write, macOS, portability]

requires:
  - phase: 24-janus-skills-claude-code-skill-library-for-ai-driven-campaign-data-management
    plan: "03"
    provides: "skills/janus-*/ directories populated by plans 04/05; install.sh authored in plan 03"

provides:
  - "install.sh with correct skills glob (CR-01 fixed: all 8 skills symlinked)"
  - "install.sh with atomic settings.json write (CR-02 fixed: tempfile.mkstemp + os.replace)"
  - "install.sh without GNU realpath dependency (WR-06 fixed: REPO_DIR already absolute)"

affects:
  - "janus-skills users on macOS"
  - "any CI/CD running install.sh under set -euo pipefail"

tech-stack:
  added: []
  patterns:
    - "Atomic file write via tempfile.mkstemp + os.replace (survives crash mid-write)"
    - "Bash glob with trailing slash restricts to directories: \"$DIR/prefix-\"*/"
    - "Drop realpath when base path is already absolute — avoids GNU-only dependency"

key-files:
  created: []
  modified:
    - "/home/gjohnson/mothership/janus-skills/install.sh"

key-decisions:
  - "Drop realpath entirely rather than add a python3 shim — REPO_DIR is already absolute, so $f and $skill_dir are already absolute. Simpler and zero new dependency."
  - "Use ${skill_dir%/} parameter expansion to trim trailing slash from glob result before passing to ln"
  - "Atomic write uses tempfile.mkstemp with dir= same directory as target for same-filesystem rename guarantee"

patterns-established:
  - "Skills glob pattern: for skill_dir in \"$REPO_DIR/skills/janus-\"*/; — trailing slash restricts to directories, * wildcard required"

requirements-completed: []

duration: 8min
completed: 2026-05-20
---

# Phase 24 Plan 06: install.sh Gap Closure Summary

**Three install.sh defects fixed: skills glob CR-01 (0 of 8 installed), atomic settings write CR-02, and GNU realpath WR-06 — smoke test now reports "Skills installed: 8 skill(s)"**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-20T02:56:00Z
- **Completed:** 2026-05-20T03:04:36Z
- **Tasks:** 2
- **Files modified:** 1 (install.sh in janus-skills repo)

## Accomplishments

- CR-01 fixed: single `*` wildcard inserted into skills for-loop glob — `"$REPO_DIR/skills/janus-"*/` now expands to all 8 subdirectories
- CR-02 fixed: python heredoc now writes settings.json via `tempfile.mkstemp` + `os.replace` — crash between open and dump no longer truncates existing MCP config
- WR-06 fixed: both `realpath` calls dropped entirely; `$f` (resources) and `${skill_dir%/}` (skills) are already absolute since `REPO_DIR` is computed from `cd ... && pwd`
- Stale NOTE message updated: removed reference to "plans 04/05" (those shipped), now prints generic "expected skills/janus-*/ subdirectories" message

## Task Commits

1. **Task 1: Fix install.sh — CR-01, CR-02, WR-06** — edits applied, verified (no separate commit per plan instructions)
2. **Task 2: Commit install.sh gap closure fixes** — `9a02226` (fix) in janus-skills repo

## Files Created/Modified

- `/home/gjohnson/mothership/janus-skills/install.sh` — skills glob fix (line 148), realpath removal (lines 139, 152-153), atomic write (lines 225-238), NOTE message update (line 159)

## Edit Details

### CR-01 — Skills glob (line 148)

Before:
```bash
for skill_dir in "$REPO_DIR/skills/janus-"/; do
```
After:
```bash
for skill_dir in "$REPO_DIR/skills/janus-"*/; do
```

### WR-06 — Resources loop (line 139)

Before:
```bash
ln -sfn "$(realpath "$f")" "$target"
```
After:
```bash
ln -sfn "$f" "$target"
```

### WR-06 — Skills loop (lines 152-153)

Before:
```bash
ln -sfn "$(realpath "$skill_dir")" "$target"
```
After:
```bash
link_target="${skill_dir%/}"
ln -sfn "$link_target" "$target"
```

### CR-02 — Atomic settings.json write (lines 225-238)

Before:
```python
# Write back with 2-space indentation
with open(settings_path, "w") as fh:
  json.dump(existing, fh, indent=2)
  fh.write("\n")
```
After:
```python
# Write back atomically (tempfile + rename — survives crash mid-write)
import tempfile
tmp_fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(settings_path) or ".",
                                     prefix=".settings_tmp_")
try:
  with os.fdopen(tmp_fd, "w") as fh:
    json.dump(existing, fh, indent=2)
    fh.write("\n")
  os.replace(tmp_path, settings_path)
except Exception:
  try:
    os.unlink(tmp_path)
  except OSError:
    pass
  raise
```

## Smoke Test Output

```
JANUS Skills Installer
  Skills destination : /tmp/janus-verify-test/.claude/skills
  Resources          : /home/gjohnson/.claude/janus-skills/resources

Resources installed: 5 file(s) → /home/gjohnson/.claude/janus-skills/resources
Skills installed   : 8 skill(s) → /tmp/janus-verify-test/.claude/skills

Installed 8 skill(s) + 5 resource(s).

Restart Claude Code for new skills to appear.
```

## Grep Verification

- `grep -c realpath install.sh` = **0** (realpath absent)
- `grep -q 'tempfile.mkstemp' install.sh` = **FOUND**
- `grep -q 'os.replace' install.sh` = **FOUND**
- `grep -E 'for skill_dir in "\$REPO_DIR/skills/janus-"\*/'` = **FOUND**

## Decisions Made

- Dropped `realpath` entirely rather than adding a python3 shim — REPO_DIR computed via `cd ... && pwd` is already absolute, making all glob results absolute by construction. Simpler approach, no new dependency.
- Used `${skill_dir%/}` parameter expansion (not a subshell) to trim the trailing slash the directory-restricting glob appends to each match.

## Deviations from Plan

None — plan executed exactly as written. All four edits (CR-01 glob, WR-06 resources, WR-06 skills, CR-02 atomic write) plus the NOTE cleanup applied as specified.

## Issues Encountered

The plan's acceptance criterion `find /tmp/janus-verify-test/.claude/skills -name SKILL.md | wc -l` returns 0 (not 8) because the installed entries are symlinks to directories, and `find` without `-follow` does not traverse symlinks. `find -follow` returns 8. The installer output `Skills installed: 8 skill(s)` is the authoritative confirmation; the symlink structure is correct by design.

## Next Phase Readiness

- install.sh is fully functional: all 8 skills install, settings.json writes atomically, macOS compatible
- VERIFICATION.md truth #4 ("install.sh implements --global and --project modes") can now be marked VERIFIED
- Anti-pattern entries CR-01, CR-02, WR-06 all closed

---
*Phase: 24-janus-skills-claude-code-skill-library-for-ai-driven-campaign-data-management*
*Completed: 2026-05-20*
