#!/usr/bin/env python3
"""Tests for notion-upload.py. Run: python3 scripts/test_notion_upload.py — exit code is the result."""
from __future__ import annotations

import subprocess
import sys
import tempfile
from pathlib import Path

SCRIPT = Path(__file__).resolve().parent / "notion-upload.py"
GOOD_URL = "https://api.notion.com/v1/file_uploads/12345678-1234-1234-1234-123456789abc/send"
HEADERS = '{"Authorization": "Bearer x", "Notion-Version": "2022-06-28"}'


def run(stdin: str, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, str(SCRIPT), *args], input=stdin, capture_output=True, text=True)


def temp_file() -> str:
    path = Path(tempfile.mkdtemp()) / "shot.png"
    path.write_bytes(b"png")
    return str(path)


def test_refuses_non_notion_url():
    result = run(HEADERS, "https://example.com/v1/file_uploads/x/send", temp_file())
    assert result.returncode == 1, result
    assert "refusing non-Notion" in result.stderr
    assert "Traceback" not in result.stderr


def test_refuses_invalid_headers_json():
    result = run("not json", GOOD_URL, temp_file())
    assert result.returncode == 1, result
    assert "upload_headers" in result.stderr
    assert "Traceback" not in result.stderr


def test_refuses_missing_headers():
    for stdin in ("", "{}", "[]", '{"Authorization": 5}'):
        result = run(stdin, GOOD_URL, temp_file())
        assert result.returncode == 1, (stdin, result)
        assert "Traceback" not in result.stderr


def test_refuses_missing_file():
    result = run(HEADERS, GOOD_URL, str(Path(tempfile.mkdtemp()) / "absent.png"))
    assert result.returncode == 1, result
    assert "no such file" in result.stderr
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
