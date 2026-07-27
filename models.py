from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Player(Base):
    __tablename__ = "players"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.now)
    match_history = relationship("MatchPlayer", back_populates="player")
    linked_accounts = relationship("StorytellerAccount", back_populates="player")

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


import knowledge_models  # noqa: E402,F401
import role_models  # noqa: E402,F401


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
        routers = [
            ("line_login_override_routes", "", "LINE 登入提示官方帳號 API"),
            ("match_override_routes", "", "綁定感知上傳 API"),
            ("room_routes", "", "小鎮報到 API"),
            ("player_seat_routes", "", "玩家自選座號 API"),
            ("account_binding_routes", "", "帳號綁定 API"),
            ("knowledge_public_routes", "", "公開知識庫 API"),
            ("role_public_routes", "", "公開角色視圖 API"),
            ("role_admin_routes", "/api/admin", "角色資料庫管理 API"),
            ("role_content_admin_routes", "/api/admin", "角色內容區塊管理 API"),
            ("role_sync_routes", "/api/admin", "角色資料同步 API"),
            ("role_reminder_routes", "/api/admin", "角色提示標記 API"),
            ("knowledge_admin_routes", "/api/admin", "知識圖譜預覽 API"),
        ]
        for module_name, prefix, label in routers:
            try:
                module = __import__(module_name)
                self.include_router(module.router, prefix=prefix)
                print(f"{label} 已掛載")
            except Exception as exc:
                print(f"{label} 掛載失敗: {exc}")

    fastapi.FastAPI.__init__ = patched_init
    fastapi.FastAPI._botc_town_checkin_router_patch = True


_install_town_checkin_router_patch()
