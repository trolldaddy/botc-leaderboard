from bs4 import BeautifulSoup

from crawl_gstone_wiki import classify_page
from import_gstone_graph import validate_report_source


def classify(title, categories, html):
    soup = BeautifulSoup(
        f'<div id="mw-content-text"><div class="mw-parser-output">{html}</div></div>',
        "html.parser",
    )
    return classify_page(title, categories, [], soup)


def main():
    page_type, reasons = classify(
        "\u50b3\u5947\u89d2\u8272",
        ["\u50b3\u5947\u89d2\u8272"],
        "<h2>role list</h2><p>role type and many role links</p>",
    )
    assert page_type == "article"
    assert reasons == ["role_group_overview"]

    page_type, reasons = classify(
        "\u672b\u65e5\u9810\u8a00\u8005",
        ["\u50b3\u5947\u89d2\u8272"],
        "<h2>ability</h2><p>once per game</p>",
    )
    assert page_type == "role"
    assert reasons == ["wiki_role_category:\u50b3\u5947\u89d2\u8272"]

    page_type, reasons = classify(
        "\u5712\u4e01",
        ["\u5947\u9047\u89d2\u8272"],
        "<h2>ability</h2><p>setup adjustment</p>",
    )
    assert page_type == "role"
    assert reasons == ["wiki_role_category:\u5947\u9047\u89d2\u8272"]

    validate_report_source({
        "meta": {"base_url": "https://clocktower-wiki.gstonegames.com"},
        "pages": [{"requested_url": "https://clocktower-wiki.gstonegames.com/index.php?title=role"}],
    })
    try:
        validate_report_source({
            "pages": [{"final_url": "https://zh.moegirl.org.cn/BOTC"}],
        })
    except ValueError as exc:
        assert "Non-GStone" in str(exc)
    else:
        raise AssertionError("Moegirl source URL must be rejected")

    print({"status": "ok", "role_groups": "not_roles", "source": "gstone_only"})


if __name__ == "__main__":
    main()
