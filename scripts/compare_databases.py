"""Compare every public table row count between source and destination PostgreSQL."""

import os
from sqlalchemy import create_engine, inspect, text


def counts(url):
    engine = create_engine(url, connect_args={"connect_timeout": 15})
    inspector = inspect(engine)
    with engine.connect() as connection:
        result = {
            table: connection.execute(text(f'SELECT COUNT(*) FROM "{table}"')).scalar_one()
            for table in sorted(inspector.get_table_names(schema="public"))
        }
    engine.dispose()
    return result


source = counts(os.environ["SOURCE_DATABASE_URL"])
target = counts(os.environ["TARGET_DATABASE_URL"])
missing = sorted(set(source) - set(target))
mismatched = {name: (value, target.get(name)) for name, value in source.items() if target.get(name) != value}
for name in sorted(set(source) | set(target)):
    print(f"{name}: source={source.get(name, '-')} target={target.get(name, '-')}")
if missing or mismatched:
    raise SystemExit(f"database comparison failed: missing={missing}, mismatched={mismatched}")
print(f"Database comparison passed for {len(source)} tables.")
