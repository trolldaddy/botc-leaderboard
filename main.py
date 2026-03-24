from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
import os
from datetime import datetime

# 導入你專案中的模組
import models, schemas
from database import engine, get_db

# 1. 初始化資料庫表
try:
    models.Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"資料庫初始化警告: {e}")

app = FastAPI(title="BOTC Leaderboard API")

# 2. 配置跨域請求 (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. 密鑰設定
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "mmmm")

# --- 🟢 API 路由：與你的 record.js / dashboard.js 完全對齊 ---

@app.post("/api/matches", response_model=schemas.MatchResponse)
@app.post("/matches/", response_model=schemas.MatchResponse)
def create_match(match: schemas.MatchCreate, db: Session = Depends(get_db)):
    # 驗證管理員密碼
    if match.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="Invalid admin password.")
    
    # 建立對局紀錄 (包含地點)
    # 注意：確保你的 models.Match 有 location 欄位
    new_match = models.Match(
        script=match.script,
        storyteller=match.storyteller,
        winning_team=match.winning_team,
        location=getattr(match, 'location', '未知') 
    )
    db.add(new_match)
    db.commit()
    db.refresh(new_match)
    
    # 處理玩家資料
    for p in match.players:
        # 自動檢查並建立玩家
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

@app.get("/api/stats")
@app.get("/stats/")
def get_stats(location: Optional[str] = None, db: Session = Depends(get_db)):
    # 按地點篩選對局
    match_query = db.query(models.Match)
    if location:
        match_query = match_query.filter(models.Match.location == location)
    
    target_matches = match_query.all()
    total_matches = len(target_matches)
    match_ids = [m.id for m in target_matches]
    
    # 計算玩家勝率
    players = db.query(models.Player).all()
    player_stats = []
    for p in players:
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

    # 獲取地點清單
    locations = [l[0] for l in db.query(models.Match.location).distinct().all() if l[0]]
    
    # 計算角色勝率
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

    return {
        "total_games": total_matches, # 對齊前端
        "good_win_percent": 0, # 此處可擴充具體勝率
        "evil_win_percent": 0,
        "total_matches": total_matches,
        "available_locations": locations,
        "players": sorted(player_stats, key=lambda x: x["win_rate"], reverse=True),
        "characters": sorted(char_list, key=lambda x: x["played"], reverse=True)
    }

@app.get("/api/player/{player_name}")
def get_player_stats(player_name: str, db: Session = Depends(get_db)):
    player = db.query(models.Player).filter(models.Player.name == player_name).first()
    if not player:
        raise HTTPException(status_code=404, detail="找不到該玩家")
    
    records = db.query(models.MatchPlayer).filter(models.MatchPlayer.player_id == player.id).all()
    total = len(records)
    wins = sum(1 for r in records if r.final_alignment == r.match.winning_team)
    
    return {
        "player_name": player_name,
        "total_matches": total,
        "overall_win_rate": round(wins/total*100, 1) if total > 0 else 0,
        "most_played_roles": [] # 可擴充
    }

@app.get("/api/history")
@app.get("/matches/")
def get_history(location: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Match)
    if location:
        query = query.filter(models.Match.location == location)
    return query.order_by(models.Match.date.desc()).all()

# --- 🟢 核心修正：首頁與靜態資源掛載 ---

@app.get("/")
@app.get("/index.html")
async def read_index():
    # 確保 index.html 在根目錄
    if os.path.exists("index.html"):
        return FileResponse('index.html')
    return {"message": "魔典系統已啟動，但找不到 index.html"}

# 掛載目錄 (順序很重要)
for folder in ["static", "pages", "js", "css"]:
    if os.path.exists(folder):
        app.mount(f"/{folder}", StaticFiles(directory=folder), name=folder)
