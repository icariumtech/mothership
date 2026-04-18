# Phase 15: Data Directory Audit + Bug Fixes — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-17
**Phase:** 15-data-directory-audit-and-bug-fixes
**Areas discussed:** Audit findings, Dead code fix strategy, body_slug script form, Audit output format

---

## Audit Findings — Act or Document?

| Option | Description | Selected |
|--------|-------------|----------|
| Document only, Phase 16 handles it | Record manifest references as Phase 16 dependency | ✓ |
| Fix the TypeScript types here | Rename manifest → deckplan in types now | |
| Fix only if low-risk | Fix isolated type aliases, defer API contracts | |

**User's choice:** Document only — Phase 16 handles the manifest → deckplan rename.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fix in-place if small, document if large | ≤~10 lines fix in; larger changes documented | ✓ |
| Document all, fix nothing extra | Strictly scoped to listed bugs only | |
| Fix everything found | Get data_loader.py fully clean | |

**User's choice:** Fix in-place if small (≤~10 lines), document if large in audit-15.md.

---

## Dead Code Fix Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Point to data/galaxy/ | self.locations_dir = self.galaxy_dir | |
| Point to data/ root | self.locations_dir = self.data_dir | |
| Check what the callers expect | Inspect callers first to infer path | ✓ |

**User's choice:** Check callers (sync_campaign_data.py, line-769 wrapper) before setting self.locations_dir.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fix the path to 'map/' (singular) | Rename searched dir from maps/ to map/, keep method | ✓ |
| Delete + inline the logic | Remove method and inline in load_location_recursive() | |
| Audit callers first, then decide | Check data/ map/ structure before deciding | |

**User's choice:** Fix the path from maps/ to map/ singular. Keep the method.

---

## Body Slug Script Form

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone Python script in tools/ | tools/validate_body_slugs.py | ✓ |
| Django management command | python manage.py validate_body_slugs | |
| Either — Claude decides | Simplest approach | |

**User's choice:** Standalone Python script at tools/validate_body_slugs.py.

---

## Audit Output Format

| Option | Description | Selected |
|--------|-------------|----------|
| Markdown file: tools/audit-15.md | Dedicated audit report in tools/ | ✓ |
| Inline in SUMMARY.md | Append findings to phase SUMMARY.md | |
| Comment block in data_loader.py | Inline TODO/audit notes in the file | |

**User's choice:** Write findings to tools/audit-15.md.

---

## Claude's Discretion

- Internal structure of validate_body_slugs.py
- Formatting of tools/audit-15.md header/structure

## Deferred Ideas

- TypeScript manifest → deckplan rename deferred to Phase 16
