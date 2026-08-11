from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
ROOM_PAGE = ROOT / "static" / "pages" / "rooms.html"
MODULES = (
    "rooms-sync.js",
    "rooms-identity.js",
    "rooms-seat.js",
    "rooms-script.js",
    "rooms-ui.js",
)


def test_room_page_loads_only_the_five_formal_modules():
    page = ROOM_PAGE.read_text(encoding="utf-8")
    sources = re.findall(r'<script[^>]+src="/js/(rooms[^"?]+)', page)
    assert sources == list(MODULES)
    assert not any("patch" in source for source in sources)


def test_room_modules_exist_and_do_not_dynamically_reload_legacy_patches():
    combined = ""
    for name in MODULES:
        path = ROOT / "static" / "js" / name
        assert path.is_file(), name
        combined += path.read_text(encoding="utf-8")
    assert "loadRuntimePatches" not in combined
    assert not re.search(r"script\.src\s*=.*rooms-.*patch", combined)


def test_each_room_domain_keeps_its_required_contracts():
    sync = (ROOT / "static/js/rooms-sync.js").read_text(encoding="utf-8")
    identity = (ROOT / "static/js/rooms-identity.js").read_text(encoding="utf-8")
    seat = (ROOT / "static/js/rooms-seat.js").read_text(encoding="utf-8")
    script = (ROOT / "static/js/rooms-script.js").read_text(encoding="utf-8")
    ui = (ROOT / "static/js/rooms-ui.js").read_text(encoding="utf-8")

    assert "window.TownCheckin" in sync
    assert "botc:town-room-changed" in sync
    assert "/permissions" in identity
    assert "switch_account=1" in identity
    assert "/seat" in seat
    assert "device_token" in seat
    assert "logo_image_url" in script
    assert "window.location.hash = scriptHash" in script
    assert "town-mode-tabs" in ui
    assert "QRCode" in ui


def test_room_transfer_uses_the_versioned_recorder_store():
    script = (ROOT / "static/js/rooms-script.js").read_text(encoding="utf-8")
    recorder = (ROOT / "static/js/recorder.js").read_text(encoding="utf-8")

    assert "botc_recorder_state_v2" in script
    assert "botc_recorder_state_v2" in recorder
    assert "localStorage.setItem(RECORDER_STORAGE_KEY" in script
    assert "localStorage.setItem(RECORDER_STORAGE_KEY" in recorder
    assert "window.name ?" not in script
    assert "window.name =" not in script
    assert "window.name ?" not in recorder
    assert "window.name =" not in recorder


if __name__ == "__main__":
    test_room_page_loads_only_the_five_formal_modules()
    test_room_modules_exist_and_do_not_dynamically_reload_legacy_patches()
    test_each_room_domain_keeps_its_required_contracts()
    test_room_transfer_uses_the_versioned_recorder_store()
    print("rooms module contract tests passed")
