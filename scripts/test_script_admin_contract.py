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


def test_script_admin_role_json_import_is_preview_first():
    html = (ROOT / "static/pages/role_admin.html").read_text(encoding="utf-8")
    javascript = (ROOT / "static/js/script_admin.js").read_text(encoding="utf-8")
    routes = (ROOT / "script_admin_routes.py").read_text(encoding="utf-8")
    assert "script-json-import" in html
    assert "script-role-json-preview" in javascript
    assert "script-role-json-apply" in javascript
    assert 'role-json/preview' in routes
    assert 'role-json/apply' in routes
    assert 'if not report["can_apply"]' in routes


def test_script_admin_new_import_is_preview_first_and_local_only():
    html = (ROOT / "static/pages/role_admin.html").read_text(encoding="utf-8")
    javascript = (ROOT / "static/js/script_admin.js").read_text(encoding="utf-8")
    routes = (ROOT / "script_admin_routes.py").read_text(encoding="utf-8")
    service = (ROOT / "script_import_service.py").read_text(encoding="utf-8")
    assert 'id="script-admin-create"' in html
    assert 'id="si-images"' in javascript
    assert 'id="si-json"' in javascript
    assert "/api/admin/scripts/imports/preview" in javascript
    assert "/api/admin/scripts/imports/apply" in javascript
    assert '@router.post("/imports/preview")' in routes
    assert '@router.post("/imports/apply")' in routes
    assert "/static/script-images/uploads/" in service
    assert "/static/script-role-icons/uploads/" in service
    assert "is_public=False" in service
    assert "needs_review=True" in service
    assert "沒有成功保存任何劇本圖片" in service
    assert "image_data" in service

def test_script_admin_compacts_flags_and_supports_confirmed_delete():
    html = (ROOT / "static/pages/role_admin.html").read_text(encoding="utf-8")
    javascript = (ROOT / "static/js/script_admin.js").read_text(encoding="utf-8")
    routes = (ROOT / "script_admin_routes.py").read_text(encoding="utf-8")
    assert "script-admin-flags" in html
    assert 'id="script-admin-delete"' in javascript
    assert "async function deleteScript()" in javascript
    assert "window.confirm" in javascript
    assert "window.prompt" in javascript
    assert '@router.delete("/{script_id}")' in routes
    assert "db.delete(script)" in routes
    assert 'id="script-artwork-files"' in javascript
    assert "uploadArtworkCandidates" in javascript
    assert "artwork_candidates:state.artworkCandidates" in javascript
    assert '@router.post("/{script_id}/artwork-candidates/uploads")' in routes
    assert "save_candidate_artwork" in routes
    assert "apply_candidate_artwork" in routes
    assert "artwork_selection:{...state.artworkSelection}" in javascript
    assert "local_artwork_payload" in routes
    assert "persisted_artwork_url" in routes


def test_script_artwork_candidate_list_scrolls_inside_workbench():
    html = (ROOT / "static/pages/role_admin.html").read_text(encoding="utf-8")
    assert "height:clamp(480px,70vh,640px);overflow:hidden" in html
    assert "overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain" in html
    assert "scrollbar-gutter:stable" in html

if __name__ == "__main__":
    test_script_admin_has_third_mode_and_editor_mount()
    test_script_admin_exposes_all_required_rich_text_fields()
    test_script_admin_api_persists_required_fields_and_custom_abilities()
    test_script_admin_compacts_flags_and_supports_confirmed_delete()
    test_script_artwork_candidate_list_scrolls_inside_workbench()
    print({"status": "ok"})
