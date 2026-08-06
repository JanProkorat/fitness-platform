#!/usr/bin/env python3
"""split-compound-commands.py — PreToolUse hook for the Bash tool.

Intercepts compound commands and asks Claude to run each part individually,
so every command goes through permission validation separately.

SPLITS ON:   && and ; at the top level (not inside quotes/subshells)
LEAVES:      | pipes and || conditionals intact (single logical operations)
SKIPS:       for/while/if/case constructs (their ; and && are structural)

EXIT CODES (Claude Code hook contract):
  0 = allow (simple command) or deny (compound — communicated via JSON stdout)

Ported 1:1 from split-compound-commands.sh (an earlier project's .claude/hooks).
"""
from __future__ import annotations

import json
import os
import re
import shlex
import sys
from datetime import date, datetime

# kit hooks run in many repos — anchor logs to CLAUDE_PROJECT_DIR (falls back to cwd, matching source when unset)
LOG_DIR = os.path.join(os.environ.get("CLAUDE_PROJECT_DIR", "."), ".claude/hooks/log")


def log(msg: str) -> None:
    os.makedirs(LOG_DIR, exist_ok=True)
    log_path = os.path.join(LOG_DIR, f"{date.today().isoformat()}.log")
    with open(log_path, "a") as f:
        f.write(msg + "\n")


# Read-only fast-path: a chain of purely inspective commands is allowed through
# intact, so routine diagnostics (echo/cat/ls/find/grep/git-status…) cost one
# tool call instead of N round-trips. The set is deliberately narrow — a chain
# is only waved through if EVERY segment starts with a read-only command word
# and contains no redirect, command-substitution, pipe, or destructive flag, so
# a denied command can never hide inside an "all-safe" chain.
SAFE_CMDS = {
    "echo", "printf", "cat", "ls", "pwd", "true", "false", "wc", "find",
    "grep", "rg", "sort", "uniq", "cut", "tr", "dirname", "basename", "date",
    "stat", "file", "which", "diff", "cmp", "jq", "env", "realpath", "tree",
    "nl", "comm", "head", "tail", "column",
}
SAFE_GIT = {
    "status", "diff", "log", "show", "branch", "check-ignore", "rev-parse",
    "ls-files", "remote", "config", "describe", "tag", "blame", "shortlog",
    "cat-file", "for-each-ref",
}
UNSAFE_SUBSTR = (">", "`", "$(", "|", "-delete", "-exec", "-execdir")

# Matches a heredoc redirect and captures its delimiter: <<EOF, <<-EOF, <<'EOF', <<"EOF".
# Deliberately does NOT match <<< (a herestring, which has no body to skip).
HEREDOC_RE = re.compile(r"""<<-?[ \t]*(?:'([^']+)'|"([^"]+)"|([A-Za-z_][A-Za-z0-9_]*))""")


def _consume_heredoc_bodies(cmd: str, i: int, pending: list[tuple[str, bool]],
                            current: list[str]) -> int:
    """Copy heredoc bodies verbatim, returning the new scan position.

    Everything between the newline that opens a heredoc and its terminator line is
    DATA, not shell. Without this the quote tracker in split_top_level treats an
    apostrophe in ordinary prose as an opening quote and desynchronises, and any
    `;` or `&&` in the body reads as a command separator — so writing a file whose
    text contains a contraction used to be rejected as a compound command.
    """
    n = len(cmd)
    while pending:
        delim, strip_tabs = pending.pop(0)
        while i < n:
            eol = cmd.find("\n", i)
            line = cmd[i:] if eol == -1 else cmd[i:eol]
            chunk = line if eol == -1 else line + "\n"
            current.append(chunk)
            i += len(chunk)
            # <<- lets the terminator be indented with tabs.
            if (line.lstrip("\t") if strip_tabs else line).strip() == delim:
                break
            if eol == -1:
                break
    return i


def split_top_level(cmd: str) -> list[str]:
    """Split cmd on && and ; at the top level, respecting quotes, subshells and heredocs."""
    parts: list[str] = []
    current: list[str] = []
    depth = 0
    in_single = in_double = False
    # Heredocs opened on the current line, awaiting their bodies after the newline.
    pending_heredocs: list[tuple[str, bool]] = []
    i = 0
    n = len(cmd)

    while i < n:
        c = cmd[i]
        rest = cmd[i:]

        if c == "'" and not in_double:
            in_single = not in_single
            current.append(c)
        elif c == '"' and not in_single:
            in_double = not in_double
            current.append(c)
        elif not in_single and not in_double:
            if c == "\\":
                current.append(c)
                if i + 1 < n:
                    i += 1
                    current.append(cmd[i])
            elif rest.startswith("<<") and not rest.startswith("<<<"):
                # Record the delimiter now; the body starts after this line's newline.
                match = HEREDOC_RE.match(rest)
                if match:
                    pending_heredocs.append((
                        match.group(1) or match.group(2) or match.group(3),
                        rest[2:3] == "-",
                    ))
                    current.append(match.group(0))
                    i += len(match.group(0))
                    continue
                current.append(c)
            elif c == "\n" and pending_heredocs:
                current.append(c)
                i = _consume_heredoc_bodies(cmd, i + 1, pending_heredocs, current)
                continue
            elif c in "({":
                depth += 1
                current.append(c)
            elif c in ")}":
                depth -= 1
                current.append(c)
            elif depth == 0 and rest.startswith("&&") and not rest.startswith("&&="):
                p = "".join(current).strip()
                if p:
                    parts.append(p)
                current = []
                i += 2
                continue
            elif depth == 0 and c == ";" and not rest.startswith(";;"):
                p = "".join(current).strip()
                if p:
                    parts.append(p)
                current = []
            else:
                current.append(c)
        else:
            current.append(c)
        i += 1

    p = "".join(current).strip()
    if p:
        parts.append(p)
    return parts


def seg_is_safe(seg: str) -> bool:
    s = seg.strip()
    if not s:
        return True
    if any(bad in s for bad in UNSAFE_SUBSTR):
        return False
    toks = s.split()
    if not toks:
        return True
    if toks[0] == "git":
        return len(toks) >= 2 and toks[1] in SAFE_GIT
    return toks[0] in SAFE_CMDS


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        return 0

    cmd = (payload.get("tool_input") or {}).get("command") or ""
    if not cmd:
        return 0

    first = cmd.strip().split()[0] if cmd.strip() else ""
    if first in ("for", "while", "until", "if", "case", "{"):
        return 0

    parts = split_top_level(cmd)

    if len(parts) > 1 and not all(seg_is_safe(p) for p in parts):
        count = len(parts)
        # shlex.quote approximates bash's %q shell-escaping of the original
        # command before it hits the plain-text log.
        log(f"[{datetime.now().astimezone().isoformat()}] split-compound: "
            f"splitting {count} parts from: {shlex.quote(cmd)}")

        lines = "".join(f"\\n  • {line}" for line in parts)
        reason = f"Compound command detected. Run each command individually in order:{lines}"
        print(json.dumps({
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "deny",
                "permissionDecisionReason": reason,
            }
        }))

    return 0


if __name__ == "__main__":
    sys.exit(main())
