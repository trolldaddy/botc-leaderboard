import base64
import hashlib
import mimetypes
import os
from pathlib import Path
from urllib.parse import quote


GCS_BUCKET = os.getenv("GCS_BUCKET", "").strip()


def _content_type(path: Path) -> str:
    return mimetypes.guess_type(path.name)[0] or "application/octet-stream"


def _versioned_name(object_name: str, data: bytes) -> str:
    path = Path(object_name)
    digest = hashlib.sha256(data).hexdigest()[:16]
    return str(path.with_name(f"{path.stem}-{digest}{path.suffix}")).replace("\\", "/")


def store_public_file(path: Path, object_name: str) -> tuple[str, str | None, str]:
    """Persist a public asset and return (url, legacy_base64, content_type).

    Local development keeps the legacy database-backed response working. In
    production, setting GCS_BUCKET uploads bytes to Cloud Storage and prevents
    another Base64 copy from being written to PostgreSQL.
    """
    content_type = _content_type(path)
    if not GCS_BUCKET:
        return "", base64.b64encode(path.read_bytes()).decode("ascii"), content_type
    return store_public_bytes(path.read_bytes(), object_name, content_type)


def store_public_bytes(data: bytes, object_name: str, content_type: str) -> tuple[str, str | None, str]:
    if not GCS_BUCKET:
        return "", base64.b64encode(data).decode("ascii"), content_type
    from google.cloud import storage

    blob = storage.Client().bucket(GCS_BUCKET).blob(_versioned_name(object_name, data).lstrip("/"))
    blob.cache_control = "public, max-age=31536000, immutable"
    blob.upload_from_string(data, content_type=content_type)
    blob.patch()
    return (
        f"https://storage.googleapis.com/{quote(GCS_BUCKET, safe='')}/{quote(blob.name, safe='/')}",
        None,
        content_type,
    )
