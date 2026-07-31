from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from gstone_wiki import parse_role_information


def main() -> None:
    html = """
    <html><body>
      <h2>角色能力</h2>
      <p>在等同于初始外来者数量的夜晚，所有镇民玩家中毒直到下个黄昏。[外来者数量任意]</p>
      <h2>角色简介</h2>
      <p>这一段不应该进入能力文字。</p>
      <h2>角色信息</h2>
      <ul>
        <li>英文名：Xaan</li>
        <li>角色类型：爪牙</li>
      </ul>
    </body></html>
    """
    result = parse_role_information(html)
    assert result["official_ability"] == "在等同於初始外來者數量的夜晚，所有鎮民玩家中毒直到下個黃昏。[外來者數量任意]"
    assert "不應該" not in result["official_ability"]
    assert result["english_name"] == "Xaan"
    print("GStone official ability parser: OK")


if __name__ == "__main__":
    main()
