from scripts.crawl_bilibili_scripts import author_from_markdown, extracted_fields


def test_author_parser_prefers_explicit_script_author():
    markdown = "本期介绍的是由钟楼博物馆剧本工作室、剧本作者 @海雾 带来的作品。"
    assert author_from_markdown(markdown) == "海霧"


def test_author_parser_preserves_explicit_coauthors():
    markdown = "本期介绍的是由 @JJ & @Mas 带来的作品。"
    assert author_from_markdown(markdown) == "JJ、Mas"


def test_extracts_sections_without_using_generic_heading_as_intro():
    markdown = """Title: 測試\n\n本期介绍的是由 @作者 带来的作品。\n\n# 剧本简介\n\n这是足够长的剧本背景介绍，用来验证摘要不会只显示章节标题。\n\n# 游戏特色\n\n核心玩法依赖阵营判断。\n\n跳转至索引贴下载JSON文件\n"""
    fields = extracted_fields(markdown, "測試")
    assert fields["introduction"].startswith("這是足夠長的劇本背景介紹")
    assert "核心玩法" in fields["gameplay_overview"]


if __name__ == "__main__":
    test_author_parser_prefers_explicit_script_author()
    test_author_parser_preserves_explicit_coauthors()
    test_extracts_sections_without_using_generic_heading_as_intro()
    print({"status": "ok"})
