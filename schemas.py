from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# --- 1. 玩家表現 (用於在錄入對局時，包在 Match 裡面傳送) ---
class PlayerPerformance(BaseModel):
    name: str                # 玩家暱稱
    initial_character: str   # 初始角色
    final_character: str     # 最終角色
    alignment: str           # 陣營 (good/evil)
    survived: bool           # 存活狀態

# --- 2. 錄入對局時的請求結構 (Match Create) ---
class MatchCreate(BaseModel):
    script: str
    date: str
    location: str
    storyteller: str
    winning_team: str
    password: str            # 管理員密鑰
    players: List[PlayerPerformance]

# --- 3. 返回數據時的基礎結構 (Match Response) ---
class MatchBase(BaseModel):
    id: int
    script: str
    date: datetime
    location: str
    storyteller: str
    winning_team: str

    class Config:
        from_attributes = True

# --- 4. 玩家個人戰績結構 ---
class PlayerStatsResponse(BaseModel):
    player_name: str
    total_matches: int
    overall_win_rate: float
    most_played_roles: List[dict]
