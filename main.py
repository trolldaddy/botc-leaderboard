import os
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

# 導入專案定義的模型與資料庫配置
import models
from database import engine, get_db

# --- 🟢 關鍵：確保 app 物件在最頂層且無縮排，供 Vercel 識別 ---
app = FastAPI(title="BOTC Stats Leaderboard API")

# 自動同步資料庫表結構 (根據 models.py 定義建立表)
try:
    models.Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"資料庫初始化失敗: {e}")

# 配置跨域請求 (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 管理員密鑰 (優先讀取環境變數，預設為 mmmm)
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "mmmm")

# --- 🚀 核心 API：錄入對局 ---

@app.post("/api/matches")
async def create_match(data: dict, db: Session = Depends(get_db)):
    """
    接收對局資料。
    包含：自動建立新玩家、建立對局主表、建立玩家表現關聯紀錄。
    """
    try:
        # 1. 驗證管理員密鑰 (相容 password 或 admin_password)
        received_pw = data.get("password") or data.get("admin_password")
        if received_pw != ADMIN_PASSWORD:
            raise HTTPException(status_code=403, detail="管理員密鑰錯誤，無法將資料寫入魔典")

        # 2. 解析日期
        raw_date = data.get("date")
        match_date = datetime.now()
        if raw_date:
            try:
                match_date = datetime.strptime(raw_date, "%Y-%m-%d")
            except:
                pass

        # 3. 建立對局環境資訊 (Matches 表)
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

        # 4. 處理每位參與玩家的表現 (MatchPlayers 表)
        players_list = data.get("players", [])
        for p in players_list:
            player_name = p.get("name", "").strip()
            if not player_name:
                continue

            # 尋找玩家 UID，若不存在則建立 (Players 表)
            db_player = db.query(models.Player).filter(models.Player.name == player_name).first()
            if not db_player:
                db_player = models.Player(name=player_name)
                db.add(db_player)
                db.commit()
                db.refresh(db_player)

            # 建立詳細的表現紀錄 (MatchPlayer 表)
            # 欄位對應：initial_character (初始), final_character (最終), alignment (陣營), survived (存活)
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
        print(f"❌ 錄入失敗 Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"伺服器內部錯誤: {str(e)}")

# --- 📊 統計 API：提供數據看板使用 ---

@app.get("/api/stats")
async def get_global_stats(location: Optional[str] = None, db: Session = Depends(get_db)):
    """
    提供全域或特定地點的勝率統計。
    """
    query = db.query(models.Match)
    if location:
        query = query.filter(models.Match.location == location)
    
    matches = query.all()
    total_games = len(matches)
    
    # 獲取目前資料庫中出現過的所有地點 (供下拉選單使用)
    all_locations = [l[0] for l in db.query(models.Match.location).distinct().all() if l[0]]
    
    if total_games == 0:
        return {
            "total_games": 0, 
            "good_win_percent": 0, 
            "evil_win_percent": 0, 
            "available_locations": all_locations
        }

    good_wins = sum(1 for m in matches if m.winning_team == "good")
    good_rate = round(good_wins / total_games * 100, 1)

    return {
        "total_games": total_games,
        "good_win_percent": good_rate,
        "evil_win_percent": round(100 - good_rate, 1),
        "available_locations": all_locations
    }

# --- 👤 玩家 API：查詢個人生涯戰績 ---

@app.get("/api/player/{name}")
async def get_player_stats(name: str, db: Session = Depends(get_db)):
    """
    根據玩家暱稱計算該玩家的總勝率與最常玩角色。
    """
    player = db.query(models.Player).filter(models.Player.name == name).first()
    if not player:
        raise HTTPException(status_code=404, detail="找不到該玩家的歷史紀錄")

    # 取得該玩家參與的所有表現
    records = db.query(models.MatchPlayer).filter(models.MatchPlayer.player_id == player.id).all()
    total = len(records)
    
    wins = 0
    roles_stat = {}
    for r in records:
        # 比對玩家最終陣營與該場獲勝陣營
        if r.alignment == r.match.winning_team:
            wins += 1
        
        # 統計最常玩的角色 (使用最終角色)
        char = r.final_character or "未知"
        roles_stat[char] = roles_stat.get(char, 0) + 1

    # 整理角色排名數據
    top_roles = [
        {"role": k, "count": v} 
        for k, v in sorted(roles_stat.items(), key=lambda x: x[1], reverse=True)[:5]
    ]

    return {
        "player_name": player.name,
        "total_matches": total,
        "overall_win_rate": round(wins / total * 100, 1) if total > 0 else 0,
        "most_played_roles": top_roles
    }

# --- 📜 歷史紀錄 API ---

@app.get("/api/history")
async def get_history(db: Session = Depends(get_db)):
    """
    獲取最近的對局紀錄。
    """
    return db.query(models.Match).order_by(models.Match.date.desc()).limit(50).all()

# --- 🖼️ 靜態檔案處理與首頁路由 ---

@app.get("/")
@app.get("/index.html")
async def serve_home():
    """
    優先尋找 static 目錄下的 index.html。
    """
    paths = ["static/index.html", "index.html"]
    for path in paths:
        if os.path.exists(path):
            return FileResponse(path)
    return {"message": "伺服器已啟動，但在 static/ 或根目錄找不到 index.html"}

# 自動掛載靜態資源目錄
for folder in ["js", "css", "pages", "static"]:
    physical_path = folder if os.path.exists(folder) else f"static/{folder}"
    if os.path.exists(physical_path):
        app.mount(f"/{folder}", StaticFiles(directory=physical_path), name=f"mount_{folder}")
