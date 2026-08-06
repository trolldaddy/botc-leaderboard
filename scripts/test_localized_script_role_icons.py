import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JSON_ROOT = ROOT / "reports" / "bilibili-script-json"
DJINN = "/static/script-role-icons/reviewed/djinn.png"
JINX_TEAMS = {"jinx", "jinxed", "jinxes", "a jinxed"}


def main():
    checked = 0
    for path in JSON_ROOT.glob("*.json"):
        payload = json.loads(path.read_text(encoding="utf-8"))
        for item in payload:
            if not isinstance(item, dict) or item.get("id") == "_meta":
                continue
            checked += 1
            raw = item.get("image")
            images = raw if isinstance(raw, list) else [raw]
            assert images and all(images), (path.name, item.get("name"), raw)
            for image in images:
                assert image.startswith("/static/"), (path.name, item.get("name"), image)
                assert (ROOT / image.lstrip("/")).is_file(), (path.name, image)
            if str(item.get("team") or "").strip().casefold() in JINX_TEAMS:
                assert item["image"] == DJINN, (path.name, item.get("name"), item["image"])
    assert checked > 0
    print({"status": "ok", "checked": checked})


if __name__ == "__main__":
    main()
