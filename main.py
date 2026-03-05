from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import os

import models, schemas
from database import engine, get_db

# 创建所有数据库表
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="BOTC Leaderboard API")

# 配置跨域请求（允许前端 HTML 调用 API）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 极简版密码
ADMIN_PASSWORD = "mmmm"

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

# --- 对局管理路由 ---
@app.post("/matches/", response_model=schemas.MatchResponse)
def create_match(match: schemas.MatchCreate, db: Session = Depends(get_db)):
    # 验证密码
    if match.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="Invalid admin password. Only Storytellers can record matches.")
    
    # 创建对局
    new_match = models.Match(
        script=match.script,
        storyteller=match.storyteller,
        winning_team=match.winning_team
    )
    db.add(new_match)
    db.commit()
    db.refresh(new_match)
    
    # 批量创建玩家对局记录
    for p in match.players:
        match_player = models.MatchPlayer(
            match_id=new_match.id,
            player_id=p.player_id,
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
def get_matches(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    matches = db.query(models.Match).order_by(models.Match.date.desc()).offset(skip).limit(limit).all()
    return matches

@app.delete("/matches/{match_id}")
def delete_match(match_id: int, req: schemas.DeleteMatchRequest, db: Session = Depends(get_db)):
    if req.password != ADMIN_PASSWORD:
        raise HTTPException(status_code=403, detail="管理员密钥错误！你无权抹除这份记忆。")
    
    match = db.query(models.Match).filter(models.Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="未找到该对局。")
        
    # 级联删除相关的对局玩家记录
    db.query(models.MatchPlayer).filter(models.MatchPlayer.match_id == match_id).delete()
    
    # 删除比赛本身
    db.delete(match)
    db.commit()
    return {"message": "对局记录已成功销毁"}

# --- 统计数据路由 ---
@app.get("/stats/")
def get_stats(db: Session = Depends(get_db)):
    total_matches = db.query(models.Match).count()
    
    players = db.query(models.Player).all()
    player_stats = []
    for p in players:
        matches_played = db.query(models.MatchPlayer).filter(models.MatchPlayer.player_id == p.id).all()
        if not matches_played:
            continue
            
        wins = 0
        good_wins = 0
        bad_wins = 0
        good_played = 0
        bad_played = 0
        
        for mp in matches_played:
            match = mp.match
            if mp.final_alignment == "good":
                good_played += 1
                if match.winning_team == "good":
                    wins += 1
                    good_wins += 1
            else:
                bad_played += 1
                if match.winning_team == "bad":
                    wins += 1
                    bad_wins += 1
                    
        player_stats.append({
            "id": p.id,
            "name": p.name,
            "total_played": len(matches_played),
            "wins": wins,
            "win_rate": round(wins / len(matches_played) * 100, 1),
            "good_played": good_played,
            "good_win_rate": round(good_wins / good_played * 100, 1) if good_played > 0 else 0,
            "bad_played": bad_played,
            "bad_win_rate": round(bad_wins / bad_played * 100, 1) if bad_played > 0 else 0,
        })
        
    all_match_players = db.query(models.MatchPlayer).all()
    character_stats = {}
    for mp in all_match_players:
        char = mp.character
        if char not in character_stats:
            character_stats[char] = {"played": 0, "wins": 0}
        
        character_stats[char]["played"] += 1
        if mp.final_alignment == mp.match.winning_team:
            character_stats[char]["wins"] += 1
            
    char_list = [
        {
            "character": k, 
            "played": v["played"], 
            "win_rate": round(v["wins"] / v["played"] * 100, 1)
        } for k, v in character_stats.items()
    ]
    
    return {
        "total_matches": total_matches,
        "players": sorted(player_stats, key=lambda x: x["win_rate"], reverse=True),
        "characters": sorted(char_list, key=lambda x: x["played"], reverse=True)
    }

# 注意：挂载静态目录必须放在所有 API 路由的最后，否则会拦截 API 请求
if os.path.exists("static"):
    app.mount("/", StaticFiles(directory="static", html=True), name="static")
