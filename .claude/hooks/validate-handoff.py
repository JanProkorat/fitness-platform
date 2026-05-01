#!/usr/bin/env python3
"""validate-handoff.py — stdlib-only JSON-schema validator for handoff files.

Used by the SubagentStop hook (gate-check.sh) to enforce that sub-agents'
final handoff JSON conforms to its declared schema BEFORE control returns
to the orchestrator. Malformed handoffs get rejected with a precise message
so the agent can self-correct.

Usage:
    python3 validate-handoff.py <handoff-file.json>

Exit codes:
    0 = valid
    1 = file or schema not found / read error
    2 = schema validation failed (with diagnostic on stderr)

The validator is intentionally minimal — supports just the JSON Schema
subset our schemas use: type, required, properties, enum, const, pattern,
minimum/minItems/maxLength, additionalProperties:false, anyOf, items.
No third-party deps.

Path convention: schema file lives at the path given by the handoff's
`$schema` field, resolved relative to CLAUDE_PROJECT_DIR.
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path
from typing import Any


PROJECT_DIR = Path(os.environ.get("CLAUDE_PROJECT_DIR") or Path.cwd())


def fail(msg: str, code: int = 2) -> "Never":
    print(f"[validate-handoff] {msg}", file=sys.stderr)
    sys.exit(code)


def load_json(path: Path) -> Any:
    try:
        with path.open() as f:
            return json.load(f)
    except FileNotFoundError:
        fail(f"file not found: {path}", code=1)
    except json.JSONDecodeError as e:
        fail(f"invalid JSON in {path}: {e}", code=2)


def validate(instance: Any, schema: dict, path: str = "$") -> list[str]:
    """Walk schema vs instance; return list of error strings (empty = valid)."""
    errors: list[str] = []

    # const
    if "const" in schema:
        if instance != schema["const"]:
            errors.append(f"{path}: expected const {schema['const']!r}, got {instance!r}")
        return errors

    # enum
    if "enum" in schema:
        if instance not in schema["enum"]:
            errors.append(f"{path}: must be one of {schema['enum']}, got {instance!r}")
        return errors

    # type
    expected = schema.get("type")
    if expected:
        if isinstance(expected, list):
            if not _matches_any_type(instance, expected):
                errors.append(f"{path}: type must be one of {expected}, got {type(instance).__name__}")
                return errors
        elif not _matches_type(instance, expected):
            errors.append(f"{path}: type must be {expected}, got {type(instance).__name__}")
            return errors

    if isinstance(instance, dict):
        # required
        for key in schema.get("required", []):
            if key not in instance:
                errors.append(f"{path}: missing required key '{key}'")

        # properties
        props = schema.get("properties", {})
        for key, value in instance.items():
            if key in props:
                errors.extend(validate(value, props[key], f"{path}.{key}"))

        # additionalProperties: false
        if schema.get("additionalProperties") is False:
            for key in instance:
                if key not in props:
                    errors.append(f"{path}: additional property '{key}' not allowed")

    elif isinstance(instance, list):
        items_schema = schema.get("items")
        if items_schema:
            for i, item in enumerate(instance):
                errors.extend(validate(item, items_schema, f"{path}[{i}]"))

        if "minItems" in schema and len(instance) < schema["minItems"]:
            errors.append(f"{path}: must have at least {schema['minItems']} items, got {len(instance)}")

    elif isinstance(instance, str):
        if "pattern" in schema and not re.match(schema["pattern"], instance):
            errors.append(f"{path}: value {instance!r} does not match pattern {schema['pattern']!r}")
        if "maxLength" in schema and len(instance) > schema["maxLength"]:
            errors.append(f"{path}: length {len(instance)} exceeds maxLength {schema['maxLength']}")

    elif isinstance(instance, (int, float)) and not isinstance(instance, bool):
        if "minimum" in schema and instance < schema["minimum"]:
            errors.append(f"{path}: value {instance} below minimum {schema['minimum']}")

    return errors


def _matches_type(instance: Any, expected: str) -> bool:
    if expected == "string":  return isinstance(instance, str)
    if expected == "integer": return isinstance(instance, int) and not isinstance(instance, bool)
    if expected == "number":  return isinstance(instance, (int, float)) and not isinstance(instance, bool)
    if expected == "boolean": return isinstance(instance, bool)
    if expected == "object":  return isinstance(instance, dict)
    if expected == "array":   return isinstance(instance, list)
    if expected == "null":    return instance is None
    return False


def _matches_any_type(instance: Any, expected: list[str]) -> bool:
    return any(_matches_type(instance, t) for t in expected)


def validate_citations(instance: Any) -> list[str]:
    """Cross-check rule_citations against actual H2 anchors in cited files.

    Tier 4.13 of the plan. Returns errors when a citation references a file
    or anchor that doesn't exist on disk.
    """
    errors: list[str] = []
    if not isinstance(instance, dict):
        return errors

    citations = instance.get("rule_citations") or []
    if not isinstance(citations, list):
        return errors

    for cite in citations:
        if not isinstance(cite, str):
            continue

        # Skip CLAUDE.md citations — they reference loose keywords, not anchors.
        if cite.startswith("CLAUDE.md"):
            continue

        # Format: <path>#<anchor>
        if "#" not in cite:
            errors.append(f"rule_citation '{cite}' missing '#anchor'")
            continue
        rel_path, anchor = cite.split("#", 1)

        full = PROJECT_DIR / ".claude" / rel_path
        if not full.is_file():
            errors.append(f"rule_citation '{cite}' — file not found: {full}")
            continue

        try:
            text = full.read_text(encoding="utf-8")
        except OSError as e:
            errors.append(f"rule_citation '{cite}' — could not read file: {e}")
            continue

        slugs = _slugify_h2s(text)
        if anchor not in slugs:
            close = _closest_matches(anchor, slugs)
            suffix = f" (closest: {', '.join(close)})" if close else ""
            errors.append(f"rule_citation '{cite}' — anchor '{anchor}' not found in {rel_path}{suffix}")

    return errors


def _slugify_h2s(markdown: str) -> set[str]:
    slugs = set()
    for line in markdown.splitlines():
        if line.startswith("## ") and not line.startswith("### "):
            heading = line[3:].strip()
            slug = re.sub(r"[^a-z0-9]+", "-", heading.lower()).strip("-")
            slugs.add(slug)
    return slugs


def _closest_matches(target: str, options: set[str], n: int = 3) -> list[str]:
    """Cheap closest-match by shared-prefix length, no third-party deps."""
    scored = sorted(
        options,
        key=lambda o: -_shared_prefix_len(target, o),
    )
    return [o for o in scored[:n] if _shared_prefix_len(target, o) >= 3]


def _shared_prefix_len(a: str, b: str) -> int:
    n = 0
    for ca, cb in zip(a, b):
        if ca == cb:
            n += 1
        else:
            break
    return n


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("usage: validate-handoff.py <handoff-file.json>", file=sys.stderr)
        return 1

    handoff_path = Path(argv[1])
    instance = load_json(handoff_path)

    if not isinstance(instance, dict):
        fail(f"handoff root must be an object, got {type(instance).__name__}", code=2)

    schema_id = instance.get("$schema")
    if not schema_id:
        fail(f"handoff missing $schema field — cannot determine which schema to validate against", code=2)

    schema_path = PROJECT_DIR / schema_id
    schema = load_json(schema_path)

    errors = validate(instance, schema)
    errors.extend(validate_citations(instance))

    if errors:
        print(f"[validate-handoff] {handoff_path} FAILED validation against {schema_id}:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 2

    print(f"[validate-handoff] {handoff_path} OK ({schema_id})", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
