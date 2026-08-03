from dataclasses import asdict, dataclass

from gstone_wiki import is_excluded_knowledge_title


HIDDEN_STATUSES = {"deleted", "archived", "disabled"}
PRESENTATION_TYPES = {
    "role_profile", "mechanic", "glossary", "night_order", "taxonomy", "reference_table",
    "rules_hub", "role_group", "script_guide", "guide", "index", "standard_article", "excluded",
}

GLOSSARY_TITLES = {"術語彙總", "术语汇总"}
NIGHT_ORDER_TITLES = {"夜晚行動順序一覽", "夜晚行动顺序一览"}
TAXONOMY_TITLES = {"角色能力類別總覽", "角色能力类别总览"}
REFERENCE_TABLE_TITLES = {"設定調整", "设置调整", "特殊勝利失敗條件", "特殊胜利失败条件"}
RULES_HUB_TITLES = {
    "規則", "规则", "規則概要", "重要細節", "术语汇总", "術語彙總",
    "給說書人的建議", "規則解釋", "相剋規則", "相克规则", "“ 可以但不建議 ”",
    "夜晚行動順序一覽", "隱性規則", "鐘樓謎團隱性規則彙總", "钟楼谜团隐性规则汇总",
    "規則調整提前公示", "规则调整提前公示", "哪些是“可以但不建議”", "哪些是“可以但不建议”",
}
ROLE_GROUP_TITLES = {
    "鎮民", "镇民", "外來者", "外来者", "爪牙", "惡魔", "恶魔",
    "旅行者", "傳奇角色", "传奇角色", "奇遇角色", "實驗性角色", "实验性角色",
}
INDEX_TITLES = {"首頁", "首页", "角色", "劇本", "剧本"}
SCRIPT_GUIDE_TITLES = {
    "山雨欲來", "山雨欲来",
    "暗流湧動", "暗流涌动", "黯月初昇", "黯月初升", "夢殞春宵", "梦殒春宵", "華燈初上", "华灯初上",
}
MECHANIC_TITLES = {
    "拜訪說書人", "拜访说书人", "保護", "保护", "暴露角色", "持續檢測型能力", "持续检测型能力",
    "處決", "处决", "額外死亡", "额外死亡", "瘋狂", "疯狂", "復活", "复活", "更換選擇目標",
    "更换选择目标", "公開觸發能力", "公开触发能力", "獲得能力", "获得能力", "獲取資訊", "获取资讯",
    "互動干擾", "互动干扰", "回溯型能力", "進場能力", "进场能力", "角色變化", "角色变化",
    "鄰近", "邻近", "免死", "能力效果干擾", "能力效果干扰", "認知覆蓋", "认知覆盖",
    "死後能力保留", "死后能力保留", "死亡觸發能力", "死亡触发能力", "提名", "投票",
    "限次能力", "影響", "影响", "陣營轉變", "阵营转变", "能力效果乾擾", "中毒", "醉酒",
}
GUIDE_TITLES = {
    "“規則”與“理念”——關於角色能力互動的說明",
    "設計師的平衡天書",
    "創作幕後——超越暗流湧動",
    "成為一個好說書人的經歷",
    "創作幕後——邏輯一片混亂？",
    "染·鐘樓謎團是一款策略遊戲",
    "設計師總結的國內玩家對染的錯誤理解",
    "瘋狂規則如何運作？——瘋狂的小精靈",
    "有關說書人的創造力--有趣的巫師",
    "鐘樓筆記：相剋更新",
}
IRRELEVANT_ROOT_TITLES = {"第一屆華燈初上劇本創作大賽", "第一届华灯初上剧本创作大赛"}


@dataclass(frozen=True)
class PresentationClassification:
    presentation_type: str
    method: str
    confidence: float
    status: str
    reason: str

    def to_dict(self):
        return asdict(self)


def _result(presentation_type: str, method: str, confidence: float, reason: str):
    return PresentationClassification(
        presentation_type=presentation_type,
        method=method,
        confidence=confidence,
        status="auto_confirmed" if confidence >= 0.95 else "needs_review",
        reason=reason,
    )


def excluded_classification(reason: str = "節點屬明確排除內容") -> PresentationClassification:
    return _result("excluded", "graph_exclusion_rule", 1.0, reason)


def classify_knowledge_node(node) -> PresentationClassification:
    name = (node.canonical_name_zh_tw or node.canonical_name_zh_cn or node.slug or "").strip()
    node_type = (node.node_type or "").strip().lower()
    status = (node.status or "").strip().lower()

    if status in HIDDEN_STATUSES or node_type == "script" or is_excluded_knowledge_title(name):
        return _result("excluded", "status_or_exclusion_rule", 1.0, "節點已停用或屬明確排除內容")
    if name in GLOSSARY_TITLES:
        return _result("glossary", "exact_title", 1.0, "術語辭典頁")
    if name in NIGHT_ORDER_TITLES:
        return _result("night_order", "exact_title", 1.0, "夜晚行動順序工具")
    if name in TAXONOMY_TITLES:
        return _result("taxonomy", "exact_title", 1.0, "能力分類總覽")
    if name in REFERENCE_TABLE_TITLES:
        return _result("reference_table", "exact_title", 0.98, "條件與規則資料表")
    if name in RULES_HUB_TITLES:
        return _result("rules_hub", "exact_title", 0.98, "規則入口或規則集合")
    if name in ROLE_GROUP_TITLES:
        return _result("role_group", "exact_title", 0.98, "角色類型入口")
    if name in INDEX_TITLES:
        return _result("index", "exact_title", 0.98, "索引或導航頁")
    if node_type == "role":
        return _result("role_profile", "node_type", 1.0, "角色節點使用角色資料頁")
    if name in SCRIPT_GUIDE_TITLES or node_type == "script":
        return _result("script_guide", "title_or_node_type", 0.96, "官方劇本或劇本指南")
    if name in MECHANIC_TITLES or node_type == "mechanic":
        return _result("mechanic", "title_or_node_type", 0.96, "單一規則或能力機制")
    if name in GUIDE_TITLES:
        return _result("guide", "exact_title", 0.98, "官方延伸閱讀指南")
    if node_type == "guide":
        return _result("guide", "node_type", 0.90, "指南型節點，需覆核文章結構")
    if any(keyword in name for keyword in ("一覽", "一览", "總覽", "总览", "彙總", "汇总")):
        return _result("reference_table", "title_keyword", 0.72, "標題顯示為總覽或彙總頁")
    if node_type == "article":
        return _result("standard_article", "fallback_node_type", 0.60, "一般文章安全後備模板")
    return _result("standard_article", "fallback_unknown", 0.40, "未知節點類型，需人工確認")
