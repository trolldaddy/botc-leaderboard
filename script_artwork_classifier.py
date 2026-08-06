"""Classify article images by visual content instead of article order."""
from pathlib import Path

from PIL import Image, ImageFilter, ImageStat


def inspect_artwork(image, *, index=0, **metadata):
    grayscale = image.convert("L")
    width, height = grayscale.size
    sample = grayscale.copy()
    sample.thumbnail((420, 620))
    stats = ImageStat.Stat(sample)
    edge_mean = ImageStat.Stat(sample.filter(ImageFilter.FIND_EDGES)).mean[0]
    ratio = width / height if height else 0
    portrait = height > width and 0.48 <= ratio <= 0.86
    face_score = ((120 if portrait else 0) - abs(ratio - 0.70) * 80
                  + min(width * height / 250_000, 20) + min(stats.stddev[0] / 8, 12))
    return {**metadata, "index": index, "width": width, "height": height,
            "ratio": ratio, "portrait": portrait, "face_score": face_score,
            "back_score": stats.mean[0] + edge_mean * 0.55}


def inspect_artwork_path(path, *, index=0, **metadata):
    with Image.open(Path(path)) as image:
        return inspect_artwork(image, index=index, **metadata)


def select_script_faces(candidates, limit=2):
    """Select the front/back pages and return them in semantic face order."""
    viable = [item for item in candidates if item.get("portrait")]
    selected = sorted(viable or candidates,
                      key=lambda item: (-item.get("face_score", 0), item.get("index", 0)))[:limit]
    if len(selected) == 2:
        selected.sort(key=lambda item: (item.get("back_score", 0), item.get("index", 0)))
    return selected
