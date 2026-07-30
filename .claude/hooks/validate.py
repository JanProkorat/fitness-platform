#!/usr/bin/env python3
"""validate.py — stdlib-only JSON Schema validator for agent handoff files.

WHEN DOES THIS RUN?
  This is a PostToolUse hook. Claude Code fires it AFTER a subagent successfully
  writes a handoff file (anything matching .claude/state/handoff-*.json).
  At that point the file exists on disk and we can validate its structure.

WHAT DOES IT DO?
  Reads the written file, looks up the matching JSON Schema for that agent type,
  and validates the file's content against that schema. If the file doesn't
  conform (e.g. a required field is missing), this script exits with code 2,
  which Claude Code surfaces as an error to the agent so it can self-correct.

WHY STDLIB ONLY?
  Claude Code's hook environment may not have third-party libraries installed.
  We implement only the JSON Schema subset that our handoff shapes actually use,
  keeping the validator self-contained and dependency-free.

SUPPORTED JSON SCHEMA KEYWORDS:
  required, enum, const, type (string/integer/array/object/boolean/null),
  pattern, minItems, minLength, minimum, additionalProperties (false), items.
  Intentionally unsupported: oneOf, anyOf — our schemas avoid them.
"""
from __future__ import annotations  # Enables modern type-hint syntax on Python 3.9

import json    # Built-in JSON parser
import os      # OS-level utilities (not heavily used here, but available)
import re      # Regular expression engine for "pattern" validation
import sys     # Access to stdin, stderr, and exit()
from pathlib import Path  # Object-oriented file path manipulation


# ── Project root ─────────────────────────────────────────────────────────────

# Every path below resolves against this, NOT the current working directory.
# CWD is wherever the agent last cd'd to, so a CWD-relative
# ".claude/schemas/..." lookup silently misses whenever an agent is working
# under src/ or tests/ — and main() then took its "schema missing -> allow"
# branch, switching the validation gate off with no visible error.
PROJECT_DIR = Path(os.environ.get("CLAUDE_PROJECT_DIR") or Path.cwd())


# ── Logging ──────────────────────────────────────────────────────────────────

# Directory where hook log files are stored (one file per calendar day).
LOG_DIR = PROJECT_DIR / ".claude/hooks/log"

# Create the log directory (and any missing parents) if it doesn't already exist.
# exist_ok=True means no error if the directory already exists.
LOG_DIR.mkdir(parents=True, exist_ok=True)


def log(msg: str) -> None:
    """Append a timestamped message to today's log file."""
    from datetime import date
    # Build today's log file path, e.g. ".claude/hooks/log/2026-04-17.log".
    # .open("a") opens the file in append mode (creates it if it doesn't exist).
    (LOG_DIR / f"{date.today().isoformat()}.log").open("a").write(
        f"[validate] {msg}\n"
    )


# ── Schema registry ───────────────────────────────────────────────────────────

# Maps the handoff file name prefix to the JSON Schema file that describes its shape.
# When a subagent writes "handoff-developer.json", we find its schema here.
HANDOFF_SCHEMAS = {
    "handoff-designer":       ".claude/schemas/work-items.v1.json",
    "handoff-developer":      ".claude/schemas/dev-result.v1.json",
    "handoff-design-reviewer": ".claude/schemas/design-review.v1.json",
    "handoff-impl-reviewer":  ".claude/schemas/impl-review.v1.json",
    # researcher.md writes its handoff against research.v1.json and cites that
    # schema three times. Without this entry _handoff_key() returns None and the
    # researcher's handoff was skipped silently — never validated.
    "handoff-researcher":     ".claude/schemas/research.v1.json",
}

# Standalone schemas for non-handoff state files. Matched by exact file name.
STANDALONE_SCHEMAS = {
    "pipeline.json": ".claude/schemas/pipeline-state.v1.json",
}

# Upper bound on a string's length before the "pattern" check runs. Guards
# against ReDoS if somebody later lands a pathological regex in a schema.
MAX_PATTERN_INPUT_LEN = 10_000

# Minimal `format` validators. JSON Schema `format` is advisory by default, but
# we treat a handful as required. Unknown formats pass silently (forward-compat).
_DATETIME_RE = re.compile(
    r"^\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(?:\.\d+)?"
    r"(?:[Zz]|[+-]\d{2}:?\d{2})$"
)
FORMAT_VALIDATORS = {
    "date-time": lambda s: bool(_DATETIME_RE.match(s)),
}


# ── Validation engine ─────────────────────────────────────────────────────────

class ValidationError(Exception):
    """Raised when a value doesn't match its schema."""
    pass


def _type_ok(value, t: str) -> bool:
    """Return True if `value` matches the JSON Schema type name `t`.

    JSON Schema distinguishes integer from number, and both from boolean.
    Python's int is a subtype of bool, so we must explicitly exclude booleans
    when checking for integer or number types (True is an int in Python).
    """
    return {
        "string":  isinstance(value, str),
        "integer": isinstance(value, int) and not isinstance(value, bool),
        "number":  isinstance(value, (int, float)) and not isinstance(value, bool),
        "boolean": isinstance(value, bool),
        "array":   isinstance(value, list),
        "object":  isinstance(value, dict),
        "null":    value is None,
    }.get(t, True)  # Unknown type names pass silently (future-proofing)


def validate(value, schema, path: str = "$") -> None:
    """Recursively validate `value` against `schema` (a dict parsed from JSON Schema).

    Args:
        value:  The Python value to validate (parsed from the handoff JSON file).
        schema: The JSON Schema dict describing the expected shape.
        path:   A dot-notation path string used in error messages, e.g. "$.items[0].status".
                Starts at "$" (JSON Schema convention for the document root).

    Raises:
        ValidationError: if `value` doesn't satisfy any constraint in `schema`.
    """

    # ── const: the value must equal exactly this literal ─────────────────────
    if "const" in schema and value != schema["const"]:
        raise ValidationError(f"{path}: expected const {schema['const']!r}, got {value!r}")

    # ── enum: the value must be one of these options ──────────────────────────
    if "enum" in schema and value not in schema["enum"]:
        raise ValidationError(f"{path}: value {value!r} not in enum {schema['enum']}")

    # ── type: the value's type must match ─────────────────────────────────────
    if "type" in schema:
        t = schema["type"]
        # "type" can be a single string OR a list of strings (union type).
        types = t if isinstance(t, list) else [t]
        # any() returns True if at least one of the types matches.
        if not any(_type_ok(value, tt) for tt in types):
            raise ValidationError(f"{path}: expected type {t}, got {type(value).__name__}")

    # ── String-specific constraints ───────────────────────────────────────────
    if isinstance(value, str):
        # minLength: the string must be at least this many characters long.
        if "minLength" in schema and len(value) < schema["minLength"]:
            raise ValidationError(f"{path}: minLength {schema['minLength']}, got {len(value)}")

        # maxLength: the string must be at most this many characters long.
        if "maxLength" in schema and len(value) > schema["maxLength"]:
            raise ValidationError(f"{path}: maxLength {schema['maxLength']}, got {len(value)}")

        # pattern: the string must match this regular expression.
        # re.search() checks for a match anywhere in the string (not just from the start).
        # Cap the input length first — Python's `re` engine has no timeout, so a
        # pathological regex (from a future schema edit) could ReDoS on long input.
        if "pattern" in schema:
            if len(value) > MAX_PATTERN_INPUT_LEN:
                raise ValidationError(
                    f"{path}: value length {len(value)} exceeds pattern-check cap {MAX_PATTERN_INPUT_LEN}"
                )
            if not re.search(schema["pattern"], value):
                raise ValidationError(f"{path}: pattern {schema['pattern']!r} failed for {value!r}")

        # format: run one of our known validators. Unknown formats pass silently.
        fmt = schema.get("format")
        if fmt and fmt in FORMAT_VALIDATORS and not FORMAT_VALIDATORS[fmt](value):
            raise ValidationError(f"{path}: value {value!r} does not match format {fmt!r}")

    # ── Number-specific constraints ───────────────────────────────────────────
    if isinstance(value, (int, float)):
        # minimum: the number must be >= this value.
        if "minimum" in schema and value < schema["minimum"]:
            raise ValidationError(f"{path}: minimum {schema['minimum']}, got {value}")

    # ── Array-specific constraints ────────────────────────────────────────────
    if isinstance(value, list):
        # minItems: the array must have at least this many elements.
        if "minItems" in schema and len(value) < schema["minItems"]:
            raise ValidationError(f"{path}: minItems {schema['minItems']}, got {len(value)}")

        # items: every element in the array must conform to this sub-schema.
        item_schema = schema.get("items")
        if item_schema is not None:
            # enumerate() yields (index, element) pairs — used to build path like "$[0]".
            for i, item in enumerate(value):
                validate(item, item_schema, f"{path}[{i}]")

    # ── Object (dict) constraints ─────────────────────────────────────────────
    if isinstance(value, dict):
        # required: these keys MUST be present in the object.
        for req in schema.get("required", []):
            if req not in value:
                raise ValidationError(f"{path}: missing required property {req!r}")

        # properties: each listed key has its own sub-schema to validate against.
        props = schema.get("properties", {})
        for k, v in value.items():
            if k in props:
                # Recurse: validate each property value against its sub-schema.
                # path is extended, e.g. "$.status" → "$.status.code"
                validate(v, props[k], f"{path}.{k}")
            elif schema.get("additionalProperties") is False:
                # additionalProperties: false means no keys beyond those in "properties".
                raise ValidationError(f"{path}: additional property {k!r} not allowed")


# ── Citation cross-check (F-W3) ───────────────────────────────────────────────

# Matches "## Heading Text" at the start of a line (not inside fenced blocks).
_HEADING_RE = re.compile(r"^##\s+(.+?)\s*$", re.MULTILINE)

# Slugify an H2 heading text into a GitHub-style anchor: lowercase, strip
# non-alphanumeric except space/hyphen, collapse runs of whitespace into a
# single hyphen. Matches the behaviour of most markdown engines including the
# one used in the project's citation format.
def _slugify(text: str) -> str:
    """Turn '## Vertical slice layout' → 'vertical-slice-layout'."""
    t = text.strip().lower()
    t = re.sub(r"[^\w\s-]", "", t)     # drop punctuation (keep letters/digits/_/-/whitespace)
    t = re.sub(r"[\s_]+", "-", t)      # whitespace → hyphen; underscore → hyphen
    t = re.sub(r"-+", "-", t).strip("-")
    return t


def _anchors_in(path: Path) -> set[str]:
    """Return the set of H2 slugs available in a markdown file.

    Returns an empty set if the file cannot be read — the caller treats that
    as 'no anchors match', which surfaces as an unresolved-citation error.
    """
    try:
        body = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return set()
    return {_slugify(m.group(1)) for m in _HEADING_RE.finditer(body)}


def _verify_citation(citation: str) -> str | None:
    """Check one citation. Return None if resolved; else a human-readable reason.

    Accepts three shapes (matches work-items.v1.json rule_citations pattern):
      - 'rules/<file>.md#<anchor>'
      - 'skills/<skill>/SKILL.md#<anchor>' or 'skills/<skill>/references/<file>.md#<anchor>'
      - 'CLAUDE.md → <keyword>'
    """
    if citation.startswith("CLAUDE.md →") or citation.startswith("CLAUDE.md →"):
        # CLAUDE.md keyword refs aren't anchor-based; verify the file exists.
        if not (PROJECT_DIR / "CLAUDE.md").is_file() \
                and not (PROJECT_DIR / ".claude/CLAUDE.md").is_file():
            return "CLAUDE.md not found"
        return None

    if "#" not in citation:
        return "no anchor fragment (expected 'path#anchor')"

    file_part, anchor = citation.rsplit("#", 1)

    # Resolve relative to repo root (the working dir where validate.py runs).
    # Resolve against PROJECT_DIR, never the current working directory.
    if file_part.startswith(".claude/"):
        target = PROJECT_DIR / file_part
    else:
        # Citations are written relative to .claude/ (e.g. 'rules/architecture.md').
        target = PROJECT_DIR / ".claude" / file_part
    if not target.is_file():
        return f"file not found: {file_part}"

    anchors = _anchors_in(target)
    if anchor not in anchors:
        # Include a short preview of nearest matches so reports are actionable.
        close = [a for a in anchors if anchor[:4] in a] if len(anchor) >= 4 else []
        hint = f" (did you mean: {', '.join(sorted(close))})" if close else ""
        return f"anchor #{anchor} not found in {file_part}{hint}"

    return None


def _verify_work_item_citations(data: dict) -> list[str]:
    """Return a list of 'citation → reason' strings for every unresolved ref
    in a handoff-designer.json payload. Empty list means all refs resolved.
    """
    problems: list[str] = []
    for wi in data.get("work_items", []):
        wi_id = wi.get("id", "<no-id>")
        for cit in wi.get("rule_citations", []):
            reason = _verify_citation(cit)
            if reason:
                problems.append(f"{wi_id}: {cit} → {reason}")
    return problems


# ── Handoff key resolution ────────────────────────────────────────────────────

def _handoff_key(path: Path) -> str | None:
    """Find which HANDOFF_SCHEMAS entry matches this file path's name.

    Returns the matching key string, or None if no schema is registered for this file.
    """
    name = path.name  # Just the filename, e.g. "handoff-developer.json"
    for key in HANDOFF_SCHEMAS:
        # startswith() checks if the filename begins with the schema key.
        # This allows filenames like "handoff-developer-v2.json" to still match.
        if name.startswith(key):
            return key
    return None  # No matching schema registered


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> int:
    """Read the Claude Code hook payload from stdin, validate the written file.

    Returns:
        0 = validation passed (or file/schema not applicable — allow)
        2 = validation failed (Claude Code will surface the stderr message)
    """

    # Parse the JSON payload that Claude Code sent on stdin.
    # Fail closed (exit 2 = deny) on parse errors — never allow on malformed input.
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError as exc:
        sys.stderr.write(f"validate: invalid JSON payload from Claude Code: {exc}\n")
        sys.exit(2)

    # Extract the file path that was just written by the agent.
    # Two possible keys: "file_path" (Write tool) or "path" (Edit tool).
    # (payload.get("tool_input") or {}) safely handles the case where "tool_input" is missing.
    file_path = (payload.get("tool_input") or {}).get("file_path") \
        or (payload.get("tool_input") or {}).get("path")

    # If no file path was found in the payload, nothing to validate — allow.
    if not file_path:
        return 0

    # Wrap the file path string in a Path object for convenient manipulation.
    target = Path(file_path)

    # Three classes of files we validate:
    #   (a) handoff-*.json    — schema chosen via HANDOFF_SCHEMAS prefix match
    #   (b) pipeline.json and peers — exact filename match in STANDALONE_SCHEMAS
    #   (c) anything else     — skip silently
    schema_path: Path | None = None

    if target.name in STANDALONE_SCHEMAS:
        schema_path = PROJECT_DIR / STANDALONE_SCHEMAS[target.name]
    elif target.name.startswith("handoff-"):
        key = _handoff_key(target)
        if not key:
            # Handoff file with no registered schema — skip silently.
            return 0
        schema_path = PROJECT_DIR / HANDOFF_SCHEMAS[key]
    else:
        return 0

    # A registered schema that isn't on disk is a broken setup, and "allow" here
    # is exactly how the gate silently disappears: the handoff sails through
    # unvalidated and nothing says so. Fail closed and name the missing file.
    if not schema_path.is_file():
        sys.stderr.write(
            f"validate: schema not found at {schema_path} — cannot validate "
            f"{target.name}. Fix the .claude setup; do not bypass this.\n"
        )
        log(f"schema missing (blocked): {schema_path}")
        return 2

    # If the target file doesn't exist (shouldn't happen in PostToolUse, but be safe).
    if not target.is_file():
        return 0

    # ── Parse the handoff JSON file ───────────────────────────────────────────
    try:
        # Read the file and parse it as JSON.
        # encoding="utf-8" ensures consistent text handling across platforms.
        data = json.loads(target.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        # The file exists but isn't valid JSON — report the parse error.
        # sys.stderr.write() sends the message to stderr (shown to the agent by Claude Code).
        sys.stderr.write(f"validate: {target} is not valid JSON: {exc}\n")
        log(f"invalid JSON at {target}: {exc}")
        return 2  # Exit code 2 = validation failure

    # ── Load and run the schema ───────────────────────────────────────────────
    # Parse the schema file (it's also JSON).
    schema = json.loads(schema_path.read_text(encoding="utf-8"))

    try:
        # Run our recursive validator. Raises ValidationError on first problem found.
        validate(data, schema)
    except ValidationError as exc:
        # Report the specific schema mismatch to stderr so the agent knows what to fix.
        sys.stderr.write(f"validate: schema mismatch for {target}: {exc}\n")
        log(f"schema fail {target}: {exc}")
        return 2  # Exit code 2 = validation failure

    # Rule-citation cross-check for designer handoff only (F-W3). The pipeline's
    # W1 optimisation has sub-agents read ONLY what the WI cites — a wrong or
    # missing anchor silently drops the rule. We catch it at the schema gate.
    if target.name.startswith("handoff-designer"):
        bad = _verify_work_item_citations(data)
        if bad:
            sys.stderr.write(
                f"validate: unresolved rule citations in {target}:\n"
                + "\n".join(f"  - {b}" for b in bad) + "\n"
            )
            log(f"citation fail {target}: {len(bad)} unresolved")
            return 2

    # Validation passed — log success and allow.
    log(f"ok: {target}")
    return 0


# ── Script entry ──────────────────────────────────────────────────────────────

# __name__ == "__main__" is True only when this script is run directly (not imported).
# sys.exit() converts the return value of main() into the process exit code.
if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:
        sys.stderr.write(f"validate: unexpected error: {exc}\n")
        sys.exit(2)
