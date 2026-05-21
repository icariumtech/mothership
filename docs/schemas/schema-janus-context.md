# JANUS Context Schema Reference

---

## Purpose

`janus.yaml` is an AI-generated file placed alongside any `location.yaml`. It holds a curated
GM context blob written by the campaign AI agent (e.g., `/janus-generate-context`). The file
summarizes the location's operational status, history, and current relevance for session prep.
It is read at runtime by `get_session_context()` and by `/janus-session-prep`.

---

## Path Convention

Always a sibling of `location.yaml` for the target location:

```
data/galaxy/<system>/<body>/janus.yaml
data/galaxy/<system>/<body>/<sub-location>/janus.yaml
data/ships/<ship-slug>/janus.yaml
data/campaign/ship/janus.yaml
```

MCP write: `write_file("galaxy/anchor-system/veil-station/janus.yaml", content)`
MCP read:  `read_file("galaxy/anchor-system/veil-station/janus.yaml")`

---

## Required Fields

| Field | Type | Note |
|---|---|---|
| `generated` | string | ISO 8601 UTC timestamp — e.g., `"2026-05-17T00:00:00Z"` |
| `context` | string | YAML literal block scalar (`\|`) — multiline GM context text |

No other fields are required. Both fields must be present for the file to be valid.

---

## Context Body Conventions

Based on the canonical veil-station example:

1. **Header line** — `LOCATION NAME — BRIEF TYPE DESCRIPTION` (ALL CAPS)
2. **Status line** — operational status, population, capacity (comma-separated)
3. **Established line** — founding year or date if relevant
4. **Operational paragraph** — one short paragraph describing current function, purpose, or
   campaign-relevant context. Keep it factual and terse — JANUS AI style.

The `context` block is freeform but should stay under 200 words. It is injected directly into
the AI prompt for session prep — shorter is better.

---

## Example

```yaml
# AI-generated JANUS context for this location.
# Written by the campaign AI agent from campaign notes.
# Update via MCP write_file: galaxy/anchor-system/veil-station/janus.yaml
generated: "2026-05-17T00:00:00Z"

context: |
  VEIL STATION — PRIMARY ORBITAL INSTALLATION, ANCHOR SYSTEM
  Operational. Population approximately 12,000. Capacity 15,000.
  Established 2167. L2 Lagrange point, Anchor-3.

  Gateway installation for Outer Veil transit traffic. High volume of
  commercial, industrial, and interstellar operations. Berthing available
  for vessels up to frigate class. Customs and biosecurity screening
  mandatory for all arrivals from the Veil.
```

---

## Generation Notes

- The `generated:` timestamp records when the AI wrote the file — use current UTC time.
- Regenerating overwrites the existing file entirely; no merge required.
- Comments at the top (lines starting `#`) are optional but aid human readers.
- The `context:` literal block must end with a trailing newline (YAML `|` block default).
