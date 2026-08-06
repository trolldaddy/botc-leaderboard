import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_reviewed_script_images_are_local_and_present():
    manifest = json.loads((ROOT / "scripts/bilibili_script_manifest.json").read_text(encoding="utf-8-sig"))
    checked = 0
    for item in manifest["items"]:
        metadata_path = ROOT / "reports/bilibili-scripts" / f"{item['external_id']}.json"
        if not metadata_path.exists():
            continue
        metadata = json.loads(metadata_path.read_text(encoding="utf-8-sig"))
        for image in metadata.get("images", []):
            url = image["url"]
            assert url.startswith("/static/script-images/reviewed/")
            target = ROOT / "static" / url.removeprefix("/static/")
            assert target.is_file() and target.stat().st_size >= 1024
            checked += 1
    assert checked == 118


if __name__ == "__main__":
    test_reviewed_script_images_are_local_and_present()
    print({"status": "ok", "images": 118})
