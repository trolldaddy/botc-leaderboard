from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

import models
from account_binding_routes import require_admin_account
from database import get_db
from gstone_wiki import fetch_role_reminders
from role_models import Role, RoleReminder
from role_reminder_merge import (
    GSTONE_REMINDER_SOURCE,
    PROTECTED_REMINDER_SOURCES,
    automated_canonical,
    find_matching_group,
    normalized_source,
    preferred_reminders,
    redundant_automated_reminders,
)

router = APIRouter(prefix="/role-reminders", tags=["role-reminders"])


def serialize(reminder: RoleReminder):
    return {
        "id": reminder.id,
        "role_id": reminder.role_id,
        "label_zh_tw": reminder.label_zh_tw,
        "scope": reminder.scope,
        "sort_order": reminder.sort_order,
        "placement_timing": reminder.placement_timing or "",
        "placement_condition": reminder.placement_condition or "",
        "removal_timing": reminder.removal_timing or "",
        "special_notes": reminder.special_notes or "",
        "source": reminder.source,
        "source_url": reminder.source_url or "",
        "needs_review": bool(reminder.needs_review),
    }


@router.get("/{role_id}")
def list_reminders(role_id: int, db: Session = Depends(get_db), admin: models.StorytellerAccount = Depends(require_admin_account)):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="找不到角色")
    items = db.query(RoleReminder).filter(RoleReminder.role_id == role_id).order_by(RoleReminder.scope.asc(), RoleReminder.sort_order.asc(), RoleReminder.id.asc()).all()
    return [serialize(item) for item in preferred_reminders(items)]


@router.post("/{role_id}/gstone-preview")
def gstone_preview(role_id: int, db: Session = Depends(get_db), admin: models.StorytellerAccount = Depends(require_admin_account)):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="找不到角色")
    try:
        result = fetch_role_reminders(role.name_zh_tw)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"讀取 GStone 官方百科失敗：{type(exc).__name__}: {exc}")
    result["role_id"] = role.id
    result["role_name"] = role.name_zh_tw
    return result


@router.post("/{role_id}/gstone-apply")
def gstone_apply(role_id: int, data: dict, db: Session = Depends(get_db), admin: models.StorytellerAccount = Depends(require_admin_account)):
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(status_code=404, detail="找不到角色")
    reminders = data.get("reminders") or []
    source_url = str(data.get("source_url") or "").strip() or None
    created = updated = merged = protected = 0
    existing = db.query(RoleReminder).filter(RoleReminder.role_id == role.id).order_by(RoleReminder.id).all()
    for index, incoming in enumerate(reminders):
        label = str(incoming.get("label") or incoming.get("label_zh_tw") or "").strip()
        if not label:
            continue
        group = find_matching_group(existing, label, scope="role")
        protected_items = [
            item for item in group
            if normalized_source(item.source) in PROTECTED_REMINDER_SOURCES
        ]
        if protected_items:
            protected += 1
            continue
        item = automated_canonical(group)
        if not item:
            item = RoleReminder(role_id=role.id, label_zh_tw=label, scope="role")
            db.add(item)
            existing.append(item)
            created += 1
        else:
            updated += 1
        for duplicate in redundant_automated_reminders(group):
            db.delete(duplicate)
            if duplicate in existing:
                existing.remove(duplicate)
            merged += 1
        item.label_zh_tw = label
        item.sort_order = index
        item.placement_timing = incoming.get("placement_timing") or None
        item.placement_condition = incoming.get("placement_condition") or None
        item.removal_timing = incoming.get("removal_timing") or None
        item.special_notes = incoming.get("special_notes") or None
        item.source = GSTONE_REMINDER_SOURCE
        item.source_url = source_url
        item.needs_review = True
    db.commit()
    return {
        "status": "success",
        "created": created,
        "updated": updated,
        "merged": merged,
        "protected": protected,
    }


@router.patch("/{role_id}/{reminder_id}")
def update_reminder(role_id: int, reminder_id: int, data: dict, db: Session = Depends(get_db), admin: models.StorytellerAccount = Depends(require_admin_account)):
    item = db.query(RoleReminder).filter(RoleReminder.id == reminder_id, RoleReminder.role_id == role_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="找不到提示標記")
    for field in ["label_zh_tw", "scope", "sort_order", "placement_timing", "placement_condition", "removal_timing", "special_notes", "source_url", "needs_review"]:
        if field in data:
            setattr(item, field, data.get(field))
    db.commit()
    db.refresh(item)
    return {"status": "success", "reminder": serialize(item)}
