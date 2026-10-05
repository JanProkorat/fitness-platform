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
        if isinstance(entry["id"], str):
            seen_ids.add(entry["id"])

    return problems


def _check_entry(entry: dict, seen_ids: set[str], operations: set[str], repo_root: Path) -> list[str]:
    problems: list[str] = []

    # Type validation: ensure required fields have correct types.
    if not isinstance(entry["id"], str):
        problems.append("field 'id' must be a string")
    if not isinstance(entry["app"], str):
        problems.append("field 'app' must be a string")
    if not isinstance(entry["area"], str):
        problems.append("field 'area' must be a string")
    if not isinstance(entry["title"], str):
        problems.append("field 'title' must be a string")
    if not isinstance(entry["route"], str):
        problems.append("field 'route' must be a string")
    if not isinstance(entry["roles"], list):
        problems.append("field 'roles' must be a list of strings")
    elif not all(isinstance(r, str) for r in entry["roles"]):
        problems.append("field 'roles' must be a list of strings")
    if not isinstance(entry["files"], list):
        problems.append("field 'files' must be a list of strings")
    elif not all(isinstance(f, str) for f in entry["files"]):
        problems.append("field 'files' must be a list of strings")
    if not isinstance(entry["endpoints"], list):
        problems.append("field 'endpoints' must be a list of strings")
    elif not all(isinstance(e, str) for e in entry["endpoints"]):
        problems.append("field 'endpoints' must be a list of strings")
    if not isinstance(entry["shots"], list):
        problems.append("field 'shots' must be a list")

    # Return early if type validation failed.
    if problems:
        return problems

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
        else:
            try:
                if not any(repo_root.glob(pattern)):
                    problems.append(f"file glob '{pattern}' matches no file")
            except (ValueError, NotImplementedError):
                problems.append(f"file glob '{pattern}' is invalid")

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
        elif not isinstance(name, str):
            problems.append(f"shot #{position} name must be a string")
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
    except (OSError, UnicodeDecodeError) as error:
        sys.exit(_fail(f"{path} could not be read: {error}"))


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
    if not isinstance(swagger, dict) or not isinstance(swagger.get("paths"), dict):
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
