"""Apply small, backwards-compatible schema additions before Cloud Run deploys."""

import sys
from pathlib import Path

from sqlalchemy import text

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from database import engine


POSTGRES_MIGRATIONS = (
    "ALTER TABLE script_entries ADD COLUMN IF NOT EXISTS script_json TEXT",
    "ALTER TABLE script_entries ADD COLUMN IF NOT EXISTS script_json_filename VARCHAR(255)",
    "ALTER TABLE script_entries ADD COLUMN IF NOT EXISTS script_json_updated_at TIMESTAMP",
)


def main():
    if engine.dialect.name != "postgresql":
        raise SystemExit("Runtime schema migration requires PostgreSQL")
    with engine.begin() as connection:
        for statement in POSTGRES_MIGRATIONS:
            connection.execute(text(statement))
    print(f"Applied {len(POSTGRES_MIGRATIONS)} runtime schema migrations.")


if __name__ == "__main__":
    main()
