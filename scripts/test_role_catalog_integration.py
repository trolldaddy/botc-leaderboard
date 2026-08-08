from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_public_role_catalog_exposes_recorder_night_fields():
    source = (ROOT / "role_public_routes.py").read_text(encoding="utf-8")

    for field in (
        "first_night_order",
        "other_night_order",
        "first_night_reminder",
        "other_night_reminder",
    ):
        assert f'"{field}"' in source


def test_global_role_catalog_uses_database_with_static_fallback():
    index = (ROOT / "static/index.html").read_text(encoding="utf-8")
    catalog = (ROOT / "static/js/role-catalog.js").read_text(encoding="utf-8")
    record = (ROOT / "static/js/record.js").read_text(encoding="utf-8")

    assert '/js/role-catalog.js' in index
    assert "/api/roles?limit=1000" in catalog
    assert "window.MASTER_ROLE_DB = catalog" in catalog
    assert "return fallback" in catalog
    assert "botc:role-catalog-ready" in record


def test_recorder_rehydrates_roles_and_night_actions_from_catalog():
    recorder = (ROOT / "static/js/recorder.js").read_text(encoding="utf-8")

    assert "const [roleCatalog, setRoleCatalog]" in recorder
    assert "window.RoleCatalog?.ready?.then(applyCatalog)" in recorder
    assert "setScript(current => current.map" in recorder
    assert "setPlayers(current => current.map" in recorder
    assert "roleCatalog.find(r => r.id === roleId)" in recorder
    assert "p.role.firstNight > 0" in recorder
    assert "p.role.otherNight > 0" in recorder
    assert "player.role.firstNightReminder" in recorder
    assert "player.role.otherNightReminder" in recorder
