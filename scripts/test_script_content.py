from pathlib import Path
import sys


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from script_content import merge_script_introductions


def test_merge_prefers_complete_text_and_preserves_distinct_copy():
    assert merge_script_introductions("摘要", "摘要與完整內容") == "摘要與完整內容"
    assert merge_script_introductions("相同", "相同") == "相同"
    assert merge_script_introductions("前言", "背景") == "前言\n\n背景"
    assert merge_script_introductions("", "背景") == "背景"
