import os
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship

# 1. 取得環境變數
DATABASE_URL = os.getenv("DATABASE_URL")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "1234")

if not DATABASE_URL:
    raise ValueError("未設定 DATABASE_URL 環境變數")

if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# 2. 資料庫引擎設定
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# 3. 資料庫模型 (Models)
class Match(Base):
    __tablename__ = "matches"
    id = Column(Integer, primary_key=True, index=True)
    script_name = Column(String)
    storyteller = Column(String)
    winning_team = Column(String) # 'good' or 'evil'
    location = Column(String, nullable=True)
    match_date = Column(DateTime, default=datetime.now)
    created_at = Column(DateTime, default=datetime.now)
    players = relationship("Player", back_populates="match")

class Player(Base):
    __tablename__ = "players"
    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"))
    name = Column(String, index=True) # 增加索引加快查詢
    role = Column(String)
    team = Column(String) # 'good' or 'evil'
    is_alive = Column(Boolean, default=True)
    match = relationship("Match", back_populates="players")

# 自動同步資料表結構
Base.metadata.create_all(bind=engine)

# 4. Pydantic 模型
class PlayerCreate(BaseModel):
    name: str
    role: str
    team: str
    is_alive: bool

class MatchCreate(BaseModel):
    script_name: str
    storyteller: str
    winning_team: str
    admin_password: str
    location: Optional[str] = None
    date: Optional[str] = None
    players: List[PlayerCreate]

# 5. 初始化 FastAPI
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# 6. API 端點

@app.post("/api/matches")
async def create_match(data: MatchCreate, db: Session = Depends(get_db)):
    if data.admin_password != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="管理員密碼錯誤")
    
    m_date = datetime.now()
    if data.date:
        try:
            m_date = datetime.strptime(data.date, "%Y-%m-%d")
        except:
            pass

    db_match = Match(
        script_name=data.script_name,
        storyteller=data.storyteller,
        winning_team=data.winning_team,
        location=data.location,
        match_date=m_date
    )
    db.add(db_match)
    db.commit()
    db.refresh(db_match)

    for p in data.players:
        db_player = Player(
            match_id=db_match.id,
            name=p.name,
            role=p.role,
            team=p.team,
            is_alive=p.is_alive
        )
        db.add(db_player)
    
    db.commit()
    return {"status": "success", "match_id": db_match.id}

@app.get("/api/stats")
async def get_stats(location: Optional[str] = None, db: Session = Depends(get_db)):
    """
    提供數據看板接口，支援按地點過濾
    """
    query = db.query(Match)
    if location:
        query = query.filter(Match.location == location)
    
    matches = query.all()
    total_games = len(matches)
    
    if total_games == 0:
        return {
            "total_games": 0, 
            "good_win_percent": 0, 
            "evil_win_percent": 0, 
            "available_locations": [l[0] for l in db.query(Match.location).distinct().all() if l[0]]
        }

    good_wins = sum(1 for m in matches if m.winning_team == "good")
    good_win_rate = (good_wins / total_games * 100)
    
    # 獲取所有不重複的地點供前端選單使用
    locations = [l[0] for l in db.query(Match.location).distinct().all() if l[0]]
    
    return {
        "total_games": total_games,
        "good_win_percent": round(good_win_rate, 1),
        "evil_win_percent": round(100 - good_win_rate, 1),
        "available_locations": locations
    }

@app.get("/api/player/{player_name}")
async def get_player_stats(player_name: str, db: Session = Depends(get_db)):
    """
    查詢單一玩家的詳細戰績
    """
    # 找出該玩家參與的所有對局
    player_entries = db.query(Player).join(Match).filter(Player.name == player_name).all()
    
    if not player_entries:
        raise HTTPException(status_code=404, detail="找不到該玩家的紀錄")

    total_played = len(player_entries)
    wins = 0
    role_counts = {}
    team_stats = {"good": {"played": 0, "wins": 0}, "evil": {"played": 0, "wins": 0}}

    for entry in player_entries:
        # 紀錄角色頻率
        role_counts[entry.role] = role_counts.get(entry.role, 0) + 1
        
        # 判斷勝負：玩家陣營與對局獲勝陣營相同即為獲勝
        is_win = entry.team == entry.match.winning_team
        if is_win:
            wins += 1
        
        # 陣營統計
        team_stats[entry.team]["played"] += 1
        if is_win:
            team_stats[entry.team]["wins"] += 1

    # 排序最常使用的角色
    sorted_roles = sorted(role_counts.items(), key=lambda x: x[1], reverse=True)
    
    return {
        "player_name": player_name,
        "total_matches": total_played,
        "overall_win_rate": round((wins / total_played * 100), 1),
        "team_breakdown": {
            "good": {
                "played": team_stats["good"]["played"],
                "win_rate": round((team_stats["good"]["wins"] / team_stats["good"]["played"] * 100), 1) if team_stats["good"]["played"] > 0 else 0
            },
            "evil": {
                "played": team_stats["evil"]["played"],
                "win_rate": round((team_stats["evil"]["wins"] / team_stats["evil"]["played"] * 100), 1) if team_stats["evil"]["played"] > 0 else 0
            }
        },
        "most_played_roles": [{"role": r[0], "count": r[1]} for r in sorted_roles[:5]]
    }

@app.get("/api/history")
async def get_history(location: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Match)
    if location:
        query = query.filter(Match.location == location)
    
    matches = query.order_by(Match.match_date.desc()).all()
    return matches
