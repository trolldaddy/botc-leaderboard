from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from database import Base


class ScriptEntry(Base):
    __tablename__ = "script_entries"
    id = Column(Integer, primary_key=True)
    slug = Column(String(220), nullable=False, unique=True, index=True)
    name_zh_tw = Column(String(220), nullable=False, index=True)
    version = Column(String(80), nullable=True)
    category = Column(String(120), nullable=True, index=True)
    introduction = Column(Text, nullable=True)
    author_name = Column(String(220), nullable=True)
    tagline = Column(Text, nullable=True)
    tags = Column(Text, nullable=True)
    background_introduction = Column(Text, nullable=True)
    gameplay_overview = Column(Text, nullable=True)
    author_note = Column(Text, nullable=True)
    production_updates = Column(Text, nullable=True)
    player_guide = Column(Text, nullable=True)
    storyteller_guide = Column(Text, nullable=True)
    source_url = Column(Text, nullable=True)
    source_platform = Column(String(50), nullable=False, default="manual")
    source_external_id = Column(String(120), nullable=True, index=True)
    published_at = Column(DateTime, nullable=True)
    is_public = Column(Boolean, nullable=False, default=False, index=True)
    needs_review = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)
    images = relationship("ScriptImage", back_populates="script", cascade="all, delete-orphan")
    roles = relationship("ScriptRole", back_populates="script", cascade="all, delete-orphan")
    supplements = relationship("ScriptSupplement", back_populates="script", cascade="all, delete-orphan")


class ScriptImage(Base):
    __tablename__ = "script_images"
    __table_args__ = (UniqueConstraint("script_id", "image_url", name="uq_script_image_url"),)
    id = Column(Integer, primary_key=True)
    script_id = Column(Integer, ForeignKey("script_entries.id"), nullable=False, index=True)
    image_url = Column(Text, nullable=False)
    alt_text = Column(String(220), nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    script = relationship("ScriptEntry", back_populates="images")


class ScriptRole(Base):
    __tablename__ = "script_roles"
    __table_args__ = (UniqueConstraint("script_id", "role_id", name="uq_script_role"),)
    id = Column(Integer, primary_key=True)
    script_id = Column(Integer, ForeignKey("script_entries.id"), nullable=False, index=True)
    role_id = Column(Integer, ForeignKey("roles.id"), nullable=False, index=True)
    sort_order = Column(Integer, nullable=False, default=0)
    script = relationship("ScriptEntry", back_populates="roles")
    role = relationship("Role")


class ScriptSupplement(Base):
    __tablename__ = "script_supplements"
    __table_args__ = (UniqueConstraint("script_id", "external_id", name="uq_script_supplement"),)
    id = Column(Integer, primary_key=True)
    script_id = Column(Integer, ForeignKey("script_entries.id"), nullable=False, index=True)
    external_id = Column(String(160), nullable=False)
    name_zh_tw = Column(String(220), nullable=False)
    entry_type = Column(String(80), nullable=False, default="special", index=True)
    image_url = Column(Text, nullable=True)
    ability = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    script = relationship("ScriptEntry", back_populates="supplements")
