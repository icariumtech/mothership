# Phase 24: JANUS Skills — Research

**Researched:** 2026-05-18
**Domain:** Claude Code skill authoring, MCP HTTP transport, YAML campaign schema
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Skill Structure**
- D-01: Separate skill per operation — one `.md` file per skill.
- D-02: All skills use the `janus-` prefix (e.g., `/janus-add-npc`).
- D-03: Skills follow established Claude Code pattern: YAML frontmatter (`name`, `description`, `allowed-tools`) + `<objective>` + `<process>` sections.

**Schema Bundling**
- D-04: DATA_DIRECTORY_GUIDE split into topic-specific resource files — each skill includes only the slice it needs.
- D-05: Resource files in `resources/` within the janus-skills repo: `schema-campaign.md`, `schema-galaxy.md`, `schema-ships.md`, `schema-encounters.md`, `schema-janus-context.md`.
- D-06: Resource files are condensed summaries (~200-400 lines), not full copies of DATA_DIRECTORY_GUIDE.
- D-07: Skills can call `get_data_schema()` at runtime as a fallback, but this is not the primary knowledge source.

**Installation**
- D-08: `install.sh` supports `--global` (→ `~/.claude/skills/`) and `--project <path>` (→ `<path>/.claude/skills/`). Optional `--mcp-config` flag writes MCP server config to target `.claude/settings.json`.
- D-09: Symlinks (not copies) so updating janus-skills repo automatically updates installed skills.

**MCP Config**
- D-10: `mcp-config-template.json` in repo root. `install.sh --mcp-config` optionally injects it into `.claude/settings.json`. User provides homelab server IP during install.

**MVP Skill Set (8 skills)**
- D-11: `/janus-generate-context` — reads location.yaml via MCP, writes `janus.yaml`
- D-12: `/janus-add-npc` — creates `data/campaign/npcs/[id].yaml`
- D-13: `/janus-add-location` — creates galaxy location directory + `location.yaml`
- D-14: `/janus-session-prep` — calls `get_session_context()`, reads `janus.yaml` files, produces GM session brief
- D-15: `/janus-add-system` — adds star system to `star_map.yaml` + creates system directory
- D-16: `/janus-add-body` — adds planet/moon/station to existing system, updates `system_map.yaml` + `orbit_map.yaml`
- D-17: `/janus-add-ship` — registers new ship in `data/ships/` with `location.yaml`
- D-18: `/janus-update-galaxy` — edits `star_map.yaml` for nebulae, routes, system visual properties

### Claude's Discretion

- Exact YAML field ordering and comment style within generated files
- Whether install.sh uses symlinks or copies (symlinks recommended)
- Exact MCP config template structure (follow Claude Code's current `mcpServers` format)

### Deferred Ideas (OUT OF SCOPE)

- Crew/character update skills (update-health, update-stress, update-status)
- `/janus-add-comm-terminal`
- Automated scheduling (cron-triggered Obsidian sync)
- CI/CD for the janus-skills repo itself

</user_constraints>

---

## Summary

Phase 24 creates the `janus-skills` GitHub repository: a collection of Claude Code skill `.md` files that encode the JANUS campaign data schema into focused AI workflows. The phase involves authoring 8 SKILL.md files, 5 condensed schema resource files, an install script, and an MCP config template. This is primarily a **content creation and file structure** phase — no Python/TypeScript code is modified in the main charon repo.

The critical technical challenge is **how resource files are referenced from SKILL.md files**. Claude Code `@`-includes always resolve relative to the project CWD, not relative to the skill file's location. This means `@./resources/schema-campaign.md` in a globally-installed skill at `~/.claude/skills/janus-add-npc/SKILL.md` would NOT resolve to the resource alongside the skill — it would resolve against the user's current project root. The viable solutions are: (A) embed schema content inline in SKILL.md, or (B) store resources at a predictable `$HOME`-anchored path that works for both `--global` and `--project` installs. Option B (resources at `~/.claude/janus-skills/resources/`) is the cleanest: install.sh creates this stable directory regardless of skills destination, and SKILL.md uses `@$HOME/.claude/janus-skills/resources/schema-campaign.md`.

The MCP server (Phase 23) exposes five tools over HTTP transport at port 8001. All file paths passed to MCP tools are relative to `data/` — skills must never pass absolute paths. Write operations trigger SSE broadcasts automatically. The MCP config template uses the `"type": "http"` format in the `mcpServers` block of `.claude/settings.json`.

**Primary recommendation:** Store resource files at `~/.claude/janus-skills/resources/` (created by `install.sh`), reference them via `@$HOME/.claude/janus-skills/resources/schema-*.md` in all SKILL.md files.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Skill definition + schema knowledge | janus-skills repo (SKILL.md files) | — | Self-contained knowledge files, no server involvement |
| Campaign data read/write | MCP server (port 8001) | Django REST API | MCP tools delegate to Django; skills must not call Django directly |
| Schema condensation (resources/) | janus-skills repo | DATA_DIRECTORY_GUIDE.md (source) | Resource files are derivatives of DATA_DIRECTORY_GUIDE |
| Installation (symlinks/copies) | install.sh | Shell environment | Script handles both global + project-local cases |
| MCP connectivity config | `.claude/settings.json` in target project | `mcp-config-template.json` (template) | Claude Code reads this file to connect to MCP server |
| Session context + live game state | `get_session_context()` MCP tool | — | Django aggregates active encounter, tokens, ship status, NPC list |

---

## Standard Stack

### This Phase Produces (Not Consumes)

This phase creates content files (SKILL.md, resource .md, install.sh, JSON config). There are no npm/pip packages to install. The deliverables are:

| Artifact | Format | Purpose |
|----------|--------|---------|
| `skills/janus-*/SKILL.md` | Markdown with YAML frontmatter | Claude Code slash commands |
| `resources/schema-*.md` | Markdown | Condensed schema references |
| `install.sh` | Bash | Installs skills + resources to target location |
| `mcp-config-template.json` | JSON | MCP server connection config template |
| `README.md` | Markdown | Setup instructions for users |

### Runtime Dependencies (for skill consumers, not for building this phase)

| Tool | Purpose | Config Location |
|------|---------|-----------------|
| Claude Code CLI | Executes skills at `/janus-*` invocation | Installed globally by user |
| JANUS MCP server (port 8001) | Data read/write for campaign YAML | `mcpServers` in `.claude/settings.json` |
| FastMCP (Python) | MCP server runtime | Docker container (Phase 23) |

---

## Architecture Patterns

### SKILL.md File Structure

Verified from reading `~/.claude/skills/gsd-add-tests/SKILL.md` and `~/.claude/skills/gsd-capture/SKILL.md`. [VERIFIED: local codebase inspection]

```markdown
---
name: janus-add-npc
description: "Create a new NPC entry in data/campaign/npcs/. Use when adding an NPC to the campaign roster."
argument-hint: "<npc-name-or-description>"
allowed-tools:
  - mcp__JanusGM__read_file
  - mcp__JanusGM__write_file
  - mcp__JanusGM__list_files
---

<objective>
Create a well-formed NPC YAML file at data/campaign/npcs/[id].yaml via the JANUS MCP server.
</objective>

<schema>
@$HOME/.claude/janus-skills/resources/schema-campaign.md
</schema>

<process>
1. Parse $ARGUMENTS for NPC name and optional details.
2. Call list_files("campaign/npcs") to see existing NPCs and avoid id collisions.
3. Derive id from name: lowercase, underscores (e.g., "Captain Harrow" → "captain_harrow").
4. Ask user for any missing required fields (faction, role, status, description).
5. Build YAML string following schema below.
6. Call write_file("campaign/npcs/{id}.yaml", content).
7. Confirm: "NPC {name} created at campaign/npcs/{id}.yaml".
</process>
```

**Key YAML frontmatter fields:** [VERIFIED: local codebase inspection]
- `name`: Invocation name (becomes `/name` slash command)
- `description`: What the model sees when deciding which skill to load. Must include "Use when..." trigger.
- `argument-hint`: Shown in tab-completion UI
- `allowed-tools`: MCP tool names use format `mcp__<ServerName>__<tool_name>`. The JANUS MCP server is named `"JanusGM"` (from `FastMCP("JanusGM")` in `mcp_server.py`). [VERIFIED: mcp_server.py line 22]

### @-Include Path Resolution (Critical Finding)

[VERIFIED: local codebase inspection of GSD skills]

Claude Code `@`-includes resolve as follows:
- `@$HOME/path/to/file.md` — absolute, env var expanded. Works from any project.
- `@.planning/STATE.md` — resolves from project CWD (not from skill file location).
- `@./resources/file.md` — ALSO resolves from CWD, NOT from the skill file. This means a globally-installed skill at `~/.claude/skills/janus-add-npc/SKILL.md` cannot use `@./resources/schema-campaign.md` — that would look for `<current-project>/resources/schema-campaign.md`.

**Consequence for janus-skills:** Resource files must be placed at a stable `$HOME`-anchored path regardless of whether `--global` or `--project` install mode is used. The install.sh script should always copy/symlink resources to `~/.claude/janus-skills/resources/`, and SKILL.md files should use `@$HOME/.claude/janus-skills/resources/schema-campaign.md`.

This directory (`~/.claude/janus-skills/`) is separate from the skills install destination (`~/.claude/skills/` or `<path>/.claude/skills/`).

### MCP Tool Names in `allowed-tools`

The FastMCP server name determines the tool name prefix in Claude Code. From `mcp_server.py`:
```python
mcp = FastMCP("JanusGM")
```
This means MCP tool names in SKILL.md `allowed-tools` are: [VERIFIED: mcp_server.py]
- `mcp__JanusGM__get_session_context`
- `mcp__JanusGM__list_files`
- `mcp__JanusGM__read_file`
- `mcp__JanusGM__write_file`
- `mcp__JanusGM__get_data_schema`

### MCP Config Template Format

HTTP transport MCP servers use this format in Claude Code's `.claude/settings.json`: [VERIFIED: local inspection of `~/.claude/plugins/marketplaces/everything-claude-code/mcp-configs/mcp-servers.json`]

```json
{
  "mcpServers": {
    "JanusGM": {
      "type": "http",
      "url": "http://<server-ip>:8001/mcp/",
      "description": "JANUS GM campaign data server"
    }
  }
}
```

The server name `"JanusGM"` must match `FastMCP("JanusGM")` in `mcp_server.py` for tool names to resolve correctly. [VERIFIED: mcp_server.py]

### MCP Tool Path Conventions

All paths passed to `read_file`, `write_file`, `list_files` are **relative to `data/`**. [VERIFIED: mcp_server.py docstrings]

```python
# From mcp_server.py:
async def list_files(dir: str) -> list:
    """List files in a data directory. dir is relative to data/ (e.g. 'campaign/crew')."""

async def read_file(path: str) -> str:
    """Read raw YAML content of a campaign file. path is relative to data/ (e.g. 'campaign/ship/ship.yaml')."""

async def write_file(path: str, content: str) -> dict:
    """Write YAML content to a campaign file. Triggers SSE broadcast."""
```

**Examples:**
- `list_files("campaign/npcs")` — lists all NPC files
- `read_file("galaxy/anchor-system/veil-station/location.yaml")` — reads a location
- `write_file("campaign/npcs/captain_harrow.yaml", yaml_str)` — creates/overwrites NPC
- `read_file("galaxy/star_map.yaml")` — reads the galaxy map

### Install Script Pattern

```bash
#!/usr/bin/env bash
# Typical pattern for janus-skills install.sh

GLOBAL_MODE=false
PROJECT_PATH=""
MCP_CONFIG=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --global) GLOBAL_MODE=true ;;
    --project) PROJECT_PATH="$2"; shift ;;
    --mcp-config) MCP_CONFIG=true ;;
  esac
  shift
done

# Determine install destination
if $GLOBAL_MODE; then
  SKILLS_DIR="$HOME/.claude/skills"
else
  SKILLS_DIR="$PROJECT_PATH/.claude/skills"
fi

# Always install resources to stable HOME path (regardless of skills destination)
RESOURCES_DIR="$HOME/.claude/janus-skills/resources"
mkdir -p "$RESOURCES_DIR"

# Symlink resource files
for f in resources/*.md; do
  ln -sf "$(realpath "$f")" "$RESOURCES_DIR/$(basename "$f")"
done

# Symlink skill directories
for skill_dir in skills/janus-*/; do
  skill_name=$(basename "$skill_dir")
  ln -sf "$(realpath "$skill_dir")" "$SKILLS_DIR/$skill_name"
done
```

### Recommended Repo Structure

```
janus-skills/
├── README.md
├── install.sh
├── mcp-config-template.json
├── resources/
│   ├── schema-campaign.md       # crew, NPC, corporation, standby schemas
│   ├── schema-galaxy.md         # star_map, system_map, orbit_map, location hierarchy
│   ├── schema-ships.md          # ship location.yaml, slug-pointer model, orbit injection
│   ├── schema-encounters.md     # deckplan, rooms, doors, POIs
│   └── schema-janus-context.md  # janus.yaml format
└── skills/
    ├── janus-generate-context/
    │   └── SKILL.md
    ├── janus-add-npc/
    │   └── SKILL.md
    ├── janus-add-location/
    │   └── SKILL.md
    ├── janus-session-prep/
    │   └── SKILL.md
    ├── janus-add-system/
    │   └── SKILL.md
    ├── janus-add-body/
    │   └── SKILL.md
    ├── janus-add-ship/
    │   └── SKILL.md
    └── janus-update-galaxy/
        └── SKILL.md
```

### Anti-Patterns to Avoid

- **Using `@./resources/...` in SKILL.md**: Resolves from project CWD, not skill location. Always use `@$HOME/.claude/janus-skills/resources/...` instead.
- **Absolute paths in MCP tool calls**: All MCP paths are relative to `data/`. Never pass `/app/data/...` or `./data/...`.
- **Direct Django API calls**: Skills must use MCP tools, never call `http://server:8000/api/...` directly.
- **Lowercase-only `allowed-tools`**: Tool names are case-sensitive and must match the server name exactly (`JanusGM`, not `janusgm`).
- **Single `allowed-tools` list for all skills**: Each skill should only declare the MCP tools it actually uses — keeps permissions minimal.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| YAML slug derivation | Custom regex | Standard string transform: `name.lower().replace(" ", "_")` | Simple, no library needed |
| YAML validation | Custom parser | `python3 -c "import yaml; yaml.safe_load(...)"` | PyYAML handles all edge cases |
| MCP connectivity | Custom HTTP client in SKILL.md | `mcp__JanusGM__*` tool calls | Claude Code handles transport |
| Full schema in each skill | Inline copy of DATA_DIRECTORY_GUIDE | `@$HOME/.claude/janus-skills/resources/schema-*.md` | DRY, maintainable |

---

## JANUS Data Schema Reference (Verified)

This section summarizes the actual verified field sets from live data files. These ARE the schemas the resource files should capture.

### NPC Schema (`data/campaign/npcs/`)

[VERIFIED: captain_harrow.yaml, lucia_vance.yaml — live data files]

Minimal NPC (no Mothership stats — suitable for background characters):
```yaml
id: "captain_harrow"           # required, matches filename stem
name: "Captain Dex Harrow"     # required
role: "Salvage Operator"       # required
faction: "Independent"         # required
location: "The Outer Veil"     # optional
status: "ACTIVE"               # required: ACTIVE | INACTIVE | DECEASED | UNKNOWN
description: "..."             # required
portrait: "/path/to/img.png"   # optional
```

Full NPC with Mothership stats (for combatant/significant NPCs):
```yaml
id: "sarah_kim"
name: "Lt. Sarah Kim"
role: "Security Chief"
class: "Marine"               # optional: character class
portrait: "/static/portraits/kim.png"
stats:
  strength: 7
  speed: 7
  intellect: 5
  combat: 9
saves:
  sanity: 35
  fear: 50
  body: 50
stress: 3
health:
  current: 10
  max: 14
wounds: 1
armor: 3
background: "Colonial Marine"
motivation: "Protect the crew"
status: "ACTIVE"
description: "..."
```

### Crew Schema (`data/campaign/crew/`)

Same format as full NPC. `id:` must match filename stem. [VERIFIED: elena_vasquez.yaml, sarah_kim.yaml]

### Location Schema (`data/galaxy/...` and `data/ships/...`)

Permanent installation example: [VERIFIED: veil-station/location.yaml]
```yaml
name: "Veil Station"
type: "station"               # required: ship | station | planet | moon | system
parent_system: "anchor-system"
orbital_body: "Anchor-3"
orbital_position: "L2 Lagrange Point"
status: "OPERATIONAL"
population: "~12,000"
crew_capacity: 15000
established: "2167"
description: "..."
lore:
  note: "03 Locations/Veil Station.md"   # optional: Obsidian vault link
  janus_sections: [...]
  exclude_patterns: [...]
janus:
  instance_id: "VEIL-JANUS-001"          # optional: JANUS AI instance config
  clearance_level: "INTERNAL"
  designation: "Station Operations AI"
```

Mobile ship location.yaml: [VERIFIED: patrol_gunboat/location.yaml]
```yaml
name: "USCSS Patrol Gunboat"
type: "ship"
description: ""
status: "OPERATIONAL"
parent_type: orbit             # required for orbit injection: orbit | surface
body_slug: tau-ceti-f          # exact match to planet directory name
system_slug: tau-ceti          # exact match to system directory name
orbital:
  radius: 32
  period: 90
  angle: 135
  inclination: 0
  size: 1.5
  icon_type: ship              # ship | station | shipyard
```

Player ship location.yaml: [VERIFIED: data/campaign/ship/location.yaml]
```yaml
name: "USCSS Morrigan"
type: "ship"
slug: "uscss_morrigan"
status: "OPERATIONAL"
```

### janus.yaml Schema (`data/galaxy/.../janus.yaml`)

[VERIFIED: veil-station/janus.yaml]
```yaml
# Written by campaign AI agent from campaign notes.
generated: "2026-05-17T00:00:00Z"
context: |
  [LOCATION NAME] — [BRIEF TYPE]
  [Status]. [Key facts].

  [Operational context paragraph for GM use.]
```

### star_map.yaml Schema (`data/galaxy/star_map.yaml`)

[VERIFIED: DATA_DIRECTORY_GUIDE.md + live file inspection]
```yaml
camera:
  position: [0, 0, 100]
  lookAt: [0, 0, 0]
  fov: 75
systems:
  - name: "Sol"
    position: [0, 0, 0]
    color: 0xFFFFAA
    size: 2.5
    type: "star"
    label: true
    location_slug: "sol"      # must match data/galaxy/{slug}/
    info:
      description: "..."
      population: "..."
routes:
  - from: "Sol"
    to: "Tau Ceti"
    color: 0x5a7a9a
    route_type: "major_trade"
    travel_time_days: 52
nebulae:
  - name: "The Veil"
    position: [0, 0, 0]
    color: 0x5aaa9a
    size: 65
    particle_count: 3500
    opacity: 0.14
    type: "emission"
```

### system_map.yaml Schema (`data/galaxy/{system}/system_map.yaml`)

[VERIFIED: DATA_DIRECTORY_GUIDE.md]
```yaml
star:
  name: "Tau Ceti"
  color: 0xFFFFBB
  size: 4.5
camera:
  position: [0, 127, 127]
  lookAt: [0, 0, 0]
  fov: 75
bodies:
  - name: "Tau Ceti e"
    type: "planet"
    location_slug: "tau-ceti-e"   # exact match to subdirectory name
    orbital_radius: 50
    orbital_period: 168
    size: 1.6
    color: 0x4682B4
    clickable: true
    has_orbit_map: true
    info:
      description: "..."
```

### orbit_map.yaml Schema (moons only; ships/stations self-register)

[VERIFIED: DATA_DIRECTORY_GUIDE.md + live tau-ceti-f/orbit_map.yaml]
```yaml
planet:
  name: "Tau Ceti f"
  type: "planet"
  size: 17.5
  texture: "/textures/terrestrial/Terrestrial-EQUIRECTANGULAR-1-2048x1024.png"
camera:
  position: [0, 35, 58]
  lookAt: [0, 0, 0]
  fov: 60
moons:
  - name: "Verdant"
    location_slug: "verdant"      # exact match to subdirectory name
    orbital_radius: 50
    orbital_period: 220
    orbital_angle: 45
    inclination: 4.2
    size: 2.5
    color: 0x7A6B5D
    clickable: false
    has_facilities: false
```

---

## Skill-to-Resource Mapping

| Skill | Primary Resources | MCP Tools Used |
|-------|-------------------|----------------|
| `/janus-generate-context` | schema-galaxy.md, schema-janus-context.md | read_file, write_file |
| `/janus-add-npc` | schema-campaign.md | list_files, write_file |
| `/janus-add-location` | schema-galaxy.md | list_files, write_file |
| `/janus-session-prep` | schema-janus-context.md | get_session_context, list_files, read_file |
| `/janus-add-system` | schema-galaxy.md | read_file, write_file |
| `/janus-add-body` | schema-galaxy.md | read_file, write_file |
| `/janus-add-ship` | schema-ships.md | list_files, write_file |
| `/janus-update-galaxy` | schema-galaxy.md | read_file, write_file |

---

## Common Pitfalls

### Pitfall 1: Slug Case Mismatch Silently Breaks Orbit Injection

**What goes wrong:** Ship or station does not appear on the orbit map despite having an `orbital:` block.
**Why it happens:** `body_slug` and `system_slug` are free-text strings. `body_slug: tau-ceti-F` (capital F) does not match the directory `tau-ceti-f`.
**How to avoid:** Skills generating location.yaml must enforce lowercase-hyphenated slugs. Add validation step: derive slug from directory name, never from display name.
**Warning signs:** Location loads in tree but absent from orbit map view.
[VERIFIED: DATA_DIRECTORY_GUIDE.md Section 2 "Typo warning"]

### Pitfall 2: id/filename Mismatch in Character Files

**What goes wrong:** Character file loads but is skipped with "duplicate id" log message, or fails uniqueness check.
**Why it happens:** The `id:` field must exactly match the filename stem. `id: elena_vasquez` in `data/campaign/crew/elena_vasquez.yaml` is correct. `id: Elena Vasquez` is wrong.
**How to avoid:** Skills creating character files should derive `id` the same way as filename: `name.lower().replace(" ", "_").replace("-", "_")`. Always write the derived id into the `id:` field.
**Warning signs:** Character doesn't appear in crew list despite file existing.
[VERIFIED: DATA_DIRECTORY_GUIDE.md Section 6.2]

### Pitfall 3: @-Include Resolves from CWD, Not Skill Location

**What goes wrong:** Skill writes `@./resources/schema-campaign.md`. When user runs the skill from their project, Claude Code looks for `<project-root>/resources/schema-campaign.md`, not `~/.claude/skills/janus-add-npc/resources/schema-campaign.md`. File not found — skill runs without schema context.
**Why it happens:** Claude Code `@`-includes are CWD-relative, not skill-file-relative. Only `@$HOME/...` and `@$VARIABLE/...` patterns resolve absolutely.
**How to avoid:** Always use `@$HOME/.claude/janus-skills/resources/schema-campaign.md`. The install.sh must always populate `~/.claude/janus-skills/resources/` regardless of which skills installation mode was used.
**Warning signs:** Skill generates incorrect YAML field names (missing schema context).
[VERIFIED: codebase inspection — gsd-add-tests uses @.planning/ (CWD-relative), gsd-ui-review uses @$HOME/ (absolute)]

### Pitfall 4: Wrong MCP Tool Name Prefix

**What goes wrong:** `allowed-tools: [mcp__janus__read_file]` in frontmatter. MCP tool unavailable — Claude cannot call it.
**Why it happens:** Tool name prefix is derived from the `FastMCP(name)` argument. `FastMCP("JanusGM")` → prefix `mcp__JanusGM__`. Case must match exactly.
**How to avoid:** Use `mcp__JanusGM__read_file` (with capital G and M) in all `allowed-tools` entries.
**Warning signs:** Tool not found error when skill tries to call MCP.
[VERIFIED: mcp_server.py line 22: `mcp = FastMCP("JanusGM")`]

### Pitfall 5: body_slug Injection Only Reaches Top-Level Bodies (Planets)

**What goes wrong:** Skill sets `body_slug: verdant` (a moon). Ship appears under root of galaxy tree, not under Verdant.
**Why it happens:** The data loader's `body_slug` injection only resolves against direct children of system nodes (planets). Moons are not valid `body_slug` targets.
**How to avoid:** `/janus-add-ship` should warn user if they specify a moon slug as `body_slug`. Valid targets are planets (direct children of system directories).
**Warning signs:** Ship appears at wrong level in location tree.
[VERIFIED: DATA_DIRECTORY_GUIDE.md Section 2 "Depth limitation"]

### Pitfall 6: Symlink Install Requires Source Repo to Remain at Original Path

**What goes wrong:** User moves/renames the janus-skills repo after installing. All symlinks break. Skills silently disappear.
**Why it happens:** Symlinks are absolute paths to the original repo location.
**How to avoid:** install.sh should use `realpath` to create absolute symlinks. README should warn: "Do not move the janus-skills directory after installing with symlinks."
**Warning signs:** Skill commands stop working after moving the repo.
[ASSUMED — based on symlink behavior; no unique janus-skills-specific documentation to verify]

---

## Code Examples

### Minimal SKILL.md Template

```markdown
---
name: janus-add-npc
description: "Create a new NPC entry in data/campaign/npcs/. Use when adding an NPC, character, or contact to the campaign roster."
argument-hint: "<npc-name> [faction] [role]"
allowed-tools:
  - mcp__JanusGM__list_files
  - mcp__JanusGM__write_file
---

<objective>
Create a well-formed NPC YAML file at data/campaign/npcs/[id].yaml using the JANUS MCP server.
Produces: data/campaign/npcs/{id}.yaml
</objective>

<schema>
@$HOME/.claude/janus-skills/resources/schema-campaign.md
</schema>

<process>
1. Parse $ARGUMENTS for NPC name and optional faction/role hints.
2. Call list_files("campaign/npcs") to see existing NPCs — avoid id collision.
3. Derive id: name to lowercase, spaces to underscores (e.g. "Captain Harrow" → "captain_harrow").
4. Ask for any missing required fields: faction, role, status, description.
5. Build YAML string with id, name, role, faction, status, description (+ optional stats).
6. Call write_file("campaign/npcs/{id}.yaml", content).
7. Confirm: "NPC {name} created at campaign/npcs/{id}.yaml".
</process>
```

### Minimal schema-campaign.md Resource File

```markdown
# Campaign Schema Reference

## NPC / Crew YAML (`data/campaign/npcs/` and `data/campaign/crew/`)

### Required fields
- `id`: Lowercase + underscores, must match filename stem exactly (`captain_harrow` in `captain_harrow.yaml`)
- `name`: Display name
- `role`: Job/title
- `status`: ACTIVE | INACTIVE | DECEASED | UNKNOWN

### NPC-only fields
- `faction`: Faction or employer name
- `location`: Current location (free text)

### Full character fields (crew + significant NPCs)
- `class`: Teamster | Scientist | Marine | Android
- `stats`: { strength, speed, intellect, combat } — range 2–10, 5 average
- `saves`: { sanity, fear, body } — percentage (e.g. 35)
- `stress`: integer (0+)
- `health`: { current, max }
- `wounds`: integer
- `armor`: integer
- `background`: Background description
- `motivation`: Character motivation

### Optional
- `portrait`: path to portrait image
- `description`: Character bio
```

### MCP Config Template (`mcp-config-template.json`)

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

### install.sh Shape

```bash
#!/usr/bin/env bash
set -euo pipefail

GLOBAL_MODE=false
PROJECT_PATH=""
MCP_CONFIG=false
REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

usage() {
  echo "Usage: $0 [--global | --project <path>] [--mcp-config]"
  exit 1
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --global) GLOBAL_MODE=true ;;
    --project) PROJECT_PATH="${2:-}"; shift ;;
    --mcp-config) MCP_CONFIG=true ;;
    *) usage ;;
  esac
  shift
done

# Validate
if $GLOBAL_MODE && [[ -n "$PROJECT_PATH" ]]; then
  echo "Cannot use --global and --project together"; exit 1
fi
if ! $GLOBAL_MODE && [[ -z "$PROJECT_PATH" ]]; then
  echo "Specify --global or --project <path>"; usage
fi

# Determine skills destination
if $GLOBAL_MODE; then
  SKILLS_DIR="$HOME/.claude/skills"
else
  SKILLS_DIR="$PROJECT_PATH/.claude/skills"
fi

# Resources always go to stable HOME path (required for @$HOME/... includes to work)
RESOURCES_DIR="$HOME/.claude/janus-skills/resources"
mkdir -p "$RESOURCES_DIR" "$SKILLS_DIR"

# Install resources (symlinks → repo resources/)
for f in "$REPO_DIR/resources/"*.md; do
  target="$RESOURCES_DIR/$(basename "$f")"
  ln -sf "$f" "$target"
  echo "  Resource: $target"
done

# Install skills (symlinks → repo skills/janus-*/)
for skill_dir in "$REPO_DIR/skills/janus-"/; do
  skill_name="$(basename "$skill_dir")"
  target="$SKILLS_DIR/$skill_name"
  ln -sf "$skill_dir" "$target"
  echo "  Skill: $target → $skill_dir"
done

# Optional: inject MCP config
if $MCP_CONFIG; then
  # ...read target settings.json, merge mcpServers block...
fi

echo "Done. Run Claude Code and use /janus-* commands."
```

---

## Runtime State Inventory

This is a content-creation phase that creates a new repository (`janus-skills`). It does not rename or migrate existing data. No runtime state inventory is needed.

None — verified by phase scope: creating new files, no renames or refactors of existing runtime-registered state.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| bash | install.sh | ✓ | 5.1.16 | — |
| git | repo creation | ✓ | 2.43 | — |
| JANUS MCP server (port 8001) | Skill runtime testing | Conditional (Docker required) | — | Document-only testing without live server |
| Claude Code CLI | Running installed skills | ✓ | (installed globally) | — |

**Missing dependencies with fallback:**
- JANUS MCP server: Skills can be authored and installed without a running server. Live testing requires `docker compose up` (Phase 23). Skills can be verified for format correctness without a live server.

---

## Validation Architecture

`workflow.nyquist_validation` is absent from `.planning/config.json` — treated as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None — this phase creates markdown + bash files, not application code |
| Quick run command | `bash install.sh --global && ls ~/.claude/skills/janus-*` |
| Full suite command | Inspect each SKILL.md for frontmatter validity + test one skill invocation |

This phase is content-only: SKILL.md files, resource .md files, install.sh, JSON config. There are no unit-testable functions and no E2E browser tests applicable.

**Validation approach:**
- **install.sh**: Test with `bash install.sh --global` and verify symlinks created
- **SKILL.md format**: Verify each file has valid YAML frontmatter (parseable with `python3 -c "import yaml; yaml.safe_load(open('...').read().split('---')[1])"`)
- **Resource @-includes**: Verify `@$HOME/.claude/janus-skills/resources/schema-*.md` resolves correctly after install
- **MCP config**: Validate `mcp-config-template.json` is valid JSON

### Phase Requirements → Test Map

| Req | Behavior | Test Type | Automated Command |
|-----|----------|-----------|-------------------|
| D-08 global | install.sh --global creates symlinks at ~/.claude/skills/ | smoke | `bash install.sh --global && ls ~/.claude/skills/janus-add-npc/` |
| D-08 project | install.sh --project creates symlinks at project/.claude/skills/ | smoke | `bash install.sh --project /tmp/test-project && ls /tmp/test-project/.claude/skills/` |
| D-09 symlinks | Installed skills are symlinks, not copies | smoke | `ls -la ~/.claude/skills/janus-add-npc` (should show `->`) |
| D-03 frontmatter | Each SKILL.md has valid YAML frontmatter | unit | `for f in skills/*/SKILL.md; do python3 -c "import yaml; yaml.safe_load(open('$f').read().split('---')[1])" && echo OK; done` |
| resources path | Schema resource @-include path resolves after install | smoke | `ls ~/.claude/janus-skills/resources/schema-campaign.md` |

### Wave 0 Gaps

None — no test framework install required. Validation is shell-command-based.

---

## Security Domain

This phase creates markdown and shell files in a new repository. No authentication, cryptography, session management, or user input validation is involved in the deliverables themselves.

The install.sh script runs locally on the user's machine with standard user permissions. It creates symlinks and optionally modifies `.claude/settings.json`. No secrets are written — the MCP server URL is a local IP address, not a credential.

**ASVS categories:** Not applicable for this phase (content creation, no authentication/session/access control concerns in the deliverables).

**Security note for `install.sh --mcp-config`:** The script should use a JSON merge approach when writing to `.claude/settings.json` to avoid overwriting existing `mcpServers` entries. It should NOT overwrite the entire file. [ASSUMED — standard safe-merge practice for config injection scripts]

---

## State of the Art

| Old Pattern | Current Pattern | Impact |
|-------------|-----------------|--------|
| Global `@-include` for skill resources | `@$HOME/...` absolute path or inline embedding | Skills must use absolute HOME-anchored paths for portability |
| Single monolithic `AGENTS.md` | Per-skill `SKILL.md` files (150 lines each) | Context-efficient; each session loads only relevant skills |
| stdio MCP transport | HTTP transport (`"type": "http"`) | JANUS uses HTTP; no subprocess spawning needed |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Symlink install breaks if repo is moved (warn in README) | Common Pitfalls #6 | Low — predictable symlink behavior, easy to document |
| A2 | install.sh --mcp-config should use JSON merge, not full file overwrite | Security Domain | Medium — could destroy user's other MCP configs if wrong |
| A3 | FastMCP server name "JanusGM" maps to tool prefix `mcp__JanusGM__` in Claude Code | Standard Stack | High — if prefix format differs, all allowed-tools entries are wrong. Needs verification with live MCP session. |

**Note on A3:** The `mcp__ServerName__tool` naming convention is the observed pattern in Claude Code. `mcp_server.py` clearly shows `FastMCP("JanusGM")`. [ASSUMED pattern confirmed by convention but not by testing a live MCP session with this specific server.]

---

## Open Questions

1. **FastMCP server name → allowed-tools prefix mapping**
   - What we know: `FastMCP("JanusGM")` creates the server. Claude Code MCP tools use `mcp__<ServerName>__<tool>` naming.
   - What's unclear: Whether the exact string `"JanusGM"` becomes the prefix verbatim (case-sensitive), or whether it's normalized. The `mcpServers` config key in `settings.json` ALSO named `"JanusGM"` may be what Claude Code uses for the prefix, not the FastMCP server name.
   - Recommendation: In the MCP config template and SKILL.md frontmatter, use `"JanusGM"` consistently as both the mcpServers key and the tool prefix. Test one skill invocation against a live server before declaring the prefix convention locked.

2. **install.sh JSON merge for settings.json**
   - What we know: install.sh optionally writes `mcpServers` block to `.claude/settings.json`.
   - What's unclear: The exact merge strategy — should it use `jq`, Python's `json` module, or a custom sed approach? `jq` may not be available on all machines.
   - Recommendation: Use Python's `json` module (always available) for settings.json merging. Add a check: `if ! command -v python3; then echo "python3 required for --mcp-config"; exit 1; fi`.

---

## Sources

### Primary (HIGH confidence)
- `mcp_server.py` — MCP tool signatures, server name, path conventions (locally verified)
- `data/galaxy/anchor-system/veil-station/janus.yaml` — canonical janus.yaml format (locally verified)
- `data/galaxy/anchor-system/veil-station/location.yaml` — canonical location.yaml (locally verified)
- `data/campaign/npcs/captain_harrow.yaml`, `lucia_vance.yaml` — NPC schema (locally verified)
- `data/campaign/crew/elena_vasquez.yaml`, `sarah_kim.yaml` — crew schema (locally verified)
- `data/ships/patrol_gunboat/location.yaml` — ship pointer model (locally verified)
- `DATA_DIRECTORY_GUIDE.md` — complete schema specification (locally verified)
- `~/.claude/skills/gsd-add-tests/SKILL.md` — SKILL.md frontmatter pattern (locally verified)
- `~/.claude/skills/gsd-capture/SKILL.md` — routing pattern in skills (locally verified)
- `~/.claude/skills/write-a-skill/SKILL.md` — skill authoring guidance (locally verified)
- `~/.claude/plugins/marketplaces/everything-claude-code/mcp-configs/mcp-servers.json` — HTTP MCP transport format (locally verified)

### Secondary (MEDIUM confidence)
- `~/.claude/skills/gsd-ui-review/SKILL.md` — `@$HOME/...` include pattern observed in practice

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- SKILL.md structure: HIGH — verified from multiple existing examples
- @-include path resolution: HIGH — verified by inspecting actual GSD skill behavior
- MCP tool name prefix: MEDIUM — derived from FastMCP("JanusGM") + convention; not tested live
- install.sh pattern: MEDIUM — standard bash symlink patterns, flagged A2 assumption
- Schema field sets: HIGH — verified from live data files

**Research date:** 2026-05-18
**Valid until:** 2026-06-18 (stable domain — SKILL.md format and data schemas are not fast-moving)
