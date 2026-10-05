# Notion Wiki Tooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `notion-docs` hub-and-changelog skill with tooling that builds and updates a screen-by-screen Notion wiki plus a Swagger-generated API reference.

**Architecture:** A checked-in screen inventory (`docs/wiki/screens.json`) is the source of which screens exist and which files and endpoints each depends on. Three small stdlib-only Python scripts validate it (`wiki-check.py`), fetch Swagger from a local backend (`fetch-swagger.py`), and render Swagger into per-tag Markdown (`wiki-api.py`); `notion-upload.py` (already committed) sends screenshots. The rewritten skill tells the main thread how to combine these with Playwright screenshots and Notion writes.

**Tech Stack:** Python 3 stdlib only (no pytest — tests are plain scripts whose exit code is the result, matching `.claude/hooks/test_*.py`), GitHub Actions, Notion MCP, Playwright MCP.

**Spec:** `docs/superpowers/specs/2026-10-05-notion-wiki-design.md`

**Issue / branch:** #1162, `chore/1162-notion-wiki-tooling`, worktree `.worktrees/1162-notion-wiki`. All paths below are relative to that worktree.

## Global Constraints

- Wiki language: English. Reader: a new team member, not a customer.
- Python scripts: stdlib only; no new dependencies.
- `curl` stays denied for Claude locally; local HTTP goes through Python scripts. CI may use `curl`.
- `screens.json` `endpoints` use `METHOD /route` exactly as the Swagger `paths` key.
- `screens.json` `app` is one of `web`, `client`, `coach`; `id` is `<app>.<area>.<screen>`, lowercase.
- Screenshots come from the real app only, never design boards.
- No changelog page.
- Code comments in English; doc comments shorter than the code they document.
- Stage files by explicit path; never `git add -A` / `git add .`; files under `docs/` need `git add -f` (`docs/*` is gitignored).
- Commit messages start `1162: ` and end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Malformed `screens.json`** (invalid JSON, top level not an object, `screens` not a list) → one clear error line and exit 1, never a Python traceback. Test in Task 1.
2. **Unsafe `files` glob** (absolute path or containing `..`) → reported as a problem, never a crash (`Path.glob` raises on absolute patterns). Test in Task 1.
3. **Endpoint typo** (lowercase method, trailing slash, missing space) → reported as malformed, not merely "not in Swagger". Test in Task 1.
4. **Self-referencing Swagger schema** (a type whose property is an array of itself) → `wiki-api.py` terminates and marks the field `(recursive)`. Test in Task 3.
5. **Operation with no tag, no security, no description** → still rendered, under `untagged`, roles `Public (no sign-in)`. Test in Task 3.

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/wiki-check.py` | Validate `screens.json` against the repo tree and a Swagger file |
| `scripts/test_wiki_check.py` | Tests for `wiki-check.py` |
| `scripts/fetch-swagger.py` | Save Swagger JSON from a localhost backend (dev cert accepted) |
| `scripts/test_fetch_swagger.py` | Tests for `fetch-swagger.py` host refusal |
| `docs/wiki/screens.json` | Screen inventory — starts empty; redesign tasks add entries |
| `scripts/wiki-api.py` | Render Swagger into one Markdown page per tag |
| `scripts/test_wiki_api.py` | Tests for `wiki-api.py` |
| `.github/workflows/e2e.yml` | Add the wiki check step against the harness's live Swagger |
| `.claude/skills/notion-docs/SKILL.md` | Rewritten skill entry point |
| `.claude/skills/notion-docs/references/build.md` | Build mode (replaces `bootstrap.md`) |
| `.claude/skills/notion-docs/references/update.md` | Update mode (rewritten) |
| `.claude/skills/notion-docs/references/page-templates.md` | Page templates, screenshot procedure, drafting brief (rewritten) |
| `.claude/skills/notion-docs/references/routing.md` | Deleted |
| `.claude/skills/notion-docs/references/bootstrap.md` | Deleted |
| `.claude/agents/web-react.md`, `mobile-expo.md` | Add "keep screens.json current" convention |
| `.claude/agents/pr-reviewer.md`, `pr-reviewer/references/review-checklist.md` | Add checklist item 13; main thread runs notion-docs |

---

### Task 1: `wiki-check.py` — validate the screen inventory

**Files:**
- Create: `scripts/wiki-check.py`
- Test: `scripts/test_wiki_check.py`

**Interfaces:**
- Produces: `check(document: object, swagger: dict, repo_root: Path) -> list[str]` (problems; empty = valid) and `swagger_operations(swagger: dict) -> set[str]` (e.g. `{"GET /trainer/clients"}`). CLI: `python3 scripts/wiki-check.py --swagger <file> [--screens docs/wiki/screens.json] [--root .]`, exit 0 valid / 1 problems.

- [ ] **Step 1: Write the failing test**

Create `scripts/test_wiki_check.py`:

```python
#!/usr/bin/env python3
"""Tests for wiki-check.py. Run: python3 scripts/test_wiki_check.py — exit code is the result."""
from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("wiki_check", HERE / "wiki-check.py")
wiki_check = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wiki_check)

SWAGGER = {"paths": {
    "/trainer/clients": {"get": {}, "parameters": []},
    "/trainer/clients/{clientId}": {"get": {}, "put": {}},
}}


def make_repo() -> Path:
    root = Path(tempfile.mkdtemp())
    (root / "web/src/pages").mkdir(parents=True)
    (root / "web/src/pages/ClientsPage.tsx").write_text("")
    return root


def screen(**overrides) -> dict:
    entry = {
        "id": "web.clients.list", "app": "web", "area": "Clients", "title": "Client list",
        "route": "/clients", "roles": ["Trainer"], "files": ["web/src/pages/ClientsPage.tsx"],
        "endpoints": ["GET /trainer/clients"], "board": "PageClients",
        "shots": [{"name": "default"}], "notionPageId": None,
    }
    entry.update(overrides)
    return entry


def problems_for(*screens: dict) -> list[str]:
    return wiki_check.check({"screens": list(screens)}, SWAGGER, make_repo())


def test_valid_entry_has_no_problems():
    assert problems_for(screen()) == []


def test_swagger_operations_ignores_non_method_keys():
    assert wiki_check.swagger_operations(SWAGGER) == {
        "GET /trainer/clients", "GET /trainer/clients/{clientId}", "PUT /trainer/clients/{clientId}"}


def test_missing_field_is_reported():
    entry = screen()
    del entry["shots"]
    assert any("missing field(s) shots" in p for p in problems_for(entry))


def test_duplicate_id_is_reported():
    assert any("duplicate id" in p for p in problems_for(screen(), screen()))


def test_id_must_match_app_prefix_and_shape():
    assert any("id must look like" in p for p in problems_for(screen(id="Web.Clients")))
    assert any("must start with its app" in p for p in problems_for(screen(id="client.clients.list")))


def test_unknown_app_and_role_are_reported():
    assert any("unknown app" in p for p in problems_for(screen(app="desktop", id="desktop.x.y")))
    assert any("unknown role" in p for p in problems_for(screen(roles=["Coach"])))


def test_glob_matching_nothing_is_reported():
    assert any("matches no file" in p for p in problems_for(screen(files=["web/src/pages/Nope.tsx"])))


def test_unsafe_globs_are_reported_not_raised():
    found = problems_for(screen(files=["/etc/passwd", "../outside/*.ts"]))
    assert sum("must be relative to the repo root" in p for p in found) == 2


def test_endpoint_not_in_swagger_is_reported():
    assert any("not in Swagger" in p for p in problems_for(screen(endpoints=["DELETE /trainer/clients"])))


def test_malformed_endpoints_are_reported_as_malformed():
    found = problems_for(screen(endpoints=["get /trainer/clients", "GET /trainer/clients/", "GET/trainer/clients"]))
    assert sum("malformed endpoint" in p for p in found) == 3


def test_shots_need_unique_names():
    found = problems_for(screen(shots=[{"name": "default"}, {"name": "default"}, {}]))
    assert any("duplicate shot name 'default'" in p for p in found)
    assert any("shot #2 has no name" in p for p in found)


def test_document_shape_is_validated():
    assert wiki_check.check([], SWAGGER, make_repo()) == ["top level must be an object with a 'screens' list"]
    assert wiki_check.check({"screens": {}}, SWAGGER, make_repo()) == ["top level must be an object with a 'screens' list"]


def test_cli_reports_invalid_json_without_traceback():
    root = make_repo()
    bad = root / "screens.json"
    bad.write_text("{not json")
    swagger = root / "swagger.json"
    swagger.write_text(json.dumps(SWAGGER))
    result = subprocess.run(
        [sys.executable, str(HERE / "wiki-check.py"), "--screens", str(bad), "--swagger", str(swagger), "--root", str(root)],
        capture_output=True, text=True)
    assert result.returncode == 1
    assert "Traceback" not in result.stderr
    assert "is not valid JSON" in result.stdout + result.stderr


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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 scripts/test_wiki_check.py`
Expected: FAIL — `FileNotFoundError` for `scripts/wiki-check.py` (module load).

- [ ] **Step 3: Write the implementation**

Create `scripts/wiki-check.py`:

```python
#!/usr/bin/env python3
"""Validate docs/wiki/screens.json against the repo tree and a Swagger file.

Usage: scripts/wiki-check.py --swagger <swagger.json> [--screens docs/wiki/screens.json] [--root .]
Prints one problem per line; exit 0 when valid, 1 otherwise.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REQUIRED = ("id", "app", "area", "title", "route", "roles", "files", "endpoints", "shots")
APPS = {"web", "client", "coach"}
ROLES = {"Public", "Client", "Trainer", "Nutritionist", "Admin"}
HTTP_METHODS = {"get", "post", "put", "patch", "delete"}
ID_PATTERN = re.compile(r"^[a-z]+\.[a-z0-9-]+\.[a-z0-9-]+$")
ENDPOINT_PATTERN = re.compile(r"^(GET|POST|PUT|PATCH|DELETE) (/[^\s]*[^/\s]|/)$")
SHAPE_ERROR = "top level must be an object with a 'screens' list"


def swagger_operations(swagger: dict) -> set[str]:
    return {
        f"{method.upper()} {path}"
        for path, operations in swagger.get("paths", {}).items()
        for method in operations
        if method in HTTP_METHODS
    }


def check(document: object, swagger: dict, repo_root: Path) -> list[str]:
    if not isinstance(document, dict) or not isinstance(document.get("screens"), list):
        return [SHAPE_ERROR]

    operations = swagger_operations(swagger)
    problems: list[str] = []
    seen_ids: set[str] = set()

    for index, entry in enumerate(document["screens"]):
        label = entry.get("id") if isinstance(entry, dict) and entry.get("id") else f"entry #{index}"
        if not isinstance(entry, dict):
            problems.append(f"{label}: must be an object")
            continue

        missing = [field for field in REQUIRED if field not in entry]
        if missing:
            problems.append(f"{label}: missing field(s) {', '.join(missing)}")
            continue

        problems.extend(f"{label}: {problem}" for problem in _check_entry(entry, seen_ids, operations, repo_root))
        seen_ids.add(entry["id"])

    return problems


def _check_entry(entry: dict, seen_ids: set[str], operations: set[str], repo_root: Path) -> list[str]:
    problems: list[str] = []

    if not ID_PATTERN.match(entry["id"]):
        problems.append("id must look like <app>.<area>.<screen> in lowercase")
    elif not entry["id"].startswith(f"{entry['app']}."):
        problems.append(f"id must start with its app '{entry['app']}.'")
    if entry["id"] in seen_ids:
        problems.append("duplicate id")

    if entry["app"] not in APPS:
        problems.append(f"unknown app '{entry['app']}' (expected one of {', '.join(sorted(APPS))})")

    if not entry["roles"]:
        problems.append("roles must not be empty")
    for role in entry["roles"]:
        if role not in ROLES:
            problems.append(f"unknown role '{role}'")

    if not entry["files"]:
        problems.append("files must not be empty")
    for pattern in entry["files"]:
        if pattern.startswith("/") or ".." in Path(pattern).parts:
            problems.append(f"file glob '{pattern}' must be relative to the repo root")
        elif not any(repo_root.glob(pattern)):
            problems.append(f"file glob '{pattern}' matches no file")

    for endpoint in entry["endpoints"]:
        if not ENDPOINT_PATTERN.match(endpoint):
            problems.append(f"malformed endpoint '{endpoint}' (expected 'GET /route')")
        elif endpoint not in operations:
            problems.append(f"endpoint '{endpoint}' not in Swagger")

    if not entry["shots"]:
        problems.append("shots must not be empty")
    shot_names: set[str] = set()
    for position, shot in enumerate(entry["shots"]):
        name = shot.get("name") if isinstance(shot, dict) else None
        if not name:
            problems.append(f"shot #{position} has no name")
        elif name in shot_names:
            problems.append(f"duplicate shot name '{name}'")
        else:
            shot_names.add(name)

    page_id = entry.get("notionPageId")
    if page_id is not None and not isinstance(page_id, str):
        problems.append("notionPageId must be null or a string")

    return problems


def _load_json(path: Path) -> object:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        sys.exit(_fail(f"{path} does not exist"))
    except json.JSONDecodeError as error:
        sys.exit(_fail(f"{path} is not valid JSON: {error}"))


def _fail(message: str) -> int:
    print(f"wiki-check: {message}")
    return 1


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--swagger", required=True, type=Path)
    parser.add_argument("--screens", default=Path("docs/wiki/screens.json"), type=Path)
    parser.add_argument("--root", default=Path("."), type=Path)
    args = parser.parse_args()

    swagger = _load_json(args.swagger)
    if not isinstance(swagger, dict):
        return _fail(f"{args.swagger} is not a Swagger document")

    problems = check(_load_json(args.screens), swagger, args.root.resolve())
    for problem in problems:
        print(problem)
    if problems:
        return _fail(f"{len(problems)} problem(s) in {args.screens}")

    print(f"wiki-check: {args.screens} is valid")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 scripts/test_wiki_check.py`
Expected: every line `PASS …`, last line `13/13 passed`, exit 0.

- [ ] **Step 5: Commit**

```bash
chmod +x scripts/wiki-check.py scripts/test_wiki_check.py
git add scripts/wiki-check.py scripts/test_wiki_check.py
git commit -m "1162: wiki-check validates the screen inventory

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `fetch-swagger.py` and the empty `screens.json`

**Files:**
- Create: `scripts/fetch-swagger.py`
- Test: `scripts/test_fetch_swagger.py`
- Create: `docs/wiki/screens.json`

**Interfaces:**
- Consumes: `scripts/wiki-check.py` CLI from Task 1.
- Produces: `python3 scripts/fetch-swagger.py <base-url> <out-file>` (exit 0 and writes the file; exit 1 with message otherwise; only `localhost` / `127.0.0.1`). `docs/wiki/screens.json` containing `{"screens": []}`.

- [ ] **Step 1: Write the failing test**

Create `scripts/test_fetch_swagger.py`:

```python
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 scripts/test_fetch_swagger.py`
Expected: FAIL on all three (script missing → returncode 2 from the interpreter).

- [ ] **Step 3: Write the implementation**

Create `scripts/fetch-swagger.py`:

```python
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 scripts/test_fetch_swagger.py`
Expected: `3/3 passed`, exit 0.

- [ ] **Step 5: Get a fresh Swagger file**

The untracked `backend/swagger.json` in the main checkout is stale (15 Sep; 26 endpoints the web calls are missing). Boot the harness from the **main checkout**, after confirming its backend matches develop:

```bash
git -C /Users/jan/Projects/fitness-platform diff --stat origin/develop -- backend
```
Expected: no output. If there is output, stop and report — the Swagger would not match develop.

```bash
cd /Users/jan/Projects/fitness-platform && ./scripts/test-env up
./scripts/test-env ports
```
Read `api_url` from the `ports` JSON, then:

```bash
python3 scripts/fetch-swagger.py <api_url> /private/tmp/claude-501/-Users-jan-Projects-fitness-platform/0f1c8d29-8bb5-4d33-baeb-807402ec94e5/scratchpad/swagger.json
```
Expected: `fetch-swagger: <N> paths → …` with N > 180.

- [ ] **Step 6: Write the empty `docs/wiki/screens.json`**

The inventory starts empty; each redesign task adds its screens when it ships
(decided 2026-10-05). Appendix A holds worked example entries for the current
web screens — use them as the pattern, not as content.

```json
{
  "screens": []
}
```

- [ ] **Step 7: Validate against the fresh Swagger**

```bash
python3 scripts/wiki-check.py --swagger /private/tmp/claude-501/-Users-jan-Projects-fitness-platform/0f1c8d29-8bb5-4d33-baeb-807402ec94e5/scratchpad/swagger.json
```
Expected: `wiki-check: docs/wiki/screens.json is valid`.

**Dry run on real data.** Copy Appendix A's JSON into
`<scratchpad>/screens-examples.json` and run:

```bash
python3 scripts/wiki-check.py --screens <scratchpad>/screens-examples.json --swagger <scratchpad>/swagger.json
```
This proves the checker on real entries; it does not block the task. Report
every problem it prints. For each `not in Swagger`: find the endpoint class
under `backend/FitnessPlatform.Application/Features/` and its route in
`Configure()`, and note whether the example entry or Swagger is wrong (an
`ExcludeFromDescription()` call, or a casing difference). Fix Appendix A
where the example is wrong; never edit the backend in this task.

Then stop the harness: `./scripts/test-env down` (from the main checkout).

- [ ] **Step 8: Commit**

```bash
chmod +x scripts/fetch-swagger.py scripts/test_fetch_swagger.py
git add scripts/fetch-swagger.py scripts/test_fetch_swagger.py
git add -f docs/wiki/screens.json
git commit -m "1162: Empty screen inventory and Swagger fetch script

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `wiki-api.py` — Swagger to per-tag Markdown

**Files:**
- Create: `scripts/wiki-api.py`
- Test: `scripts/test_wiki_api.py`

**Interfaces:**
- Consumes: `screens.json` shape from Task 2 (`screens[].id`, `screens[].endpoints`).
- Produces: `flatten(schema: dict, components: dict, prefix: str = "", seen: frozenset = frozenset()) -> list[dict]` (rows with keys `field`, `type`, `required`, `description`); `group_by_tag(swagger: dict) -> dict[str, list[tuple[str, str, dict]]]`; `render_tag(tag: str, operations: list[tuple[str, str, dict]], swagger: dict, used_by: dict[str, list[str]]) -> str`; `slug(tag: str) -> str`. CLI: `python3 scripts/wiki-api.py --swagger <file> --screens docs/wiki/screens.json --out <dir>` writes `<dir>/<slug>.md` and prints each path.

- [ ] **Step 1: Write the failing test**

Create `scripts/test_wiki_api.py`:

```python
#!/usr/bin/env python3
"""Tests for wiki-api.py. Run: python3 scripts/test_wiki_api.py — exit code is the result."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("wiki_api", HERE / "wiki-api.py")
wiki_api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(wiki_api)

SWAGGER = {
    "paths": {
        "/trainer/clients": {
            "get": {
                "tags": ["Trainer"],
                "summary": "Get trainer's clients",
                "description": "Returns a paginated list | with a pipe.",
                "parameters": [
                    {"name": "page", "in": "query", "required": True, "description": "Page number.",
                     "schema": {"type": "integer", "format": "int32"}},
                    {"name": "status", "in": "query", "schema": {"$ref": "#/components/schemas/ClientStatus"}},
                ],
                "responses": {
                    "200": {"description": "Success", "content": {"application/json": {
                        "schema": {"$ref": "#/components/schemas/ClientList"}}}},
                    "401": {"description": "Unauthorized"},
                },
                "security": [{"JWTBearerAuth": ["Trainer", "Nutritionist"]}],
            },
            "post": {
                "tags": ["Trainer"],
                "requestBody": {"content": {"application/json": {"schema": {"$ref": "#/components/schemas/Node"}}}},
                "responses": {"204": {"description": "No Content"}},
                "security": [{"JWTBearerAuth": []}],
            },
        },
        "/health": {"get": {"responses": {"200": {"description": "OK"}}}},
    },
    "components": {"schemas": {
        "ClientStatus": {"type": "string", "enum": ["Active", "Paused"]},
        "ClientList": {"type": "object", "required": ["items"], "properties": {
            "items": {"type": "array", "items": {"$ref": "#/components/schemas/Client"}},
            "total": {"type": "integer", "format": "int32"},
        }},
        "Client": {"type": "object", "properties": {
            "name": {"type": "string", "nullable": True, "description": "Full name"},
            "status": {"allOf": [{"$ref": "#/components/schemas/ClientStatus"}]},
        }},
        "Node": {"type": "object", "properties": {
            "label": {"type": "string"},
            "children": {"type": "array", "items": {"$ref": "#/components/schemas/Node"}},
        }},
    }},
}
COMPONENTS = SWAGGER["components"]["schemas"]


def test_flatten_resolves_refs_and_arrays():
    rows = wiki_api.flatten({"$ref": "#/components/schemas/ClientList"}, COMPONENTS)
    assert [row["field"] for row in rows] == ["items", "items[].name", "items[].status", "total"]
    assert rows[0]["required"] is True
    assert rows[0]["type"] == "array of Client"
    assert rows[1]["type"] == "string, nullable"
    assert rows[1]["description"] == "Full name"
    assert rows[2]["type"] == "ClientStatus (enum: Active, Paused)"


def test_flatten_stops_on_recursive_schema():
    rows = wiki_api.flatten({"$ref": "#/components/schemas/Node"}, COMPONENTS)
    assert [row["field"] for row in rows] == ["label", "children"]
    assert rows[1]["type"] == "array of Node (recursive)"


def test_group_by_tag_puts_untagged_last_group():
    groups = wiki_api.group_by_tag(SWAGGER)
    assert sorted(groups) == ["Trainer", "untagged"]
    assert [(method, path) for method, path, _ in groups["Trainer"]] == [
        ("get", "/trainer/clients"), ("post", "/trainer/clients")]


def test_render_tag_lists_roles_params_responses_and_used_by():
    page = wiki_api.render_tag("Trainer", wiki_api.group_by_tag(SWAGGER)["Trainer"], SWAGGER,
                               {"GET /trainer/clients": ["web.clients.list"]})
    assert "## GET /trainer/clients" in page
    assert "**Roles:** Nutritionist, Trainer" in page
    assert "**Used by:** web.clients.list" in page
    assert "| page | query | integer (int32) | yes | Page number. |" in page
    assert "| status | query | ClientStatus (enum: Active, Paused) | no |  |" in page
    assert "### Response 200" in page
    assert "| items[].name | string, nullable | no | Full name |" in page
    assert "| 401 | Unauthorized |" in page
    assert "with a pipe" in page and "list \\| with" in page
    assert "**Roles:** Any signed-in user" in page
    assert "**Used by:** no documented screen" in page


def test_untagged_operation_without_security_is_public():
    page = wiki_api.render_tag("untagged", wiki_api.group_by_tag(SWAGGER)["untagged"], SWAGGER, {})
    assert "## GET /health" in page
    assert "**Roles:** Public (no sign-in)" in page


def test_slug():
    assert wiki_api.slug("Trainer") == "trainer"
    assert wiki_api.slug("Client Nutrition & Plans") == "client-nutrition-plans"


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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python3 scripts/test_wiki_api.py`
Expected: FAIL — `FileNotFoundError` for `scripts/wiki-api.py`.

- [ ] **Step 3: Write the implementation**

Create `scripts/wiki-api.py`:

```python
#!/usr/bin/env python3
"""Render a Swagger document into one Markdown page per tag for the Notion wiki.

Usage: scripts/wiki-api.py --swagger <swagger.json> --screens docs/wiki/screens.json --out <dir>
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

METHOD_ORDER = ["get", "post", "put", "patch", "delete"]


def slug(tag: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", tag.lower()).strip("-")


def _ref_name(ref: str) -> str:
    return ref.rsplit("/", 1)[-1]


def _deref(schema: dict, components: dict) -> dict:
    visited: set[str] = set()
    while "$ref" in schema:
        name = _ref_name(schema["$ref"])
        if name in visited:
            break
        visited.add(name)
        schema = components.get(name, {})
    return schema


def _merge_all_of(schema: dict, components: dict) -> dict:
    if "allOf" not in schema:
        return schema
    if len(schema["allOf"]) == 1:
        return _merge_all_of(_deref(schema["allOf"][0], components), components)
    merged: dict = {"type": "object", "properties": {}, "required": []}
    for part in schema["allOf"]:
        part = _merge_all_of(_deref(part, components), components)
        merged["properties"].update(part.get("properties", {}))
        merged["required"].extend(part.get("required", []))
    return merged


def _body(schema: dict, components: dict) -> dict:
    return _merge_all_of(_deref(schema, components), components)


def type_label(schema: dict, components: dict) -> str:
    if "$ref" in schema:
        name = _ref_name(schema["$ref"])
        target = components.get(name, {})
        if "enum" in target:
            return f"{name} (enum: {', '.join(str(value) for value in target['enum'])})"
        return name
    if "allOf" in schema:
        return " & ".join(type_label(part, components) for part in schema["allOf"])
    if "enum" in schema:
        return "enum: " + ", ".join(str(value) for value in schema["enum"])
    kind = schema.get("type", "object")
    if kind == "array":
        return f"array of {type_label(schema.get('items', {}), components)}"
    label = kind + (f" ({schema['format']})" if schema.get("format") else "")
    return label + (", nullable" if schema.get("nullable") else "")


def flatten(schema: dict, components: dict, prefix: str = "", seen: frozenset = frozenset()) -> list[dict]:
    if "$ref" in schema:
        name = _ref_name(schema["$ref"])
        if name in seen:
            return []
        seen = seen | {name}

    body = _body(schema, components)
    if body.get("type") == "array":
        return flatten(body.get("items", {}), components, f"{prefix}[].", seen)

    required = set(body.get("required", []))
    rows: list[dict] = []
    for name, prop in body.get("properties", {}).items():
        field = f"{prefix}{name}"
        target = _body(prop, components)
        is_array = target.get("type") == "array"
        nested = target.get("items", {}) if is_array else prop
        recursive = "$ref" in nested and _ref_name(nested["$ref"]) in seen

        rows.append({
            "field": field,
            "type": type_label(prop, components) + (" (recursive)" if recursive else ""),
            "required": name in required,
            "description": prop.get("description") or target.get("description") or "",
        })

        if not recursive and _body(nested, components).get("properties"):
            rows.extend(flatten(nested, components, f"{field}[]." if is_array else f"{field}.", seen))
    return rows


def group_by_tag(swagger: dict) -> dict[str, list[tuple[str, str, dict]]]:
    groups: dict[str, list[tuple[str, str, dict]]] = {}
    for path in sorted(swagger.get("paths", {})):
        operations = swagger["paths"][path]
        for method in METHOD_ORDER:
            if method in operations:
                tag = (operations[method].get("tags") or ["untagged"])[0]
                groups.setdefault(tag, []).append((method, path, operations[method]))
    return groups


def roles_label(operation: dict, swagger: dict) -> str:
    security = operation.get("security", swagger.get("security"))
    if not security:
        return "Public (no sign-in)"
    roles = sorted({role for requirement in security for scopes in requirement.values() for role in scopes})
    return ", ".join(roles) if roles else "Any signed-in user"


def _cell(text: object) -> str:
    return str(text).replace("|", "\\|").replace("\n", " ").strip()


def _json_schema(container: dict) -> dict | None:
    content = container.get("content", {})
    media = content.get("application/json") or next(iter(content.values()), None)
    return media.get("schema") if media else None


def _field_table(rows: list[dict]) -> list[str]:
    lines = ["| Field | Type | Required | Description |", "|---|---|---|---|"]
    lines += [f"| {_cell(r['field'])} | {_cell(r['type'])} | {'yes' if r['required'] else 'no'} | {_cell(r['description'])} |"
              for r in rows]
    return lines + [""]


def render_tag(tag: str, operations: list[tuple[str, str, dict]], swagger: dict, used_by: dict[str, list[str]]) -> str:
    components = swagger.get("components", {}).get("schemas", {})
    lines = [f"# {tag}", ""]

    for method, path, operation in operations:
        key = f"{method.upper()} {path}"
        lines += [f"## {key}", ""]
        for text in (operation.get("summary"), operation.get("description")):
            if text:
                lines += [_cell(text), ""]
        lines += [f"**Roles:** {roles_label(operation, swagger)}", ""]
        lines += [f"**Used by:** {', '.join(used_by.get(key, [])) or 'no documented screen'}", ""]

        parameters = operation.get("parameters", [])
        if parameters:
            lines += ["### Parameters", "", "| Name | In | Type | Required | Description |", "|---|---|---|---|---|"]
            for parameter in parameters:
                lines.append(
                    f"| {_cell(parameter['name'])} | {parameter.get('in', '')} "
                    f"| {_cell(type_label(parameter.get('schema', {}), components))} "
                    f"| {'yes' if parameter.get('required') else 'no'} | {_cell(parameter.get('description', ''))} |")
            lines.append("")

        request_schema = _json_schema(operation.get("requestBody", {}))
        if request_schema:
            lines += ["### Request body", ""] + _field_table(flatten(request_schema, components))

        responses = operation.get("responses", {})
        for code in sorted(responses):
            response_schema = _json_schema(responses[code])
            if code.startswith("2") and response_schema:
                lines += [f"### Response {code}", ""] + _field_table(flatten(response_schema, components))

        if responses:
            lines += ["### Status codes", "", "| Code | Meaning |", "|---|---|"]
            lines += [f"| {code} | {_cell(responses[code].get('description', ''))} |" for code in sorted(responses)]
            lines.append("")

    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--swagger", required=True, type=Path)
    parser.add_argument("--screens", default=Path("docs/wiki/screens.json"), type=Path)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()

    swagger = json.loads(args.swagger.read_text(encoding="utf-8"))
    used_by: dict[str, list[str]] = {}
    for screen in json.loads(args.screens.read_text(encoding="utf-8"))["screens"]:
        for endpoint in screen["endpoints"]:
            used_by.setdefault(endpoint, []).append(screen["id"])

    args.out.mkdir(parents=True, exist_ok=True)
    for tag, operations in sorted(group_by_tag(swagger).items()):
        target = args.out / f"{slug(tag)}.md"
        target.write_text(render_tag(tag, operations, swagger, used_by), encoding="utf-8")
        print(target)
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python3 scripts/test_wiki_api.py`
Expected: `6/6 passed`, exit 0.

- [ ] **Step 5: Smoke-run on the real Swagger**

```bash
python3 scripts/wiki-api.py --swagger /private/tmp/claude-501/-Users-jan-Projects-fitness-platform/0f1c8d29-8bb5-4d33-baeb-807402ec94e5/scratchpad/swagger.json --out /private/tmp/claude-501/-Users-jan-Projects-fitness-platform/0f1c8d29-8bb5-4d33-baeb-807402ec94e5/scratchpad/wiki-api
```
Expected: one `.md` path per tag, no traceback. Open `trainer.md` and confirm `## GET /trainer/clients` lists `page`, `pageSize`, `search`. Run it once more with `--screens <scratchpad>/screens-examples.json` (from Task 2) and confirm that line reads `Used by: web.clients.list, …`.

- [ ] **Step 6: Commit**

```bash
chmod +x scripts/wiki-api.py scripts/test_wiki_api.py
git add scripts/wiki-api.py scripts/test_wiki_api.py
git commit -m "1162: wiki-api renders Swagger into per-tag wiki pages

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: CI — run the wiki tests and check against live Swagger

**Files:**
- Modify: `.github/workflows/e2e.yml` (pull_request `paths`, plus a step after "Boot compose harness")

**Interfaces:**
- Consumes: `E2E_API_URL` set by the existing "Boot compose harness" step; the three test scripts and `wiki-check.py`.

- [ ] **Step 1: Widen the pull_request path filter**

In `.github/workflows/e2e.yml`, under `on.pull_request.paths`, add after `- 'qa-playwright/**'`:

```yaml
      - 'docs/wiki/**'
      - 'scripts/wiki-*'
      - 'scripts/fetch-swagger.py'
      - 'scripts/test_wiki_*'
      - 'scripts/test_fetch_swagger.py'
```

- [ ] **Step 2: Add the check step**

Insert directly after the "Boot compose harness" step and before "Run Playwright tests (host suite — regression smoke)":

```yaml
      - name: Wiki screen inventory check
        # Validates docs/wiki/screens.json against the harness's live Swagger,
        # so an endpoint rename or a deleted page file fails here, not in Notion.
        run: |
          set -euo pipefail
          python3 scripts/test_wiki_check.py
          python3 scripts/test_wiki_api.py
          python3 scripts/test_fetch_swagger.py
          curl -ksSf "$E2E_API_URL/swagger/v1/swagger.json" -o "$RUNNER_TEMP/swagger.json"
          python3 scripts/wiki-check.py --swagger "$RUNNER_TEMP/swagger.json"
```

- [ ] **Step 3: Verify the workflow still parses**

```bash
ruby -ryaml -e 'YAML.load_file(".github/workflows/e2e.yml"); puts "ok"'
```
Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/e2e.yml
git commit -m "1162: CI checks the screen inventory against live Swagger

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Rewrite the `notion-docs` skill

**Files:**
- Modify (full rewrite): `.claude/skills/notion-docs/SKILL.md`
- Create: `.claude/skills/notion-docs/references/build.md`
- Modify (full rewrite): `.claude/skills/notion-docs/references/update.md`
- Modify (full rewrite): `.claude/skills/notion-docs/references/page-templates.md`
- Delete: `.claude/skills/notion-docs/references/bootstrap.md`, `.claude/skills/notion-docs/references/routing.md`

**Interfaces:**
- Consumes: CLIs from Tasks 1–3 and `scripts/notion-upload.py`; root page id `3451c0f6-641f-81cf-b502-fbd0e6227e27`.

- [ ] **Step 1: Write `SKILL.md`**

```markdown
---
name: notion-docs
description: Build and update the GoodFellas Notion wiki — app → area → screen pages explaining every control, real-app screenshots, and an API reference generated from Swagger. Two modes — update (at the end of every task, after its PR merges) and build (recovery rebuild). Main thread only. Invoke on "update the wiki", "update the docs", "rebuild the wiki", or after any task's PR merges.
---

# notion-docs — the Notion wiki

Notion holds an English wiki for a **new team member** (tester, developer,
product person). It explains every shipped screen and every API endpoint.
Design: `docs/superpowers/specs/2026-10-05-notion-wiki-design.md`.

**Main thread only.** Screenshots need the Playwright browser tool and pages
need the Notion tools; sub-agents have neither. Sub-agents only draft text.

## Modes

| Mode | When | Reference |
|---|---|---|
| `update` | **End of every task:** after its PR merges — into the epic branch (sub-issue) or `develop` (standalone or epic PR) — or "update the wiki". | [`references/update.md`](references/update.md) |
| `build` | Recovery only: the tree was lost, or the user asks to rebuild everything. | [`references/build.md`](references/build.md) |

Default to `update`. The wiki grows task by task: `screens.json` starts
empty, and update creates any missing app, area, API reference or glossary
page the first time it needs one. An epic PR's merge to `develop` still runs
update; after per-task runs it is usually a no-op.

## Fixed facts

- Root page: `Fitness & Nutrition Platform`, id `3451c0f6-641f-81cf-b502-fbd0e6227e27`.
- Screen inventory: `docs/wiki/screens.json` — the only source of which
  screen pages exist. Never create a screen page without an entry.
- Page shapes, the screenshot procedure and the drafting brief:
  [`references/page-templates.md`](references/page-templates.md).
- Scripts: `scripts/wiki-check.py`, `scripts/fetch-swagger.py`,
  `scripts/wiki-api.py`, `scripts/notion-upload.py`.
- No changelog page. The wiki describes the app as it is now.

## Rules

- English only. Screenshots show the app in Czech (`lang` = `cs`).
- Screenshots come from the real app against the test harness, never from
  design boards and never from personal data.
- Swagger is copied faithfully. A wrong Swagger fact is a backend issue to
  report, not something to correct in the wiki.
- A failed screenshot keeps the old image and adds the "screenshot out of
  date" callout; never delete an image because a capture failed.
- After creating a screen page, write its id into `notionPageId` in
  `screens.json` and commit that change on the current branch.

## Done when

- `python3 scripts/wiki-check.py --swagger <fresh swagger>` passes.
- Every entry in `screens.json` has a page, and its `notionPageId` is set.
- The run summary lists pages created, updated, trashed and failed shots.
```

- [ ] **Step 2: Write `references/build.md`**

```markdown
# Build mode — recreate the whole wiki

Recovery only: the tree was lost, or the user asks to rebuild everything.
Normal growth happens in update mode, task by task. Reuses the root page.

## 1. Prepare

1. Boot the test harness from the repo root: `./scripts/test-env up`, then
   `./scripts/test-env ports` → `api_url`. Start the web portal against it
   (`npm run dev:e2e` in `web/`, port 5173). Kill anything already on :5173
   from another worktree first (`lsof -i :5173`).
2. `python3 scripts/fetch-swagger.py <api_url> <scratchpad>/swagger.json`.
3. `python3 scripts/wiki-check.py --swagger <scratchpad>/swagger.json` —
   stop and fix `screens.json` if it fails.
4. `python3 scripts/wiki-api.py --swagger <scratchpad>/swagger.json --out <scratchpad>/wiki-api`.

## 2. Skeleton (Notion)

Replace the root page content with the **Main page** template. Create, as
children of the root, in this order: one **App page** per `app` value that has
entries (`web` → "Coaching portal (web)", `client` → "Client app (mobile)",
`coach` → "Coach app (mobile)"), then "API reference", then "Glossary". Under
each app page create one **Area page** per distinct `area`.

## 3. Screen pages

For each entry in `screens.json`:

1. Dispatch a drafting sub-agent (Sonnet) with the **drafting brief** from
   `page-templates.md`, filled with the entry. Up to 4 in parallel.
2. Take the entry's screenshots with the **screenshot procedure**.
3. Create the screen page under its area page from the **Screen page**
   template: drafted text + uploaded images. Links in "Technical" point to
   the endpoint's heading on its API reference page.
4. Write the page id into the entry's `notionPageId`.

## 4. API reference

Create one child page of "API reference" per file in `<scratchpad>/wiki-api/`,
titled with the tag. Before publishing, enrich each endpoint with the
**error codes** and **validation rules** section (see `page-templates.md`),
read from the endpoint folder under `backend/FitnessPlatform.Application/Features/`.
Replace each `Used by` screen id with a mention of that screen's page.

## 5. Glossary

One table of domain terms (term, meaning, where it appears). Seed it from
terms used on the screen pages; Czech product terms keep their Czech word
with the English meaning (e.g. "kouč — coach").

## 6. Finish

Commit `docs/wiki/screens.json` (`git add -f`). Stop the harness
(`./scripts/test-env down`) and the dev server. Report the summary.
```

- [ ] **Step 3: Write `references/update.md`**

```markdown
# Update mode — at the end of every task

Runs after the task's PR merges: into the epic branch for a sub-issue, into
`develop` for a standalone or epic PR. The wiki grows from here — there is no
up-front build.

## 0. Make sure the skeleton exists

Fetch the root page. Create whatever this run needs and is missing, using the
templates in `page-templates.md`: the Main page content, the app page for the
entry's `app`, the area page for its `area`, "API reference", "Glossary".
Never recreate a page that exists.

## 1. What changed

`git diff --name-only <merge-commit>^1 <merge-commit>` (for a squash merge,
`<commit>^ <commit>`). Then:

- **Affected screens:** entries whose `files` globs match any changed path.
- **New / removed screens:** compare `screens.json` before and after the merge.
- **Affected API tags:** for changed paths under
  `backend/FitnessPlatform.Application/Features/<Area>/`, the Swagger tags of
  the endpoints in those folders. Any backend change also re-runs
  `wiki-api.py` and republishes only tag pages whose Markdown differs from
  what is in Notion.

Nothing affected → report "wiki unchanged" and stop.

## 2. Prepare

Same as build step 1, but skip booting the web portal when no screen is affected.

## 3. Apply

- **Affected screen:** re-draft its text (drafting brief), retake its shots,
  replace the page body. Keep the page id.
- **New screen:** as build step 3, and add its link to the area page (create
  the area page if it is new).
- **Removed screen:** move its page to the trash (replace the area page's
  content without that child, `allow_deleting_content: true`); remove its
  link.
- **Affected tag:** republish that API reference page, enriched as in build.

## 4. Finish

Commit any `notionPageId` changes. Stop the harness and dev server. Report:
pages updated / created / trashed, failed shots.
```

- [ ] **Step 4: Write `references/page-templates.md`**

```markdown
# Page templates, screenshot procedure, drafting brief

## Main page

- What the platform is (one paragraph): coaches (trainers, nutritionists)
  manage clients on the web portal; clients use the mobile app.
- Who uses which app — a 3-row table.
- How to read this wiki: app → area → screen; API reference; glossary.
- Links to the app pages, API reference, glossary.

## App page

Purpose of the app, who signs in, how to reach it (URL / store), then a list
of its area pages with one line each.

## Area page

What the area is for (2–3 sentences), then its screens as a list:
title — one-line purpose — link.

## Screen page (in this order)

1. **Purpose** — 1–2 sentences; which roles use it.
2. **Screenshots** — one image per shot, caption = shot name. Light only
   until the app has a dark theme; then light and dark side by side.
3. **How to get here** — route; the link or button that leads here.
4. **Controls** — table: Control (label as shown, Czech + English) | What it
   does | Options / allowed values | Default | Disabled or hidden when.
   Every button, dropdown, input, toggle, tab, filter chip, collapsible and
   row action gets a row.
5. **States** — empty, loading, error, role-dependent: what it looks like
   and what triggers it.
6. **Technical** — endpoints called (each links to its API reference
   heading), source files from `files`.

## API reference page (one per Swagger tag)

The `wiki-api.py` Markdown, plus under each endpoint:

- **Error codes** — table: Code | When. Read `SendProblemAsync(...)` and
  `ThrowErrorWithCode(...)` calls in the endpoint; codes are the values in
  `Domain/Constants/ErrorCodes.cs`.
- **Validation rules** — one bullet per rule from the endpoint's
  `*Validator.cs`.

## Screenshot procedure (main thread)

1. Browser: Playwright tool, Brave. Window 1440×900. Set `localStorage.lang`
   = `cs` before the first navigation.
2. Sign in as the role the shot needs (credentials in
   `docs/testing/e2e-fixtures.md`). `Public` screens: signed out.
3. Navigate to the entry's `route` (replace `:param` with a seeded id). Run
   the shot's `steps`. Wait for network idle and for animations to finish.
4. `browser_take_screenshot` to `<scratchpad>/shots/<id>--<shot>.png`.
5. `notion-create-file-upload` with filename `<id>--<shot>.png` → then
   `python3 scripts/notion-upload.py <upload_url> "<authorization>" <file>`.
   The file name must equal the upload's filename.
6. Place `<image src="file-upload://<file_upload_id>"></image>` on the page.
   Unplaced uploads expire within an hour.
7. **On failure** (route errors, a step's control not found): keep the
   page's existing image and add the callout
   "⚠️ Screenshot out of date — capture failed on <date>". List it in the
   run summary.

## Drafting brief (send to a Sonnet sub-agent per screen)

> Read-only. Write the text for one wiki page about a screen of the
> GoodFellas app, for a new team member. English, plain, short sentences.
> Screen: `<id>` — `<title>`, route `<route>`, roles `<roles>`.
> Source files: `<files>`. Endpoints: `<endpoints>`.
> UI labels: read Czech from `web/src/i18n/locales/cs.json` and English from
> `en.json` (for mobile, the `mobile/src/i18n/locales/` files).
> Return Markdown only, with exactly these sections: Purpose, How to get
> here, Controls (table with the five columns: Control | What it does |
> Options / allowed values | Default | Disabled or hidden when), States.
> Cover every interactive element in the source files. For each claim you
> are unsure of, append "(unverified)". Do not include screenshots or
> endpoint docs.
```

- [ ] **Step 5: Delete the replaced references**

```bash
git rm .claude/skills/notion-docs/references/bootstrap.md .claude/skills/notion-docs/references/routing.md
```

- [ ] **Step 6: Verify no dangling references**

```bash
git grep -n -e "bootstrap.md" -e "routing.md" -e "bootstrap mode" -e "changelog" -- .claude CLAUDE.md
```
Expected: no hit that points at the notion-docs skill. Hits in `.claude/CLAUDE.md` (task lifecycle step 8), `.claude/rules/merge-strategy.md`, `pr-reviewer.md` and `ship-epic/SKILL.md` are rewritten in Task 6 — leave them. Report any other hit.

- [ ] **Step 7: Lint the Claude config**

```bash
npx -y @carlrannaberg/cclint@0.2.10 --root .
```
Expected: no errors for `.claude/skills/notion-docs/`. If `npx` is denied locally, say so and rely on the `cclint` CI job.

- [ ] **Step 8: Commit**

```bash
git add .claude/skills/notion-docs/SKILL.md .claude/skills/notion-docs/references/build.md .claude/skills/notion-docs/references/update.md .claude/skills/notion-docs/references/page-templates.md
git commit -m "1162: Rewrite notion-docs as the screen-by-screen wiki

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Keep the inventory current, and update the wiki at the end of every task

**Files:**
- Modify: `.claude/rules/merge-strategy.md` (sections "Sub-issue auto-merge" and "Merge dispatch")
- Modify: `.claude/CLAUDE.md` ("Task lifecycle reminder" step 8)
- Modify: `.claude/skills/ship-epic/SKILL.md` (sub-issue merge bullet, Phase 3 step 3, checklist, never-list)
- Modify: `.claude/agents/web-react.md` (section `## Conventions`, after its paragraph)
- Modify: `.claude/agents/mobile-expo.md` (section `## Conventions`, after its paragraph)
- Modify: `.claude/agents/pr-reviewer.md` (frontmatter line `skills: notion-docs`; line ~939 "all 12 items"; post-merge bullet ~801)
- Modify: `.claude/agents/pr-reviewer/references/review-checklist.md` (new item 13 before `## Done when`; "All 12 items walked")

- [ ] **Step 1: Add the convention to `web-react.md` and `mobile-expo.md`**

Append to each file's `## Conventions` section (after the existing paragraph, before the next `##`):

```markdown
**Wiki screen inventory.** When you add, remove or rename a routed screen,
or change which endpoints a screen calls, update its entry in
`docs/wiki/screens.json` in the same change (`id`, `route`, `files`,
`endpoints`, `shots`; leave `notionPageId` alone). Check it with
`python3 scripts/wiki-check.py --swagger <swagger.json>` when a Swagger file
is available; CI runs the same check.
```

- [ ] **Step 2: Add checklist item 13**

In `.claude/agents/pr-reviewer/references/review-checklist.md`, insert before `## Done when`:

```markdown
## 13. Wiki screen inventory current

**Citation:** `.claude/skills/notion-docs/SKILL.md` → Fixed facts

```bash
git diff --name-only origin/<base>...HEAD -- 'web/src/pages/**' 'mobile/src/app/**' 'web/src/App.tsx'
git diff origin/<base>...HEAD -- docs/wiki/screens.json
```

A page or route file added, removed or renamed (first command) with no
matching `screens.json` change (second) → **BLOCKING**. A new API call on a
screen whose entry's `endpoints` does not list it → **BLOCKING**.

---
```

Then change `- All 12 items walked.` to `- All 13 items walked.`

- [ ] **Step 3: Update `pr-reviewer.md`**

1. Remove the frontmatter line `skills: notion-docs` (the reviewer never runs the wiki; it cannot reach Notion or the browser).
2. Change "walk all 12 items top-to-bottom" to "walk all 13 items top-to-bottom".
3. Replace the post-merge bullet

```markdown
  - Dispatch `notion-docs` (update mode) to document the shipped change.
    For an epic merge, the docs entry should cover the union of
    sub-issues that landed in the consolidated commit.
```
with
```markdown
  - Run `notion-docs` (update mode) on the main thread — it needs the
    browser and Notion tools, which sub-agents lack. For an epic merge it
    covers every file the consolidated commit changed.
```

- [ ] **Step 4: Move the docs trigger to "end of every task"**

The wiki now updates after **every** task's PR merges, sub-issues included
(decided 2026-10-05). Replace each old "once per epic / develop only" rule:

1. `.claude/rules/merge-strategy.md`, section "Sub-issue auto-merge" — replace
   ```markdown
   - `notion-docs` is **not** dispatched per sub-issue. It runs once
     after the epic ships to `develop`.
   ```
   with
   ```markdown
   - Run `notion-docs` (update mode) on the main thread after the
     merge — the wiki updates at the end of every task, sub-issues
     included.
   ```
2. Same file, "Merge dispatch" step 5 — replace
   ```markdown
   5. Orchestrator dispatches `notion-docs` (update mode) to document
      the change. For an epic merge the docs entry covers all the
      sub-issues that landed in the consolidated commit — not one per
      sub-issue.
   ```
   with
   ```markdown
   5. Orchestrator runs `notion-docs` (update mode) on the main thread.
      For an epic merge the sub-issues were already documented as they
      merged, so this run is usually a no-op.
   ```
3. `.claude/CLAUDE.md`, "Task lifecycle reminder" step 8 — replace
   ```markdown
   8. After merge to `develop` (epic or standalone) → invoke `notion-docs`
      (update mode). On first use in a fresh workspace → bootstrap mode.
   ```
   with
   ```markdown
   8. After **every** task's PR merges (sub-issue, standalone or epic) →
      run `notion-docs` (update mode) on the main thread. It creates any
      missing wiki pages itself; `build` mode is for recovery only.
   ```
4. `.claude/agents/pr-reviewer.md`, `merge-sub-issue` hand-back block —
   replace
   ```markdown
     - DO NOT dispatch `notion-docs` for sub-issue merges — that runs
       once at the epic merge.
   ```
   with
   ```markdown
     - Run `notion-docs` (update mode) on the main thread — the wiki
       updates at the end of every task.
   ```
5. `.claude/skills/ship-epic/SKILL.md`:
   - the sub-issue merge bullet "**Do NOT dispatch `notion-docs`** for
     sub-issue merges. That fires exactly once, in Phase 3, after the epic
     merges to `develop`." → "**Run `notion-docs`** (update mode) after
     each sub-issue merges — the wiki updates at the end of every task.";
   - Phase 3 step 3 "**Single `notion-docs` pass** for the entire epic. …
     (they're intermediate; the consolidated commit is what matters)." →
     "**Final `notion-docs` update** after the epic merges to `develop`.
     Sub-issues were documented as they merged, so this is usually a
     no-op; it catches anything the epic PR itself changed.";
   - checklist item "**Exactly one** `notion-docs` update landed for the
     entire epic — at the end, after the epic merged to `develop`." →
     "A `notion-docs` update ran after every sub-issue merge and once
     after the epic merged to `develop`.";
   - the "Never invoke `notion-docs` per sub-issue merge. …" bullet in the
     never-list → delete it (all four lines).
   - leave the `description:` frontmatter as is (it only names the skill).

- [ ] **Step 5: Verify**

```bash
git grep -n -e "12 items" -e "skills: notion-docs" -e "not\*\* dispatched per sub-issue" -e "DO NOT dispatch \`notion-docs\`" -e "Exactly one\*\* \`notion-docs\`" -e "Never invoke \`notion-docs\` per sub-issue" -e "bootstrap mode" -- .claude CLAUDE.md
npx -y @carlrannaberg/cclint@0.2.10 --root .
```
Expected: first command no output; cclint no errors (or note that `npx` was denied).

- [ ] **Step 6: Commit**

```bash
git add .claude/agents/web-react.md .claude/agents/mobile-expo.md .claude/agents/pr-reviewer.md .claude/agents/pr-reviewer/references/review-checklist.md .claude/rules/merge-strategy.md .claude/CLAUDE.md .claude/skills/ship-epic/SKILL.md
git commit -m "1162: Dev and review rules keep the screen inventory current

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Final verification and hand-off

- [ ] **Step 1: Run every test script**

```bash
python3 scripts/test_wiki_check.py
python3 scripts/test_wiki_api.py
python3 scripts/test_fetch_swagger.py
```
Expected: `13/13`, `6/6`, `3/3 passed`.

- [ ] **Step 2: Inventory check against fresh Swagger** — repeat Task 2 Step 5 and Step 7. Expected: valid.

- [ ] **Step 3: Push and hand to the gates**

The main thread pushes (`git push -u origin chore/1162-notion-wiki-tooling`), then runs the project gates: `qa-tester` (issue #1162 ACs), then `pr-reviewer` (base `develop`). Merging to `develop` needs the user's same-turn authorization.

- [ ] **Step 4: Stop the time clock** per the private flow once the PR is open.

---

## Appendix A — worked example entries (not committed)

Gathered 2026-10-05 from the web portal as it stood on `develop`. Kept as the
pattern for the entries redesign tasks will add.

Facts come from the web inventory: router `web/src/App.tsx:54-73`, guard `web/src/routes/ProtectedRoute.tsx:13,18,23` (Client-only users → `/download-app`; Trainer, Nutritionist, Admin reach the shell), in-page Nutritionist gating at `web/src/pages/RecipesPage.tsx:42-43,65` and `web/src/pages/IngredientsPage.tsx:29-30,77`. `roles` lists who can **use** the screen; in-page restrictions are explained on the wiki page.

```json
{
  "screens": [
    {
      "id": "web.account.sign-in", "app": "web", "area": "Account", "title": "Sign in", "route": "/",
      "roles": ["Public"],
      "files": ["web/src/pages/EntryPage.tsx", "web/src/components/entry/**"],
      "endpoints": ["POST /auth/login", "GET /users/me", "POST /auth/refresh"],
      "board": "PageHomeSignIn",
      "shots": [{ "name": "default" }],
      "notionPageId": null
    },
    {
      "id": "web.account.register", "app": "web", "area": "Account", "title": "Create account", "route": "/register",
      "roles": ["Public"],
      "files": ["web/src/pages/EntryPage.tsx", "web/src/components/entry/**"],
      "endpoints": ["POST /auth/register", "POST /auth/resend-verification/anonymous"],
      "board": "PageRegister",
      "shots": [
        { "name": "default" },
        { "name": "check-email", "steps": "fill the form with a fresh e-mail address, pick a role, submit 'Založit účet'" }
      ],
      "notionPageId": null
    },
    {
      "id": "web.account.forgot-password", "app": "web", "area": "Account", "title": "Forgot password", "route": "/forgot-password",
      "roles": ["Public"],
      "files": ["web/src/pages/EntryPage.tsx", "web/src/components/entry/**"],
      "endpoints": ["POST /auth/password/reset"],
      "board": null,
      "shots": [
        { "name": "default" },
        { "name": "sent", "steps": "enter a seeded user's e-mail and submit" }
      ],
      "notionPageId": null
    },
    {
      "id": "web.account.verify-email", "app": "web", "area": "Account", "title": "Verify e-mail", "route": "/verify-email",
      "roles": ["Public"],
      "files": ["web/src/pages/VerifyEmailPage.tsx"],
      "endpoints": ["POST /auth/verify-email", "POST /auth/resend-verification/anonymous", "GET /users/me"],
      "board": "PageRegisterVerified",
      "shots": [
        { "name": "check-inbox" },
        { "name": "invalid-link", "steps": "open the page with an invalid token in the link" }
      ],
      "notionPageId": null
    },
    {
      "id": "web.account.reset-password", "app": "web", "area": "Account", "title": "Reset password", "route": "/auth/reset-password",
      "roles": ["Public"],
      "files": ["web/src/pages/ResetPasswordPage.tsx"],
      "endpoints": ["PUT /auth/password/reset"],
      "board": null,
      "shots": [
        { "name": "default", "steps": "open the reset link from the forgot-password e-mail in MailHog" },
        { "name": "invalid-link", "steps": "open the page without a token" }
      ],
      "notionPageId": null
    },
    {
      "id": "web.account.download-app", "app": "web", "area": "Account", "title": "Download the app", "route": "/download-app",
      "roles": ["Client"],
      "files": ["web/src/pages/DownloadAppPage.tsx"],
      "endpoints": [],
      "board": null,
      "shots": [{ "name": "default", "steps": "sign in as a seeded client" }],
      "notionPageId": null
    },
    {
      "id": "web.clients.list", "app": "web", "area": "Clients", "title": "Client list", "route": "/clients",
      "roles": ["Trainer", "Nutritionist", "Admin"],
      "files": ["web/src/pages/ClientsPage.tsx", "web/src/components/clients/**"],
      "endpoints": [
        "GET /trainer/clients", "GET /trainer/clients/pending",
        "GET /trainer/client-tags", "POST /trainer/client-tags",
        "PUT /trainer/client-tags/{tagId}", "DELETE /trainer/client-tags/{tagId}",
        "PUT /trainer/clients/{clientId}/tags", "POST /trainer/broadcast",
        "POST /trainer/pending-invites", "DELETE /trainer/pending-invites/{id}",
        "POST /trainer/client-requests/{publicId}/accept", "POST /trainer/client-requests/{publicId}/reject"
      ],
      "board": "PageClients",
      "shots": [
        { "name": "default" },
        { "name": "pending-tab", "steps": "click the 'Čekající' tab" },
        { "name": "invite-drawer", "steps": "click '+ Pozvat klienta'" },
        { "name": "broadcast-drawer", "steps": "tick two client rows, click 'Odeslat zprávu' in the selection bar" },
        { "name": "tag-filter", "steps": "click 'Vybrat štítky'" },
        { "name": "create-tag", "steps": "click 'Vybrat štítky', then 'Vytvořit štítek'" }
      ],
      "notionPageId": null
    },
    {
      "id": "web.clients.detail", "app": "web", "area": "Clients", "title": "Client detail", "route": "/clients/:clientId",
      "roles": ["Trainer", "Nutritionist", "Admin"],
      "files": ["web/src/pages/ClientDetailPage.tsx", "web/src/components/client-detail/**"],
      "endpoints": [
        "GET /trainer/clients/{clientId}", "GET /trainer/clients/{clientId}/plans",
        "GET /trainer/clients/{clientId}/measurements", "GET /trainer/clients/{clientId}/message-stats",
        "GET /nutrition/plans/{planId}", "GET /training/plans/{planId}"
      ],
      "board": "PageClientDetail",
      "shots": [{ "name": "default", "steps": "open a seeded client with an active plan from the client list" }],
      "notionPageId": null
    },
    {
      "id": "web.inbox.conversations", "app": "web", "area": "Inbox", "title": "Inbox", "route": "/inbox",
      "roles": ["Trainer", "Nutritionist", "Admin"],
      "files": ["web/src/pages/InboxPage.tsx", "web/src/components/inbox/**"],
      "endpoints": [
        "GET /conversations", "POST /conversations", "GET /conversations/filter-counts",
        "GET /conversations/{conversationId}/messages", "POST /conversations/{conversationId}/messages",
        "POST /conversations/{conversationId}/messages/image-upload-url", "POST /conversations/{conversationId}/read",
        "GET /trainer/clients/{clientId}", "GET /trainer/clients/{clientId}/plans",
        "GET /trainer/clients/{clientId}/measurements"
      ],
      "board": "PageInbox",
      "shots": [
        { "name": "empty", "steps": "open /inbox without selecting a conversation" },
        { "name": "conversation", "steps": "click the first conversation" },
        { "name": "client-panel", "steps": "click the first conversation, then 'Zobrazit klienta'" },
        { "name": "archived", "steps": "switch the view toggle to 'Archivováno'" }
      ],
      "notionPageId": null
    },
    {
      "id": "web.recipes.library", "app": "web", "area": "Recipes", "title": "Recipe library", "route": "/recipes",
      "roles": ["Nutritionist"],
      "files": ["web/src/pages/RecipesPage.tsx", "web/src/components/recipes/**", "web/src/components/library/**", "web/src/components/tags/**"],
      "endpoints": [
        "GET /recipes", "POST /recipes", "GET /recipes/{recipeId}", "PUT /recipes/{recipeId}", "DELETE /recipes/{recipeId}",
        "POST /recipes/{recipeId}/image/upload-url", "PUT /recipes/{recipeId}/image", "DELETE /recipes/{recipeId}/image",
        "DELETE /recipes/{recipeId}/gallery", "POST /recipes/{recipeId}/gallery/promote",
        "PUT /trainer/recipes/{recipeId}/tags", "GET /foods/search", "GET /trainer/food-tags"
      ],
      "board": "PageRecipesTable",
      "shots": [
        { "name": "default" },
        { "name": "new-recipe", "steps": "click '+ Nový recept'" },
        { "name": "ingredients-tab", "steps": "open a seeded recipe, click the 'Suroviny' tab" },
        { "name": "preparation-tab", "steps": "open a seeded recipe, click the 'Postup' tab" },
        { "name": "pictures-tab", "steps": "open a seeded recipe, click the 'Obrázky' tab" },
        { "name": "delete-dialog", "steps": "open a recipe you own, click 'Smazat'" }
      ],
      "notionPageId": null
    },
    {
      "id": "web.ingredients.library", "app": "web", "area": "Ingredients", "title": "Ingredient library", "route": "/ingredients",
      "roles": ["Trainer", "Nutritionist"],
      "files": ["web/src/pages/IngredientsPage.tsx", "web/src/components/ingredients/**", "web/src/components/library/**", "web/src/components/tags/**"],
      "endpoints": [
        "GET /foods/search", "POST /foods", "GET /foods/{foodId}", "PUT /foods/{foodId}", "DELETE /foods/{foodId}",
        "GET /foods/custom", "POST /foods/{foodId}/image/upload-url", "PUT /foods/{foodId}/image", "DELETE /foods/{foodId}/image",
        "GET /trainer/food-tags", "POST /trainer/food-tags", "PUT /trainer/food-tags/{tagId}", "DELETE /trainer/food-tags/{tagId}",
        "PUT /trainer/foods/{foodId}/tags"
      ],
      "board": "PageIngredients",
      "shots": [
        { "name": "default" },
        { "name": "new-ingredient", "steps": "sign in as the nutritionist, click '+ Nová surovina'" },
        { "name": "delete-dialog", "steps": "open an ingredient you own, click 'Smazat'" },
        { "name": "trainer-read-only", "steps": "sign in as the trainer, open any ingredient" }
      ],
      "notionPageId": null
    }
  ]
}
```
