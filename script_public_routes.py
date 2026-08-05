from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from database import get_db
from role_public_routes import role_card
from script_models import ScriptEntry, ScriptRole

router = APIRouter(prefix="/api/scripts", tags=["scripts-public"])


def serialize_script(script, include_roles=False):
    payload = {
        "slug": script.slug, "name_zh_tw": script.name_zh_tw, "version": script.version,
        "category": script.category, "introduction": script.introduction,
        "source_url": script.source_url, "source_platform": script.source_platform,
        "published_at": script.published_at.isoformat() if script.published_at else None,
        "needs_review": bool(script.needs_review),
        "images": [{"url": image.image_url, "alt": image.alt_text or script.name_zh_tw}
                   for image in sorted(script.images, key=lambda item: (item.sort_order, item.id))],
        "role_count": len(script.roles),
    }
    if include_roles:
        payload["roles"] = [role_card(item.role)
                            for item in sorted(script.roles, key=lambda value: (value.sort_order, value.id))
                            if item.role and item.role.is_active]
    return payload


@router.get("")
def list_scripts(q: str = Query(default="", max_length=120), db: Session = Depends(get_db)):
    query = db.query(ScriptEntry).options(joinedload(ScriptEntry.images), joinedload(ScriptEntry.roles)).filter(
        ScriptEntry.is_public == True  # noqa: E712
    )
    keyword = q.strip()
    if keyword:
        query = query.filter(ScriptEntry.name_zh_tw.ilike(f"%{keyword}%"))
    items = query.order_by(ScriptEntry.updated_at.desc(), ScriptEntry.name_zh_tw).all()
    return {"query": keyword, "total": len(items), "items": [serialize_script(item) for item in items]}


@router.get("/{slug}")
def get_script(slug: str, db: Session = Depends(get_db)):
    script = db.query(ScriptEntry).options(
        joinedload(ScriptEntry.images),
        joinedload(ScriptEntry.roles).joinedload(ScriptRole.role),
    ).filter(ScriptEntry.slug == slug, ScriptEntry.is_public == True).first()  # noqa: E712
    if not script:
        raise HTTPException(status_code=404, detail="找不到劇本")
    return serialize_script(script, include_roles=True)
