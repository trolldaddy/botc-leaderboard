import json
import tempfile
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from role_models import Role, RoleAlias
from scripts.import_bilibili_script import find_role, role_ids_from_json, role_references_from_json


def test_script_json_ignores_meta_and_keeps_names():
    path = Path(tempfile.gettempdir()) / "botc-script-import-test.json"
    path.write_text(json.dumps([{"id": "_meta", "name": "測試"}, {"id": "20002_20", "name": "调查员"}]), encoding="utf-8")
    assert role_ids_from_json(path) == ["20002_20"]
    assert role_references_from_json(path)[0]["name"] == "调查员"


def test_script_json_preserves_fabled_metadata():
    path = Path(tempfile.gettempdir()) / "botc-script-import-fabled-test.json"
    path.write_text(json.dumps([
        {"id": "investigator", "name": "调查员", "team": "townsfolk"},
        {"id": "_custom", "name": "自訂傳奇", "team": "fabled", "ability": "規則修正"},
    ]), encoding="utf-8")
    references = role_references_from_json(path)
    assert role_ids_from_json(path) == ["investigator", "_custom"]
    assert references[1]["team"] == "fabled"
    assert references[1]["ability"] == "規則修正"


def test_find_role_normalizes_symbols_traditional_names_and_aliases():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    session = sessionmaker(bind=engine)()
    try:
        investigator = Role(canonical_key="investigator", name_zh_tw="\u8abf\u67e5\u54e1", team="townsfolk")
        evil_twin = Role(canonical_key="evil_twin", name_zh_tw="\u93e1\u50cf\u96d9\u5b50", team="minion")
        taowu = Role(canonical_key="taowu", name_zh_tw="\u6aae\u674c", team="fabled")
        session.add_all([investigator, evil_twin, taowu])
        session.flush()
        session.add(RoleAlias(role_id=taowu.id, source="test", external_id="taowu", external_name="\u68bc\u674c"))
        session.commit()

        assert find_role(session, {"id": "1investigator_c", "name": "\u25b2\u8c03\u67e5\u5458"}).id == investigator.id
        assert find_role(session, {"id": "jinxiangshuangzi", "name": "\u955c\u50cf\u53cc\u5b50"}).id == evil_twin.id
        assert find_role(session, {"id": "taowuuuuuuuuuu11111111", "name": "\u68bc\u674c"}).id == taowu.id
    finally:
        session.close()


if __name__ == "__main__":
    test_script_json_ignores_meta_and_keeps_names()
    test_script_json_preserves_fabled_metadata()
    test_find_role_normalizes_symbols_traditional_names_and_aliases()
    print({"status": "ok"})
