from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_script_admin_has_third_mode_and_editor_mount():
    html = (ROOT / "static/pages/role_admin.html").read_text(encoding="utf-8")
    assert 'data-admin-mode="scripts"' in html
    assert 'id="script-admin"' in html
    assert "劇本管理系統" in html


def test_script_admin_exposes_all_required_rich_text_fields():
    javascript = (ROOT / "static/js/script_admin.js").read_text(encoding="utf-8")
    required_ids = {
        "sam-background",
        "sam-gameplay",
        "sam-author-note",
        "sam-updates",
        "sam-player-guide",
        "sam-storyteller-guide",
    }
    assert all(field_id in javascript for field_id in required_ids)
    assert "data-rich-text" in javascript
    assert "data-custom-ability data-rich-text" in javascript


def test_script_admin_api_persists_required_fields_and_custom_abilities():
    routes = (ROOT / "script_admin_routes.py").read_text(encoding="utf-8")
    for field in (
        "background_introduction",
        "gameplay_overview",
        "author_note",
        "production_updates",
        "player_guide",
        "storyteller_guide",
    ):
        assert field in routes
    assert 'data.get("custom_roles")' in routes
    assert '("ability", "ability")' in routes
    assert "setattr(item, target, incoming[field])" in routes


if __name__ == "__main__":
    test_script_admin_has_third_mode_and_editor_mount()
    test_script_admin_exposes_all_required_rich_text_fields()
    test_script_admin_api_persists_required_fields_and_custom_abilities()
    print({"status": "ok"})