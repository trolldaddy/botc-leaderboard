from fastapi import FastAPI, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
import os
from datetime import datetime

# 導入專案模組
try:
    import models, schemas
    from database import engine, get_db
except ImportError:
    # 預防模組導入失敗的基礎錯誤處理
    print("錯誤: 找不到 models, schemas 或 database 模組。請確認檔案是否存在。")

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

# --- API 路由 ---

@app.post("/api/matches", response_model=schemas.MatchResponse)
@app.post("/matches/", response_model=schemas.MatchResponse)
def create_match(match: schemas.MatchCreate, db: Session = Depends(get_db)):
    if match.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="Invalid admin password.")
    
    new_match = models.Match(
        script=match.script,
        storyteller=match.storyteller,
        winning_team=match.winning_team,
        location=getattr(match, 'location', '未知') 
    )
    db.add(new_match)
    db.commit()
    db.refresh(new_match)
    
    for p in match.players:
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
    match_query = db.query(models.Match)
    if location:
        match_query = match_query.filter(models.Match.location == location)
    
    target_matches = match_query.all()
    total_matches = len(target_matches)
    match_ids = [m.id for m in target_matches]
    
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
            "win_rate": round(wins / len(records) * 100, 1) if records else 0
        })

    locations = [l[0] for l in db.query(models.Match.location).distinct().all() if l[0]]
    
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
        "win_rate": round(v["wins"] / v["played"] * 100, 1) if v["played"] > 0 else 0
    } for k, v in character_stats.items()]

    return {
        "total_games": total_matches,
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
        "overall_win_rate": round(wins/total*100, 1) if total > 0 else 0
    }

@app.get("/api/history")
@app.get("/matches/")
def get_history(location: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Match)
    if location:
        query = query.filter(models.Match.location == location)
    return query.order_by(models.Match.date.desc()).all()

# --- 核心修正：首頁與靜態資源掛載 ---

@app.get("/")
@app.get("/index.html")
async def read_index():
    # 優先尋找 static 目錄下的 index.html
    static_index = os.path.join("static", "index.html")
    if os.path.exists(static_index):
        return FileResponse(static_index)
    # 備選尋找根目錄
    if os.path.exists("index.html"):
        return FileResponse('index.html')
    return {"message": "魔典系統已啟動，但在 static/ 或 根目錄 均找不到 index.html"}

# 掛載目錄邏輯優化
# 1. 掛載 pages (假設它在根目錄或 static/pages)
if os.path.exists("pages"):
    app.mount("/pages", StaticFiles(directory="pages"), name="pages")
elif os.path.exists("static/pages"):
    app.mount("/pages", StaticFiles(directory="static/pages"), name="pages")

# 2. 掛載 js/css/static (處理常見路徑結構)
for folder in ["js", "css", "static"]:
    if os.path.exists(folder):
        app.mount(f"/{folder}", StaticFiles(directory=folder), name=folder)
    elif os.path.exists(f"static/{folder}"):
        app.mount(f"/{folder}", StaticFiles(directory=f"static/{folder}"), name=f"{folder}_alt")
