from datetime import datetime
from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from database import Base
from knowledge_models import KnowledgeNode, KnowledgeSource, KnowledgeSourceRecord
from seed_gstone_knowledge_articles import latest_gstone_record


def main():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    db = sessionmaker(bind=engine)()
    try:
        source = KnowledgeSource(
            source_type="wiki",
            name="GStone Wiki",
            base_url="https://clocktower-wiki.gstonegames.com",
            is_official=True,
        )
        node = KnowledgeNode(
            node_type="article",
            slug="home",
            canonical_name_zh_tw="home",
            status="discovered",
            visibility="internal",
        )
        db.add_all([source, node])
        db.flush()
        parsed = KnowledgeSourceRecord(
            source_id=source.id,
            node_id=node.id,
            source_url="https://clocktower-wiki.gstonegames.com/index.php?title=valid",
            parse_status="parsed",
            fetched_at=datetime(2026, 1, 1),
        )
        failed = KnowledgeSourceRecord(
            source_id=source.id,
            node_id=node.id,
            source_url="https://clocktower-wiki.gstonegames.com/index.php?title=missing",
            parse_status="failed",
            fetched_at=datetime(2026, 1, 2),
        )
        db.add_all([parsed, failed])
        db.commit()

        selected = latest_gstone_record(db, node.id, source.id)
        assert selected is not None
        assert selected.id == parsed.id
        assert selected.parse_status == "parsed"
        print({"status": "ok", "selected": "latest_parsed"})
    finally:
        db.close()


if __name__ == "__main__":
    main()
