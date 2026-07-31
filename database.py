from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
import os

# 優先讀取系統環境變數 DATABASE_URL（用於雲端 PostgreSQL）。
# GitHub Actions 中未設定的 Secret 會展開成空字串，因此不能只依賴
# os.environ.get(..., default)，需要把空字串也視為「未設定」。
SQLALCHEMY_DATABASE_URL = os.environ.get("DATABASE_URL") or "sqlite:///./botc.db"

# 如果使用的是 SQLite，需要特別聲明 check_same_thread=False。
# 如果是雲端 PostgreSQL（通常以 postgresql:// 或 postgres:// 開頭），則不需要。
if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
    )
else:
    # 兼容部分平台提供的 postgres://；SQLAlchemy 1.4+ 要求 postgresql://。
    if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
        SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace(
            "postgres://", "postgresql://", 1
        )
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        pool_pre_ping=True,
        pool_recycle=300,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
