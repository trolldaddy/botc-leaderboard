import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlencode

import requests
from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session, joinedload

import models
from database import engine, get_db

app = FastAPI(title="BOTC Stats Leaderboard API")

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "mmmm")
SESSION_SECRET = os.getenv("SESSION_SECRET") or ADMIN_PASSWORD
LINE_CHANNEL_ID = os.getenv("LINE_CHANNEL_ID", "")
LINE_CHANNEL_SECRET = os.getenv("LINE_CHANNEL_SECRET", "")
LINE_CALLBACK_URL = os.getenv("LINE_CALLBACK_URL", "")
ALLOWED_LINE_USER_IDS = {
    item.strip() for item in os.getenv("ALLOWED_LINE_USER_IDS", "").split(",") if item.strip()
}
ADMIN_LINE_USER_IDS = {
    item.strip() for item in os.getenv("ADMIN_LINE_USER_IDS", "").split(",") if item.strip()
}
UPLOAD_LIMIT_PER_24H = int(os.getenv("UPLOAD_LIMIT_PER_24H", "10"))
SESSION_COOKIE = "botc_session"
LINE_STATE_COOKIE = "botc_line_state"
LINE_NEXT_COOKIE = "botc_line_next"
SESSION_MAX_AGE = 60 * 60 * 24 * 30

# 確保資料庫表已建立
try:
    models.Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"資料庫初始化失敗: {e}")


def ensure_runtime_schema():
    """補齊舊資料庫缺少的新欄位。create_all 不會自動 ALTER 已存在的表。"""
    try:
        inspector = inspect(engine)
        if "matches" in inspector.get_table_names():
            columns = {col["name"] for col in inspector.get_columns("matches")}
            with engine.begin() as conn:
                if "uploaded_by_id" not in columns:
                    conn.execute(text("ALTER TABLE matches ADD COLUMN uploaded_by_id INTEGER"))
                if "created_at" not in columns:
                    conn.execute(text("ALTER TABLE matches ADD COLUMN created_at DATETIME"))
                    conn.execute(text("UPDATE matches SET created_at = date WHERE created_at IS NULL"))
        if "storyteller_accounts" in inspector.get_table_names():
            columns = {col["name"] for col in inspector.get_columns("storyteller_accounts")}
            with engine.begin() as conn:
                if "is_banned" not in columns:
                    conn.execute(text("ALTER TABLE storyteller_accounts ADD COLUMN is_banned BOOLEAN DEFAULT 0"))
                if "banned_at" not in columns:
                    conn.execute(text("ALTER TABLE storyteller_accounts ADD COLUMN banned_at DATETIME"))
    except Exception as e:
        print(f"資料庫結構補齊失敗: {e}")


ensure_runtime_schema()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _sign(value: str) -> str:
    return hmac.new(SESSION_SECRET.encode("utf-8"), value.encode("utf-8"), hashlib.sha256).hexdigest()


def create_session_cookie(account_id: int) -> str:
    payload = {
        "account_id": account_id,
        "exp": int(time.time()) + SESSION_MAX_AGE,
    }
    body = _b64encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    return f"{body}.{_sign(body)}"


def read_session_cookie(request: Request) -> Optional[dict]:
    raw_cookie = request.cookies.get(SESSION_COOKIE)
    if not raw_cookie or "." not in raw_cookie:
        return None
    body, signature = raw_cookie.rsplit(".", 1)
    if not hmac.compare_digest(_sign(body), signature):
        return None
    try:
        payload = json.loads(_b64decode(body).decode("utf-8"))
    except Exception:
        return None
    if int(payload.get("exp", 0)) < int(time.time()):
        return None
    return payload


def is_secure_request(request: Request) -> bool:
    return request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"


def set_auth_cookie(response: RedirectResponse, request: Request, account_id: int):
    response.set_cookie(
        SESSION_COOKIE,
        create_session_cookie(account_id),
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=is_secure_request(request),
        samesite="lax",
    )


def clear_auth_cookie(response):
    response.delete_cookie(SESSION_COOKIE)
    response.delete_cookie(LINE_STATE_COOKIE)
    response.delete_cookie(LINE_NEXT_COOKIE)


def line_callback_url(request: Request) -> str:
    return LINE_CALLBACK_URL or str(request.url_for("line_callback"))


def storyteller_can_upload(account: models.StorytellerAccount) -> bool:
    if bool(account.is_banned):
        return False
    if ALLOWED_LINE_USER_IDS:
        return account.line_user_id in ALLOWED_LINE_USER_IDS or bool(account.is_allowed)
    return True


def storyteller_is_admin(account: Optional[models.StorytellerAccount]) -> bool:
    return bool(account and account.line_user_id in ADMIN_LINE_USER_IDS)


def get_optional_storyteller(request: Request, db: Session = Depends(get_db)) -> Optional[models.StorytellerAccount]:
    session = read_session_cookie(request)
    if not session:
        return None
    account_id = session.get("account_id")
    if not account_id:
        return None
    return db.query(models.StorytellerAccount).filter(models.StorytellerAccount.id == account_id).first()


def require_upload_storyteller(
    account: Optional[models.StorytellerAccount] = Depends(get_optional_storyteller),
) -> models.StorytellerAccount:
    if not account:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="請先使用 LINE 登入")
    if bool(account.is_banned):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="此 LINE 帳號已被禁止上傳戰績")
    if not storyteller_can_upload(account):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="此 LINE 帳號尚未開放上傳戰績")
    return account


def require_admin_storyteller(
    account: Optional[models.StorytellerAccount] = Depends(get_optional_storyteller),
) -> models.StorytellerAccount:
    if not account:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="請先使用 LINE 登入")
    if not storyteller_is_admin(account):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="沒有管理員權限")
    return account


def enforce_upload_rate_limit(db: Session, uploader: models.StorytellerAccount):
    if UPLOAD_LIMIT_PER_24H <= 0:
        return
    cutoff = datetime.now() - timedelta(hours=24)
    recent_count = db.query(models.Match).filter(
        models.Match.uploaded_by_id == uploader.id,
        models.Match.created_at >= cutoff,
    ).count()
    if recent_count >= UPLOAD_LIMIT_PER_24H:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"此 LINE 帳號 24 小時內最多只能上傳 {UPLOAD_LIMIT_PER_24H} 筆戰績",
        )


def serialize_match(m: models.Match, include_players: bool = True) -> dict:
    sorted_players = sorted(m.players, key=lambda x: x.seat_number if x.seat_number is not None else 99)
    data = {
        "id": m.id,
        "script": m.script,
        "date": m.date,
        "location": m.location,
        "storyteller": m.storyteller,
        "winning_team": m.winning_team,
        "replay_log": m.replay_log,
        "uploaded_by": m.uploader.display_name if m.uploader else None,
        "uploaded_by_id": m.uploader.line_user_id if m.uploader else None,
        "created_at": m.created_at,
    }
    if include_players:
        data["players"] = [
            {
                "player_name": p.player.name,
                "seat_number": p.seat_number,
                "initial_character": p.initial_character,
                "final_character": p.final_character,
                "alignment": p.alignment,
                "survived": p.survived,
            }
            for p in sorted_players
        ]
    return data


# --- LINE Login ---
@app.get("/auth/line/login")
async def line_login(request: Request):
    if not LINE_CHANNEL_ID or not LINE_CHANNEL_SECRET:
        raise HTTPException(status_code=500, detail="尚未設定 LINE_CHANNEL_ID 或 LINE_CHANNEL_SECRET")

    state = secrets.token_urlsafe(32)
    nonce = secrets.token_urlsafe(32)
    next_url = request.query_params.get("next", "/")
    if not next_url.startswith("/"):
        next_url = "/"

    params = {
        "response_type": "code",
        "client_id": LINE_CHANNEL_ID,
        "redirect_uri": line_callback_url(request),
        "state": state,
        "scope": "profile openid",
        "nonce": nonce,
    }
    response = RedirectResponse(f"https://access.line.me/oauth2/v2.1/authorize?{urlencode(params)}")
    response.set_cookie(LINE_STATE_COOKIE, state, max_age=600, httponly=True, secure=is_secure_request(request), samesite="lax")
    response.set_cookie(LINE_NEXT_COOKIE, next_url, max_age=600, httponly=True, secure=is_secure_request(request), samesite="lax")
    return response


@app.get("/auth/line/callback")
async def line_callback(request: Request, db: Session = Depends(get_db)):
    error = request.query_params.get("error")
    if error:
        raise HTTPException(status_code=400, detail=f"LINE 登入失敗: {error}")

    state = request.query_params.get("state")
    expected_state = request.cookies.get(LINE_STATE_COOKIE)
    if not state or not expected_state or not hmac.compare_digest(state, expected_state):
        raise HTTPException(status_code=400, detail="LINE 登入狀態驗證失敗，請重新登入")

    code = request.query_params.get("code")
    if not code:
        raise HTTPException(status_code=400, detail="LINE 未回傳授權碼")

    token_resp = requests.post(
        "https://api.line.me/oauth2/v2.1/token",
        data={
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": line_callback_url(request),
            "client_id": LINE_CHANNEL_ID,
            "client_secret": LINE_CHANNEL_SECRET,
        },
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        timeout=10,
    )
    if not token_resp.ok:
        raise HTTPException(status_code=400, detail="無法向 LINE 交換登入權杖")

    access_token = token_resp.json().get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="LINE 未回傳 access token")

    profile_resp = requests.get(
        "https://api.line.me/v2/profile",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=10,
    )
    if not profile_resp.ok:
        raise HTTPException(status_code=400, detail="無法取得 LINE 使用者資料")

    profile = profile_resp.json()
    line_user_id = profile.get("userId")
    if not line_user_id:
        raise HTTPException(status_code=400, detail="LINE 使用者資料缺少 userId")

    account = db.query(models.StorytellerAccount).filter(models.StorytellerAccount.line_user_id == line_user_id).first()
    allowed_by_env = not ALLOWED_LINE_USER_IDS or line_user_id in ALLOWED_LINE_USER_IDS
    if not account:
        account = models.StorytellerAccount(
            line_user_id=line_user_id,
            display_name=profile.get("displayName"),
            picture_url=profile.get("pictureUrl"),
            is_allowed=allowed_by_env,
            last_login_at=datetime.now(),
        )
        db.add(account)
    else:
        account.display_name = profile.get("displayName") or account.display_name
        account.picture_url = profile.get("pictureUrl") or account.picture_url
        account.last_login_at = datetime.now()
        if allowed_by_env:
            account.is_allowed = True
    db.commit()
    db.refresh(account)

    next_url = request.cookies.get(LINE_NEXT_COOKIE, "/")
    if not next_url.startswith("/"):
        next_url = "/"
    response = RedirectResponse(next_url)
    set_auth_cookie(response, request, account.id)
    response.delete_cookie(LINE_STATE_COOKIE)
    response.delete_cookie(LINE_NEXT_COOKIE)
    return response


@app.get("/auth/logout")
@app.post("/auth/logout")
async def logout():
    response = RedirectResponse("/")
    clear_auth_cookie(response)
    return response


@app.get("/api/me")
async def get_me(account: Optional[models.StorytellerAccount] = Depends(get_optional_storyteller)):
    if not account:
        return {"authenticated": False, "can_upload": False, "is_admin": False}
    return {
        "authenticated": True,
        "can_upload": storyteller_can_upload(account),
        "is_admin": storyteller_is_admin(account),
        "user": {
            "display_name": account.display_name,
            "picture_url": account.picture_url,
            "line_user_id": account.line_user_id,
            "is_banned": bool(account.is_banned),
        },
    }


# --- PWA 支援路由 ---
@app.get("/manifest.json")
async def serve_manifest():
    paths = ["static/manifest.json", "manifest.json"]
    for path in paths:
        if os.path.exists(path):
            return FileResponse(path)
    raise HTTPException(status_code=404, detail="manifest.json not found")


@app.get("/sw.js")
async def serve_sw():
    paths = ["static/sw.js", "sw.js"]
    for path in paths:
        if os.path.exists(path):
            return FileResponse(path)
    raise HTTPException(status_code=404, detail="sw.js not found")


# --- 戰績錄入 API ---
@app.post("/api/matches")
async def create_match(
    data: dict,
    db: Session = Depends(get_db),
    uploader: models.StorytellerAccount = Depends(require_upload_storyteller),
):
    enforce_upload_rate_limit(db, uploader)
    try:
        raw_date = data.get("date")
        match_date = datetime.now()
        if raw_date:
            try:
                match_date = datetime.strptime(raw_date, "%Y-%m-%d")
            except Exception:
                pass

        new_match = models.Match(
            script=data.get("script", "未知劇本"),
            date=match_date,
            location=data.get("location", "未知"),
            storyteller=data.get("storyteller") or uploader.display_name or "佚名",
            winning_team=data.get("winning_team", "good"),
            replay_log=data.get("replay_log"),
            uploaded_by_id=uploader.id,
            created_at=datetime.now(),
        )
        db.add(new_match)
        db.commit()
        db.refresh(new_match)

        players_list = data.get("players", [])
        for i, p in enumerate(players_list):
            player_name = p.get("name", "").strip()
            if not player_name:
                continue

            db_player = db.query(models.Player).filter(models.Player.name == player_name).first()
            if not db_player:
                db_player = models.Player(name=player_name)
                db.add(db_player)
                db.commit()
                db.refresh(db_player)

            performance = models.MatchPlayer(
                match_id=new_match.id,
                player_id=db_player.id,
                seat_number=p.get("seat_number", i + 1),
                initial_character=p.get("initial_character") or p.get("character") or "未知",
                final_character=p.get("final_character") or p.get("character") or "未知",
                alignment=p.get("alignment") or p.get("final_alignment") or "good",
                survived=p.get("survived") if p.get("survived") is not None else True,
            )
            db.add(performance)
        
        db.commit()
        return {"status": "success", "match_id": new_match.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"伺服器內部錯誤: {str(e)}")


# --- 管理員 API ---
@app.get("/api/admin/users")
async def admin_get_users(
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_storyteller),
):
    accounts = db.query(models.StorytellerAccount).order_by(models.StorytellerAccount.last_login_at.desc()).all()
    return [
        {
            "id": account.id,
            "line_user_id": account.line_user_id,
            "display_name": account.display_name,
            "picture_url": account.picture_url,
            "is_allowed": bool(account.is_allowed),
            "is_banned": bool(account.is_banned),
            "is_admin": storyteller_is_admin(account),
            "created_at": account.created_at,
            "last_login_at": account.last_login_at,
            "upload_count": len(account.uploaded_matches),
        }
        for account in accounts
    ]


@app.patch("/api/admin/users/{account_id}")
async def admin_update_user(
    account_id: int,
    data: dict,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_storyteller),
):
    account = db.query(models.StorytellerAccount).filter(models.StorytellerAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="找不到此 LINE 帳號")
    if account.id == admin.id and data.get("is_banned") is True:
        raise HTTPException(status_code=400, detail="不能 BAN 自己")
    if "is_banned" in data:
        account.is_banned = bool(data.get("is_banned"))
        account.banned_at = datetime.now() if account.is_banned else None
    if "is_allowed" in data:
        account.is_allowed = bool(data.get("is_allowed"))
    db.commit()
    db.refresh(account)
    return {"status": "success", "account": {"id": account.id, "is_banned": bool(account.is_banned), "is_allowed": bool(account.is_allowed)}}


@app.get("/api/admin/replays")
async def admin_get_replays(
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_storyteller),
):
    matches = db.query(models.Match).options(
        joinedload(models.Match.players).joinedload(models.MatchPlayer.player),
        joinedload(models.Match.uploader),
    ).order_by(models.Match.created_at.desc(), models.Match.date.desc()).all()
    return [serialize_match(m) for m in matches]


@app.patch("/api/admin/matches/{match_id}")
async def admin_update_match(
    match_id: int,
    data: dict,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_storyteller),
):
    match = db.query(models.Match).filter(models.Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="找不到此 replay 紀錄")

    for field in ["script", "location", "storyteller", "winning_team", "replay_log"]:
        if field in data:
            setattr(match, field, data.get(field))
    if data.get("date"):
        try:
            match.date = datetime.strptime(data.get("date"), "%Y-%m-%d")
        except Exception:
            raise HTTPException(status_code=400, detail="日期格式需為 YYYY-MM-DD")

    db.commit()
    db.refresh(match)
    return {"status": "success", "match": serialize_match(match, include_players=False)}


@app.delete("/api/admin/matches/{match_id}")
async def admin_delete_match(
    match_id: int,
    db: Session = Depends(get_db),
    admin: models.StorytellerAccount = Depends(require_admin_storyteller),
):
    match = db.query(models.Match).filter(models.Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="找不到此 replay 紀錄")
    db.delete(match)
    db.commit()
    return {"status": "success"}


# 統計數據 API
@app.get("/api/stats")
async def get_dashboard_summary(db: Session = Depends(get_db)):
    all_matches = db.query(models.Match).all()
    total_games = len(all_matches)
    
    global_good = sum(1 for m in all_matches if m.winning_team == "good")
    global_evil = total_games - global_good
    
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
            "evil_rate": round(s["evil"] / s["total"] * 100, 1) if s["total"] > 0 else 0,
        })

    return {
        "global": {
            "total": total_games,
            "good_wins": global_good,
            "evil_wins": global_evil,
            "good_rate": round(global_good / total_games * 100, 1) if total_games > 0 else 0,
            "evil_rate": round(global_evil / total_games * 100, 1) if total_games > 0 else 0,
        },
        "locations": sorted(location_stats, key=lambda x: x["total"], reverse=True),
    }


@app.get("/api/players")
async def get_all_players(db: Session = Depends(get_db)):
    players = db.query(models.Player.name).order_by(models.Player.name).all()
    return [p[0] for p in players]


@app.get("/api/history")
async def get_history(db: Session = Depends(get_db)):
    matches = db.query(models.Match).options(
        joinedload(models.Match.players).joinedload(models.MatchPlayer.player),
        joinedload(models.Match.uploader),
    ).order_by(models.Match.date.desc()).limit(50).all()
    return [serialize_match(m) for m in matches]


@app.get("/")
@app.get("/index.html")
async def serve_home():
    for path in ["static/index.html", "index.html"]:
        if os.path.exists(path):
            return FileResponse(path)
    return {"message": "找不到 index.html"}


# 掛載靜態資源資料夾
for folder in ["js", "css", "pages", "static", "icons"]:
    physical_path = folder if os.path.exists(folder) else f"static/{folder}"
    if os.path.exists(physical_path):
        app.mount(f"/{folder}", StaticFiles(directory=physical_path), name=f"mount_{folder}")
