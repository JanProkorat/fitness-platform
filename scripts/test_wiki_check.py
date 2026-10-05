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


def test_empty_glob_string_is_reported_not_raised():
    found = problems_for(screen(files=[""]))
    assert any("invalid" in p.lower() or "must" in p.lower() for p in found)
    assert all("Traceback" not in p for p in found)


def test_null_in_roles_is_reported_not_raised():
    found = problems_for(screen(roles=None))
    assert any("must be a list" in p for p in found)


def test_non_string_endpoint_is_reported_not_raised():
    found = problems_for(screen(endpoints=[5]))
    assert any("must be" in p.lower() or "string" in p.lower() for p in found)


def test_non_string_id_is_reported_not_raised():
    found = problems_for(screen(id=5))
    assert any("must be" in p.lower() or "string" in p.lower() for p in found)


def test_id_as_list_is_reported_not_raised():
    found = problems_for(screen(id=["web", "clients", "list"]))
    assert any("must be" in p.lower() or "string" in p.lower() for p in found)


def test_shot_name_as_list_is_reported_not_raised():
    found = problems_for(screen(shots=[{"name": ["default"]}]))
    assert any("name must be a string" in p for p in found)


def test_cli_rejects_swagger_with_non_dict_paths():
    root = make_repo()
    screens = root / "screens.json"
    screens.write_text(json.dumps({"screens": []}))
    bad_swagger = root / "swagger.json"
    bad_swagger.write_text(json.dumps({"paths": []}))
    result = subprocess.run(
        [sys.executable, str(HERE / "wiki-check.py"), "--screens", str(screens), "--swagger", str(bad_swagger), "--root", str(root)],
        capture_output=True, text=True)
    assert result.returncode == 1
    assert "Traceback" not in result.stderr
    assert "not a Swagger document" in result.stdout + result.stderr


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
