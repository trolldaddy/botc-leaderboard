import base64
import tempfile
from pathlib import Path
from types import SimpleNamespace

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import models  # noqa: F401 - register account tables on shared metadata
import role_models  # noqa: F401 - register role tables on shared metadata
from database import Base
from role_models import Role
from script_admin_routes import apply_role_json
from script_admin_routes import delete_script
from script_admin_routes import serialize_script as serialize_admin_script
from script_admin_routes import update_script
from script_models import ScriptEntry, ScriptImage, ScriptRole, ScriptSupplement
import script_import_service
from script_public_routes import get_storyteller_guide, list_scripts, serialize_script as serialize_public_script


def make_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)()


def seed_script(db):
    role = Role(
        canonical_key="washerwoman",
        name_zh_tw="洗衣婦",
        name_en="Washerwoman",
        team="townsfolk",
        is_official=True,
        is_active=True,
        image_url="https://example.test/washerwoman.png",
    )
    script = ScriptEntry(
        slug="integration-script",
        name_zh_tw="整合測試劇本",
        is_public=True,
        needs_review=True,
        source_platform="test",
    )
    script.roles.append(ScriptRole(role=role, sort_order=0))
    script.supplements.append(ScriptSupplement(
        external_id="custom-oracle",
        name_zh_tw="自創先知",
        entry_type="townsfolk",
        image_url="https://example.test/custom.png",
        ability="舊能力",
        sort_order=0,
    ))
    db.add(script)
    db.commit()
    return script.id


def test_admin_update_round_trips_rich_text_and_custom_role():
    db = make_session()
    script_id = seed_script(db)
    custom_id = db.query(ScriptSupplement.id).scalar()
    rich_fields = {
        "background_introduction": '<p><strong>背景</strong>與<a href="https://example.test">連結</a></p>',
        "gameplay_overview": '<p><span style="font-size:1.25em">核心體驗</span></p>',
        "author_note": "<blockquote>作者的話</blockquote>",
        "production_updates": "<ul><li>v2 更新</li></ul>",
        "player_guide": "<p>玩家攻略</p>",
        "storyteller_guide": "<p><strong>說書人攻略</strong></p>",
    }
    result = update_script(
        script_id,
        {
            **rich_fields,
            "author_name": "測試作者",
            "category": "\u90e8\u5206\u539f\u5275",
            "is_laplace_owned": True,
            "custom_roles": [{
                "id": custom_id,
                "name_zh_tw": "自創先知・改",
                "team": "outsider",
                "image_url": "https://example.test/custom-v2.png",
                "ability": '<p><strong>可編輯能力</strong></p>',
                "sort_order": 0,
            }],
        },
        db=db,
        admin=SimpleNamespace(),
    )

    assert result["status"] == "success"
    detail = result["script"]
    for field, expected in rich_fields.items():
        assert detail[field] == expected
    assert detail["author_name"] == "測試作者"
    assert detail["category"] == "\u90e8\u5206\u539f\u5275"
    assert detail["is_laplace_owned"] is True
    assert detail["custom_roles"] == [{
        "id": custom_id,
        "external_id": "custom-oracle",
        "name_zh_tw": "自創先知・改",
        "team": "outsider",
        "image_url": "https://example.test/custom-v2.png",
        "ability": '<p><strong>可編輯能力</strong></p>',
        "sort_order": 0,
    }]

    persisted = db.query(ScriptEntry).filter_by(id=script_id).one()
    assert serialize_admin_script(persisted, detail=True)["storyteller_guide"] == rich_fields["storyteller_guide"]


def test_admin_rejects_unknown_script_category():
    db = make_session()
    script_id = seed_script(db)
    try:
        update_script(script_id, {"category": "legacy-category"}, db=db, admin=SimpleNamespace())
        raise AssertionError("unknown category should be rejected")
    except HTTPException as exc:
        assert exc.status_code == 400

def test_role_json_apply_replaces_stale_custom_clockmaker_with_official_role():
    db = make_session()
    official = []
    for key, name in (
        ("clockmaker", "鐘錶匠"),
        ("washerwoman", "洗衣婦"),
        ("librarian", "圖書管理員"),
        ("investigator", "調查員"),
        ("chef", "廚師"),
    ):
        role = Role(canonical_key=key, name_zh_tw=name, team="townsfolk", is_official=True, is_active=True)
        db.add(role)
        official.append(role)
    script = ScriptEntry(slug="clockmaker-replace", name_zh_tw="斗轉星移")
    script.roles.append(ScriptRole(role=official[1], sort_order=0))
    script.supplements.append(ScriptSupplement(
        external_id="legacy-clockmaker", name_zh_tw="鐘錶匠", entry_type="townsfolk",
        image_url="https://clocktower-wiki.gstonegames.com/images/thumb/7/74/Clockmaker.png/300px-Clockmaker.png",
        sort_order=0,
    ))
    db.add(script)
    db.commit()

    payload = [
        {"id": "legacy-clockmaker", "name": "钟表匠", "team": "townsfolk", "image": "https://clocktower-wiki.gstonegames.com/images/thumb/7/74/Clockmaker.png/300px-Clockmaker.png"},
        {"id": "washerwoman"}, {"id": "librarian"}, {"id": "investigator"}, {"id": "chef"},
    ]
    result = apply_role_json(
        script.id,
        {"filename": "roles.json", "content": __import__("json").dumps(payload)},
        db=db,
        admin=SimpleNamespace(),
    )

    assert result["status"] == "success"
    assert result["roles_matched"] == 5
    assert result["special_entries_preserved"] == 0
    assert len(result["script"]["roles"]) == 5
    assert result["script"]["custom_roles"] == []
    assert {item["role_id"] for item in result["script"]["roles"]} == {role.id for role in official}
    assert db.query(ScriptSupplement).filter_by(script_id=script.id).count() == 0

def test_admin_can_create_classify_and_delete_special_entries():
    db = make_session()
    script_id = seed_script(db)
    result = update_script(script_id, {
        "custom_roles": [{
            "id": None,
            "name_zh_tw": "Jinx entry",
            "team": "a jinxed",
            "image_url": "",
            "ability": "Jinx ability",
        }],
    }, db=db, admin=SimpleNamespace())
    custom = result["script"]["custom_roles"]
    assert len(custom) == 1
    assert custom[0]["name_zh_tw"] == "Jinx entry"
    assert custom[0]["team"] == "jinx"
    assert custom[0]["external_id"].startswith("manual-")

    update_script(script_id, {"custom_roles": []}, db=db, admin=SimpleNamespace())
    assert db.query(ScriptSupplement).filter_by(script_id=script_id).count() == 0


def test_public_script_list_searches_roles_and_combines_catalog_filters():
    db = make_session()
    script_id = seed_script(db)
    script = db.query(ScriptEntry).filter_by(id=script_id).one()
    script.category = "官混劇本"
    script.is_laplace_owned = True
    script.author_name = "測試作者"
    db.commit()

    by_role = list_scripts(q="洗衣婦", category="", laplace=False, db=db)
    assert [item["slug"] for item in by_role["items"]] == ["integration-script"]

    by_category = list_scripts(q="", category="官混劇本", laplace=False, db=db)
    assert by_category["total"] == 1

    by_laplace_and_author = list_scripts(q="測試作者", category="", laplace=True, db=db)
    assert by_laplace_and_author["total"] == 1

    excluded = list_scripts(q="洗衣婦", category="完全原創", laplace=False, db=db)
    assert excluded["total"] == 0

def test_public_payload_and_storyteller_login_gate():
    db = make_session()
    script_id = seed_script(db)
    script = db.query(ScriptEntry).filter_by(id=script_id).one()
    script.player_guide = "<p>所有人可看的玩家攻略</p>"
    script.storyteller_guide = "<p>登入後可看的說書人攻略</p>"
    script.is_laplace_owned = True
    db.commit()

    anonymous = serialize_public_script(script, include_roles=True, account=None)
    assert anonymous["is_laplace_owned"] is True
    assert anonymous["guides"]["player"] == {
        "content": "<p>所有人可看的玩家攻略</p>",
        "available": True,
    }
    assert anonymous["guides"]["storyteller"] == {
        "available": True,
        "locked": True,
        "login_required": True,
    }
    assert "content" not in anonymous["guides"]["storyteller"]
    assert anonymous["special_entries"][0]["ability"] == "舊能力"

    logged_in = serialize_public_script(
        script,
        include_roles=True,
        account=SimpleNamespace(is_banned=False),
    )
    assert logged_in["guides"]["storyteller"]["locked"] is False
    assert logged_in["guides"]["storyteller"]["login_required"] is False

    try:
        get_storyteller_guide(script.slug, db=db, account=None)
        raise AssertionError("anonymous access should be rejected")
    except HTTPException as exc:
        assert exc.status_code == 401

    try:
        get_storyteller_guide(script.slug, db=db, account=SimpleNamespace(is_banned=True))
        raise AssertionError("banned account access should be rejected")
    except HTTPException as exc:
        assert exc.status_code == 403

    allowed = get_storyteller_guide(
        script.slug,
        db=db,
        account=SimpleNamespace(is_banned=False),
    )
    assert allowed["content"] == "<p>登入後可看的說書人攻略</p>"



def test_remote_artwork_prefers_two_portrait_faces_over_logo():
    candidates = [
        {"index": 1, "width": 1600, "height": 500, "name": "logo"},
        {"index": 2, "width": 1080, "height": 1600, "name": "front"},
        {"index": 3, "width": 1100, "height": 1650, "name": "back"},
        {"index": 4, "width": 1200, "height": 1200, "name": "avatar"},
    ]
    selected = script_import_service.rank_remote_artwork(candidates)
    assert [item["name"] for item in selected] == ["front", "back"]

def test_admin_can_delete_script_and_cascade_children():
    db = make_session()
    script_id = seed_script(db)
    script = db.query(ScriptEntry).filter_by(id=script_id).one()
    script.images.append(ScriptImage(
        image_url="/static/script-images/uploads/integration-script/front.png",
        alt_text="front",
        sort_order=0,
    ))
    db.commit()
    deleted_name = script.name_zh_tw

    result = delete_script(script_id, db=db, admin=SimpleNamespace())

    assert result == {
        "status": "success",
        "deleted_id": script_id,
        "deleted_name": deleted_name,
    }
    assert db.query(ScriptEntry).filter_by(id=script_id).count() == 0
    assert db.query(ScriptImage).filter_by(script_id=script_id).count() == 0
    assert db.query(ScriptRole).filter_by(script_id=script_id).count() == 0
    assert db.query(ScriptSupplement).filter_by(script_id=script_id).count() == 0

def test_new_manual_import_creates_internal_draft_and_local_artwork():
    db = make_session()
    roles = []
    for index in range(5):
        role = Role(
            canonical_key=f"import-role-{index}",
            name_zh_tw=f"匯入角色{index}",
            name_en=f"Import Role {index}",
            team="townsfolk",
            is_official=True,
            is_active=True,
        )
        db.add(role)
        roles.append(role)
    db.flush()
    image_bytes = b"fake-image-payload"
    with tempfile.TemporaryDirectory() as folder:
        previous = script_import_service.IMAGE_ROOT
        script_import_service.IMAGE_ROOT = Path(folder)
        try:
            script = script_import_service.create_script(
                db,
                {
                    "name_zh_tw": "手動匯入測試",
                    "images": [{
                        "filename": "front.png",
                        "content_type": "image/png",
                        "content": base64.b64encode(image_bytes).decode("ascii"),
                    }],
                },
                roles,
                [],
                {},
            )
        finally:
            script_import_service.IMAGE_ROOT = previous
    assert script.is_public is False
    assert script.needs_review is True
    assert len(script.roles) == 5
    assert script.images[0].image_url.startswith("/static/script-images/uploads/")
    assert script.source_platform == "manual"

if __name__ == "__main__":
    test_admin_update_round_trips_rich_text_and_custom_role()
    test_admin_rejects_unknown_script_category()
    test_role_json_apply_replaces_stale_custom_clockmaker_with_official_role()
    test_admin_can_create_classify_and_delete_special_entries()
    test_public_script_list_searches_roles_and_combines_catalog_filters()
    test_public_payload_and_storyteller_login_gate()
    test_admin_can_delete_script_and_cascade_children()
    test_new_manual_import_creates_internal_draft_and_local_artwork()
    test_remote_artwork_prefers_two_portrait_faces_over_logo()
    print({"status": "ok", "tests": 9})
