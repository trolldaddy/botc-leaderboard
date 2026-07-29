from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, inspect, text
from sqlalchemy.orm import relationship

from database import Base, engine


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, index=True)
    canonical_key = Column(String, unique=True, index=True, nullable=False)
    name_zh_tw = Column(String, index=True, nullable=False)
    name_en = Column(String, index=True, nullable=True)
    team = Column(String, index=True, nullable=False)
    ability_zh_tw = Column(Text, nullable=True)
    first_night_order = Column(Integer, default=0)
    other_night_order = Column(Integer, default=0)
    first_night_reminder = Column(Text, nullable=True)
    other_night_reminder = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    source_type = Column(String, default="unclassified", index=True)
    source_name = Column(String, nullable=True)
    author = Column(String, nullable=True)
    script_names_json = Column(Text, nullable=True)
    ability_tags_json = Column(Text, nullable=True)
    is_official = Column(Boolean, default=False)
    is_custom = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    needs_review = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    aliases = relationship("RoleAlias", back_populates="role", cascade="all, delete-orphan")
    guide = relationship("RoleGuide", back_populates="role", uselist=False, cascade="all, delete-orphan")
    reminders = relationship("RoleReminder", back_populates="role", cascade="all, delete-orphan")
    content_blocks = relationship("RoleContentBlock", back_populates="role", cascade="all, delete-orphan")
    knowledge_links = relationship("RoleKnowledgeLink", back_populates="role", cascade="all, delete-orphan")


class RoleAlias(Base):
    __tablename__ = "role_aliases"
    __table_args__ = (UniqueConstraint("source", "external_id", name="uq_role_alias_source_external_id"),)

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False, index=True)
    source = Column(String, default="master_role_db", index=True)
    external_id = Column(String, nullable=False, index=True)
    external_name = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    role = relationship("Role", back_populates="aliases")


class RoleGuide(Base):
    __tablename__ = "role_guides"

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"), unique=True, nullable=False, index=True)
    beginner_summary = Column(Text, nullable=True)
    how_to_play = Column(Text, nullable=True)
    first_day_advice = Column(Text, nullable=True)
    common_mistakes = Column(Text, nullable=True)
    advanced_tips = Column(Text, nullable=True)
    ability_supplement = Column(Text, nullable=True)
    storyteller_advice = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    role = relationship("Role", back_populates="guide")


class RoleReminder(Base):
    __tablename__ = "role_reminders"
    __table_args__ = (UniqueConstraint("role_id", "scope", "label_zh_tw", name="uq_role_reminder_role_scope_label"),)

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False, index=True)
    label_zh_tw = Column(String, nullable=False)
    scope = Column(String, nullable=False, default="role", index=True)
    sort_order = Column(Integer, nullable=False, default=0)
    placement_timing = Column(Text, nullable=True)
    placement_condition = Column(Text, nullable=True)
    removal_timing = Column(Text, nullable=True)
    special_notes = Column(Text, nullable=True)
    source = Column(String, nullable=False, default="pocket_grimoire", index=True)
    source_url = Column(Text, nullable=True)
    needs_review = Column(Boolean, nullable=False, default=False, index=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    role = relationship("Role", back_populates="reminders")


class RoleContentBlock(Base):
    __tablename__ = "role_content_blocks"
    __table_args__ = (UniqueConstraint("role_id", "block_type", "source", "source_key", name="uq_role_content_source_block"),)

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False, index=True)
    block_type = Column(String(60), nullable=False, index=True)
    title = Column(String(220), nullable=True)
    content_format = Column(String(30), nullable=False, default="html")
    content = Column(Text, nullable=True)
    audience = Column(String(30), nullable=False, default="encyclopedia", index=True)
    source = Column(String(60), nullable=False, default="manual", index=True)
    source_key = Column(String(220), nullable=False, default="manual")
    source_url = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    review_status = Column(String(40), nullable=False, default="needs_review", index=True)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    role = relationship("Role", back_populates="content_blocks")


class RoleKnowledgeLink(Base):
    __tablename__ = "role_knowledge_links"
    __table_args__ = (UniqueConstraint("role_id", "knowledge_node_id", name="uq_role_knowledge_link"),)

    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False, index=True)
    knowledge_node_id = Column(Integer, nullable=False, index=True)
    match_method = Column(String(50), nullable=False, default="name")
    confidence = Column(Float, nullable=False, default=1.0)
    review_status = Column(String(40), nullable=False, default="needs_review", index=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    role = relationship("Role", back_populates="knowledge_links")


def ensure_role_schema():
    Base.metadata.create_all(bind=engine, tables=[
        Role.__table__, RoleAlias.__table__, RoleGuide.__table__, RoleReminder.__table__,
        RoleContentBlock.__table__, RoleKnowledgeLink.__table__,
    ])
    try:
        inspector = inspect(engine)
        if "roles" in inspector.get_table_names():
            role_columns = {column["name"] for column in inspector.get_columns("roles")}
            with engine.begin() as connection:
                for name in ("script_names_json", "ability_tags_json"):
                    if name in role_columns:
                        continue
                    if engine.dialect.name == "postgresql":
                        connection.execute(text(f"ALTER TABLE roles ADD COLUMN IF NOT EXISTS {name} TEXT"))
                    else:
                        connection.execute(text(f"ALTER TABLE roles ADD COLUMN {name} TEXT"))
        if "role_guides" in inspector.get_table_names():
            guide_columns = {column["name"] for column in inspector.get_columns("role_guides")}
            with engine.begin() as connection:
                for name in ("ability_supplement", "storyteller_advice"):
                    if name in guide_columns:
                        continue
                    if engine.dialect.name == "postgresql":
                        connection.execute(text(f"ALTER TABLE role_guides ADD COLUMN IF NOT EXISTS {name} TEXT"))
                    else:
                        connection.execute(text(f"ALTER TABLE role_guides ADD COLUMN {name} TEXT"))
        if "role_reminders" not in inspector.get_table_names():
            return
        columns = {column["name"] for column in inspector.get_columns("role_reminders")}
        dialect = engine.dialect.name
        boolean_default = "FALSE" if dialect == "postgresql" else "0"
        timestamp_type = "TIMESTAMP" if dialect == "postgresql" else "DATETIME"
        additions = {
            "placement_timing": "TEXT", "placement_condition": "TEXT", "removal_timing": "TEXT",
            "special_notes": "TEXT", "source_url": "TEXT", "needs_review": f"BOOLEAN DEFAULT {boolean_default}",
            "updated_at": timestamp_type,
        }
        with engine.begin() as connection:
            for name, definition in additions.items():
                if name in columns:
                    continue
                if dialect == "postgresql":
                    connection.execute(text(f"ALTER TABLE role_reminders ADD COLUMN IF NOT EXISTS {name} {definition}"))
                else:
                    connection.execute(text(f"ALTER TABLE role_reminders ADD COLUMN {name} {definition}"))
    except Exception as exc:
        print(f"角色提示標記資料表補齊失敗: {exc}")


ensure_role_schema()
