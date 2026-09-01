"""Apply small, backwards-compatible schema additions before Cloud Run deploys."""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from database import engine
import models
from runtime_schema import ensure_runtime_schema


def main():
    if engine.dialect.name != "postgresql":
        raise SystemExit("Runtime schema migration requires PostgreSQL")
    models.CubeEscapePlayer.__table__.create(bind=engine, checkfirst=True)
    applied = ensure_runtime_schema(engine)
    print(f"Applied {applied} runtime schema migrations.")


if __name__ == "__main__":
    main()
