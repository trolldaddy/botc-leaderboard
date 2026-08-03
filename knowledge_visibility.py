"""Shared policy for deciding which Knowledge records may appear publicly."""

PUBLIC_VISIBILITIES = {"public", "published"}
HIDDEN_STATUSES = {"deleted", "archived", "disabled"}
PUBLIC_NODE_TYPES = {"role", "script", "guide", "mechanic", "article"}
PUBLIC_OFFICIAL_SCRIPT_NAMES = {
    "暗流湧動", "暗流涌动",
    "黯月初升", "黯月初昇",
    "夢殞春宵", "梦殒春宵",
    "實驗性角色", "实验性角色",
    "華燈初上", "华灯初上",
    "山雨欲來", "山雨欲来",
}

PUBLIC_PRESENTATION_TYPES = {
    "role_profile", "mechanic", "glossary", "night_order", "taxonomy", "reference_table",
    "rules_hub", "role_group", "script_guide", "guide", "index",
}

def node_display_name(node) -> str:
    return (node.canonical_name_zh_tw or node.canonical_name_zh_cn or node.slug or "").strip()


def recommended_node_visibility(node) -> str:
    """Return the deterministic visibility used by the one-time data backfill."""
    status = (node.status or "").strip().lower()
    node_type = (node.node_type or "").strip().lower()
    presentation_type = (node.presentation_type or "").strip().lower()
    name = node_display_name(node)

    if status in HIDDEN_STATUSES or node_type not in PUBLIC_NODE_TYPES:
        return "internal"
    if name in PUBLIC_OFFICIAL_SCRIPT_NAMES:
        return "public"
    if node_type == "script":
        if presentation_type == "role_group":
            return "public"
        return "internal"
    if presentation_type == "excluded":
        return "internal"
    if presentation_type not in PUBLIC_PRESENTATION_TYPES:
        return "internal"
    return "public"


def recommended_block_visibility(block, node_visibility: str) -> str:
    """Hide raw/rejected material even when its parent article is public."""
    block_type = (block.block_type or "").strip().lower()
    review_status = (block.review_status or "").strip().lower()
    if node_visibility not in PUBLIC_VISIBILITIES:
        return "internal"
    if block_type.startswith("source_excerpt") or review_status == "rejected":
        return "internal"
    return "public"
