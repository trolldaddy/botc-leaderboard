import os
import secrets
from urllib.parse import urlencode

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse

router = APIRouter(tags=["line-login-override"])

LINE_CHANNEL_ID = os.getenv("LINE_CHANNEL_ID", "")
LINE_CHANNEL_SECRET = os.getenv("LINE_CHANNEL_SECRET", "")
LINE_CALLBACK_URL = os.getenv("LINE_CALLBACK_URL", "")
LINE_STATE_COOKIE = "botc_line_state"
LINE_NEXT_COOKIE = "botc_line_next"


def is_secure_request(request: Request) -> bool:
    return request.url.scheme == "https" or request.headers.get("x-forwarded-proto") == "https"


def line_callback_url(request: Request) -> str:
    return LINE_CALLBACK_URL or str(request.url_for("line_callback"))


@router.get("/auth/line/login")
@router.get("/api/auth/line/login")
async def line_login_with_bot_prompt(request: Request, next: str = "/#record"):
    if not LINE_CHANNEL_ID or not LINE_CHANNEL_SECRET:
        raise HTTPException(status_code=500, detail="尚未設定 LINE_CHANNEL_ID 或 LINE_CHANNEL_SECRET")

    state = secrets.token_urlsafe(24)
    params = {
        "response_type": "code",
        "client_id": LINE_CHANNEL_ID,
        "redirect_uri": line_callback_url(request),
        "state": state,
        "scope": "profile openid",
        # 登入流程中順便提示玩家加入已連結的 LINE 官方帳號。
        "bot_prompt": "normal",
    }
    response = RedirectResponse(f"https://access.line.me/oauth2/v2.1/authorize?{urlencode(params)}")
    secure = is_secure_request(request)
    response.set_cookie(LINE_STATE_COOKIE, state, max_age=600, httponly=True, secure=secure, samesite="lax")
    response.set_cookie(LINE_NEXT_COOKIE, next or "/#record", max_age=600, httponly=True, secure=secure, samesite="lax")
    return response
