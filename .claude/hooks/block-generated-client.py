#!/usr/bin/env python3
"""block-generated-client.py — PreToolUse[Write|Edit] hook: block hand-edits
to the generated typed API client (whatever OpenAPI/Swagger generator the
repo uses — see `skills/regen-api/SKILL.md`).

WHEN DOES THIS RUN?
  Claude Code fires this hook before any Write or Edit tool call. The hook
  inspects the target path and decides whether it looks like the generated
  API client; if so, it denies the write.

WHAT DOES IT DO?
  A hand-edit to a generated client silently diverges from what the next
  regen will produce — the edit gets clobbered (losing the fix) or, worse,
  survives until the next regen overwrites it and nobody notices the
  regression until runtime. This hook blocks both outcomes at the source.

CONFIGURABLE PATH
  Protected paths default to any path matching `**/generated.ts` or
  `**/api/generated*.ts` (glob-style, `*` matches any run of characters
  including `/`). Override via the `REACT_PACK_GENERATED_CLIENT_GLOBS`
  environment variable — a comma-separated list of glob patterns — when a
  repo's generator writes somewhere else (e.g. a whole `src/api/generated/`
  directory of files, or a differently-named single file).

OUTPUT PROTOCOL
  Matches every allowlist hook in this hub (see
  `packs/dotnet/hooks/developer-allowlist.py`): a denial is one JSON object
  on stdout with `hookSpecificOutput.permissionDecision: "deny"`, followed
  by exit 0. An allow is no stdout at all, also exit 0.

Ported from `block-generated-edits.sh` (an earlier project's .claude/hooks,
which protected NSwag output at a hardcoded path with an `exit 2` + stderr
protocol) — generalized to a configurable glob list and the JSON-stdout-deny
protocol used elsewhere in this hub, so it does not hardcode one generator
or one consuming repo's path (see `common/PACK-CONTRACT.md`).
"""
from __future__ import annotations

import fnmatch
import json
import os
import sys
from datetime import date, datetime

LOG_DIR = os.path.join(os.environ.get("CLAUDE_PROJECT_DIR", "."), ".claude/hooks/log")

DEFAULT_GLOBS = ("**/generated.ts", "**/api/generated*.ts")


def log(msg: str) -> None:
    os.makedirs(LOG_DIR, exist_ok=True)
    log_path = os.path.join(LOG_DIR, f"{date.today().isoformat()}.log")
    with open(log_path, "a") as f:
        f.write(msg + "\n")


def configured_globs() -> tuple[str, ...]:
    raw = os.environ.get("REACT_PACK_GENERATED_CLIENT_GLOBS")
    if not raw:
        return DEFAULT_GLOBS
    globs = tuple(g.strip() for g in raw.split(",") if g.strip())
    return globs or DEFAULT_GLOBS


def matches_protected_glob(file_path: str, globs: tuple[str, ...]) -> str | None:
    """Returns the matching glob, or None. Path is normalised to forward
    slashes before matching so a glob written with `/` (the only sane way
    to write one) matches on every platform, including a Windows-style
    incoming path with backslashes."""
    posix_path = file_path.replace("\\", "/")
    for pattern in globs:
        if fnmatch.fnmatch(posix_path, pattern):
            return pattern
    return None


def deny(file_path: str, pattern: str) -> int:
    log(f"[{datetime.now().astimezone().isoformat()}] block-generated-client: "
        f"DENIED {file_path!r} (matched glob {pattern!r})")
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": (
                f"Blocked: '{file_path}' matches the protected generated-API-client glob "
                f"'{pattern}'. This file is auto-generated from an OpenAPI/Swagger source "
                "and must not be hand-edited — regenerate it via the `regen-api` skill "
                "instead. To extend behaviour, add wrappers in a sibling module (e.g. "
                "src/api/<domain>.ts). Override the protected globs via "
                "REACT_PACK_GENERATED_CLIENT_GLOBS if this repo's generator writes "
                "somewhere else."
            ),
        }
    }))
    return 0


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0

    tool_input = payload.get("tool_input") or {}
    file_path = tool_input.get("file_path") or tool_input.get("path") or ""
    if not file_path:
        return 0

    pattern = matches_protected_glob(file_path, configured_globs())
    if pattern is None:
        return 0

    return deny(file_path, pattern)


if __name__ == "__main__":
    sys.exit(main())
