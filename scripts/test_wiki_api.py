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
