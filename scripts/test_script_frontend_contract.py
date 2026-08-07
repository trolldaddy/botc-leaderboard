from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_public_script_page_renders_sanitized_rich_text():
    javascript = (ROOT / "static/js/scripts.js").read_text(encoding="utf-8")
    assert "function richText(" in javascript
    assert "const allowedTags = new Set(" in javascript
    assert "allowedFontSizes" in javascript
    assert "richText(item.background_introduction || item.introduction" in javascript
    assert "richText(item.gameplay_overview" in javascript
    assert "richText(guides.player?.content" in javascript
    assert "target.innerHTML = richText(payload.content" in javascript


def test_custom_script_entries_are_cards_not_links_and_show_ability():
    javascript = (ROOT / "static/js/scripts.js").read_text(encoding="utf-8")
    start = javascript.index("function specialCard(item)")
    end = javascript.index("function groupedRosterMarkup", start)
    special_card = javascript[start:end]
    assert '<div class="script-role-card script-special-card">' in special_card
    assert '<a class="script-role-card' not in special_card
    assert "richText(item.ability)" in special_card


def test_special_entry_categories_and_admin_controls_are_explicit():
    public_js = (ROOT / "static/js/scripts.js").read_text(encoding="utf-8")
    admin_js = (ROOT / "static/js/script_admin.js").read_text(encoding="utf-8")
    assert "'a jinxed':'jinx'" in public_js
    assert "\u76f8\u524b\u898f\u5247" in public_js
    for category in ("townsfolk", "outsider", "minion", "demon", "traveller", "loric", "fabled", "jinx", "special"):
        assert f"'{category}'" in admin_js
    assert "data-custom-team" in admin_js
    assert "script-custom-add" in admin_js
    assert "data-custom-delete" in admin_js
    for category in ("\\u5b98\\u65b9\\u5287\\u672c", "\\u5b98\\u6df7\\u5287\\u672c", "\\u90e8\\u5206\\u539f\\u5275", "\\u5b8c\\u5168\\u539f\\u5275"):
        assert category in admin_js
    assert "sam-laplace" in admin_js
    assert "si-laplace" in admin_js
    assert "is_laplace_owned" in admin_js



def test_public_script_catalog_filters_and_role_search_are_available():
    page = (ROOT / "static/pages/scripts.html").read_text(encoding="utf-8")
    javascript = (ROOT / "static/js/scripts.js").read_text(encoding="utf-8")
    assert 'id="script-category-filters"' in page
    assert page.count("data-script-category=") == 6
    assert "item.is_laplace_owned" in javascript
    assert "role.name_zh_tw" in javascript
    assert "entry.name_zh_tw" in javascript
    assert "categoryMatches" in javascript


def test_room_script_summary_uses_logo_link_and_same_page_room_state():
    rooms = (ROOT / "static/js/rooms.js").read_text(encoding="utf-8")
    summary = (ROOT / "static/js/rooms-script-summary-patch.js").read_text(encoding="utf-8")
    assert "botc:town-room-changed" in rooms
    assert "getCurrentRoom" in rooms
    assert "script.logo_image_url" in summary
    assert "window.TownCheckin?.getCurrentRoom?.()" in summary
    assert "botc:town-room-changed" in summary
    assert "/#scripts/${encodeURIComponent(script.slug)}" in summary

if __name__ == "__main__":
    test_public_script_page_renders_sanitized_rich_text()
    test_custom_script_entries_are_cards_not_links_and_show_ability()
    test_special_entry_categories_and_admin_controls_are_explicit()
    test_public_script_catalog_filters_and_role_search_are_available()
    test_room_script_summary_uses_logo_link_and_same_page_room_state()
    print({"status": "ok", "tests": 5})
