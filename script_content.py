"""Canonical script-copy helpers shared by imports and data migrations."""


def merge_script_introductions(introduction, background_introduction):
    """Merge the legacy introduction fields without duplicating excerpts."""
    intro = (introduction or "").strip()
    background = (background_introduction or "").strip()
    if not intro:
        return background or None
    if not background:
        return intro
    intro_flat = " ".join(intro.split())
    background_flat = " ".join(background.split())
    if intro_flat == background_flat or intro_flat in background_flat:
        return background
    if background_flat in intro_flat:
        return intro
    return f"{intro}\n\n{background}"
