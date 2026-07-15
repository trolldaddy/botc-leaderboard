from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

# ==========================================
# 1. 玩家主表 (Players)
# 儲存玩家的基本身份，確保每個暱稱對應唯一的 UID
# ==========================================
class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True