#!/usr/bin/env python3
"""Tests for fetch-swagger.py. Run: python3 scripts/test_fetch_swagger.py — exit code is the result."""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / "fetch-swagger.py"


def run(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, str(SCRIPT), *args], capture_output=True, text=True)


def test_refuses_non_local_host():
    result = run("https://api.example.com", str(Path(tempfile.mkdtemp()) / "s.json"))
    assert result.returncode == 1, result
    assert "only localhost" in result.stderr


def test_refuses_non_http_scheme():
    result = run("file:///etc/passwd", str(Path(tempfile.mkdtemp()) / "s.json"))
    assert result.returncode == 1, result


def test_reports_unreachable_backend_without_traceback():
    result = run("https://localhost:1", str(Path(tempfile.mkdtemp()) / "s.json"))
    assert result.returncode == 1, result
    assert "Traceback" not in result.stderr


def main() -> int:
    tests = [value for name, value in sorted(globals().items()) if name.startswith("test_")]
    failures = 0
    for test in tests:
        try:
            test()
            print(f"PASS {test.__name__}")
        except AssertionError as error:
            failures += 1
            print(f"FAIL {test.__name__}: {error}")
    print(f"{len(tests) - failures}/{len(tests)} passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
