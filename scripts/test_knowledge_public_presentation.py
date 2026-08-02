from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from knowledge_models import KnowledgeNode
from knowledge_public_routes import _public_node_type, list_types, search_knowledge


def test_role_group_is_exposed_as_mechanic_even_with_stale_script_type():
    node = KnowledgeNode(node_type="script", presentation_type="role_group")

    assert _public_node_type(node) == "mechanic"


def test_regular_roles_keep_their_public_type():
    node = KnowledgeNode(node_type="role", presentation_type="role_profile")

    assert _public_node_type(node) == "role"


def test_public_search_hides_scripts_but_keeps_role_groups():
    engine = create_engine("sqlite:///:memory:")
    KnowledgeNode.__table__.create(engine)
    with Session(engine) as db:
        db.add_all([
            KnowledgeNode(node_type="script", slug="event-script", canonical_name_zh_tw="活動劇本"),
            KnowledgeNode(node_type="script", slug="travellers", canonical_name_zh_tw="旅行者", presentation_type="role_group"),
            KnowledgeNode(node_type="mechanic", slug="voting", canonical_name_zh_tw="投票"),
        ])
        db.commit()

        result = search_knowledge(q="", node_type="", limit=100, offset=0, db=db)

    assert [item["name"] for item in result["items"]] == ["投票", "旅行者"]
    assert {item["node_type"] for item in result["items"]} == {"mechanic"}


def test_public_types_fold_role_groups_into_mechanics():
    engine = create_engine("sqlite:///:memory:")
    KnowledgeNode.__table__.create(engine)
    with Session(engine) as db:
        db.add_all([
            KnowledgeNode(node_type="script", slug="event-script", canonical_name_zh_tw="活動劇本"),
            KnowledgeNode(node_type="script", slug="travellers", canonical_name_zh_tw="旅行者", presentation_type="role_group"),
            KnowledgeNode(node_type="mechanic", slug="voting", canonical_name_zh_tw="投票"),
        ])
        db.commit()

        result = list_types(db=db)

    assert result == {"items": [{"node_type": "mechanic", "count": 2}]}
