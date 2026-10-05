#!/usr/bin/env python3
"""Send one local file to a Notion file-upload URL from notion-create-file-upload.

Usage: echo '<upload_headers JSON>' | scripts/notion-upload.py <upload_url> <file>

The JSON object is the upload_headers value from notion-create-file-upload; every
header in it is sent. Headers come from stdin so nothing secret is passed as an argument; pipe them from a heredoc rather than echo to keep them out of the shell history.

Only https://api.notion.com/v1/[mcp/]file_uploads/<uuid>/send is accepted, so
the script cannot be pointed at any other host.
"""

import json
import mimetypes
import re
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

UPLOAD_URL = re.compile(
    r"^https://api\.notion\.com/v1/(mcp/)?file_uploads/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/send$"
)
MAX_BYTES = 20 * 1024 * 1024


def fail(message: str) -> None:
    print(f"notion-upload: {message}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    if len(sys.argv) != 3:
        fail("usage: echo '<upload_headers JSON>' | notion-upload.py <upload_url> <file>")

    url, file_arg = sys.argv[1:]

    if not UPLOAD_URL.match(url):
        fail(f"refusing non-Notion upload URL: {url}")

    try:
        upload_headers = json.loads(sys.stdin.read())
    except json.JSONDecodeError:
        fail("stdin must be the upload_headers JSON object")
    if not isinstance(upload_headers, dict) or not upload_headers or not all(
        isinstance(key, str) and isinstance(value, str) for key, value in upload_headers.items()
    ):
        fail("stdin must be a non-empty JSON object of string headers")

    path = Path(file_arg)
    if not path.is_file():
        fail(f"no such file: {path}")

    data = path.read_bytes()
    if len(data) > MAX_BYTES:
        fail(f"{path} is {len(data)} bytes; the single-part limit is {MAX_BYTES}")

    content_type = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    boundary = uuid.uuid4().hex
    body = b"".join([
        f"--{boundary}\r\n".encode(),
        f'Content-Disposition: form-data; name="file"; filename="{path.name}"\r\n'.encode(),
        f"Content-Type: {content_type}\r\n\r\n".encode(),
        data,
        f"\r\n--{boundary}--\r\n".encode(),
    ])

    headers = {key: value for key, value in upload_headers.items() if key.lower() != "content-type"}
    headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    request = urllib.request.Request(url, data=body, method="POST", headers=headers)

    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            print(json.dumps(json.loads(response.read()), indent=2))
    except urllib.error.HTTPError as error:
        fail(f"HTTP {error.code}: {error.read().decode(errors='replace')}")
    except (urllib.error.URLError, OSError) as error:
        fail(f"network error: {error}")


if __name__ == "__main__":
    main()
