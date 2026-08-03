from types import SimpleNamespace

from knowledge_visibility import recommended_block_visibility, recommended_node_visibility


def node(name, node_type="article", presentation_type="standard_article", status="discovered"):
    return SimpleNamespace(
        canonical_name_zh_tw=name,
        canonical_name_zh_cn=None,
        slug=name,
        node_type=node_type,
        presentation_type=presentation_type,
        status=status,
    )


def block(block_type="article_section", review_status="needs_review"):
    return SimpleNamespace(block_type=block_type, review_status=review_status)


def test_public_knowledge_categories_and_articles():
    assert recommended_node_visibility(node("鎮民", "script", "role_group")) == "public"
    assert recommended_node_visibility(node("保護", "mechanic", "mechanic")) == "public"
    assert recommended_node_visibility(node("紅唇女郎", "role", "role_profile")) == "public"


def test_only_allowlisted_scripts_are_public():
    assert recommended_node_visibility(node("暗流湧動", "script", "excluded")) == "public"
    assert recommended_node_visibility(node("一限生機", "script", "script_guide")) == "internal"
    assert recommended_node_visibility(node("社群活動劇本", "script", "excluded")) == "internal"


def test_uncertain_standard_articles_wait_for_review():
    assert recommended_node_visibility(node("unclassified")) == "internal"
    assert recommended_node_visibility(node("rules", presentation_type="rules_hub")) == "public"


def test_homepage_is_always_internal():
    assert recommended_node_visibility(node("\u9996\u9801", presentation_type="index")) == "internal"
    assert recommended_node_visibility(node("\u9996\u9875", presentation_type="index")) == "internal"


def test_hidden_and_excluded_articles_stay_internal():
    assert recommended_node_visibility(node("認證公示", presentation_type="excluded")) == "internal"
    assert recommended_node_visibility(node("舊文章", status="disabled")) == "internal"


def test_raw_and_rejected_blocks_stay_internal():
    assert recommended_block_visibility(block(), "public") == "public"
    assert recommended_block_visibility(block("source_excerpt"), "public") == "internal"
    assert recommended_block_visibility(block(review_status="rejected"), "public") == "internal"
    assert recommended_block_visibility(block(), "internal") == "internal"
