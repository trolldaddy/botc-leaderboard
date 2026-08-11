from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_feature_routers_are_registered_explicitly():
    main_source = (ROOT / "main.py").read_text(encoding="utf-8")
    models_source = (ROOT / "models.py").read_text(encoding="utf-8")
    modules = {
        "line_login_override_routes",
        "match_override_routes",
        "room_routes",
        "player_seat_routes",
        "account_binding_routes",
        "knowledge_public_routes",
        "role_public_routes",
        "script_public_routes",
        "script_admin_routes",
        "role_admin_routes",
        "role_content_admin_routes",
        "role_sync_routes",
        "role_reminder_routes",
        "knowledge_admin_routes",
    }
    for module in modules:
        assert f"import {module}" in main_source
        assert f"{module}.router" in main_source
    assert "FastAPI.__init__" not in models_source
    assert "_install_town_checkin_router_patch" not in models_source


def test_override_routes_have_one_source_owner():
    main_source = (ROOT / "main.py").read_text(encoding="utf-8")
    line_source = (ROOT / "line_login_override_routes.py").read_text(encoding="utf-8")
    match_source = (ROOT / "match_override_routes.py").read_text(encoding="utf-8")
    for path in ("/auth/line/login", "/api/auth/line/login", "/auth/line/callback"):
        assert path not in main_source
        assert path in line_source
    assert '@app.post("/api/matches")' not in main_source
    assert '@router.post("/api/matches")' in match_source


def test_runtime_openapi_contains_every_feature(monkeypatch):
    monkeypatch.setenv("RUN_SCHEMA_MIGRATIONS", "0")
    import main

    paths = set(main.app.openapi()["paths"])
    assert {
        "/auth/line/login",
        "/auth/line/callback",
        "/api/matches",
        "/api/rooms",
        "/api/roles",
        "/api/scripts",
        "/api/admin/scripts",
        "/api/admin/roles",
    } <= paths
