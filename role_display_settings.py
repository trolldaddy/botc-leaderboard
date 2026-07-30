import re

from role_models import RoleDisplaySetting


DISPLAY_SETTING_DEFAULTS = [
    ("module.identity", "module", "角色名稱、圖示與陣營", True, True, True, 10),
    ("module.role_metadata", "module", "英文名、所屬劇本與能力類型", True, True, True, 20),
    ("module.official_ability", "module", "官方能力", True, True, True, 30),
    ("module.guide", "module", "拉普拉斯教學欄位", True, True, True, 40),
    ("module.references", "module", "百科來源連結", False, True, True, 50),
    ("module.night_operation", "module", "夜間順序與夜間提示", False, False, True, 60),
    ("module.reminders", "module", "提示標記", False, False, True, 70),
    ("module.source_status", "module", "來源與審核狀態", False, False, False, 80),
    ("block.background", "block", "背景故事", False, True, True, 100),
    ("block.ability", "block", "角色能力補充（百科）", False, True, True, 110),
    ("block.overview", "block", "角色簡介", False, True, True, 120),
    ("block.examples", "block", "範例", False, True, True, 130),
    ("block.strategy_play", "block", "策略：如何遊玩", True, True, True, 140),
    ("block.strategy_bluff", "block", "策略：如何偽裝", False, True, True, 150),
    ("block.strategy_counter", "block", "策略：如何對抗", False, True, True, 160),
    ("block.how_it_works", "block", "運作方式", False, True, True, 200),
    ("block.rules_detail", "block", "規則細節", False, True, True, 210),
    ("block.rules_interactions", "block", "規則細節：角色互動", False, True, True, 220),
    ("block.rules_jinx", "block", "規則細節：相剋規則", False, True, True, 230),
    ("block.player_summary", "block", "一句話定位", True, True, True, 300),
    ("block.storyteller_advice", "block", "說書人建議", False, False, True, 310),
    ("block.common_mistakes", "block", "常見誤解", True, True, True, 320),
    ("block.ability_supplement", "block", "角色能力補充（拉普拉斯）", True, True, True, 330),
    ("block.how_to_play", "block", "這個角色要做什麼", True, True, True, 340),
    ("block.advanced_tips", "block", "進階技巧", True, True, True, 350),
    ("block.custom_note", "block", "自訂內容", False, True, True, 900),
]


def base_block_type(value):
    return re.sub(r"_\d+$", "", str(value or ""))


def ensure_display_settings(db):
    existing = {item.item_key: item for item in db.query(RoleDisplaySetting).all()}
    created = False
    for key, item_type, label, player, encyclopedia, storyteller, order in DISPLAY_SETTING_DEFAULTS:
        if key in existing:
            continue
        db.add(RoleDisplaySetting(
            item_key=key, item_type=item_type, label=label,
            show_player=player, show_encyclopedia=encyclopedia, show_storyteller=storyteller,
            sort_player=order, sort_encyclopedia=order, sort_storyteller=order,
        ))
        created = True
    if created:
        db.commit()
    return db.query(RoleDisplaySetting).order_by(
        RoleDisplaySetting.item_type.desc(), RoleDisplaySetting.sort_encyclopedia, RoleDisplaySetting.id,
    ).all()


def setting_visible(setting, view):
    return bool(getattr(setting, f"show_{view}", False))


def setting_order(setting, view):
    return int(getattr(setting, f"sort_{view}", 0) or 0)