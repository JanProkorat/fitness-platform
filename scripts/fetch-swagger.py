#!/usr/bin/env python3
"""Save the Swagger JSON of a locally running backend.

Usage: scripts/fetch-swagger.py <base-url> <out-file>
Example: scripts/fetch-swagger.py https://localhost:5101 /tmp/swagger.json
Only localhost is accepted; the dev certificate is not verified.
"""
from __future__ import annotations

import json
import ssl
import sys
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

ALLOWED_HOSTS = {"localhost", "127.0.0.1"}


def fail(message: str) -> int:
    print(f"fetch-swagger: {message}", file=sys.stderr)
    return 1


def main() -> int:
    if len(sys.argv) != 3:
        return fail("usage: fetch-swagger.py <base-url> <out-file>")

    base_url, out_file = sys.argv[1:]
    parsed = urlparse(base_url)
    if parsed.scheme not in {"http", "https"} or parsed.hostname not in ALLOWED_HOSTS:
        return fail(f"only localhost http(s) URLs are accepted, got {base_url}")

    url = f"{base_url.rstrip('/')}/swagger/v1/swagger.json"
    try:
        with urllib.request.urlopen(url, timeout=30, context=ssl._create_unverified_context()) as response:
            document = json.loads(response.read())
    except (urllib.error.URLError, OSError) as error:
        return fail(f"could not reach {url}: {error}")
    except json.JSONDecodeError as error:
        return fail(f"{url} did not return JSON: {error}")

    if "paths" not in document:
        return fail(f"{url} returned JSON without 'paths'")

    Path(out_file).write_text(json.dumps(document, indent=1), encoding="utf-8")
    print(f"fetch-swagger: {len(document['paths'])} paths → {out_file}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
