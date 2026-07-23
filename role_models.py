from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
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
    is_official = Column(Boolean, default=False)
    is_custom = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    needs_review = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    aliases = relationship("RoleAlias", back_populates="role", cascade="all, delete-orphan")
    guide = relationship("RoleGuide", back_populates="role", uselist=False, cascade="all, delete-orphan")


class RoleAlias(Base):
    __tablename__ = "role_aliases"
    __table_args__ = (
        UniqueConstraint("source", "external_id", name="uq_role_alias_source_external_id"),
    )

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
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    role = relationship("Role", back_populates="guide")


def ensure_role_schema():
    Base.metadata.create_all(
        bind=engine,
        tables=[Role.__table__, RoleAlias.__table__, RoleGuide.__table__],
    )


ensure_role_schema()
