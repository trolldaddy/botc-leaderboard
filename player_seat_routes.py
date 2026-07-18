from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

import models
from database import get_db
from room_routes import (
    ensure_room_player_device_schema,
    get_optional_account,
    normalize_device_token,
    reload_room,
    serialize_room,
    serialize_room_player,
)

router = APIRouter(prefix="/api/rooms", tags=["town-checkin-player-seat"])


def build_room_permissions(
    room: models.GameRoom,
    account: Optional[models.StorytellerAccount],
) -> dict:
    is_owner = bool(account and room.created_by_id == account.id)
    return {
        "is_owner": is_owner,
        "can_manage_players": is_owner,
        "can_manage_room": is_owner,
    }


def can_manage_own_seat(
    room: models.GameRoom,
    entry: models.RoomPlayer,
    account: Optional[models.StorytellerAccount],
    device_token: Optional[str],
) -> bool:
    if account and room.created_by_id == account.id:
        return True
    if account and entry.account_id == account.id:
        return True
    if device_token and getattr(entry, "device_token", None) == device_token:
        return True
    return False


@router.get("/{room_code}/permissions")
async def get_room_permissions(
    room_code: str,
    db: Session = Depends(get_db),
    account: Optional[models.StorytellerAccount] = Depends(get_optional_account),
):
    room = db.query(models.GameRoom).filter(
        models.GameRoom.room_code == room_code.upper()
    ).first()
    if not room:
        raise HTTPException(status_code=404, detail="找不到房間")

    return build_room_permissions(room, account)


@router.patch("/{room_code}/players/{room_player_id}/seat")
async def update_own_seat(
    room_code: str,
    room_player_id: int,
    data: dict,
    request: Request,
    db: Session = Depends(get_db),
    account: Optional[models.StorytellerAccount] = Depends(get_optional_account),
):
    ensure_room_player_device_schema(db)

    room = db.query(models.GameRoom).filter(
        models.GameRoom.room_code == room_code.upper()
    ).first()
    if not room:
        raise HTTPException(status_code=404, detail="找不到房間")

    entry = db.query(models.RoomPlayer).filter(
        models.RoomPlayer.room_id == room.id,
        models.RoomPlayer.id == room_player_id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="找不到玩家")

    device_token = normalize_device_token(
        data.get("device_token")
        or data.get("deviceToken")
        or request.headers.get("X-BOTC-Device-Token")
    )
    if not can_manage_own_seat(room, entry, account, device_token):
        raise HTTPException(status_code=403, detail="你只能修改自己的座號")

    raw_seat = data.get("seat_number")
    try:
        seat = int(raw_seat) if raw_seat not in (None, "") else None
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="座號格式錯誤")

    if seat is not None and not 1 <= seat <= 20:
        raise HTTPException(status_code=400, detail="座號必須介於 1 到 20")

    if seat is not None:
        conflict = db.query(models.RoomPlayer).filter(
            models.RoomPlayer.room_id == room.id,
            models.RoomPlayer.seat_number == seat,
            models.RoomPlayer.id != entry.id,
        ).first()
        if conflict:
            raise HTTPException(status_code=400, detail="此座號已被使用")

    entry.seat_number = seat
    db.commit()
    db.refresh(entry)
    room = reload_room(db, room.id)

    return {
        "status": "success",
        "player": serialize_room_player(entry),
        "room": serialize_room(room),
        "permissions": build_room_permissions(room, account),
    }
