import base64
import hashlib
import hmac
import json
import os
import time
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

import models
from database import get_db

router = APIRouter(tags=["match-upload"])

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "mmmm")
SESSION_SECRET = os.getenv("SESSION_SECRET") or ADMIN_PASSWORD
SESSION_COOKIE = "botc_session"
ALLOWED_LINE_USER_IDS = {item.strip() for item in os.getenv("ALLOWED_LINE_USER_IDS", "").split(",") if item.strip()}
UPLOAD_LIMIT_PER_24H = int(os.getenv("UPLOAD_LIMIT_PER_24H", "10"))


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


def account_can_upload(account: models.StorytellerAccount) -> bool:
    if bool(getattr(account, "is_banned", False)):
        return False
    if ALLOWED_LINE_USER_IDS:
        return account.line_user_id in ALLOWED_LINE_USER_IDS or bool(getattr(account, "is_allowed", False))
    return True


def require_upload_account(account: Optional[models.StorytellerAccount] = Depends(get_optional_account)) -> models.StorytellerAccount:
    if not account:
        raise HTTPException(status_code=401, detail="請先使用 LINE 登入")
    if not account_can_upload(account):
        if bool(getattr(account, "is_banned", False)):
            raise HTTPException(status_code=403, detail="此 LINE 帳號已被停權，無法上傳戰績")
        raise HTTPException(status_code=403, detail="此 LINE 帳號尚未開通上傳權限")
    return account


def enforce_upload_rate_limit(db: Session, account: models.StorytellerAccount):
    since = datetime.now() - timedelta(hours=24)
    recent_uploads = db.query(models.Match).filter(models.Match.uploaded_by_id == account.id, models.Match.created_at >= since).count()
    if recent_uploads >= UPLOAD_LIMIT_PER_24H:
        raise HTTPException(status_code=429, detail=f"此 LINE 帳號 24 小時內最多只能上傳 {UPLOAD_LIMIT_PER_24H} 筆紀錄")


def resolve_player(db: Session, payload: dict) -> Optional[models.Player]:
    raw_player_id = payload.get("player_id") or payload.get("playerId")
    if raw_player_id not in (None, "", 0, "0"):
        player = db.query(models.Player).filter(models.Player.id == int(raw_player_id)).first()
        if player:
            return player

    raw_account_id = payload.get("account_id") or payload.get("accountId")
    if raw_account_id not in (None, "", 0, "0"):
        account = db.query(models.StorytellerAccount).filter(models.StorytellerAccount.id == int(raw_account_id)).first()
        if account and getattr(account, "player_id", None):
            player = db.query(models.Player).filter(models.Player.id == account.player_id).first()
            if player:
                return player

    name = (payload.get("player_name") or payload.get("name") or "").strip()
    if not name:
        return None
    player = db.query(models.Player).filter(models.Player.name == name).first()
    if not player:
        player = models.Player(name=name)
        db.add(player)
        db.flush()
    return player


@router.post("/api/matches")
async def create_match_with_player_binding(data: dict, db: Session = Depends(get_db), uploader: models.StorytellerAccount = Depends(require_upload_account)):
    try:
        enforce_upload_rate_limit(db, uploader)
        match = models.Match(
            script=data.get("script"),
            date=datetime.strptime(data.get("date"), "%Y-%m-%d") if data.get("date") else datetime.now(),
            location=data.get("location"),
            storyteller=data.get("storyteller"),
            winning_team=data.get("winning_team"),
            replay_log=data.get("replay_log"),
            uploaded_by_id=uploader.id,
            created_at=datetime.now(),
        )
        db.add(match)
        db.flush()

        for p in data.get("players", []):
            player = resolve_player(db, p)
            if not player:
                continue
            survived = p.get("survived")
            if survived is None:
                survived = p.get("status") != "dead"
            db.add(models.MatchPlayer(
                match_id=match.id,
                player_id=player.id,
                seat_number=p.get("seat_number") or p.get("seat"),
                initial_character=p.get("initial_character") or p.get("initial_role"),
                final_character=p.get("final_character") or p.get("final_role"),
                alignment=p.get("alignment"),
                survived=bool(survived),
            ))
        db.commit()
        return {"status": "success", "match_id": match.id, "binding_aware": True}
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        print(f"上傳失敗: {exc}")
        raise HTTPException(status_code=500, detail=str(exc))
