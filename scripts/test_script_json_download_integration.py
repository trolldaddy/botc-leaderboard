import json
import sys
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from script_import_service import normalized_script_payload  # noqa: E402


def test_normalized_json_uses_database_traditional_names_and_night_data():
    role = SimpleNamespace(
        canonical_key="clockmaker", name_zh_tw="鐘錶匠", team="townsfolk",
        ability_zh_tw="得知惡魔與爪牙之間的距離。", image_url="/clockmaker.png",
        first_night_order=12, other_night_order=0,
        first_night_reminder="展示數字。", other_night_reminder=None,
    )
    payload = normalized_script_payload("測試劇本", "作者", [role], [])
    assert payload[0] == {"id": "_meta", "name": "測試劇本", "author": "作者"}
    assert payload[1]["name"] == "鐘錶匠"
    assert payload[1]["firstNight"] == 12
    assert payload[1]["firstNightReminder"] == "展示數字。"
    assert "鐘錶匠" in json.dumps(payload, ensure_ascii=False)


def test_download_and_recorder_logo_contracts():
    public_routes = (ROOT / "script_public_routes.py").read_text(encoding="utf-8")
    recorder = (ROOT / "static" / "js" / "recorder.js").read_text(encoding="utf-8")
    scripts_ui = (ROOT / "static" / "js" / "scripts.js").read_text(encoding="utf-8")
    assert '"/{slug}/download.json"' in public_routes
    assert '"json_download_url"' in public_routes
    assert "logo_image_url" in recorder
    assert "loadPublicScript" in recorder
    assert "\\u4e0b\\u8f09\\u7e41\\u4e2d JSON" in scripts_ui


if __name__ == "__main__":
    test_normalized_json_uses_database_traditional_names_and_night_data()
    test_download_and_recorder_logo_contracts()
    print("script JSON download integration tests passed")
