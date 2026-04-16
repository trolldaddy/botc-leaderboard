from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

# ==========================================
# 1. 玩家主表 (Players)
# 儲存玩家的基本身份，確保每個暱稱對應唯一的 UID
# ==========================================
class Player(Base):
    __tablename__ = "players"
    
    id = Column(Integer, primary_key=True, index=True) # 玩家 UID
    name = Column(String, unique=True, index=True)    # 玩家暱稱 (唯一的，用於查詢個人戰績)
    created_at = Column(DateTime, default=datetime.now)
    
    # 關聯：一個玩家可以擁有多場對局表現紀錄 (一對多)
    match_history = relationship("MatchPlayer", back_populates="player")

# ==========================================
# 2. 對局總表 (Matches)
# 儲存每一場遊戲的環境資訊（時間、地點、劇本、結果）
# ==========================================
class Match(Base):
    __tablename__ = "matches"
    
    id = Column(Integer, primary_key=True, index=True) # 賽局 UID
    script = Column(String, index=True)               # 劇本名稱
    date = Column(DateTime, default=datetime.now)      # 對局日期
    location = Column(String, default="未知", index=True) # 遊戲地點 (支援分區統計)
    storyteller = Column(String)                      # 說書人姓名
    winning_team = Column(String)                     # 獲勝陣營 (good/evil)
    # 在 Match 類別中新增欄位定義
    replay_log = Column(Text, nullable=True) # 使用 Text 類型來存長篇文字
    
    # 關聯：一場對局會有多名玩家參與的紀錄 (一對多)
    # 當對局被刪除時，關聯的玩家紀錄也會一併刪除 (cascade)
    players = relationship("MatchPlayer", back_populates="match", cascade="all, delete-orphan")

# ==========================================
# 3. 對局表現紀錄表 (MatchPlayers)
# 核心關聯表：記錄「哪個玩家」在「哪一局」中玩了「什麼角色」
# ==========================================
class MatchPlayer(Base):
    __tablename__ = "match_players"
    
    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id")) # 關聯對局 UID
    player_id = Column(Integer, ForeignKey("players.id")) # 關聯玩家 UID
    
    # --- 對局細節 (支援覆盤魔法書的首尾狀態) ---
    initial_character = Column(String) # 初始角色 (遊戲開始時的角色，含酒鬼等隱藏資訊)
    final_character = Column(String)   # 最終角色 (遊戲結束時的角色，處理轉職或變體身分)
    alignment = Column(String)         # 陣營 (計算個人勝率用的最終陣營：good/evil)
    survived = Column(Boolean)         # 狀態 (True = 存活 / False = 死亡)
    
    # 定義物件關聯路徑
    player = relationship("Player", back_populates="match_history")
    match = relationship("Match", back_populates="players")

    @property
    def is_win(self):
        """
        邏輯屬性：判斷該玩家在此局是否獲勝
        判斷依據：玩家最終陣營 == 該場對局獲勝陣營
        """
        if not self.match:
            return False
        return self.alignment == self.match.winning_team
