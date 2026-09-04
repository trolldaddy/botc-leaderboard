from pathlib import Path
import sys

from sqlalchemy import create_engine, inspect, text


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def test_deploy_and_local_schema_steps_share_one_migration_function():
    runtime = (ROOT / "runtime_schema.py").read_text(encoding="utf-8")
    deploy = (ROOT / "scripts/migrate_runtime_schema.py").read_text(encoding="utf-8")
    local = (ROOT / "scripts/apply_schema.py").read_text(encoding="utf-8")
    main = (ROOT / "main.py").read_text(encoding="utf-8")

    assert "def ensure_runtime_schema(engine)" in runtime
    assert "ensure_runtime_schema(engine)" in deploy
    assert "ensure_runtime_schema(engine)" in local
    assert 'os.environ["RUN_SCHEMA_MIGRATIONS"] = "0"' in local
    assert "ensure_runtime_schema(engine)" in main


def test_runtime_schema_is_idempotent_and_backfills_match_created_at():
    from runtime_schema import ensure_runtime_schema

    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE matches (id INTEGER PRIMARY KEY, date DATETIME)"))
        connection.execute(text("INSERT INTO matches (id, date) VALUES (1, '2026-08-12 10:00:00')"))
        connection.execute(text("CREATE TABLE storyteller_accounts (id INTEGER PRIMARY KEY, last_login_at DATETIME)"))
        connection.execute(text("INSERT INTO storyteller_accounts (id, last_login_at) VALUES (1, '2026-08-12 09:00:00')"))

    assert ensure_runtime_schema(engine) == 5
    assert ensure_runtime_schema(engine) == 0
    columns = {item["name"] for item in inspect(engine).get_columns("matches")}
    assert {"uploaded_by_id", "created_at"} <= columns
    with engine.connect() as connection:
        created_at = connection.execute(text("SELECT created_at FROM matches WHERE id = 1")).scalar_one()
        account_created_at = connection.execute(text("SELECT created_at FROM storyteller_accounts WHERE id = 1")).scalar_one()
    assert str(created_at).startswith("2026-08-12 10:00:00")
    assert str(account_created_at).startswith("2026-08-12 09:00:00")


def test_runtime_schema_merges_legacy_script_introductions_once():
    from runtime_schema import ensure_runtime_schema

    engine = create_engine("sqlite:///:memory:")
    with engine.begin() as connection:
        connection.execute(text(
            "CREATE TABLE script_entries (id INTEGER PRIMARY KEY, introduction TEXT, background_introduction TEXT)"
        ))
        connection.execute(text(
            "INSERT INTO script_entries VALUES "
            "(1, '短介紹', '短介紹以及完整背景'), "
            "(2, '不同的前言', '完整背景')"
        ))

    ensure_runtime_schema(engine)
    ensure_runtime_schema(engine)
    with engine.connect() as connection:
        rows = connection.execute(text(
            "SELECT introduction, background_introduction FROM script_entries ORDER BY id"
        )).all()
    assert rows == [("短介紹以及完整背景", None), ("不同的前言\n\n完整背景", None)]


if __name__ == "__main__":
    test_deploy_and_local_schema_steps_share_one_migration_function()
    test_runtime_schema_is_idempotent_and_backfills_match_created_at()
    print("runtime schema contract tests passed")
