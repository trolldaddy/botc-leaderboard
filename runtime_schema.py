"""Idempotent schema additions shared by local setup and deployment jobs."""

from sqlalchemy import inspect, text


def ensure_runtime_schema(engine):
    inspector = inspect(engine)
    dialect = engine.dialect.name
    timestamp_type = "TIMESTAMP" if dialect == "postgresql" else "DATETIME"
    boolean_default = "FALSE" if dialect == "postgresql" else "0"

    def add_column_sql(table, column, definition):
        if dialect == "postgresql":
            return f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {definition}"
        return f"ALTER TABLE {table} ADD COLUMN {column} {definition}"

    table_names = inspector.get_table_names()
    migrations = {
        "matches": {
            "uploaded_by_id": "INTEGER",
            "created_at": timestamp_type,
        },
        "storyteller_accounts": {
            "created_at": timestamp_type,
            "last_login_at": timestamp_type,
            "is_banned": f"BOOLEAN DEFAULT {boolean_default}",
            "banned_at": timestamp_type,
        },
        "locations": {
            "type": "VARCHAR DEFAULT 'store'",
            "address": "TEXT",
            "link_url": "TEXT",
            "image_url": "TEXT",
            "description": "TEXT",
            "schedule_note": "TEXT",
            "contact_note": "TEXT",
            "is_public": f"BOOLEAN DEFAULT {boolean_default}",
            "sort_order": "INTEGER DEFAULT 0",
            "created_at": timestamp_type,
            "updated_at": timestamp_type,
        },
        "script_entries": {
            "author_name": "VARCHAR(220)",
            "tagline": "TEXT",
            "tags": "TEXT",
            "background_introduction": "TEXT",
            "gameplay_overview": "TEXT",
            "author_note": "TEXT",
            "production_updates": "TEXT",
            "player_guide": "TEXT",
            "storyteller_guide": "TEXT",
            "script_json": "TEXT",
            "script_json_filename": "VARCHAR(255)",
            "script_json_updated_at": timestamp_type,
            "is_laplace_owned": f"BOOLEAN DEFAULT {boolean_default}",
        },
        "script_images": {
            "image_data": "TEXT",
            "content_type": "VARCHAR(100)",
        },
        "knowledge_nodes": {
            "presentation_type": "VARCHAR(50)",
            "classification_method": "VARCHAR(80)",
            "classification_confidence": "FLOAT",
            "classification_status": "VARCHAR(40) DEFAULT 'unclassified'",
        },
    }

    applied = 0
    for table, definitions in migrations.items():
        if table not in table_names:
            continue
        columns = {column["name"] for column in inspector.get_columns(table)}
        with engine.begin() as connection:
            for column, definition in definitions.items():
                if column in columns:
                    continue
                connection.execute(text(add_column_sql(table, column, definition)))
                applied += 1
            if table == "matches" and "created_at" not in columns:
                connection.execute(text("UPDATE matches SET created_at = date WHERE created_at IS NULL"))
            if table == "storyteller_accounts" and "created_at" not in columns and "last_login_at" in columns:
                connection.execute(text("UPDATE storyteller_accounts SET created_at = last_login_at WHERE created_at IS NULL"))
    return applied
