#!/usr/bin/env python3
"""Send one local file to a Notion file-upload URL from notion-create-file-upload.

Usage: scripts/notion-upload.py <upload_url> <authorization header value> <file>

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
    if len(sys.argv) != 4:
        fail("usage: notion-upload.py <upload_url> <authorization> <file>")

    url, authorization, file_arg = sys.argv[1:]

    if not UPLOAD_URL.match(url):
        fail(f"refusing non-Notion upload URL: {url}")

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

    request = urllib.request.Request(url, data=body, method="POST", headers={
        "Authorization": authorization,
        "Content-Type": f"multipart/form-data; boundary={boundary}",
    })

    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            print(json.dumps(json.loads(response.read()), indent=2))
    except urllib.error.HTTPError as error:
        fail(f"HTTP {error.code}: {error.read().decode(errors='replace')}")


if __name__ == "__main__":
    main()
