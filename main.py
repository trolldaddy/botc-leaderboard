from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

# 1. 玩家主表 (Players) - 存儲玩家的基本身份
class Player(Base):
    __tablename__ = "players"
    
    id = Column(Integer, primary_key=True, index=True) # 玩家 UID
    name = Column(String, unique=True, index=True)    # 玩家暱稱 (唯一的)
    created_at = Column(DateTime, default=datetime.now)
    
    # 關聯到對局紀錄
    match_history = relationship("MatchPlayer", back_populates="player")

# 2. 對局總表 (Matches) - 存儲每一場遊戲的環境資訊
class Match(Base):
    __tablename__ = "matches"
    
    id = Column(Integer, primary_key=True, index=True) # 賽局 UID
    script = Column(String, index=True)               # 劇本名稱
    date = Column(DateTime, default=datetime.now)      # 對局日期
    location = Column(String, default="未知", index=True) # 遊戲地點
    storyteller = Column(String)                      # 說書人
    winning_team = Column(String)                     # 獲勝陣營 (good/evil)
    
    # 關聯到參與的玩家列表
    players = relationship("MatchPlayer", back_populates="match")

# 3. 對局表現表 (MatchPlayers) - 核心表：記錄「誰」在「哪一局」玩了「什麼」
class MatchPlayer(Base):
    __tablename__ = "match_players"
    
    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id")) # 關聯賽局 UID
    player_id = Column(Integer, ForeignKey("players.id")) # 關聯玩家 UID
    
    # 對局細節
    initial_character = Column(String) # 初始角色 (含隱藏，如：酒鬼-廚師)
    final_character = Column(String)   # 最終角色 (最後的名單)
    alignment = Column(String)         # 陣營 (計算勝率用的最終陣營)
    survived = Column(Boolean)         # 狀態 (存活/死亡)
    
    # 關聯定義
    player = relationship("Player", back_populates="match_history")
    match = relationship("Match", back_populates="players")

    @property
    def is_win(self):
        """
        這是一個計算屬性，判斷該玩家在這場是否勝利
        邏輯：玩家陣營 == 該場獲勝陣營
        """
        return self.alignment == self.match.winning_team
