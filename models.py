from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

# ==========================================
# 1. 玩家主表 (Players)
# 儲存玩家的基本身份，確保每個暱稱對應唯一的 UID
# ==========================================
class Player(Base):
    __tablename__ = "players"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.now)

    match_history = relationship("MatchPlayer", back_populates="player")
    linked_accounts = relationship("StorytellerAccount", back_populates="player")


# ==========================================
# 2. LINE 登入帳號 (StorytellerAccounts)
# 早期命名沿用 StorytellerAccount；實際上現在代表任何 LINE 登入者。
# player_id 用來把 LINE 帳號綁定到既有玩家戰績身份。
# can_host 先預留主持/開房認證權限，目前不強制限制。
# ==========================================
class StorytellerAccount(Base):
    __tablename__ = "storyteller_accounts"

    id = Column(Integer, primary_key=True, index=True)
    line_user_id = Column(String, unique=True, index=True, nullable=False)
    display_name = Column(String, nullable=True)
    picture_url = Column(Text, nullable=True)
    player_id = Column(Integer, ForeignKey("players.id"), nullable=True, unique=True)
    can_host = Column(Boolean, default=True)
    host_verified_at = Column(DateTime, nullable=True)
    host_note = Column(Text, nullable=True)
    is_allowed = Column(Boolean, default=False)
    is_banned = Column(Boolean, default=False)
    banned_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    last_login_at = Column(DateTime, default=datetime.now)

    uploaded_matches = relationship("Match", back_populates="uploader")
    checkin_entries = relationship("RoomPlayer", back_populates="account")
    player = relationship("Player", back_populates="linked_accounts")


# ==========================================
# 3. 地點 / 線上社群資料 (Locations)
# 用於公開宣傳店家、Discord、社群與開團資訊
# ==========================================
class Location(Base):
    __tablename__ = "locations"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)
    type = Column(String, default="store")
    address = Column(Text, nullable=True)
    link_url = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    schedule_note = Column(Text, nullable=True)
    contact_note = Column(Text, nullable=True)
    is_public = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)


# ==========================================
# 4. 小鎮報到房間 (GameRooms)
# 說書人開房後，玩家可掃 QR 報到，再由說書人分配座號
# ==========================================
class GameRoom(Base):
    __tablename__ = "game_rooms"

    id = Column(Integer, primary_key=True, index=True)
    room_code = Column(String, unique=True, index=True, nullable=False)
    title = Column(String, nullable=True)
    script = Column(String, nullable=True)
    date = Column(DateTime, default=datetime.now)
    location = Column(String, default="拉普拉斯")
    storyteller = Column(String, nullable=True)
    status = Column(String, default="open", index=True)
    created_by_id = Column(Integer, ForeignKey("storyteller_accounts.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)

    players = relationship("RoomPlayer", back_populates="room", cascade="all, delete-orphan")
    creator = relationship("StorytellerAccount")


# ==========================================
# 5. 小鎮報到玩家 (RoomPlayers)
# 記錄玩家加入房間與座號分配，可為 LINE 玩家或臨時玩家
# device_token 是每支手機瀏覽器的本機報到識別碼，用來避免同手機重複加入。
# ==========================================
class RoomPlayer(Base):
    __tablename__ = "room_players"
    __table_args__ = (
        UniqueConstraint("room_id", "account_id", name="uq_room_player_account"),
        UniqueConstraint("room_id", "seat_number", name="uq_room_player_seat"),
    )

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("game_rooms.id"), nullable=False)
    account_id = Column(Integer, ForeignKey("storyteller_accounts.id"), nullable=True)
    device_token = Column(String, index=True, nullable=True)
    seat_number = Column(Integer, nullable=True)
    display_name = Column(String, nullable=False)
    is_temporary = Column(Boolean, default=False)
    joined_at = Column(DateTime, default=datetime.now)

    room = relationship("GameRoom", back_populates="players")
    account = relationship("StorytellerAccount", back_populates="checkin_entries")


# ==========================================
# 6. 對局總表 (Matches)
# 儲存每一場遊戲的環境資訊（時間、地點、劇本、結果）
# ==========================================
class Match(Base):
    __tablename__ = "matches"

    id = Column(Integer, primary_key=True, index=True)
    script = Column(String, index=True)
    date = Column(DateTime, default=datetime.now)
    location = Column(String, default="未知", index=True)
    storyteller = Column(String)
    winning_team = Column(String)
    replay_log = Column(Text, nullable=True)
    uploaded_by_id = Column(Integer, ForeignKey("storyteller_accounts.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.now)

    players = relationship("MatchPlayer", back_populates="match", cascade="all, delete-orphan")
    uploader = relationship("StorytellerAccount", back_populates="uploaded_matches")


# ==========================================
# 7. 對局表現紀錄表 (MatchPlayers)
# 核心關聯表：記錄「哪個玩家」在「哪一局」中玩了「什麼角色」
# ==========================================
class MatchPlayer(Base):
    __tablename__ = "match_players"

    id = Column(Integer, primary_key=True, index=True)
    match_id = Column(Integer, ForeignKey("matches.id"))
    player_id = Column(Integer, ForeignKey("players.id"))
    seat_number = Column(Integer, nullable=True)
    initial_character = Column(String)
    final_character = Column(String)
    alignment = Column(String)
    survived = Column(Boolean)

    player = relationship("Player", back_populates="match_history")
    match = relationship("Match", back_populates="players")

    @property
    def is_win(self):
        if not self.match:
            return False
        return self.alignment == self.match.winning_team


# ==========================================
# 測試分支：小鎮報到 / 帳號綁定 API 自動掛載器
# main.py 是大型入口檔，為避免整檔覆蓋風險，這裡在 FastAPI app 建立時自動掛上額外 router。
# 等功能穩定合併前，可再改成 main.py 裡明確 app.include_router(...)
# ==========================================
def _install_town_checkin_router_patch():
    try:
        import fastapi
    except Exception as exc:
        print(f"小鎮報到 API 掛載器初始化失敗: {exc}")
        return

    if getattr(fastapi.FastAPI, "_botc_town_checkin_router_patch", False):
        return

    original_init = fastapi.FastAPI.__init__

    def patched_init(self, *args, **kwargs):
        original_init(self, *args, **kwargs)
        try:
            import line_login_override_routes
            self.include_router(line_login_override_routes.router)
            print("LINE 登入提示官方帳號 API 已掛載: /auth/line/login")
        except Exception as exc:
            print(f"LINE 登入提示官方帳號 API 掛載失敗: {exc}")
        try:
            import match_override_routes
            self.include_router(match_override_routes.router)
            print("綁定感知上傳 API 已掛載: /api/matches")
        except Exception as exc:
            print(f"綁定感知上傳 API 掛載失敗: {exc}")
        try:
            import room_routes
            self.include_router(room_routes.router)
            print("小鎮報到 API 已掛載: /api/rooms")
        except Exception as exc:
            print(f"小鎮報到 API 掛載失敗: {exc}")
        try:
            import player_seat_routes
            self.include_router(player_seat_routes.router)
            print("玩家自選座號 API 已掛載: /api/rooms/{room_code}/players/{id}/seat")
        except Exception as exc:
            print(f"玩家自選座號 API 掛載失敗: {exc}")
        try:
            import account_binding_routes
            self.include_router(account_binding_routes.router)
            print("帳號綁定 API 已掛載: /api/admin/account-bindings")
        except Exception as exc:
            print(f"帳號綁定 API 掛載失敗: {exc}")

    fastapi.FastAPI.__init__ = patched_init
    fastapi.FastAPI._botc_town_checkin_router_patch = True


_install_town_checkin_router_patch()
