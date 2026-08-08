import os
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
    require_account,
)

router = APIRouter(prefix="/api/rooms", tags=["town-checkin-player-seat"])


def can_reclaim_room_owner(account: Optional[models.StorytellerAccount]) -> bool:
    admin_ids = {
        item.strip()
        for item in os.getenv("ADMIN_LINE_USER_IDS", "").split(",")
        if item.strip()
    }
    return bool(account and account.line_user_id in admin_ids)


def build_room_permissions(
    room: models.GameRoom,
    account: Optional[models.StorytellerAccount],
) -> dict:
    is_owner = bool(account and room.created_by_id == account.id)
    return {
        "authenticated": bool(account),
        "current_account_display_name": account.display_name if account else None,
        "is_owner": is_owner,
        "can_manage_players": is_owner,
        "can_manage_room": is_owner,
        "can_reclaim_owner": bool(not is_owner and can_reclaim_room_owner(account)),
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


@router.post("/{room_code}/reclaim-owner")
async def reclaim_room_owner(
    room_code: str,
    data: dict,
    db: Session = Depends(get_db),
    account: models.StorytellerAccount = Depends(require_account),
):
    if not can_reclaim_room_owner(account):
        raise HTTPException(status_code=403, detail="只有管理員可以恢復房主權限")

    room = db.query(models.GameRoom).filter(
        models.GameRoom.room_code == room_code.upper()
    ).first()
    if not room:
        raise HTTPException(status_code=404, detail="找不到房間")

    if str(data.get("confirm_room_code", "")).strip().upper() != room.room_code:
        raise HTTPException(status_code=400, detail="房號確認不符")

    creator = db.query(models.StorytellerAccount).filter(
        models.StorytellerAccount.id == room.created_by_id
    ).first()
    creator_name = (creator.display_name if creator else "").strip()
    account_name = (account.display_name or "").strip()
    if not creator_name or creator_name != account_name:
        raise HTTPException(status_code=403, detail="目前帳號與原房主資料不符")

    account_player = db.query(models.RoomPlayer).filter(
        models.RoomPlayer.room_id == room.id,
        models.RoomPlayer.account_id == account.id,
        models.RoomPlayer.is_temporary.is_(False),
    ).first()
    if not account_player:
        raise HTTPException(status_code=403, detail="目前帳號尚未以 LINE 加入此房間")

    previous_owner_id = room.created_by_id
    room.created_by_id = account.id
    db.commit()
    room = reload_room(db, room.id)

    return {
        "status": "success",
        "previous_owner_id": previous_owner_id,
        "room": serialize_room(room),
        "permissions": build_room_permissions(room, account),
    }


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
