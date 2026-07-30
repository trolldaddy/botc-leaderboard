import argparse
import hashlib
import os
import sys
from pathlib import Path

from sqlalchemy.orm import Session

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from database import SessionLocal
from knowledge_models import (
    KnowledgeAlias,
    KnowledgeBlock,
    KnowledgeNode,
    KnowledgeSource,
    KnowledgeSourceRecord,
)
from role_models import Role, RoleKnowledgeLink


MOEGIRL_URL = (
    "https://moegirl.uk/index.php?"
    "title=%E6%9F%93%C2%B7%E9%92%9F%E6%A5%BC%E8%B0%9C%E5%9B%A2&variant=zh-tw"
)
BWIKI_URL = "https://wiki.biligame.com/bloodontheclocktower/%E5%B1%B1%E9%9B%A8%E6%AC%B2%E6%9D%A5"

# These pages were removed from the former GStone wiki.  The text below is
# recovered from community mirrors of the historical role list, not presented
# as current GStone content.  jinweijun2 intentionally has no inferred ability.
ARCHIVED_ROLES = [
    {
        "key": "yanluo",
        "name_tw": "閻羅",
        "name_cn": "阎罗",
        "ability": (
            "在你的首個夜晚，你能查看魔典並選擇一名玩家：他在第三個夜晚死亡，"
            "即使因為任何原因讓他不會死亡。每個夜晚，你要選擇一名玩家："
            "上個夜晚被你選擇的玩家死亡。"
        ),
        "source_url": MOEGIRL_URL,
    },
    {
        "key": "ranfangfangzhu",
        "name_tw": "染坊坊主",
        "name_cn": "染坊坊主",
        "ability": "如果你在夜晚死亡，惡魔的能力變成「每個夜晚*，可能會有一名玩家死亡。」",
        "source_url": MOEGIRL_URL,
    },
    {
        "key": "diaomin",
        "name_tw": "刁民",
        "name_cn": "刁民",
        "ability": "曾在白天粗暴地打斷過你的發言的玩家之一會在當晚醉酒，即使你已死亡。",
        "source_url": BWIKI_URL,
    },
    {
        "key": "fengshuishi",
        "name_tw": "風水師",
        "name_cn": "风水师",
        "ability": (
            "在你的首個夜晚，你會得知一名玩家的角色類型。每個夜晚*，"
            "你會從他的順時針方向得知下一名非旅行者玩家的角色類型。"
        ),
        "source_url": MOEGIRL_URL,
    },
    {
        "key": "shutong",
        "name_tw": "書童",
        "name_cn": "书童",
        "ability": (
            "在你的首個夜晚，你要選擇除你以外的一名玩家：除首個夜晚以外，"
            "當他被邪惡玩家的能力選擇或影響時，你在當晚死亡。"
        ),
        "source_url": MOEGIRL_URL,
    },
    {
        "key": "jinweijun2",
        "name_tw": "禁衛軍Ⅱ",
        "name_cn": "禁卫军Ⅱ",
        "ability": None,
        "source_url": None,
        "note": "公開鏡像尚未找到可確認的完整能力；僅保留既有首夜「求生／求死」操作資料。",
    },
    {
        "key": "yongjiang",
        "name_tw": "俑匠",
        "name_cn": "俑匠",
        "ability": "如果已死亡玩家中沒有邪惡玩家，你只會死於處決。",
        "source_url": MOEGIRL_URL,
    },
    {
        "key": "shiguan",
        "name_tw": "史官",
        "name_cn": "史官",
        "ability": "每個夜晚*，如果今天白天有玩家死於處決，你會得知有多少名存活的鎮民。",
        "source_url": MOEGIRL_URL,
    },
    {
        "key": "yanshi",
        "name_tw": "偃師",
        "name_cn": "偃师",
        "ability": "如果你在夜晚死亡，你與一名存活爪牙玩家交換角色。",
        "source_url": MOEGIRL_URL,
    },
    {
        "key": "daoke",
        "name_tw": "刀客",
        "name_cn": "刀客",
        "ability": (
            "在你的首個夜晚，你會得知一個在場的爪牙角色。每局遊戲限一次，"
            "你可以在白天公開選擇一名玩家：如果他是你得知的角色，他死亡。"
        ),
        "source_url": MOEGIRL_URL,
    },
]


def get_or_create_source(db: Session) -> KnowledgeSource:
    source = db.query(KnowledgeSource).filter(
        KnowledgeSource.name == "Archived Chinese community role mirrors"
    ).first()
    if source:
        return source
    source = KnowledgeSource(
        source_type="wiki_mirror",
        name="Archived Chinese community role mirrors",
        base_url="https://moegirl.uk/",
        publisher="Community mirrors",
        license_status="unknown",
        trust_level="secondary",
        default_language="zh-CN",
        is_official=False,
    )
    db.add(source)
    db.flush()
    return source


def find_role(db: Session, item: dict) -> Role | None:
    return db.query(Role).filter(
        (Role.canonical_key == item["key"]) | (Role.name_zh_tw == item["name_tw"])
    ).first()


def find_or_create_node(db: Session, item: dict) -> tuple[KnowledgeNode, bool]:
    node = db.query(KnowledgeNode).filter(
        (KnowledgeNode.slug == item["key"])
        | (KnowledgeNode.canonical_name_zh_tw == item["name_tw"])
        | (KnowledgeNode.canonical_name_zh_cn == item["name_cn"])
    ).first()
    if node:
        return node, False
    node = KnowledgeNode(
        node_type="role",
        slug=item["key"],
        canonical_name_zh_tw=item["name_tw"],
        canonical_name_zh_cn=item["name_cn"],
        summary=item.get("note"),
        presentation_type="role_profile",
        classification_method="manual_archived_recovery",
        classification_confidence=0.85 if item["ability"] else 0.5,
        classification_status="needs_review",
        status="discovered",
        visibility="internal",
        is_official=False,
    )
    db.add(node)
    db.flush()
    return node, True


def ensure_alias(db: Session, node: KnowledgeNode, item: dict) -> bool:
    if not item["name_cn"] or item["name_cn"] == item["name_tw"]:
        return False
    alias = db.query(KnowledgeAlias).filter(
        KnowledgeAlias.node_id == node.id,
        KnowledgeAlias.alias == item["name_cn"],
        KnowledgeAlias.language == "zh-CN",
    ).first()
    if alias:
        return False
    db.add(KnowledgeAlias(
        node_id=node.id,
        alias=item["name_cn"],
        language="zh-CN",
        alias_type="archived_source",
        is_preferred=True,
    ))
    return True


def ensure_source_record(
    db: Session, source: KnowledgeSource, node: KnowledgeNode, item: dict
) -> tuple[KnowledgeSourceRecord | None, bool]:
    if not item["ability"] or not item["source_url"]:
        return None, False
    record = db.query(KnowledgeSourceRecord).filter(
        KnowledgeSourceRecord.source_id == source.id,
        KnowledgeSourceRecord.node_id == node.id,
        KnowledgeSourceRecord.block_type == "ability",
        KnowledgeSourceRecord.source_url == item["source_url"],
    ).first()
    if record:
        return record, False
    content_hash = hashlib.sha256(item["ability"].encode("utf-8")).hexdigest()
    record = KnowledgeSourceRecord(
        source_id=source.id,
        node_id=node.id,
        block_type="ability",
        source_url=item["source_url"],
        source_title=f"{item['name_tw']}（歷史角色鏡像）",
        source_language="zh-CN",
        raw_content=item["ability"],
        normalized_content=item["ability"],
        content_hash=content_hash,
        parser_version="manual-archived-role-v1",
        parse_status="recovered",
        review_status="needs_review",
    )
    db.add(record)
    db.flush()
    return record, True


def ensure_ability_block(
    db: Session, node: KnowledgeNode, record: KnowledgeSourceRecord | None, item: dict
) -> tuple[KnowledgeBlock | None, bool]:
    if not item["ability"]:
        return None, False
    block = db.query(KnowledgeBlock).filter(
        KnowledgeBlock.node_id == node.id,
        KnowledgeBlock.block_type == "ability",
        KnowledgeBlock.layer == "archived_community",
    ).first()
    created = block is None
    if created:
        block = KnowledgeBlock(
            node_id=node.id,
            block_type="ability",
            layer="archived_community",
        )
        db.add(block)
    block.title = "角色能力"
    block.content_format = "text"
    block.content = item["ability"]
    block.sort_order = 100
    block.language = "zh-TW"
    block.review_status = "needs_review"
    block.visibility = "public"
    block.current_source_record_id = record.id if record else None
    return block, created


def run(write: bool) -> dict:
    db: Session = SessionLocal()
    stats = {
        "mode": "write" if write else "preview",
        "roles_scanned": len(ARCHIVED_ROLES),
        "nodes_created": 0,
        "aliases_created": 0,
        "source_records_created": 0,
        "ability_blocks_created": 0,
        "ability_blocks_updated": 0,
        "role_links_created": 0,
        "role_links_updated": 0,
        "role_abilities_would_fill": 0,
        "role_abilities_filled": 0,
        "role_abilities_preserved": 0,
        "missing_roles": [],
        "ability_still_missing": [],
    }
    try:
        source = get_or_create_source(db)
        for item in ARCHIVED_ROLES:
            role = find_role(db, item)
            if not role:
                stats["missing_roles"].append(item["name_tw"])
                continue
            node, node_created = find_or_create_node(db, item)
            stats["nodes_created"] += int(node_created)
            stats["aliases_created"] += int(ensure_alias(db, node, item))
            record, record_created = ensure_source_record(db, source, node, item)
            stats["source_records_created"] += int(record_created)
            _, block_created = ensure_ability_block(db, node, record, item)
            if item["ability"]:
                stats["ability_blocks_created" if block_created else "ability_blocks_updated"] += 1
            else:
                stats["ability_still_missing"].append({
                    "name": item["name_tw"],
                    "note": item.get("note"),
                })

            link = db.query(RoleKnowledgeLink).filter(
                RoleKnowledgeLink.role_id == role.id,
                RoleKnowledgeLink.knowledge_node_id == node.id,
            ).first()
            if link:
                stats["role_links_updated"] += 1
            else:
                link = RoleKnowledgeLink(role_id=role.id, knowledge_node_id=node.id)
                db.add(link)
                stats["role_links_created"] += 1
            link.match_method = "manual_archived_name"
            link.confidence = 0.85 if item["ability"] else 0.5
            link.review_status = "needs_review"

            if item["ability"] and not (role.ability_zh_tw or "").strip():
                stats["role_abilities_would_fill"] += 1
                if write:
                    role.ability_zh_tw = item["ability"]
                    role.needs_review = True
                    stats["role_abilities_filled"] += 1
            elif item["ability"]:
                stats["role_abilities_preserved"] += 1

        if write:
            db.commit()
        else:
            db.rollback()
        return stats
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(
        description="Seed recoverable data for role pages removed from the former GStone wiki."
    )
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    if not os.getenv("DATABASE_URL"):
        raise SystemExit("DATABASE_URL is required")
    print(run(args.write))


if __name__ == "__main__":
    main()
