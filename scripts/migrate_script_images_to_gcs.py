"""Move ScriptImage Base64 payloads to Cloud Storage, preserving DB records."""

import argparse
import base64
import hashlib
import mimetypes
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from database import SessionLocal  # noqa: E402
from google.cloud import storage  # noqa: E402
from object_storage import store_public_file  # noqa: E402
from role_models import Role  # noqa: E402
from script_models import ScriptEntry, ScriptImage, ScriptSupplement  # noqa: E402


def extension(content_type):
    return mimetypes.guess_extension(content_type or "") or ".bin"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    bucket_name = os.environ.get("GCS_BUCKET", "").strip()
    if not bucket_name:
        raise SystemExit("GCS_BUCKET is required")

    bucket = storage.Client().bucket(bucket_name)
    db = SessionLocal()
    moved = skipped = failed = 0
    try:
        rows = db.query(ScriptImage, ScriptEntry.slug).join(ScriptEntry).order_by(ScriptImage.id).all()
        for image, slug in rows:
            if not image.image_data:
                skipped += 1
                continue
            try:
                payload = base64.b64decode(image.image_data, validate=True)
            except (TypeError, ValueError) as exc:
                failed += 1
                print(f"invalid image_data: script_image={image.id}: {exc}", file=sys.stderr)
                continue
            digest = hashlib.sha256(payload).hexdigest()[:16]
            name = f"script-artwork/{slug}/{image.sort_order}-{digest}{extension(image.content_type)}"
            print(f"script_image={image.id} bytes={len(payload)} -> gs://{bucket_name}/{name}")
            if args.write:
                blob = bucket.blob(name)
                blob.cache_control = "public, max-age=31536000, immutable"
                blob.upload_from_string(payload, content_type=image.content_type or "application/octet-stream")
                blob.patch()
                image.image_url = f"https://storage.googleapis.com/{bucket_name}/{name}"
                image.image_data = None
                db.commit()
            moved += 1

        local_media = [
            ("role", row.id, row.image_url, row)
            for row in db.query(Role).filter(Role.image_url.like("/static/%")).all()
        ] + [
            ("supplement", row.id, row.image_url, row)
            for row in db.query(ScriptSupplement).filter(ScriptSupplement.image_url.like("/static/%")).all()
        ]
        for media_type, media_id, url, row in local_media:
            source = ROOT / url.lstrip("/")
            if not source.is_file():
                failed += 1
                print(f"missing local media: {media_type}={media_id} path={source}", file=sys.stderr)
                continue
            object_name = f"catalog-media/{media_type}/{media_id}{source.suffix.lower()}"
            print(f"{media_type}={media_id} -> gs://{bucket_name}/{object_name}")
            if args.write:
                cloud_url, _, _ = store_public_file(source, object_name)
                row.image_url = cloud_url
                db.commit()
            moved += 1
    finally:
        db.close()
    print(f"moved={moved} skipped={skipped} failed={failed} write={args.write}")
    if failed:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
