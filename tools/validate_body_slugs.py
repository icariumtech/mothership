#!/usr/bin/env python3
"""
validate_body_slugs.py — Phase 18 migration pre-flight check.

Scans all system_map.yaml and orbit_map.yaml files for `location_slug` and
`body_slug` fields and verifies each one resolves to a real directory under
data/galaxy/.

Usage:
    python tools/validate_body_slugs.py
    python tools/validate_body_slugs.py --data-dir /path/to/data
    python tools/validate_body_slugs.py --verbose

Exit code 0 = all slugs resolve. Exit code 1 = at least one mismatch found.
"""
import argparse
import sys
from pathlib import Path
import yaml


def find_yaml_files(galaxy_dir: Path) -> list[Path]:
    """Collect all system_map.yaml and orbit_map.yaml files under galaxy/."""
    targets = []
    for pattern in ("**/system_map.yaml", "**/orbit_map.yaml"):
        targets.extend(galaxy_dir.glob(pattern))
    return sorted(targets)


def extract_location_slugs(yaml_file: Path) -> list[dict]:
    """
    Parse a YAML file and return all location_slug / body_slug references found
    in body entries (top-level `bodies:` list).

    Returns list of dicts: {slug, field_name, source_file, body_name}
    """
    refs = []
    try:
        with open(yaml_file) as f:
            data = yaml.safe_load(f)
    except Exception as e:
        print(f"  WARNING: could not parse {yaml_file}: {e}", file=sys.stderr)
        return refs

    if not isinstance(data, dict):
        return refs

    bodies = data.get("bodies", [])
    if not isinstance(bodies, list):
        return refs

    for body in bodies:
        if not isinstance(body, dict):
            continue
        body_name = body.get("name", "<unnamed>")
        for field in ("location_slug", "body_slug"):
            slug = body.get(field)
            if slug:
                refs.append({
                    "slug": slug,
                    "field": field,
                    "source": str(yaml_file),
                    "body": body_name,
                })

    # Also check top-level location_slug (some files have it at root)
    top_slug = data.get("location_slug")
    if top_slug:
        refs.append({
            "slug": top_slug,
            "field": "location_slug",
            "source": str(yaml_file),
            "body": "<top-level>",
        })

    return refs


def resolve_slug(slug: str, galaxy_dir: Path) -> Path | None:
    """
    Find the directory in data/galaxy/ that corresponds to a slug.

    Searches recursively — a slug like "phoebe" might be at
    data/galaxy/tau-ceti/tau-ceti-e/phoebe/.
    """
    # Direct match under galaxy/
    direct = galaxy_dir / slug
    if direct.is_dir():
        return direct

    # Recursive search
    for candidate in galaxy_dir.rglob(slug):
        if candidate.is_dir():
            return candidate

    return None


def validate(data_dir: Path, verbose: bool = False) -> bool:
    """
    Run the full validation. Returns True if all slugs resolve, False otherwise.
    """
    galaxy_dir = data_dir / "galaxy"
    if not galaxy_dir.exists():
        print(f"ERROR: galaxy directory not found at {galaxy_dir}", file=sys.stderr)
        return False

    yaml_files = find_yaml_files(galaxy_dir)
    if not yaml_files:
        print("No system_map.yaml or orbit_map.yaml files found.", file=sys.stderr)
        return True

    all_refs = []
    for yaml_file in yaml_files:
        refs = extract_location_slugs(yaml_file)
        all_refs.extend(refs)

    if not all_refs:
        print("No location_slug or body_slug references found.")
        return True

    ok_count = 0
    fail_count = 0
    failures = []

    for ref in all_refs:
        slug = ref["slug"]
        resolved = resolve_slug(slug, galaxy_dir)
        if resolved:
            ok_count += 1
            if verbose:
                print(f"  OK  {slug:<30}  ({ref['body']} in {Path(ref['source']).name})")
        else:
            fail_count += 1
            failures.append(ref)
            print(
                f"  MISS {slug:<30}  "
                f"field={ref['field']}  body={ref['body']!r}  "
                f"file={ref['source']}"
            )

    print()
    print(f"Results: {ok_count} resolved, {fail_count} missing")

    if failures:
        print()
        print("FAILED — the following slugs have no matching directory in data/galaxy/:")
        for ref in failures:
            print(f"  - {ref['slug']!r}  ({ref['body']} in {ref['source']})")
        return False

    print("PASSED — all body slugs resolve to data/galaxy/ paths.")
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Validate body_slug / location_slug references in system_map and orbit_map YAML files."
    )
    parser.add_argument(
        "--data-dir",
        default="data",
        help="Path to the data/ directory (default: data)",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Print each resolved slug, not just failures",
    )
    args = parser.parse_args()

    data_dir = Path(args.data_dir)
    if not data_dir.exists():
        print(f"ERROR: data directory not found: {data_dir}", file=sys.stderr)
        sys.exit(1)

    passed = validate(data_dir, verbose=args.verbose)
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
