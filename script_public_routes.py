import base64
import json

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from account_binding_routes import get_optional_account
import models
from database import get_db
from knowledge_models import KnowledgeAlias, KnowledgeNode
from knowledge_visibility import PUBLIC_VISIBILITIES
from role_public_routes import role_card
from role_models import Role, RoleKnowledgeLink
from script_models import ScriptEntry, ScriptImage, ScriptRole, ScriptSupplement

router = APIRouter(prefix="/api/scripts", tags=["scripts-public"])


@router.get("/artwork/{script_slug}/{slot}")
def get_script_artwork(script_slug: str, slot: int, db: Session = Depends(get_db)):
    if slot not in (0, 1, 100):
        raise HTTPException(status_code=404, detail="找不到劇本圖片")
    image = db.query(ScriptImage).join(ScriptEntry).filter(
        ScriptEntry.slug == script_slug,
        ScriptImage.sort_order == slot,
    ).first()
    if not image or not image.image_data:
        raise HTTPException(status_code=404, detail="找不到劇本圖片")
    try:
        content = base64.b64decode(image.image_data, validate=True)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="劇本圖片資料已損壞")
    return Response(
        content=content,
        media_type=image.content_type or "application/octet-stream",
        headers={"Cache-Control": "public, max-age=300"},
    )


def parse_tags(value):
    if not value:
        return []
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [str(item).strip() for item in parsed if str(item).strip()]
    except (TypeError, ValueError, json.JSONDecodeError):
        pass
    return [item.strip() for item in str(value).replace("\uFF0C", ",").split(",") if item.strip()]


def can_read_storyteller_guide(account):
    return bool(account) and not bool(getattr(account, "is_banned", False))


def serialize_script(script, include_roles=False, knowledge_slugs=None, supplement_knowledge_slugs=None, account=None):
    payload = {
        "slug": script.slug, "name_zh_tw": script.name_zh_tw, "version": script.version,
        "category": script.category, "introduction": script.introduction,
        "author_name": script.author_name, "tagline": script.tagline,
        "tags": parse_tags(script.tags),
        "background_introduction": script.background_introduction,
        "gameplay_overview": script.gameplay_overview,
        "author_note": script.author_note,
        "production_updates": script.production_updates,
        "source_url": script.source_url, "source_platform": script.source_platform,
        "published_at": script.published_at.isoformat() if script.published_at else None,
        "needs_review": bool(script.needs_review),
        "is_laplace_owned": bool(script.is_laplace_owned),
        "images": [{"url": image.image_url, "alt": image.alt_text or script.name_zh_tw}
                   for image in sorted(script.images, key=lambda item: (item.sort_order, item.id))
                   if image.sort_order in (0, 1)],
        "logo_image_url": next((image.image_url for image in script.images if image.sort_order == 100), None),
        "role_count": len(script.roles),
        "special_entry_count": len(script.supplements),
    }
    payload["guides"] = {
        "player": {"content": script.player_guide or "", "available": bool(script.player_guide)},
        "storyteller": {
            "available": bool(script.storyteller_guide),
            "locked": not can_read_storyteller_guide(account),
            "login_required": account is None,
        },
    }
    if include_roles:
        payload["roles"] = [role_card(item.role, knowledge_slug=(knowledge_slugs or {}).get(item.role_id))
                            for item in sorted(script.roles, key=lambda value: (value.sort_order, value.id))
                            if item.role and item.role.is_active]
        payload["special_entries"] = [{
            "id": item.id,
            "external_id": item.external_id,
            "name_zh_tw": item.name_zh_tw,
            "team": item.entry_type,
            "image_url": item.image_url,
            "ability": item.ability,
            "knowledge_slug": (supplement_knowledge_slugs or {}).get(item.id),
        } for item in sorted(script.supplements, key=lambda value: (value.sort_order, value.id))]
    return payload


def script_load_options(include_role_records=False):
    options = [joinedload(ScriptEntry.images), joinedload(ScriptEntry.supplements)]
    options.append(joinedload(ScriptEntry.roles).joinedload(ScriptRole.role) if include_role_records
                   else joinedload(ScriptEntry.roles))
    return options


@router.get("")
def list_scripts(
    q: str = Query(default="", max_length=120),
    category: str = Query(default="", max_length=120),
    laplace: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    query = db.query(ScriptEntry).options(*script_load_options()).filter(
        ScriptEntry.is_public == True  # noqa: E712
    )
    keyword = q.strip()
    selected_category = category.strip()
    if selected_category:
        query = query.filter(ScriptEntry.category == selected_category)
    if laplace:
        query = query.filter(ScriptEntry.is_laplace_owned == True)  # noqa: E712
    if keyword:
        pattern = f"%{keyword}%"
        query = query.filter(or_(
            ScriptEntry.name_zh_tw.ilike(pattern),
            ScriptEntry.author_name.ilike(pattern),
            ScriptEntry.tagline.ilike(pattern),
            ScriptEntry.roles.any(ScriptRole.role.has(or_(
                Role.name_zh_tw.ilike(pattern),
                Role.name_en.ilike(pattern),
                Role.canonical_key.ilike(pattern),
            ))),
            ScriptEntry.supplements.any(or_(
                ScriptSupplement.name_zh_tw.ilike(pattern),
                ScriptSupplement.external_id.ilike(pattern),
            )),
        ))
    items = query.order_by(ScriptEntry.updated_at.desc(), ScriptEntry.name_zh_tw).all()
    return {
        "query": keyword,
        "category": selected_category,
        "laplace": laplace,
        "total": len(items),
        "items": [serialize_script(item) for item in items],
    }

@router.get("/{slug}")
def get_script(
    slug: str,
    db: Session = Depends(get_db),
    account: models.StorytellerAccount | None = Depends(get_optional_account),
):
    script = db.query(ScriptEntry).options(*script_load_options(include_role_records=True)).filter(
        ScriptEntry.slug == slug, ScriptEntry.is_public == True
    ).first()  # noqa: E712
    if not script:
        raise HTTPException(status_code=404, detail="找不到劇本")
    role_ids = [item.role_id for item in script.roles]
    knowledge_slugs = {}
    if role_ids:
        for role_id, slug in db.query(RoleKnowledgeLink.role_id, KnowledgeNode.slug).join(
            KnowledgeNode, KnowledgeNode.id == RoleKnowledgeLink.knowledge_node_id
        ).filter(RoleKnowledgeLink.role_id.in_(role_ids)).order_by(RoleKnowledgeLink.id).all():
            knowledge_slugs.setdefault(role_id, slug)
    supplement_knowledge_slugs = {}
    supplement_names = {item.name_zh_tw for item in script.supplements if item.name_zh_tw}
    if supplement_names:
        public_nodes = db.query(KnowledgeNode).filter(
            KnowledgeNode.visibility.in_(PUBLIC_VISIBILITIES),
            KnowledgeNode.node_type == "role",
            ~KnowledgeNode.status.in_(("deleted", "archived", "disabled")),
        )
        nodes_by_name = {
            name: node for node in public_nodes.filter(or_(
                KnowledgeNode.canonical_name_zh_tw.in_(supplement_names),
                KnowledgeNode.canonical_name_zh_cn.in_(supplement_names),
                KnowledgeNode.canonical_name_en.in_(supplement_names),
            )).all()
            for name in (node.canonical_name_zh_tw, node.canonical_name_zh_cn, node.canonical_name_en)
            if name
        }
        for alias, node in db.query(KnowledgeAlias.alias, KnowledgeNode).join(
            KnowledgeNode, KnowledgeNode.id == KnowledgeAlias.node_id
        ).filter(
            KnowledgeAlias.alias.in_(supplement_names),
            KnowledgeNode.visibility.in_(PUBLIC_VISIBILITIES),
            KnowledgeNode.node_type == "role",
            ~KnowledgeNode.status.in_(("deleted", "archived", "disabled")),
        ).all():
            nodes_by_name.setdefault(alias, node)
        for item in script.supplements:
            node = nodes_by_name.get(item.name_zh_tw)
            if node:
                supplement_knowledge_slugs[item.id] = node.slug
    return serialize_script(
        script, include_roles=True, knowledge_slugs=knowledge_slugs,
        supplement_knowledge_slugs=supplement_knowledge_slugs, account=account
    )


@router.get("/{slug}/storyteller-guide")
def get_storyteller_guide(
    slug: str,
    db: Session = Depends(get_db),
    account: models.StorytellerAccount | None = Depends(get_optional_account),
):
    script = db.query(ScriptEntry).filter(
        ScriptEntry.slug == slug,
        ScriptEntry.is_public == True,  # noqa: E712
    ).first()
    if not script:
        raise HTTPException(status_code=404, detail="\u627E\u4E0D\u5230\u5287\u672C")
    if not account:
        raise HTTPException(status_code=401, detail="\u8ACB\u5148\u4F7F\u7528 LINE \u767B\u5165")
    if not can_read_storyteller_guide(account):
        raise HTTPException(status_code=403, detail="\u6B64\u5E33\u865F\u7121\u6CD5\u67E5\u770B\u8AAA\u66F8\u4EBA\u653B\u7565")
    return {
        "slug": script.slug,
        "content": script.storyteller_guide or "",
        "available": bool(script.storyteller_guide),
    }
