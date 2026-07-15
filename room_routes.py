import base64
import hashlib
import hmac
import json
import os
import secrets
import string
import time
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload

import models
from database import get_db

router = APIRouter(prefix="/api/rooms", tags=["town-checkin"])

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "mmmm")
SESSION_SECRET = os.getenv("SESSION_SECRET") or ADMIN_PASSWORD
SESSION_COOKIE = "botc_session"


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


def generate_room_code(db: Session) -> str:
    alphabet = string.ascii_uppercase + string.digits
    for _ in range(30):
        code = "".join(secrets.choice(alphabet) for _ in range(5))
        if not db.query(models.GameRoom).filter(models.GameRoom.room_code == code).first():
            return code
    raise HTTPException(status_code=500, detail="無法產生房間代碼")


def serialize_account(account: Optional[models.StorytellerAccount]):
    if not account:
        return None
    return {
        "id": account.id,
        "line_user_id": account.line_user_id,
        "display_name": account.display_name,
        "picture_url": account.picture_url,
    }


def serialize_room_player(entry: models.RoomPlayer):
    return {
        "id": entry.id,
        "room_id": entry.room_id,
        "account_id": entry.account_id,
        "line_user_id": entry.account.line_user_id if entry.account else None,
        "picture_url": entry.account.picture_url if entry.account else None,
        "seat_number": entry.seat_number,
        "display_name": entry.display_name,
        "name": entry.display_name,
        "is_temporary": bool(entry.is_temporary),
        "joined_at": entry.joined_at.isoformat() if entry.joined_at else None,
    }


def serialize_room(room: models.GameRoom):
    return {
        "id": room.id,
        "room_code": room.room_code,
        "title": room.title,
        "script": room.script,
        "date": room.date.date().isoformat() if room.date else None,
        "location": room.location,
        "storyteller": room.storyteller,
        "status": room.status,
        "created_at": room.created_at.isoformat() if room.created_at else None,
        "players": [
            serialize_room_player(p)
            for p in sorted(room.players, key=lambda p: (p.seat_number is None, p.seat_number or 999, p.joined_at or datetime.now()))
        ],
    }


@router.post("")
async def create_room(data: dict, db: Session = Depends(get_db), account: Optional[models.StorytellerAccount] = Depends(get_optional_account)):
    code = generate_room_code(db)
    date_value = data.get("date")
    try:
        date = datetime.strptime(date_value, "%Y-%m-%d") if date_value else datetime.now()
    except Exception:
        raise HTTPException(status_code=400, detail="日期格式需為 YYYY-MM-DD")

    room = models.GameRoom(
        room_code=code,
        title=(data.get("title") or "小鎮報到").strip(),
        script=(data.get("script") or "").strip() or None,
        date=date,
        location=(data.get("location") or "拉普拉斯").strip(),
        storyteller=(data.get("storyteller") or (account.display_name if account else "")).strip() or None,
        status="open",
        created_by_id=account.id if account else None,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
    db.add(room)
    db.commit()
    db.refresh(room)
    return {"status": "success", "room": serialize_room(room)}


@router.get("/{room_code}")
async def get_room(room_code: str, db: Session = Depends(get_db)):
    room = db.query(models.GameRoom).options(joinedload(models.GameRoom.players).joinedload(models.RoomPlayer.account)).filter(models.GameRoom.room_code == room_code.upper()).first()
    if not room:
        raise HTTPException(status_code=404, detail="找不到房間")
    return serialize_room(room)


@router.post("/{room_code}/join")
async def join_room(room_code: str, data: dict, db: Session = Depends(get_db), account: Optional[models.StorytellerAccount] = Depends(get_optional_account)):
    room = db.query(models.GameRoom).options(joinedload(models.GameRoom.players)).filter(models.GameRoom.room_code == room_code.upper()).first()
    if not room:
        raise HTTPException(status_code=404, detail="找不到房間")
    if room.status != "open":
        raise HTTPException(status_code=400, detail="房間已鎖定，無法加入")

    is_temporary = bool(data.get("is_temporary")) or account is None
    display_name = (data.get("display_name") or data.get("name") or (account.display_name if account else "")).strip()
    if not display_name:
        raise HTTPException(status_code=400, detail="請輸入玩家名稱")

    if account and not is_temporary:
        existing = db.query(models.RoomPlayer).filter(models.RoomPlayer.room_id == room.id, models.RoomPlayer.account_id == account.id).first()
        if existing:
            existing.display_name = display_name
            existing.is_temporary = False
            db.commit()
            db.refresh(existing)
            return {"status": "success", "player": serialize_room_player(existing), "room": serialize_room(room)}

    entry = models.RoomPlayer(
        room_id=room.id,
        account_id=account.id if account and not is_temporary else None,
        display_name=display_name,
        is_temporary=is_temporary,
        joined_at=datetime.now(),
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    room = db.query(models.GameRoom).options(joinedload(models.GameRoom.players).joinedload(models.RoomPlayer.account)).filter(models.GameRoom.id == room.id).first()
    return {"status": "success", "player": serialize_room_player(entry), "room": serialize_room(room)}


@router.patch("/{room_code}/players/{room_player_id}")
async def update_room_player(room_code: str, room_player_id: int, data: dict, db: Session = Depends(get_db)):
    room = db.query(models.GameRoom).filter(models.GameRoom.room_code == room_code.upper()).first()
    if not room:
        raise HTTPException(status_code=404, detail="找不到房間")
    entry = db.query(models.RoomPlayer).filter(models.RoomPlayer.room_id == room.id, models.RoomPlayer.id == room_player_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="找不到玩家")

    if "display_name" in data:
        name = (data.get("display_name") or "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="玩家名稱不可空白")
        entry.display_name = name

    if "seat_number" in data:
        raw_seat = data.get("seat_number")
        seat = int(raw_seat) if raw_seat not in (None, "") else None
        if seat is not None:
            conflict = db.query(models.RoomPlayer).filter(models.RoomPlayer.room_id == room.id, models.RoomPlayer.seat_number == seat, models.RoomPlayer.id != entry.id).first()
            if conflict:
                raise HTTPException(status_code=400, detail="此座號已被分配")
        entry.seat_number = seat

    db.commit()
    db.refresh(entry)
    room = db.query(models.GameRoom).options(joinedload(models.GameRoom.players).joinedload(models.RoomPlayer.account)).filter(models.GameRoom.id == room.id).first()
    return {"status": "success", "player": serialize_room_player(entry), "room": serialize_room(room)}


@router.delete("/{room_code}/players/{room_player_id}")
async def delete_room_player(room_code: str, room_player_id: int, db: Session = Depends(get_db)):
    room = db.query(models.GameRoom).filter(models.GameRoom.room_code == room_code.upper()).first()
    if not room:
        raise HTTPException(status_code=404, detail="找不到房間")
    entry = db.query(models.RoomPlayer).filter(models.RoomPlayer.room_id == room.id, models.RoomPlayer.id == room_player_id).first()
    if not entry:
        raise HTTPException(status_code=404, detail="找不到玩家")
    db.delete(entry)
    db.commit()
    return {"status": "success"}


@router.patch("/{room_code}")
async def update_room(room_code: str, data: dict, db: Session = Depends(get_db)):
    room = db.query(models.GameRoom).filter(models.GameRoom.room_code == room_code.upper()).first()
    if not room:
        raise HTTPException(status_code=404, detail="找不到房間")
    for field in ["title", "script", "location", "storyteller", "status"]:
        if field in data:
            setattr(room, field, data.get(field))
    if data.get("date"):
        try:
            room.date = datetime.strptime(data.get("date"), "%Y-%m-%d")
        except Exception:
            raise HTTPException(status_code=400, detail="日期格式需為 YYYY-MM-DD")
    room.updated_at = datetime.now()
    db.commit()
    db.refresh(room)
    room = db.query(models.GameRoom).options(joinedload(models.GameRoom.players).joinedload(models.RoomPlayer.account)).filter(models.GameRoom.id == room.id).first()
    return {"status": "success", "room": serialize_room(room)}
