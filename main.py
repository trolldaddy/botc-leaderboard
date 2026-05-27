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
ALLOWED_LINE_USER_IDS = {item.strip() for item in os.getenv("ALLOWED_LINE_USER_IDS", "").split(",") if item.strip()}
ADMIN_LINE_USER_IDS = {item.strip() for item in os.getenv("ADMIN_LINE_USER_IDS", "").split(",") if item.strip()}
UPLOAD_LIMIT_PER_24H = int(os.getenv("UPLOAD_LIMIT_PER_24H", "10"))
SESSION_COOKIE = "botc_session"
LINE_STATE_COOKIE = "botc_line_state"
LINE_NEXT_COOKIE = "botc_line_next"
SESSION_MAX_AGE = 60 * 60 * 24 * 30

try:
    models.Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"資料庫初始化失敗: {e}")


def ensure_runtime_schema():
    """補齊舊資料庫缺少的新欄位。create_all 不會自動 ALTER 已存在的表。"""
    try:
        inspector = inspect(engine)
        dialect = engine.dialect.name
        timestamp_type = "TIMESTAMP" if dialect == "postgresql" else "DATETIME"
        boolean_default = "FALSE" if dialect == "postgresql" else "0"

        def add_column_sql(table, column, definition):
            if dialect == "postgresql":
                return f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {definition}"
            return f"ALTER TABLE {table} ADD COLUMN {column} {definition}"

        if "matches" in inspector.get_table_names():
            columns = {col["name"] for col in inspector.get_columns("matches")}
            with engine.begin() as conn:
                if "uploaded_by_id" not in columns:
                    conn.execute(text(add_column_sql("matches", "uploaded_by_id", "INTEGER")))
                if "created_at" not in columns:
                    conn.execute(text(add_column_sql("matches", "created_at", timestamp_type)))
                    conn.execute(text("UPDATE matches SET created_at = date WHERE created_at IS NULL"))
        if "storyteller_accounts" in inspector.get_table_names():
            columns = {col["name"] for col in inspector.get_columns("storyteller_accounts")}
            with engine.begin() as conn:
                if "created_at" not in columns:
                    conn.execute(text(add_column_sql("storyteller_accounts", "created_at", timestamp_type)))
                    if "last_login_at" in columns:
                        conn.execute(text("UPDATE storyteller_accounts SET created_at = last_login_at WHERE created_at IS NULL"))
                if "last_login_at" not in columns:
                    conn.execute(text(add_column_sql("storyteller_accounts", "last_login_at", timestamp_type)))
                if "is_banned" not in columns:
                    conn.execute(text(add_column_sql("storyteller_accounts", "is_banned", f"BOOLEAN DEFAULT {boolean_default}")))
                if "banned_at" not in columns:
                    conn.execute(text(add_column_sql("storyteller_accounts", "banned_at", timestamp_type)))
    except Exception as e:
        print(f"資料庫結構補齊失敗: {e}")


ensure_runtime_schema()

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _sign(value: str) -> str:
    return hmac.new(SESSION_SECRET.encode("utf-8"), value.encode("utf-8"), hashlib.sha256).hexdigest()


def create_session_cookie(account_id: int) -> str:
    payload = {"account_id": account_id, "exp": int(time.time()) + SESSION_MAX_AGE}
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
    response.set_cookie(SESSION_COOKIE, create_session_cookie(account_id), max_age=SESSION_MAX_AGE, httponly=True, secure=is_secure_request(request), samesite="lax")


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


def require_upload_storyteller(account: Optional[models.StorytellerAccount] = Depends(get_optional_storyteller)) -> models.StorytellerAccount:
    if not account:
        raise HTTPException(status_code=401, detail="請先使用 LINE 登入")
    if not storyteller_can_upload(account):
        if bool(account.is_banned):
            raise HTTPException(status_code=403, detail="此 LINE 帳號已被停權，無法上傳戰績")
        raise HTTPException(status_code=403, detail="此 LINE 帳號尚未開通上傳權限")
    return account


def require_admin_storyteller(account: Optional[models.StorytellerAccount] = Depends(get_optional_storyteller)) -> models.StorytellerAccount:
    if not account:
        raise HTTPException(status_code=401, detail="請先使用 LINE 登入")
    if not storyteller_is_admin(account):
        raise HTTPException(status_code=403, detail="沒有管理後台權限")
    return account


def enforce_upload_rate_limit(db: Session, account: models.StorytellerAccount):
    since = datetime.now() - timedelta(hours=24)
    recent_uploads = db.query(models.Match).filter(models.Match.uploaded_by_id == account.id, models.Match.created_at >= since).count()
    if recent_uploads >= UPLOAD_LIMIT_PER_24H:
        raise HTTPException(status_code=429, detail=f"此 LINE 帳號 24 小時內最多只能上傳 {UPLOAD_LIMIT_PER_24H} 筆紀錄")


def serialize_datetime(value):
    return value.isoformat() if value else None


def serialize_match(m: models.Match, include_players: bool = True):
    payload = {
        "id": m.id,
        "script": m.script,
        "date": serialize_datetime(m.date),
        "location": m.location,
        "storyteller": m.storyteller,
        "winning_team": m.winning_team,
        "replay_log": m.replay_log,
        "created_at": serialize_datetime(m.created_at),
        "uploaded_by": m.uploader.display_name if m.uploader else None,
        "uploaded_by_line_user_id": m.uploader.line_user_id if m.uploader else None,
    }
    if include_players:
        payload["players"] = [
            {
                "seat": getattr(p, "seat_number", None),
                "seat_number": getattr(p, "seat_number", None),
                "name": p.player.name if p.player else "",
                "player_name": p.player.name if p.player else "",
                "initial_role": getattr(p, "initial_character", None),
                "initial_character": getattr(p, "initial_character", None),
                "final_role": getattr(p, "final_character", None),
                "final_character": getattr(p, "final_character", None),
                "alignment": p.alignment,
                "status": "alive" if p.survived else "dead",
                "survived": bool(p.survived),
            }
            for p in sorted(m.players, key=lambda x: x.seat_number if x.seat_number is not None else 999)
        ]
    return payload


@app.get("/auth/line/login")
@app.get("/api/auth/line/login")
async def line_login(request: Request, next: str = "/#record"):
    if not LINE_CHANNEL_ID or not LINE_CHANNEL_SECRET:
        raise HTTPException(status_code=500, detail="尚未設定 LINE_CHANNEL_ID 或 LINE_CHANNEL_SECRET")
    state = secrets.token_urlsafe(24)
    params = {"response_type": "code", "client_id": LINE_CHANNEL_ID, "redirect_uri": line_callback_url(request), "state": state, "scope": "profile openid"}
    response = RedirectResponse(f"https://access.line.me/oauth2/v2.1/authorize?{urlencode(params)}")
    secure = is_secure_request(request)
    response.set_cookie(LINE_STATE_COOKIE, state, max_age=600, httponly=True, secure=secure, samesite="lax")
    response.set_cookie(LINE_NEXT_COOKIE, next or "/#record", max_age=600, httponly=True, secure=secure, samesite="lax")
    return response


@app.get("/auth/line/callback")
async def line_callback(request: Request, code: str = "", state: str = "", db: Session = Depends(get_db)):
    expected_state = request.cookies.get(LINE_STATE_COOKIE)
    if not expected_state or not state or not hmac.compare_digest(expected_state, state):
        raise HTTPException(status_code=400, detail="LINE 登入狀態驗證失敗，請重新登入")
    if not code:
        raise HTTPException(status_code=400, detail="LINE 未回傳授權碼")
    token_resp = requests.post("https://api.line.me/oauth2/v2.1/token", data={"grant_type": "authorization_code", "code": code, "redirect_uri": line_callback_url(request), "client_id": LINE_CHANNEL_ID, "client_secret": LINE_CHANNEL_SECRET}, timeout=10)
    if not token_resp.ok:
        raise HTTPException(status_code=400, detail="LINE token 換取失敗")
    access_token = token_resp.json().get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="LINE 未回傳 access token")
    profile_resp = requests.get("https://api.line.me/v2/profile", headers={"Authorization": f"Bearer {access_token}"}, timeout=10)
    if not profile_resp.ok:
        raise HTTPException(status_code=400, detail="LINE 個人資料讀取失敗")
    profile = profile_resp.json()
    line_user_id = profile.get("userId")
    display_name = profile.get("displayName") or "LINE 使用者"
    picture_url = profile.get("pictureUrl")
    if not line_user_id:
        raise HTTPException(status_code=400, detail="LINE 未回傳 userId")
    account = db.query(models.StorytellerAccount).filter(models.StorytellerAccount.line_user_id == line_user_id).first()
    now = datetime.now()
    if account:
        account.display_name = display_name
        account.picture_url = picture_url
        account.last_login_at = now
    else:
        account = models.StorytellerAccount(line_user_id=line_user_id, display_name=display_name, picture_url=picture_url, is_allowed=(not ALLOWED_LINE_USER_IDS) or (line_user_id in ALLOWED_LINE_USER_IDS), last_login_at=now)
        db.add(account)
    db.commit()
    db.refresh(account)
    next_url = request.cookies.get(LINE_NEXT_COOKIE) or "/#record"
    response = RedirectResponse(next_url)
    set_auth_cookie(response, request, account.id)
    response.delete_cookie(LINE_STATE_COOKIE)
    response.delete_cookie(LINE_NEXT_COOKIE)
    return response


@app.post("/api/auth/logout")
async def logout():
    response = {"status": "success"}
    redirect = RedirectResponse("/#record")
    clear_auth_cookie(redirect)
    return response


@app.get("/auth/logout")
async def logout_redirect():
    response = RedirectResponse("/#record")
    clear_auth_cookie(response)
    return response


@app.get("/api/me")
async def get_me(account: Optional[models.StorytellerAccount] = Depends(get_optional_storyteller)):
    if not account:
        return {"logged_in": False, "can_upload": False, "is_admin": False, "user": None}
    return {"logged_in": True, "can_upload": storyteller_can_upload(account), "is_admin": storyteller_is_admin(account), "user": {"display_name": account.display_name, "line_user_id": account.line_user_id, "picture_url": account.picture_url, "is_allowed": account.is_allowed, "is_banned": bool(account.is_banned)}}


@app.post("/api/matches")
async def create_match(data: dict, db: Session = Depends(get_db), uploader: models.StorytellerAccount = Depends(require_upload_storyteller)):
    try:
        enforce_upload_rate_limit(db, uploader)
        match = models.Match(script=data.get("script"), date=datetime.strptime(data.get("date"), "%Y-%m-%d") if data.get("date") else datetime.now(), location=data.get("location"), storyteller=data.get("storyteller"), winning_team=data.get("winning_team"), replay_log=data.get("replay_log"), uploaded_by_id=uploader.id, created_at=datetime.now())
        db.add(match)
        db.flush()
        for p in data.get("players", []):
            name = (p.get("name") or "").strip()
            if not name:
                continue
            player = db.query(models.Player).filter(models.Player.name == name).first()
            if not player:
                player = models.Player(name=name)
                db.add(player)
                db.flush()
            survived = p.get("survived")
            if survived is None:
                survived = p.get("status") != "dead"
            mp = models.MatchPlayer(match_id=match.id, player_id=player.id, seat_number=p.get("seat_number") or p.get("seat"), initial_character=p.get("initial_character") or p.get("initial_role"), final_character=p.get("final_character") or p.get("final_role"), alignment=p.get("alignment"), survived=bool(survived))
            db.add(mp)
        db.commit()
        return {"status": "success", "match_id": match.id}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        print(f"上傳失敗: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/admin/users")
async def admin_get_users(db: Session = Depends(get_db), admin: models.StorytellerAccount = Depends(require_admin_storyteller)):
    accounts = db.query(models.StorytellerAccount).order_by(models.StorytellerAccount.last_login_at.desc()).all()
    upload_counts = {}
    for uploader_id, in db.query(models.Match.uploaded_by_id).filter(models.Match.uploaded_by_id.isnot(None)).all():
        upload_counts[uploader_id] = upload_counts.get(uploader_id, 0) + 1
    return [{"id": account.id, "line_user_id": account.line_user_id, "display_name": account.display_name, "picture_url": account.picture_url, "is_allowed": bool(account.is_allowed), "is_banned": bool(account.is_banned), "is_admin": storyteller_is_admin(account), "created_at": serialize_datetime(account.created_at), "last_login_at": serialize_datetime(account.last_login_at), "upload_count": upload_counts.get(account.id, 0)} for account in accounts]


@app.patch("/api/admin/users/{account_id}")
async def admin_update_user(account_id: int, data: dict, db: Session = Depends(get_db), admin: models.StorytellerAccount = Depends(require_admin_storyteller)):
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
async def admin_get_replays(db: Session = Depends(get_db), admin: models.StorytellerAccount = Depends(require_admin_storyteller)):
    matches = db.query(models.Match).options(joinedload(models.Match.players).joinedload(models.MatchPlayer.player), joinedload(models.Match.uploader)).order_by(models.Match.date.desc(), models.Match.id.desc()).all()
    return [serialize_match(m) for m in matches]


@app.patch("/api/admin/matches/{match_id}")
async def admin_update_match(match_id: int, data: dict, db: Session = Depends(get_db), admin: models.StorytellerAccount = Depends(require_admin_storyteller)):
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
async def admin_delete_match(match_id: int, db: Session = Depends(get_db), admin: models.StorytellerAccount = Depends(require_admin_storyteller)):
    match = db.query(models.Match).filter(models.Match.id == match_id).first()
    if not match:
        raise HTTPException(status_code=404, detail="找不到此 replay 紀錄")
    db.delete(match)
    db.commit()
    return {"status": "success"}


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
    location_stats = [{"name": loc, "total": s["total"], "good_wins": s["good"], "evil_wins": s["evil"], "good_rate": round(s["good"] / s["total"] * 100, 1) if s["total"] > 0 else 0, "evil_rate": round(s["evil"] / s["total"] * 100, 1) if s["total"] > 0 else 0} for loc, s in location_map.items()]
    return {"global": {"total": total_games, "good_wins": global_good, "evil_wins": global_evil, "good_rate": round(global_good / total_games * 100, 1) if total_games > 0 else 0, "evil_rate": round(global_evil / total_games * 100, 1) if total_games > 0 else 0}, "locations": sorted(location_stats, key=lambda x: x["total"], reverse=True)}


@app.get("/api/players")
async def get_all_players(db: Session = Depends(get_db)):
    players = db.query(models.Player.name).order_by(models.Player.name).all()
    return [p[0] for p in players]


@app.get("/api/history")
async def get_history(db: Session = Depends(get_db)):
    matches = db.query(models.Match).options(joinedload(models.Match.players).joinedload(models.MatchPlayer.player), joinedload(models.Match.uploader)).order_by(models.Match.date.desc()).limit(50).all()
    return [serialize_match(m) for m in matches]


@app.get("/")
@app.get("/index.html")
async def serve_home():
    for path in ["static/index.html", "index.html"]:
        if os.path.exists(path):
            return FileResponse(path)
    return {"message": "找不到 index.html"}


for folder in ["js", "css", "pages", "static", "icons"]:
    physical_path = folder if os.path.exists(folder) else f"static/{folder}"
    if os.path.exists(physical_path):
        app.mount(f"/{folder}", StaticFiles(directory=physical_path), name=f"mount_{folder}")
