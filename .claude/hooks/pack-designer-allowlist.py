#!/usr/bin/env python3
"""pack-allowlist-dispatch.py — composed per-role PreToolUse[Bash] allowlist
dispatcher for multi-pack repos.

WHY THIS EXISTS
  The common agents' frontmatter (agents/designer.md, agents/developer.md,
  agents/impl-reviewer.md) unconditionally wires a PreToolUse[Bash] hook at a
  fixed, repo-local path — `.claude/hooks/pack-<role>-allowlist.py` — that
  the hub-symlinked frontmatter can never edit per-repo (see
  `common/PACK-CONTRACT.md` §5). A repo may adopt more than one pack (e.g. a
  `dotnet` pack for `api/**` and a `react` pack for `app/**`), and each
  adopted pack may ship its own opinion on what that role's agent may run.
  `kit-onboard.sh`/`kit-sync.sh` install this file at that fixed path
  whenever at least one adopted pack supplies a `<role>-allowlist.py` for it
  — see `kit_install_allowlist_dispatchers` in `bin/lib-kit.sh`.

WHAT IT DOES
  1. Determines its own role (designer|developer|reviewer) from its own
     invoked filename — `pack-<role>-allowlist.py` — so the exact same file
     content is installed under all three role names (symlinked or copied,
     per onboarding mode); no per-role generation needed.
  2. Reads `.claude/.kit-manifest` for the repo's adopted packs.
  3. For each adopted pack, looks for that pack's own role-allowlist file,
     wired in at onboarding/sync time as
     `.claude/hooks/<pack>-<role>-allowlist.py` — namespaced by pack so N
     adopted packs can each ship a same-named `<role>-allowlist.py` without
     colliding at this one fixed dispatch path (see `kit_wire_pack_hooks` in
     `bin/lib-kit.sh`). A pack that doesn't ship one for this role is a
     NON-VOTER for this decision — it is skipped entirely, not counted as
     an allow. This matters: an abstaining pack must never be able to
     short-circuit past a sibling pack's deny just because it has no
     opinion of its own.
  4. Runs each present (voting) pack file with the same stdin payload this
     dispatcher received, and combines the voting packs' results: ALLOW iff
     AT LEAST ONE voting pack allows; DENY iff EVERY voting pack actively
     denies — and when that happens, combine each denying pack's reason
     into one message so the caller sees why every pack objected, not just
     one. If zero adopted packs vote (none ship a `<role>-allowlist.py` at
     all), fall back to allow — this path normally cannot occur because
     `kit-onboard.sh`/`kit-sync.sh` install the no-op passthrough instead of
     this dispatcher whenever no adopted pack supplies the role; the
     fallback exists only for robustness.

OUTPUT PROTOCOL (matches every sibling pack allowlist hook in this hub, e.g.
packs/dotnet/hooks/developer-allowlist.py):
  A denial is one JSON object on stdout with
  `hookSpecificOutput.permissionDecision: "deny"`, always followed by exit 0.
  An allow is no stdout at all, also exit 0. This dispatcher preserves that
  contract exactly — Claude Code reads "no output" as "no decision made,
  proceed" and non-empty deny JSON as an actual block; there is no "allow"
  JSON shape to emit, only the absence of a deny one.
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys

ROLE_RE = re.compile(r"^pack-(designer|developer|reviewer)-allowlist\.py$")


def own_role() -> str | None:
    """The role this invocation is dispatching for, from argv[0]'s basename
    — NOT from a resolved symlink target, so this works correctly whether
    `.claude/hooks/pack-<role>-allowlist.py` is a symlink (symlink mode) or a
    real copy (seed mode) of this same file under three different names."""
    name = os.path.basename(sys.argv[0])
    m = ROLE_RE.match(name)
    return m.group(1) if m else None


def read_manifest_packs(project_dir: str) -> list[str]:
    """Adopted packs per `.claude/.kit-manifest`, or [] if it's missing,
    unreadable, or malformed — fails open (no packs = nothing to dispatch to
    = allow), never breaks the calling agent's Bash tool over a bad manifest."""
    manifest_path = os.path.join(project_dir, ".claude", ".kit-manifest")
    try:
        with open(manifest_path, "r", encoding="utf-8") as f:
            data = json.load(f)
    except (OSError, json.JSONDecodeError):
        return []
    packs = data.get("packs") if isinstance(data, dict) else None
    if not isinstance(packs, list):
        return []
    return [p for p in packs if isinstance(p, str) and p]


def run_pack_allowlist(path: str, stdin_text: str) -> tuple[bool, str]:
    """Runs one pack's <role>-allowlist.py with the given stdin.

    Returns (denied, reason). denied=False means this pack allows — or its
    own process failed to run or produced something unparseable, which fails
    open (allow), consistent with the no-op-passthrough fallback's
    philosophy elsewhere in this hub: a broken pack hook must never itself
    become the reason a Bash call is blocked.
    """
    try:
        proc = subprocess.run(
            [sys.executable, path],
            input=stdin_text,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        print(
            f"pack-allowlist-dispatch: '{path}' failed to run ({exc}) — "
            "treating as allow (fail open).",
            file=sys.stderr,
        )
        return False, ""

    out = (proc.stdout or "").strip()
    if not out:
        return False, ""

    try:
        payload = json.loads(out)
    except json.JSONDecodeError:
        print(
            f"pack-allowlist-dispatch: '{path}' produced non-JSON stdout "
            f"({out!r}) — treating as allow (fail open).",
            file=sys.stderr,
        )
        return False, ""

    hso = payload.get("hookSpecificOutput") if isinstance(payload, dict) else None
    decision = (hso or {}).get("permissionDecision") if isinstance(hso, dict) else None
    if decision != "deny":
        return False, ""

    reason = (hso or {}).get("permissionDecisionReason") or "denied (no reason given)"
    return True, reason


def deny(reason: str) -> int:
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": reason,
                }
            }
        )
    )
    return 0


def main() -> int:
    stdin_text = sys.stdin.read()

    role = own_role()
    if role is None:
        # Invoked under an unrecognized name — nothing to dispatch by role.
        # Fail open rather than break the calling agent's Bash tool.
        return 0

    project_dir = os.environ.get("CLAUDE_PROJECT_DIR", ".")
    packs = read_manifest_packs(project_dir)
    if not packs:
        return 0

    denials: list[tuple[str, str]] = []
    voted = False
    for pack in packs:
        hook_path = os.path.join(
            project_dir, ".claude", "hooks", f"{pack}-{role}-allowlist.py"
        )
        if not os.path.isfile(hook_path):
            # This pack ships no opinion for this role — it's a non-voter,
            # skip it entirely. Do NOT treat this as an allow: an
            # abstaining pack must never be able to open the gate and
            # override a sibling pack's deny.
            continue
        voted = True
        denied, reason = run_pack_allowlist(hook_path, stdin_text)
        if not denied:
            return 0
        denials.append((pack, reason))

    if not voted:
        # No adopted pack ships an opinion for this role at all. Safe
        # allow-with-comment fallback for robustness — kit-onboard.sh/
        # kit-sync.sh normally install the no-op passthrough instead of
        # this dispatcher whenever this is the case (see
        # kit_install_allowlist_dispatchers in bin/lib-kit.sh), so this
        # branch should not be reachable in practice.
        return 0

    # Every voting pack (every adopted pack that ships an opinion on this
    # role) actively denied.
    combined = "; ".join(f"{pack}: {reason}" for pack, reason in denials)
    return deny(f"denied by every adopted pack ({combined})")


if __name__ == "__main__":
    sys.exit(main())
