from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_global_navigation_renders_line_account_and_logout():
    index = (ROOT / "static/index.html").read_text(encoding="utf-8")
    css = (ROOT / "static/css/style.css").read_text(encoding="utf-8")

    assert 'id="site-account-nav-item"' in index
    assert "/api/auth/line/login?next=" in index
    assert "me.user.display_name" in index
    assert "fetch('/api/auth/logout'" in index
    assert "refreshSiteAccount();" in index
    assert ".nav-account-item" in css
    assert ".nav-account-name" in css


def test_post_logout_clears_the_auth_cookie():
    main_source = (ROOT / "main.py").read_text(encoding="utf-8")
    logout_block = main_source.split('@app.post("/api/auth/logout")', 1)[1].split(
        '@app.get("/auth/logout")', 1
    )[0]

    assert "JSONResponse" in logout_block
    assert "clear_auth_cookie(response)" in logout_block
