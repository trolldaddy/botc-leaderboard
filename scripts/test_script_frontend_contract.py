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


if __name__ == "__main__":
    test_public_script_page_renders_sanitized_rich_text()
    test_custom_script_entries_are_cards_not_links_and_show_ability()
    print({"status": "ok", "tests": 2})
