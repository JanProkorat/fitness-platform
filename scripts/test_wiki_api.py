#!/usr/bin/env python3
"""Tests for wiki-api.py. Run: python3 scripts/test_wiki_api.py — exit code is the result."""
from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
import tempfile
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


def test_flatten_oneof_wrapped_enum_ref():
    components = {
        "MovementType": {"type": "string", "enum": ["Push", "Pull"]},
        "Exercise": {"type": "object", "properties": {
            "movementType": {"nullable": True, "oneOf": [{"$ref": "#/components/schemas/MovementType"}]},
            "other": {"anyOf": [{"$ref": "#/components/schemas/MovementType"}]},
        }},
    }
    rows = wiki_api.flatten({"$ref": "#/components/schemas/Exercise"}, components)
    assert rows[0]["type"] == "MovementType (enum: Push, Pull), nullable"
    assert rows[1]["type"] == "MovementType (enum: Push, Pull)"


def test_flatten_oneof_wrapped_object_is_flattened():
    components = {
        "Address": {"type": "object", "properties": {"city": {"type": "string"}}},
        "Person": {"type": "object", "properties": {
            "address": {"nullable": True, "oneOf": [{"$ref": "#/components/schemas/Address"}]},
        }},
    }
    rows = wiki_api.flatten({"$ref": "#/components/schemas/Person"}, components)
    assert [row["field"] for row in rows] == ["address", "address.city"]
    assert rows[0]["type"] == "Address, nullable"


def test_flatten_oneof_wrapped_self_reference():
    components = {
        "N": {"type": "object", "properties": {
            "name": {"type": "string"},
            "parent": {"nullable": True, "oneOf": [{"$ref": "#/components/schemas/N"}]},
        }},
    }
    rows = wiki_api.flatten({"$ref": "#/components/schemas/N"}, components)
    assert [row["field"] for row in rows] == ["name", "parent"]
    assert rows[1]["type"].endswith("(recursive)")


def test_flatten_allof_wrapped_self_reference():
    # Test allOf-wrapped self-reference (e.g., nullable self-ref) does not cause RecursionError
    components = {
        "N": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "parent": {"nullable": True, "allOf": [{"$ref": "#/components/schemas/N"}]},
            },
        }
    }
    rows = wiki_api.flatten({"$ref": "#/components/schemas/N"}, components)
    assert [row["field"] for row in rows] == ["name", "parent"]
    assert rows[1]["type"].endswith("(recursive)")


def test_flatten_array_of_allof_wrapped_self_ref():
    # Test array of allOf-wrapped self-refs terminates
    components = {
        "N": {
            "type": "object",
            "properties": {
                "children": {"type": "array", "items": {"allOf": [{"$ref": "#/components/schemas/N"}]}},
            },
        }
    }
    rows = wiki_api.flatten({"$ref": "#/components/schemas/N"}, components)
    assert [row["field"] for row in rows] == ["children"]
    assert rows[0]["type"] == "array of N (recursive)"


def test_flatten_mutual_recursion():
    # Test mutual recursion A -> B -> A terminates and marks edges recursive
    components = {
        "A": {
            "type": "object",
            "properties": {
                "name": {"type": "string"},
                "b": {"$ref": "#/components/schemas/B"},
            },
        },
        "B": {
            "type": "object",
            "properties": {
                "label": {"type": "string"},
                "a": {"$ref": "#/components/schemas/A"},
            },
        }
    }
    rows = wiki_api.flatten({"$ref": "#/components/schemas/A"}, components)
    assert [row["field"] for row in rows] == ["name", "b", "b.label", "b.a"]
    assert rows[3]["type"].endswith("(recursive)")  # b.a is recursive


def test_render_tag_resolves_parameter_refs():
    # Test parameter $ref resolution
    swagger = {
        "paths": {
            "/test": {
                "get": {
                    "tags": ["Test"],
                    "parameters": [
                        {"$ref": "#/components/parameters/PageParam"},
                    ],
                    "responses": {"200": {"description": "OK"}},
                }
            }
        },
        "components": {
            "parameters": {
                "PageParam": {
                    "name": "page",
                    "in": "query",
                    "schema": {"type": "integer"},
                    "required": True,
                    "description": "Page number",
                }
            },
            "schemas": {}
        }
    }
    page = wiki_api.render_tag("Test", [("get", "/test", swagger["paths"]["/test"]["get"])], swagger, {})
    assert "| page | query | integer | yes | Page number |" in page


def test_render_tag_includes_path_level_parameters():
    # Test path-level parameters are included before operation parameters
    swagger = {
        "paths": {
            "/items/{id}": {
                "parameters": [
                    {"name": "id", "in": "path", "required": True, "schema": {"type": "string"}, "description": "Item ID"}
                ],
                "get": {
                    "tags": ["Items"],
                    "parameters": [
                        {"name": "format", "in": "query", "schema": {"type": "string"}, "description": "Response format"}
                    ],
                    "responses": {"200": {"description": "OK"}},
                }
            }
        },
        "components": {"schemas": {}}
    }
    page = wiki_api.render_tag("Items", [("get", "/items/{id}", swagger["paths"]["/items/{id}"]["get"])], swagger, {})
    # id should come before format
    assert "| id | path | string | yes | Item ID |" in page
    assert "| format | query | string | no | Response format |" in page
    id_idx = page.find("| id | path")
    format_idx = page.find("| format | query")
    assert id_idx < format_idx


def test_main_missing_swagger_file():
    # Test CLI error handling for missing swagger file
    with tempfile.TemporaryDirectory() as tmpdir:
        out_dir = Path(tmpdir) / "out"
        result = subprocess.run(
            [sys.executable, str(HERE / "wiki-api.py"),
             "--swagger", "/nonexistent/swagger.json",
             "--screens", str(HERE / "test_wiki_api.py"),  # dummy file
             "--out", str(out_dir)],
            capture_output=True,
            text=True
        )
        assert result.returncode == 1
        assert "wiki-api:" in result.stderr
        assert "not found" in result.stderr


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
