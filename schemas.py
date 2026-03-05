from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

# ==================
# Player Schemas
# ==================
class PlayerBase(BaseModel):
    name: str

class PlayerCreate(PlayerBase):
    pass

class PlayerResponse(PlayerBase):
    id: int

    class Config:
        from_attributes = True

# ==================
# MatchPlayer Schemas
# ==================
class MatchPlayerBase(BaseModel):
    player_id: int
    character: str
    initial_alignment: str
    final_alignment: str
    survived: bool

class MatchPlayerCreate(MatchPlayerBase):
    pass

# ==================
# Match Schemas
# ==================
class MatchBase(BaseModel):
    script: str
    storyteller: str
    winning_team: str
    password: Optional[str] = None # 用于验证管理员权限

class MatchCreate(MatchBase):
    players: List[MatchPlayerCreate]

class MatchPlayerResponse(MatchPlayerBase):
    id: int
    match_id: int

    class Config:
        from_attributes = True

class MatchResponse(MatchBase):
    id: int
    date: datetime
    players: List[MatchPlayerResponse]

    class Config:
        from_attributes = True

class DeleteMatchRequest(BaseModel):
    password: str
