#!/usr/bin/env python3
"""Regression tests for split-compound-commands.py.

Run: python3 .claude/hooks/test_split_compound_commands.py

No framework — these hooks have no test runner, and adding one for a 200-line
script is not worth the dependency. Exit code is the result.

The heredoc cases exist because of #912: the splitter tracked quotes but not
heredocs, so an apostrophe in ordinary prose inside a `cat > file <<'EOF'` body
flipped its quote state, and a `;` or `&&` in that body read as a command
separator. Writing a file whose text contained a contraction was rejected as a
compound command — which is how it was found, while filing the issue describing it.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "split_compound_commands", Path(__file__).with_name("split-compound-commands.py"))
_mod = importlib.util.module_from_spec(_spec)
assert _spec.loader is not None
_spec.loader.exec_module(_mod)

split = _mod.split_top_level

FAILURES: list[str] = []


def check(name: str, cmd: str, expected: list[str]) -> None:
    actual = split(cmd)
    if actual == expected:
        print(f"  ok    {name}")
    else:
        FAILURES.append(name)
        print(f"  FAIL  {name}\n          cmd      {cmd!r}\n"
              f"          expected {expected!r}\n          actual   {actual!r}")


print("split_top_level — existing behaviour must not regress")
check("simple command is one part", "ls -la", ["ls -la"])
check("splits on &&", "cd /tmp && ls", ["cd /tmp", "ls"])
check("splits on ;", "cd /tmp; ls", ["cd /tmp", "ls"])
check("leaves pipes intact", "cat f | grep x", ["cat f | grep x"])
check("leaves || intact", "cmd-a || cmd-b", ["cmd-a || cmd-b"])
check("ignores separators inside single quotes", "echo 'a && b'", ["echo 'a && b'"])
check("ignores separators inside double quotes", 'echo "a; b"', ['echo "a; b"'])
check("respects subshell depth", "(cd /tmp && ls)", ["(cd /tmp && ls)"])

print("\nheredocs — #912")

# The exact shape that failed: an apostrophe in prose desynchronised quote
# tracking, so the trailing `&& echo done` was mis-attributed.
contraction = "cat > f.md <<'EOF'\nIt doesn't work\nEOF"
check("apostrophe in body does not desync quotes", contraction, [contraction])

semicolon = "cat > f.md <<'EOF'\nfirst; second\nEOF"
check("semicolon in body is data, not a separator", semicolon, [semicolon])

ampersand = "cat > f.md <<'EOF'\nthis && that\nEOF"
check("ampersand in body is data, not a separator", ampersand, [ampersand])

combined = "cat > f.md <<'EOF'\nIt doesn't work; really && truly\nEOF"
check("apostrophe, semicolon and && together", combined, [combined])

check("unquoted delimiter", "cat > f <<EOF\na; b\nEOF", ["cat > f <<EOF\na; b\nEOF"])
check("double-quoted delimiter", 'cat > f <<"EOF"\na; b\nEOF', ['cat > f <<"EOF"\na; b\nEOF'])
check("tab-stripped delimiter (<<-)", "cat > f <<-EOF\na; b\n\tEOF", ["cat > f <<-EOF\na; b\n\tEOF"])

# A real separator AFTER the heredoc closes must still split — the fix must not
# swallow the rest of the command. Note the separator has to be `;` or `&&`: a bare
# newline is not one, and never was, so `EOF\nrm ...` is legitimately a single part.
after = "cat > f <<'EOF'\nbody's text\nEOF\nrm -r /tmp/x; ls"
check("separator after terminator still splits", after,
      ["cat > f <<'EOF'\nbody's text\nEOF\nrm -r /tmp/x", "ls"])

check("bare newline is not a separator (unchanged)", "echo a\necho b", ["echo a\necho b"])

# <<< is a herestring, not a heredoc — no body to skip.
check("herestring is not treated as a heredoc", "grep x <<< 'a; b'", ["grep x <<< 'a; b'"])

print()
if FAILURES:
    print(f"{len(FAILURES)} FAILED: {', '.join(FAILURES)}")
    sys.exit(1)
print("all passed")
