"""Explicit schema step for deployments; never run migrations during web startup."""

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
os.environ["RUN_SCHEMA_MIGRATIONS"] = "1"

import models  # noqa: E402
from account_binding_routes import ensure_binding_schema  # noqa: E402
from database import engine  # noqa: E402
from main import ensure_runtime_schema  # noqa: E402
from role_models import ensure_role_schema  # noqa: E402


def main():
    models.Base.metadata.create_all(bind=engine)
    ensure_runtime_schema()
    ensure_role_schema()
    ensure_binding_schema()
    print("Schema is up to date.")


if __name__ == "__main__":
    main()
