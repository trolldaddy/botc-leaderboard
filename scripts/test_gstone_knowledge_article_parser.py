from seed_gstone_knowledge_articles import extract_article_sections, is_gstone_url, or_


HTML = """
<div id="mw-content-text"><div class="mw-parser-output">
  <p>這是導言。</p>
  <h2><span>第一節</span><span class="mw-editsection">[编辑]</span></h2>
  <p>第一段內容。</p>
  <h3>子標題</h3>
  <ul><li>項目甲</li><li>項目乙</li></ul>
  <h2>資料表</h2>
  <table><tr><th>名稱</th><th>效果</th></tr><tr><td>瘋狂</td><td>由說書人判定</td></tr></table>
  <h2>參考資料</h2><p>不匯入。</p>
</div></div>
"""


def main():
    assert callable(or_)
    normalized, blocks = extract_article_sections(HTML)
    assert [block["title"] for block in blocks] == ["導言", "第一節", "資料表"]
    assert "### 子標題" in blocks[1]["content"]
    assert "- 專案甲" in blocks[1]["content"]
    assert "| 名稱 | 效果 |" in blocks[2]["content"]
    assert "參考資料" not in normalized
    assert is_gstone_url("https://clocktower-wiki.gstonegames.com/index.php?title=瘋狂")
    assert not is_gstone_url("https://zh.moegirl.org.cn/血染鐘樓")
    print({"status": "ok", "blocks": len(blocks), "source_policy": "gstone_only"})


if __name__ == "__main__":
    main()
