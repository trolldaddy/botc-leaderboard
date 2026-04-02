import os
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload 
from sqlalchemy import func

import models
from database import engine, get_db

app = FastAPI(title="BOTC Stats Leaderboard API")

try:
    models.Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"資料庫初始化失敗: {e}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "mmmm")

@app.post("/api/matches")
async def create_match(data: dict, db: Session = Depends(get_db)):
    try:
        received_pw = data.get("password") or data.get("admin_password")
        if received_pw != ADMIN_PASSWORD:
            raise HTTPException(status_code=403, detail="管理員密鑰錯誤")

        raw_date = data.get("date")
        match_date = datetime.now()
        if raw_date:
            try:
                match_date = datetime.strptime(raw_date, "%Y-%m-%d")
            except:
                pass

        new_match = models.Match(
            script=data.get("script", "未知劇本"),
            date=match_date,
            location=data.get("location", "未知"),
            storyteller=data.get("storyteller", "佚名"),
            winning_team=data.get("winning_team", "good")
        )
        db.add(new_match)
        db.commit()
        db.refresh(new_match)

        players_list = data.get("players", [])
        for p in players_list:
            player_name = p.get("name", "").strip()
            if not player_name: continue

            db_player = db.query(models.Player).filter(models.Player.name == player_name).first()
            if not db_player:
                db_player = models.Player(name=player_name)
                db.add(db_player)
                db.commit()
                db.refresh(db_player)

            performance = models.MatchPlayer(
                match_id=new_match.id,
                player_id=db_player.id,
                initial_character=p.get("initial_character") or p.get("character") or "未知",
                final_character=p.get("final_character") or p.get("character") or "未知",
                alignment=p.get("alignment") or p.get("final_alignment") or "good",
                survived=p.get("survived") if p.get("survived") is not None else True
            )
            db.add(performance)
        
        db.commit()
        return {"status": "success", "match_id": new_match.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"伺服器內部錯誤: {str(e)}")

# 🟢 升級統計 API：同時回傳全域與分地點數據
@app.get("/api/stats")
async def get_dashboard_summary(db: Session = Depends(get_db)):
    all_matches = db.query(models.Match).all()
    total_games = len(all_matches)
    
    # 1. 全域計算
    global_good = sum(1 for m in all_matches if m.winning_team == "good")
    global_evil = total_games - global_good
    
    # 2. 分地點計算
    location_map = {}
    for m in all_matches:
        loc = m.location or "未知"
        if loc not in location_map:
            location_map[loc] = {"total": 0, "good": 0, "evil": 0}
        location_map[loc]["total"] += 1
        if m.winning_team == "good":
            location_map[loc]["good"] += 1
        else:
            location_map[loc]["evil"] += 1
            
    location_stats = []
    for loc, s in location_map.items():
        location_stats.append({
            "name": loc,
            "total": s["total"],
            "good_wins": s["good"],
            "evil_wins": s["evil"],
            "good_rate": round(s["good"] / s["total"] * 100, 1) if s["total"] > 0 else 0,
            "evil_rate": round(s["evil"] / s["total"] * 100, 1) if s["total"] > 0 else 0
        })

    return {
        "global": {
            "total": total_games,
            "good_wins": global_good,
            "evil_wins": global_evil,
            "good_rate": round(global_good / total_games * 100, 1) if total_games > 0 else 0,
            "evil_rate": round(global_evil / total_games * 100, 1) if total_games > 0 else 0
        },
        "locations": sorted(location_stats, key=lambda x: x["total"], reverse=True)
    }

@app.get("/api/players")
async def get_all_players(db: Session = Depends(get_db)):
    players = db.query(models.Player.name).order_by(models.Player.name).all()
    return [p[0] for p in players]

@app.get("/api/player/{name}")
async def get_player_stats(name: str, db: Session = Depends(get_db)):
    player = db.query(models.Player).filter(models.Player.name == name).first()
    if not player: raise HTTPException(status_code=404, detail="找不到玩家")
    records = db.query(models.MatchPlayer).filter(models.MatchPlayer.player_id == player.id).all()
    total = len(records)
    wins = sum(1 for r in records if r.alignment == r.match.winning_team)
    roles_stat = {}
    for r in records:
        char = r.final_character or "未知"
        roles_stat[char] = roles_stat.get(char, 0) + 1
    top_roles = [{"role": k, "count": v} for k, v in sorted(roles_stat.items(), key=lambda x: x[1], reverse=True)[:5]]
    return {"player_name": player.name, "total_matches": total, "overall_win_rate": round(wins / total * 100, 1) if total > 0 else 0, "most_played_roles": top_roles}

@app.get("/api/history")
async def get_history(db: Session = Depends(get_db)):
    matches = db.query(models.Match).options(
        joinedload(models.Match.players).joinedload(models.MatchPlayer.player)
    ).order_by(models.Match.date.desc()).limit(50).all()
    
    result = []
    for m in matches:
        sorted_players_records = sorted(m.players, key=lambda x: x.id)
        m_data = {
            "id": m.id, "script": m.script, "date": m.date, "location": m.location, "storyteller": m.storyteller, "winning_team": m.winning_team,
            "players": [{"player_name": p.player.name, "initial_character": p.initial_character, "final_character": p.final_character, "alignment": p.alignment, "survived": p.survived} for p in sorted_players_records]
        }
        result.append(m_data)
    return result

@app.get("/")
@app.get("/index.html")
async def serve_home():
    for path in ["static/index.html", "index.html"]:
        if os.path.exists(path): return FileResponse(path)
    return {"message": "找不到 index.html"}

for folder in ["js", "css", "pages", "static"]:
    physical_path = folder if os.path.exists(folder) else f"static/{folder}"
    if os.path.exists(physical_path):
        app.mount(f"/{folder}", StaticFiles(directory=physical_path), name=f"mount_{folder}")
