from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import relationship

from database import Base


class KnowledgeSource(Base):
    __tablename__ = "knowledge_sources"

    id = Column(Integer, primary_key=True)
    source_type = Column(String(50), nullable=False, default="wiki")
    name = Column(String(200), nullable=False, unique=True, index=True)
    base_url = Column(Text, nullable=True)
    publisher = Column(String(200), nullable=True)
    license_status = Column(String(50), nullable=False, default="unknown")
    trust_level = Column(String(50), nullable=False, default="unknown")
    default_language = Column(String(20), nullable=False, default="zh-CN")
    is_official = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.now)


class KnowledgeNode(Base):
    __tablename__ = "knowledge_nodes"

    id = Column(Integer, primary_key=True)
    node_type = Column(String(50), nullable=False, index=True)
    slug = Column(String(220), nullable=False, unique=True, index=True)
    canonical_name_zh_tw = Column(String(220), nullable=False, index=True)
    canonical_name_zh_cn = Column(String(220), nullable=True)
    canonical_name_en = Column(String(220), nullable=True)
    summary = Column(Text, nullable=True)
    status = Column(String(40), nullable=False, default="discovered", index=True)
    visibility = Column(String(40), nullable=False, default="internal")
    is_official = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)
    published_at = Column(DateTime, nullable=True)

    aliases = relationship("KnowledgeAlias", back_populates="node", cascade="all, delete-orphan")
    blocks = relationship("KnowledgeBlock", back_populates="node", cascade="all, delete-orphan")


class KnowledgeAlias(Base):
    __tablename__ = "knowledge_aliases"
    __table_args__ = (UniqueConstraint("node_id", "alias", "language", name="uq_knowledge_alias"),)

    id = Column(Integer, primary_key=True)
    node_id = Column(Integer, ForeignKey("knowledge_nodes.id"), nullable=False, index=True)
    alias = Column(String(220), nullable=False, index=True)
    language = Column(String(20), nullable=False, default="zh-TW")
    alias_type = Column(String(40), nullable=False, default="source")
    is_preferred = Column(Boolean, nullable=False, default=False)
    source_id = Column(Integer, ForeignKey("knowledge_sources.id"), nullable=True)

    node = relationship("KnowledgeNode", back_populates="aliases")


class KnowledgeBlock(Base):
    __tablename__ = "knowledge_blocks"

    id = Column(Integer, primary_key=True)
    node_id = Column(Integer, ForeignKey("knowledge_nodes.id"), nullable=False, index=True)
    block_type = Column(String(60), nullable=False, index=True)
    title = Column(String(220), nullable=True)
    content_format = Column(String(30), nullable=False, default="text")
    content = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    language = Column(String(20), nullable=False, default="zh-TW")
    layer = Column(String(30), nullable=False, default="source")
    review_status = Column(String(40), nullable=False, default="needs_review", index=True)
    visibility = Column(String(40), nullable=False, default="internal")
    current_source_record_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)
    updated_at = Column(DateTime, nullable=False, default=datetime.now, onupdate=datetime.now)

    node = relationship("KnowledgeNode", back_populates="blocks")


class KnowledgeSourceRecord(Base):
    __tablename__ = "knowledge_source_records"

    id = Column(Integer, primary_key=True)
    source_id = Column(Integer, ForeignKey("knowledge_sources.id"), nullable=False, index=True)
    node_id = Column(Integer, ForeignKey("knowledge_nodes.id"), nullable=True, index=True)
    block_type = Column(String(60), nullable=True)
    source_url = Column(Text, nullable=False)
    source_title = Column(String(220), nullable=True)
    source_language = Column(String(20), nullable=False, default="zh-CN")
    raw_content = Column(Text, nullable=True)
    normalized_content = Column(Text, nullable=True)
    content_hash = Column(String(64), nullable=True, index=True)
    fetched_at = Column(DateTime, nullable=False, default=datetime.now)
    source_updated_at = Column(DateTime, nullable=True)
    parser_version = Column(String(50), nullable=True)
    parse_status = Column(String(40), nullable=False, default="discovered")
    review_status = Column(String(40), nullable=False, default="needs_review")
    supersedes_id = Column(Integer, ForeignKey("knowledge_source_records.id"), nullable=True)


class KnowledgeEdge(Base):
    __tablename__ = "knowledge_edges"
    __table_args__ = (UniqueConstraint("from_node_id", "to_node_id", "edge_type", "source_id", name="uq_knowledge_edge"),)

    id = Column(Integer, primary_key=True)
    from_node_id = Column(Integer, ForeignKey("knowledge_nodes.id"), nullable=False, index=True)
    to_node_id = Column(Integer, ForeignKey("knowledge_nodes.id"), nullable=False, index=True)
    edge_type = Column(String(60), nullable=False, default="references", index=True)
    direction = Column(String(20), nullable=False, default="directed")
    source_id = Column(Integer, ForeignKey("knowledge_sources.id"), nullable=True)
    source_record_id = Column(Integer, ForeignKey("knowledge_source_records.id"), nullable=True)
    confidence = Column(Float, nullable=False, default=0.5)
    review_status = Column(String(40), nullable=False, default="needs_review")
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)


class CrawlRun(Base):
    __tablename__ = "crawl_runs"

    id = Column(Integer, primary_key=True)
    source_id = Column(Integer, ForeignKey("knowledge_sources.id"), nullable=False, index=True)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    status = Column(String(40), nullable=False, default="completed")
    parser_version = Column(String(50), nullable=True)
    pages_fetched = Column(Integer, nullable=False, default=0)
    successful_pages = Column(Integer, nullable=False, default=0)
    failed_pages = Column(Integer, nullable=False, default=0)
    report_json = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.now)


class CrawlPage(Base):
    __tablename__ = "crawl_pages"
    __table_args__ = (UniqueConstraint("crawl_run_id", "url", name="uq_crawl_page_run_url"),)

    id = Column(Integer, primary_key=True)
    crawl_run_id = Column(Integer, ForeignKey("crawl_runs.id"), nullable=False, index=True)
    url = Column(Text, nullable=False)
    requested_title = Column(String(220), nullable=True)
    resolved_title = Column(String(220), nullable=True, index=True)
    http_status = Column(Integer, nullable=False, default=0)
    page_type_detected = Column(String(50), nullable=False, default="unknown", index=True)
    classification_reasons = Column(Text, nullable=True)
    content_hash = Column(String(64), nullable=True)
    parse_status = Column(String(40), nullable=False, default="discovered")
    error_message = Column(Text, nullable=True)
    elapsed_ms = Column(Integer, nullable=False, default=0)


class CrawlLink(Base):
    __tablename__ = "crawl_links"
    __table_args__ = (UniqueConstraint("crawl_page_id", "target_title", name="uq_crawl_link"),)

    id = Column(Integer, primary_key=True)
    crawl_page_id = Column(Integer, ForeignKey("crawl_pages.id"), nullable=False, index=True)
    target_title = Column(String(220), nullable=False, index=True)
    target_url = Column(Text, nullable=True)
    anchor_text = Column(String(500), nullable=True)
