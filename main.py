from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
import os
from datetime import datetime

import models, schemas
from database import engine, get_db

# 確保資料庫表已建立
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="BOTC Leaderboard API")

# 配置跨域請求
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 密碼設定 (優先讀取環境變數，若無則用預設 mmmm)
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "mmmm")

# --- 玩家管理路由 ---
@app.post("/players/", response_model=schemas.PlayerResponse)
def create_player(player: schemas.PlayerCreate, db: Session = Depends(get_db)):
    db_player = db.query(models.Player).filter(models.Player.name == player.name).first()
    if db_player:
        raise HTTPException(status_code=400, detail="Player already exists")
    new_player = models.Player(name=player.name)
    db.add(new_player)
    db.commit()
    db.refresh(new_player)
    return new_player

@app.get("/players/", response_model=List[schemas.PlayerResponse])
def get_players(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    players = db.query(models.Player).offset(skip).limit(limit).all()
    return players

# --- 🟢 新增：玩家個人詳細戰績查詢 ---
@app.get("/api/player/{player_name}")
def get_player_detail_stats(player_name: str, db: Session = Depends(get_db)):
    # 查找玩家
    player = db.query(models.Player).filter(models.Player.name == player_name).first()
    if not player:
        raise HTTPException(status_code=404, detail="找不到該玩家")
    
    # 查找該玩家所有對局
    records = db.query(models.MatchPlayer).filter(models.MatchPlayer.player_id == player.id).all()
    
    total_played = len(records)
    wins = 0
    role_counts = {}
    
    for r in records:
        # 計算勝率
        if r.final_alignment == r.match.winning_team:
            wins += 1
        # 計算角色頻率
        role_counts[r.character] = role_counts.get(r.character, 0) + 1
        
    return {
        "player_name": player_name,
        "total_matches": total_played,
        "overall_win_rate": round(wins / total_played * 100, 1) if total_played > 0 else 0,
        "most_played_roles": sorted(role_counts.items(), key=lambda x: x[1], reverse=True)[:5]
    }

# --- 對局管理路由 ---
@app.post("/matches/", response_model=schemas.MatchResponse)
def create_match(match: schemas.MatchCreate, db: Session = Depends(get_db)):
    if match.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="Invalid admin password.")
    
    # 建立對局 (加入地點欄位)
    new_match = models.Match(
        script=match.script,
        storyteller=match.storyteller,
        winning_team=match.winning_team,
        location=getattr(match, 'location', '未知') # 🟢 處理地點
    )
    db.add(new_match)
    db.commit()
    db.refresh(new_match)
    
    for p in match.players:
        # 如果玩家不存在則自動建立玩家 (優化邏輯)
        db_p = db.query(models.Player).filter(models.Player.name == p.name).first()
        if not db_p:
            db_p = models.Player(name=p.name)
            db.add(db_p)
            db.commit()
            db.refresh(db_p)

        match_player = models.MatchPlayer(
            match_id=new_match.id,
            player_id=db_p.id,
            character=p.character,
            initial_alignment=p.initial_alignment,
            final_alignment=p.final_alignment,
            survived=p.survived
        )
        db.add(match_player)
    
    db.commit()
    db.refresh(new_match)
    return new_match

@app.get("/matches/", response_model=List[schemas.MatchResponse])
def get_matches(location: Optional[str] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    query = db.query(models.Match)
    if location:
        query = query.filter(models.Match.location == location)
    return query.order_by(models.Match.date.desc()).offset(skip).limit(limit).all()

# --- 統計數據路由 (支援地點篩選) ---
@app.get("/stats/")
def get_stats(location: Optional[str] = None, db: Session = Depends(get_db)):
    # 1. 基礎對局查詢
    match_query = db.query(models.Match)
    if location:
        match_query = match_query.filter(models.Match.location == location)
    
    target_matches = match_query.all()
    total_matches = len(target_matches)
    match_ids = [m.id for m in target_matches]
    
    # 2. 玩家統計
    players = db.query(models.Player).all()
    player_stats = []
    for p in players:
        # 只統計符合地點的對局
        records = db.query(models.MatchPlayer).filter(
            models.MatchPlayer.player_id == p.id,
            models.MatchPlayer.match_id.in_(match_ids)
        ).all()
        
        if not records: continue
            
        wins = sum(1 for r in records if r.final_alignment == r.match.winning_team)
        
        player_stats.append({
            "id": p.id,
            "name": p.name,
            "total_played": len(records),
            "wins": wins,
            "win_rate": round(wins / len(records) * 100, 1)
        })

    # 3. 角色統計
    char_records = db.query(models.MatchPlayer).filter(models.MatchPlayer.match_id.in_(match_ids)).all()
    character_stats = {}
    for r in char_records:
        if r.character not in character_stats:
            character_stats[r.character] = {"played": 0, "wins": 0}
        character_stats[r.character]["played"] += 1
        if r.final_alignment == r.match.winning_team:
            character_stats[r.character]["wins"] += 1
            
    char_list = [{
        "character": k, 
        "played": v["played"], 
        "win_rate": round(v["wins"] / v["played"] * 100, 1)
    } for k, v in character_stats.items()]

    # 4. 獲取所有出現過的地點
    locations = [l[0] for l in db.query(models.Match.location).distinct().all() if l[0]]
    
    return {
        "total_matches": total_matches,
        "available_locations": locations,
        "players": sorted(player_stats, key=lambda x: x["win_rate"], reverse=True),
        "characters": sorted(char_list, key=lambda x: x["played"], reverse=True)
    }

# --- 🟢 修復 404：明確處理首頁與靜態檔案 ---

@app.get("/")
async def serve_home():
    return FileResponse('index.html')

@app.get("/index.html")
async def serve_index():
    return FileResponse('index.html')

# 靜態目錄掛載放在最後
if os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")
if os.path.exists("pages"):
    app.mount("/pages", StaticFiles(directory="pages"), name="pages")
if os.path.exists("js"):
    app.mount("/js", StaticFiles(directory="js"), name="js")
if os.path.exists("css"):
    app.mount("/css", StaticFiles(directory="css"), name="css")
