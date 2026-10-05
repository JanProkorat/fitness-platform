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
