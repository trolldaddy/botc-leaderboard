from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_page_loader_cleans_scoped_resources():
    index = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
    assert "function createPageScope()" in index
    assert "intervals.forEach(id => globalThis.clearInterval(id))" in index
    assert "observers.forEach(observer => observer.disconnect())" in index
    assert "target.removeEventListener" in index
    assert "leaveCurrentPage(pageName)" in index
    assert "const window = __scope.window" in index
    assert "const document = __scope.document" in index


def test_non_room_navigation_removes_join_suffix():
    index = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
    assert "if (nextPage !== 'rooms')" in index
    assert "url.searchParams.delete('join')" in index
    assert "window.history.replaceState" in index


def test_babel_source_and_transform_are_cached():
    index = (ROOT / "static" / "index.html").read_text(encoding="utf-8")
    assert "__babelPageSourceCache" in index
    assert "__babelPageTransformCache" in index
    assert "Babel.transform" in index


def test_room_transfer_does_not_load_recorder_twice():
    source = (ROOT / "static" / "js" / "rooms-script.js").read_text(encoding="utf-8")
    assert "window.location.hash = 'recorder'" in source
    assert "window.loadPage('recorder')" not in source


if __name__ == "__main__":
    test_page_loader_cleans_scoped_resources()
    test_non_room_navigation_removes_join_suffix()
    test_babel_source_and_transform_are_cached()
    test_room_transfer_does_not_load_recorder_twice()
    print("page lifecycle performance contract tests passed")
