---
phase: 24-janus-skills-claude-code-skill-library-for-ai-driven-campaign-data-management
reviewed: 2026-05-19T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - /home/gjohnson/mothership/janus-skills/install.sh
  - /home/gjohnson/mothership/janus-skills/mcp-config-template.json
  - /home/gjohnson/mothership/janus-skills/README.md
  - /home/gjohnson/mothership/janus-skills/resources/schema-campaign.md
  - /home/gjohnson/mothership/janus-skills/resources/schema-encounters.md
  - /home/gjohnson/mothership/janus-skills/resources/schema-galaxy.md
  - /home/gjohnson/mothership/janus-skills/resources/schema-janus-context.md
  - /home/gjohnson/mothership/janus-skills/resources/schema-ships.md
  - /home/gjohnson/mothership/janus-skills/skills/janus-add-body/SKILL.md
  - /home/gjohnson/mothership/janus-skills/skills/janus-add-location/SKILL.md
  - /home/gjohnson/mothership/janus-skills/skills/janus-add-npc/SKILL.md
  - /home/gjohnson/mothership/janus-skills/skills/janus-add-ship/SKILL.md
  - /home/gjohnson/mothership/janus-skills/skills/janus-add-system/SKILL.md
  - /home/gjohnson/mothership/janus-skills/skills/janus-generate-context/SKILL.md
  - /home/gjohnson/mothership/janus-skills/skills/janus-session-prep/SKILL.md
  - /home/gjohnson/mothership/janus-skills/skills/janus-update-galaxy/SKILL.md
findings:
  critical: 3
  warning: 6
  info: 3
  total: 12
status: issues_found
---

# Phase 24: Code Review Report

**Reviewed:** 2026-05-19T00:00:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Reviewed the full janus-skills library: the shell installer, MCP config template, all eight SKILL.md
slash commands, and five schema resource files. The MCP tool prefix (`mcp__JanusGM__`) is consistent
across all SKILL.md files and the YAML frontmatter is well-formed throughout. The schema reference files
are accurate and detailed.

Three blockers were found: a missing wildcard `*` in the skills glob renders the installer inert (zero
skills installed with no error); the Python snippet writes `settings.json` non-atomically (truncation
risk on crash); and the `janus-add-ship` deckplan stub path directs AI to write the legacy format
explicitly forbidden by the schema reference. Six warnings cover correctness gaps that will produce
wrong output: the NPC id formula/example mismatch (period left in id), the ship slug convention
contradicting its own validation regex, an `add-location` process that places moons at the wrong
directory depth, a static ship branch conflicting with the upfront required-argument prompt, duplicate
`@-includes` loading schemas twice into context, and `realpath` not available on macOS.

---

## Critical Issues

### CR-01: Skills glob missing wildcard — zero skills installed silently

**File:** `/home/gjohnson/mothership/janus-skills/install.sh:148`
**Issue:** The for-loop glob is `"$REPO_DIR/skills/janus-"/` — the wildcard `*` is absent after
`janus-`. Bash expands this as a literal path (`skills/janus-/`) which does not exist. The `[[ -d
"$skill_dir" ]] || continue` guard swallows the non-match silently, so the loop body never executes.
`SKILL_COUNT` stays 0, the NOTE branch fires ("No skill directories found yet"), and the user sees
no error — all 8 skills are quietly not installed.

**Fix:**
```bash
# line 148 — add the missing * after janus-
for skill_dir in "$REPO_DIR/skills/janus-"*/; do
```

---

### CR-02: settings.json written non-atomically — truncation risk on crash

**File:** `/home/gjohnson/mothership/janus-skills/install.sh:226-228`
**Issue:** The Python snippet opens `settings_path` for write (`"w"`) and calls `json.dump` directly
into the live file. If the process is interrupted (Ctrl-C, OOM kill, disk full) after `open()` but
before `json.dump` completes, `settings.json` is left truncated or empty — destroying any pre-existing
MCP server entries the user had configured. Restoring requires the user to manually reconstruct their
settings file.

**Fix:** Write to a sibling temp file and rename atomically:
```python
import tempfile, os

tmp_fd, tmp_path = tempfile.mkstemp(dir=os.path.dirname(settings_path),
                                     prefix=".settings_tmp_")
try:
    with os.fdopen(tmp_fd, "w") as fh:
        json.dump(existing, fh, indent=2)
        fh.write("\n")
    os.replace(tmp_path, settings_path)
except:
    os.unlink(tmp_path)
    raise
```

---

### CR-03: janus-add-ship deckplan stub path writes legacy format explicitly forbidden by schema

**File:** `/home/gjohnson/mothership/janus-skills/skills/janus-add-ship/SKILL.md:83-85`
**Issue:** Step 13 instructs the AI to create `ships/<ship-slug>/map/main.yaml` with `rooms: []`.
`schema-encounters.md` explicitly defines the correct new format as `ships/<ship-slug>/deckplan.yaml`
with a `decks:` list, and states: "Skills should write new format only." The `map/main.yaml` path is
the legacy format (`map/manifest.yaml` + individual deck files). A ship created this way will not load
correctly in `EncounterMapDisplay` which expects `deckplan.yaml`.

**Fix:** Update step 13 to use the correct path and minimal scaffold:
```markdown
13. Ask the user if they want an empty deckplan stub. If yes, build a minimal deckplan stub:
    ```yaml
    decks:
      - id: main_deck
        name: Main Deck
        level: 1
        default: true
        unit_size: 30
        rooms: []
    ```
    Call `write_file("ships/<ship-slug>/deckplan.yaml", stub_content)`.
```
Also update the objective text at line 20 (`ships/<slug>/map/main.yaml` → `ships/<slug>/deckplan.yaml`).

---

## Warnings

### WR-01: janus-add-npc id formula produces wrong example — period left in derived id

**File:** `/home/gjohnson/mothership/janus-skills/skills/janus-add-npc/SKILL.md:33`
**Issue:** The documented formula is `name.lower().replace(" ", "_").replace("-", "_")`. Applied to
`"Dr. Elena-Kim"` it produces `dr._elena_kim` (with a literal period and a single underscore). The
SKILL.md example shows `dr__elena_kim` (double underscore, no period) — both the period retention
and the double-underscore claim are wrong. The period in a filename stem (`dr._elena_kim.yaml`) is
technically valid on most filesystems but will look broken and may surprise the data loader's id
matching. Neither the formula nor the example strips punctuation from the id.

**Fix:** Extend the formula to strip non-alphanumeric-underscore characters:
```python
import re
id = re.sub(r'[^a-z0-9_]', '', name.lower().replace(' ', '_').replace('-', '_'))
```
Update the example accordingly: `"Dr. Elena-Kim"` → `dr_elena_kim`.

---

### WR-02: janus-add-ship slug uses underscores but validation regex and galaxy slugs use hyphens

**File:** `/home/gjohnson/mothership/janus-skills/skills/janus-add-ship/SKILL.md:37-43`
**Issue:** Step 3 derives slugs with `name.lower().replace(" ", "_")` (underscores) to match the
`patrol_gunboat` convention. Step 4 then enforces `^[a-z0-9_-]+$` which is consistent. However
the `system_slug` and `body_slug` fields written into the same `location.yaml` must use the
galaxy directory convention (hyphens only). The step says "Both `system_slug` and `body_slug` must
also match this pattern" — but never specifies that those two fields must use hyphens while the ship
slug itself uses underscores. An AI following step 4 literally could normalize a `system_slug` of
`tau-ceti` to `tau_ceti`, silently breaking orbit injection (Pitfall P1).

**Fix:** Add an explicit note that `system_slug` and `body_slug` follow the galaxy slug convention
(lowercase hyphens only, matching the directory name) and must NOT be normalized to underscores.

---

### WR-03: janus-add-location places moon type at wrong directory depth

**File:** `/home/gjohnson/mothership/janus-skills/skills/janus-add-location/SKILL.md:31-63`
**Issue:** Step 2 accepts `type = moon` but the process never branches on moon type and never asks
for a parent planet. The write path (step 9) is hardcoded as
`galaxy/<parent-system>/<location-slug>/location.yaml` — directly under the system. The correct
path for a moon is `galaxy/<system>/<planet>/<moon-slug>/location.yaml` (one level deeper, under
the planet). An AI following this skill for type=moon will write the location.yaml to the wrong
directory and the moon will not appear on the orbit map.

Additionally, type `ship` is accepted by the type prompt but not redirected to `/janus-add-ship`,
which would cause a mis-structured ship entry under `galaxy/` instead of `ships/`.

**Fix:** Add two guards at step 2:
- If `type == moon`: ask for parent planet slug. Adjust write path to
  `galaxy/<parent-system>/<planet-slug>/<location-slug>/location.yaml`.
- If `type == ship`: redirect the user to `/janus-add-ship` and abort.

---

### WR-04: janus-add-ship step 1 requires body slug before ship kind is known — conflicts with static branch

**File:** `/home/gjohnson/mothership/janus-skills/skills/janus-add-ship/SKILL.md:29-35`
**Issue:** Step 1 says "if any are missing, prompt the user before continuing" for all three
arguments including `body slug (parent planet)`. Step 2 then asks whether the ship is orbit,
surface, or static. For the static branch (step 10), `body_slug` and `system_slug` are explicitly
not needed and not written. An AI following step 1 literally will demand a body slug from the user
even for a static installation, creating unnecessary friction and potentially confusing the user.

**Fix:** Change step 1 to mark `system slug` and `body slug` as conditional:
```
1. Parse $ARGUMENTS for ship name (required). Note system slug and body slug as optional hints
   — do NOT prompt for them yet. Ship kind (step 2) determines whether they are needed.
```

---

### WR-05: All SKILL.md files include schema twice via duplicate @-includes — doubles context token cost

**Files:** All 8 SKILL.md files (e.g., `janus-add-body/SKILL.md:11,28`)
**Issue:** Every SKILL.md has a top-level `@-include` immediately after the frontmatter AND a
second identical `@-include` inside the `<schema>` block. Claude Code resolves both at load time,
injecting the full schema content twice into the AI context window. For `janus-generate-context`
this is 4 `@-includes` (two schema files, each duplicated). Since context budget directly affects
reasoning quality for complex tasks, wasting tokens on duplicate schema hurts the skills that need
them most.

**Fix:** Remove the top-level bare `@-include` (line immediately after frontmatter) from each
SKILL.md and keep only the `@-include` inside the `<schema>` block, where its purpose is clear.

---

### WR-06: realpath not available on macOS without coreutils — installer fails silently on macOS

**File:** `/home/gjohnson/mothership/janus-skills/install.sh:139,152`
**Issue:** `realpath "$f"` and `realpath "$skill_dir"` are called to resolve absolute symlink
targets. `realpath` is a GNU coreutils command not included in macOS's default BSD userland. On a
Mac without Homebrew's coreutils installed, both calls fail with `command not found` and — because
`set -euo pipefail` is active — the script aborts mid-installation, leaving partial symlinks. The
error message is cryptic and does not tell the user what to install.

**Fix:** Replace with a portable `readlink -f` implementation or include a fallback:
```bash
# portable realpath using Python (already required for --mcp-config)
_realpath() { python3 -c "import os,sys; print(os.path.realpath(sys.argv[1]))" "$1"; }
# then use: ln -sfn "$(_realpath "$f")" "$target"
```
Alternatively, since symlinks to `$REPO_DIR`-relative paths are being created and `$REPO_DIR` is
already an absolute path from `cd ... && pwd`, the `realpath` call can be replaced by using
`$REPO_DIR`-anchored paths directly for repo files.

---

## Info

### IN-01: janus-generate-context includes schema-galaxy.md unnecessarily

**File:** `/home/gjohnson/mothership/janus-skills/skills/janus-generate-context/SKILL.md:10,26`
**Issue:** The `<schema>` block (and the duplicate top-level `@-include`) loads `schema-galaxy.md`
in addition to `schema-janus-context.md`. The generate-context process reads only
`location.yaml` and writes `janus.yaml`. None of the 9 process steps reference `system_map.yaml`,
`star_map.yaml`, `orbit_map.yaml`, or any galaxy-specific field. The galaxy schema is not used.

**Fix:** Remove the `schema-galaxy.md` include from `janus-generate-context/SKILL.md`. Only
`schema-janus-context.md` is needed.

---

### IN-02: mcp-config-template.json — no port 8001 documentation; non-standard port may surprise users

**File:** `/home/gjohnson/mothership/janus-skills/mcp-config-template.json:5`
**Issue:** The template hardcodes port `8001`. This is not documented in the README as the JANUS
server's expected port (the README only says `http://<your-ip>:8001/mcp/`). Users running a
non-default Docker Compose configuration or a port-forwarding setup on a different port have no
way to override it via `--mcp-config` — the port is baked into the template URL and the Python
injector only replaces `HOMELAB_IP`, not `PORT`.

**Fix (minor):** Add a `HOMELAB_PORT` placeholder alongside `HOMELAB_IP` in the template URL and
update the Python injector to accept a second prompt (with default 8001), or at minimum document
the port in the README troubleshooting section and add a comment to `mcp-config-template.json`.

---

### IN-03: No IP format validation in install.sh — any string accepted as homelab IP

**File:** `/home/gjohnson/mothership/janus-skills/install.sh:175-179`
**Issue:** The retry loop only rejects an empty `HOMELAB_IP`. A typo like `192.168.1` (missing
octet), a hostname, or a stray space is accepted without warning and written directly into
`settings.json`. The resulting URL silently fails to connect with no indication at the MCP config
level.

**Fix:** Add a basic format guard before accepting the value:
```bash
if [[ ! "$HOMELAB_IP" =~ ^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$|^[a-zA-Z0-9.-]+$ ]]; then
  echo "WARNING: '$HOMELAB_IP' does not look like a valid IP or hostname. Continue anyway? [y/N]"
  read -r confirm
  [[ "$confirm" == [yY] ]] || continue
fi
```

---

_Reviewed: 2026-05-19T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
