import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from datetime import datetime
from urllib.parse import urlencode

import requests
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

import models
from database import get_db

router = APIRouter(tags=["line-login-override"])

ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "mmmm")
SESSION_SECRET = os.getenv("SESSION_SECRET") or ADMIN_PASSWORD
LINE_CHANNEL_ID = os.getenv("LINE_CHANNEL_ID", "")
LINE_CHANNEL_SECRET = os.getenv("LINE_CHANNEL_SECRET", "")
LINE_CALLBACK_URL = os.getenv("LINE_CALLBACK_URL", "")
ALLOWED_LINE_USER_IDS = {
    item.strip()
    for item in os.getenv("ALLOWED_LINE_USER_IDS", "").split(",")
    if item.strip()
}
SESSION_COOKIE = "botc_session"
SESSION_MAX_AGE = 60 * 60 * 24 * 30
OAUTH_STATE_MAX_AGE = 10 * 60


def _b64encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")


def _b64decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _sign(value: str) -> str:
    return hmac.new(
        SESSION_SECRET.encode("utf-8"),
        value.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()


def _make_signed_token(payload: dict) -> str:
    body = _b64encode(
        json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    )
    return f"{body}.{_sign(body)}"


def _read_signed_token(token: str) -> dict | None:
    if not token or "." not in token:
        return None
    body, signature = token.rsplit(".", 1)
    if not hmac.compare_digest(_sign(body), signature):
        return None
    try:
        payload = json.loads(_b64decode(body).decode("utf-8"))
    except Exception:
        return None
    if int(payload.get("exp", 0)) < int(time.time()):
        return None
    return payload


def _safe_next_url(value: str) -> str:
    value = (value or "").strip()
    if not value.startswith("/") or value.startswith("//"):
        return "/#record"
    return value


def create_session_cookie(account_id: int) -> str:
    return _make_signed_token(
        {
            "account_id": account_id,
            "exp": int(time.time()) + SESSION_MAX_AGE,
        }
    )


def is_secure_request(request: Request) -> bool:
    return request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"


def line_callback_url(request: Request) -> str:
    return LINE_CALLBACK_URL or str(request.url_for("line_callback_mobile_safe"))


@router.get("/auth/line/login")
@router.get("/api/auth/line/login")
async def line_login_with_bot_prompt(
    request: Request,
    next: str = "/#record",
    switch_account: bool = False,
):
    if not LINE_CHANNEL_ID or not LINE_CHANNEL_SECRET:
        raise HTTPException(
            status_code=500,
            detail="尚未設定 LINE_CHANNEL_ID 或 LINE_CHANNEL_SECRET",
        )

    state = _make_signed_token(
        {
            "nonce": secrets.token_urlsafe(24),
            "next": _safe_next_url(next),
            "exp": int(time.time()) + OAUTH_STATE_MAX_AGE,
        }
    )
    params = {
        "response_type": "code",
        "client_id": LINE_CHANNEL_ID,
        "redirect_uri": line_callback_url(request),
        "state": state,
        "scope": "profile openid",
        "bot_prompt": "normal",
    }
    if switch_account:
        params["disable_auto_login"] = "true"
    return RedirectResponse(
        f"https://access.line.me/oauth2/v2.1/authorize?{urlencode(params)}"
    )


@router.get("/auth/line/callback", name="line_callback_mobile_safe")
async def line_callback_mobile_safe(
    request: Request,
    code: str = "",
    state: str = "",
    db: Session = Depends(get_db),
):
    state_payload = _read_signed_token(state)
    if not state_payload:
        raise HTTPException(
            status_code=400,
            detail="LINE 登入狀態驗證失敗或已逾時，請重新登入",
        )
    if not code:
        raise HTTPException(status_code=400, detail="LINE 未回傳授權碼")

    callback_url = line_callback_url(request)
    try:
        token_resp = requests.post(
            "https://api.line.me/oauth2/v2.1/token",
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": callback_url,
                "client_id": LINE_CHANNEL_ID,
                "client_secret": LINE_CHANNEL_SECRET,
            },
            timeout=10,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail="LINE token 服務暫時無法連線") from exc

    if not token_resp.ok:
        raise HTTPException(status_code=400, detail="LINE token 換取失敗")
    access_token = token_resp.json().get("access_token")
    if not access_token:
        raise HTTPException(status_code=400, detail="LINE 未回傳 access token")

    try:
        profile_resp = requests.get(
            "https://api.line.me/v2/profile",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=10,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail="LINE 個人資料服務暫時無法連線") from exc

    if not profile_resp.ok:
        raise HTTPException(status_code=400, detail="LINE 個人資料讀取失敗")

    profile = profile_resp.json()
    line_user_id = profile.get("userId")
    display_name = profile.get("displayName") or "LINE 使用者"
    picture_url = profile.get("pictureUrl")
    if not line_user_id:
        raise HTTPException(status_code=400, detail="LINE 未回傳 userId")

    account = (
        db.query(models.StorytellerAccount)
        .filter(models.StorytellerAccount.line_user_id == line_user_id)
        .first()
    )
    now = datetime.now()
    if account:
        account.display_name = display_name
        account.picture_url = picture_url
        account.last_login_at = now
    else:
        account = models.StorytellerAccount(
            line_user_id=line_user_id,
            display_name=display_name,
            picture_url=picture_url,
            is_allowed=(not ALLOWED_LINE_USER_IDS)
            or (line_user_id in ALLOWED_LINE_USER_IDS),
            last_login_at=now,
        )
        db.add(account)

    db.commit()
    db.refresh(account)

    response = RedirectResponse(_safe_next_url(state_payload.get("next", "/#record")))
    response.set_cookie(
        SESSION_COOKIE,
        create_session_cookie(account.id),
        max_age=SESSION_MAX_AGE,
        httponly=True,
        secure=is_secure_request(request),
        samesite="lax",
    )
    return response
