import base64
import hashlib
import hmac
import json
import os
import time
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session, joinedload

import models
from database import engine, get_db

router = APIRouter(prefix="/api/admin/account-bindings", tags=["account-bindings"])

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "mmmm")
SESSION_SECRET = os.getenv("SESSION_SECRET") or ADMIN_PASSWORD
SESSION_COOKIE = "botc_session"
ADMIN_LINE_USER_IDS = {item.strip() for item in os.getenv("ADMIN_LINE_USER_IDS", "").split(",") if item.strip()}


def ensure_binding_schema():
    try:
        inspector = inspect(engine)
        table_names = inspector.get_table_names()
        if "storyteller_accounts" not in table_names:
            return
        dialect = engine.dialect.name
        timestamp_type = "TIMESTAMP" if dialect == "postgresql" else "DATETIME"
        boolean_default = "TRUE" if dialect == "postgresql" else "1"

        def add_column_sql(table, column, definition):
            if dialect == "postgresql":
                return f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {column} {definition}"
            return f"ALTER TABLE {table} ADD COLUMN {column} {definition}"

        columns = {col["name"] for col in inspector.get_columns("storyteller_accounts")}
        with engine.begin() as conn:
            if "player_id" not in columns:
                conn.execute(text(add_column_sql("storyteller_accounts", "player_id", "INTEGER")))
            if "can_host" not in columns:
                conn.execute(text(add_column_sql("storyteller_accounts", "can_host", f"BOOLEAN DEFAULT {boolean_default}")))
            if "host_verified_at" not in columns:
                conn.execute(text(add_column_sql("storyteller_accounts", "host_verified_at", timestamp_type)))
            if "host_note" not in columns:
                conn.execute(text(add_column_sql("storyteller_accounts", "host_note", "TEXT")))
    except Exception as exc:
        print(f"帳號綁定資料庫欄位補齊失敗: {exc}")


ensure_binding_schema()


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _sign(value: str) -> str:
    return hmac.new(SESSION_SECRET.encode("utf-8"), value.encode("utf-8"), hashlib.sha256).hexdigest()


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


def get_optional_account(request: Request, db: Session = Depends(get_db)) -> Optional[models.StorytellerAccount]:
    session = read_session_cookie(request)
    if not session:
        return None
    account_id = session.get("account_id")
    if not account_id:
        return None
    return db.query(models.StorytellerAccount).filter(models.StorytellerAccount.id == account_id).first()


def require_admin_account(account: Optional[models.StorytellerAccount] = Depends(get_optional_account)) -> models.StorytellerAccount:
    if not account:
        raise HTTPException(status_code=401, detail="請先使用 LINE 登入")
    if account.line_user_id not in ADMIN_LINE_USER_IDS:
        raise HTTPException(status_code=403, detail="沒有管理後台權限")
    return account


def serialize_datetime(value):
    return value.isoformat() if value else None


def serialize_player(player: Optional[models.Player]):
    if not player:
        return None
    return {
        "id": player.id,
        "name": player.name,
        "created_at": serialize_datetime(player.created_at),
    }


def account_aliases(db: Session, account_id: int):
    rows = (
        db.query(models.RoomPlayer, models.GameRoom)
        .join(models.GameRoom, models.RoomPlayer.room_id == models.GameRoom.id)
        .filter(models.RoomPlayer.account_id == account_id)
        .order_by(models.RoomPlayer.joined_at.desc())
        .limit(12)
        .all()
    )
    aliases = []
    latest_rooms = []
    seen_alias = set()
    for entry, room in rows:
        name = (entry.display_name or "").strip()
        if name and name not in seen_alias:
            aliases.append(name)
            seen_alias.add(name)
        latest_rooms.append({
            "room_code": room.room_code,
            "title": room.title,
            "script": room.script,
            "date": room.date.date().isoformat() if room.date else None,
            "display_name": entry.display_name,
            "seat_number": entry.seat_number,
            "joined_at": serialize_datetime(entry.joined_at),
        })
    return aliases, latest_rooms


def serialize_account(db: Session, account: models.StorytellerAccount):
    aliases, latest_rooms = account_aliases(db, account.id)
    return {
        "id": account.id,
        "line_user_id": account.line_user_id,
        "display_name": account.display_name,
        "picture_url": account.picture_url,
        "player_id": getattr(account, "player_id", None),
        "player": serialize_player(getattr(account, "player", None)),
        "can_host": bool(getattr(account, "can_host", True)),
        "host_verified_at": serialize_datetime(getattr(account, "host_verified_at", None)),
        "host_note": getattr(account, "host_note", None),
        "is_allowed": bool(getattr(account, "is_allowed", False)),
        "is_banned": bool(getattr(account, "is_banned", False)),
        "created_at": serialize_datetime(account.created_at),
        "last_login_at": serialize_datetime(account.last_login_at),
        "aliases": aliases,
        "latest_rooms": latest_rooms,
    }


@router.get("")
async def list_account_bindings(unbound_only: bool = False, q: str = "", db: Session = Depends(get_db), admin: models.StorytellerAccount = Depends(require_admin_account)):
    query = db.query(models.StorytellerAccount).options(joinedload(models.StorytellerAccount.player))
    if unbound_only:
        query = query.filter(models.StorytellerAccount.player_id.is_(None))
    accounts = query.order_by(models.StorytellerAccount.last_login_at.desc()).all()
    keyword = (q or "").strip().lower()
    if keyword:
        filtered = []
        for account in accounts:
            aliases, _rooms = account_aliases(db, account.id)
            haystack = " ".join([
                account.display_name or "",
                account.line_user_id or "",
                account.player.name if account.player else "",
                " ".join(aliases),
            ]).lower()
            if keyword in haystack:
                filtered.append(account)
        accounts = filtered
    return [serialize_account(db, account) for account in accounts]


@router.get("/players")
async def search_players(q: str = "", limit: int = 30, db: Session = Depends(get_db), admin: models.StorytellerAccount = Depends(require_admin_account)):
    query = db.query(models.Player)
    keyword = (q or "").strip()
    if keyword:
        query = query.filter(models.Player.name.ilike(f"%{keyword}%"))
    players = query.order_by(models.Player.name.asc()).limit(max(1, min(limit, 100))).all()
    return [serialize_player(player) for player in players]


@router.patch("/{account_id}")
async def bind_account(account_id: int, data: dict, db: Session = Depends(get_db), admin: models.StorytellerAccount = Depends(require_admin_account)):
    account = db.query(models.StorytellerAccount).filter(models.StorytellerAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="找不到此 LINE 帳號")

    if "player_id" in data:
        raw_player_id = data.get("player_id")
        if raw_player_id in (None, "", 0, "0"):
            account.player_id = None
        else:
            player_id = int(raw_player_id)
            player = db.query(models.Player).filter(models.Player.id == player_id).first()
            if not player:
                raise HTTPException(status_code=404, detail="找不到此玩家資料")
            duplicate = db.query(models.StorytellerAccount).filter(models.StorytellerAccount.player_id == player.id, models.StorytellerAccount.id != account.id).first()
            if duplicate:
                raise HTTPException(status_code=400, detail=f"此玩家已綁定到 {duplicate.display_name or duplicate.line_user_id}")
            account.player_id = player.id

    if "can_host" in data:
        account.can_host = bool(data.get("can_host"))
        if account.can_host and not account.host_verified_at:
            account.host_verified_at = datetime.now()
        if not account.can_host:
            account.host_verified_at = None
    if "host_note" in data:
        account.host_note = data.get("host_note")

    db.commit()
    db.refresh(account)
    account = db.query(models.StorytellerAccount).options(joinedload(models.StorytellerAccount.player)).filter(models.StorytellerAccount.id == account.id).first()
    return {"status": "success", "account": serialize_account(db, account)}


@router.post("/{account_id}/create-player")
async def create_player_for_account(account_id: int, data: dict, db: Session = Depends(get_db), admin: models.StorytellerAccount = Depends(require_admin_account)):
    account = db.query(models.StorytellerAccount).filter(models.StorytellerAccount.id == account_id).first()
    if not account:
        raise HTTPException(status_code=404, detail="找不到此 LINE 帳號")
    name = (data.get("name") or account.display_name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="玩家名稱不可空白")
    existing = db.query(models.Player).filter(models.Player.name == name).first()
    if existing:
        duplicate = db.query(models.StorytellerAccount).filter(models.StorytellerAccount.player_id == existing.id, models.StorytellerAccount.id != account.id).first()
        if duplicate:
            raise HTTPException(status_code=400, detail=f"此玩家已綁定到 {duplicate.display_name or duplicate.line_user_id}")
        account.player_id = existing.id
    else:
        player = models.Player(name=name)
        db.add(player)
        db.flush()
        account.player_id = player.id
    db.commit()
    db.refresh(account)
    account = db.query(models.StorytellerAccount).options(joinedload(models.StorytellerAccount.player)).filter(models.StorytellerAccount.id == account.id).first()
    return {"status": "success", "account": serialize_account(db, account)}
