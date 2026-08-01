from gstone_wiki import parse_role_information

from scripts.seed_gstone_special_roles import (

    OVERVIEW_TITLES,
    SPECIAL_ROLE_TITLES,
    canonical_key,
    iter_special_roles,
)


def test_special_role_seed_counts_are_exact():
    assert len(SPECIAL_ROLE_TITLES["fabled"]) == 16
    assert len(SPECIAL_ROLE_TITLES["loric"]) == 11
    assert len(list(iter_special_roles())) == 27


def test_overview_pages_are_never_special_role_seeds():
    source_titles = {title for _, title in iter_special_roles()}
    assert not source_titles.intersection(OVERVIEW_TITLES)


def test_english_name_produces_stable_canonical_key():
    assert canonical_key("Spirit of Ivory", "聖潔之魂") == "spirit_of_ivory"
    assert canonical_key("Hell's Librarian", "地獄藏書員") == "hell_s_librarian"


def test_missing_english_name_has_stable_gstone_fallback():
    first = canonical_key("", "麒麟")
    assert first.startswith("gstone_special_")
    assert canonical_key("", "麒麟") == first


def test_gstone_role_icon_is_parsed_from_wiki_image():
    html = """
    <div class="mw-parser-output">
      <img alt="Doomsayer.png" src="/images/thumb/6/6c/Doomsayer.png/200px-Doomsayer.png">
      <h2>角色資訊</h2>
      <ul>
        <li>英文名：Doomsayer</li>
        <li>角色類型：傳奇角色</li>
      </ul>
    </div>
    """
    info = parse_role_information(html)

    assert info["found"] is True
    assert info["image_url"] == (
        "https://clocktower-wiki.gstonegames.com/images/thumb/6/6c/Doomsayer.png/200px-Doomsayer.png"
    )
