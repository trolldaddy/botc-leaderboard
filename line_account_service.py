from datetime import datetime

from sqlalchemy.orm import Session

import models


def reconcile_line_account(
    db: Session,
    line_user_id: str,
    display_name: str,
    picture_url: str | None,
    is_allowed_default: bool,
) -> models.StorytellerAccount:
    """Return the established account for a LINE user without deleting legacy data."""
    accounts = (
        db.query(models.StorytellerAccount)
        .filter(models.StorytellerAccount.line_user_id == line_user_id)
        .order_by(models.StorytellerAccount.id.asc())
        .all()
    )
    now = datetime.now()
    if not accounts:
        account = models.StorytellerAccount(
            line_user_id=line_user_id,
            display_name=display_name,
            picture_url=picture_url,
            is_allowed=is_allowed_default,
            last_login_at=now,
        )
        db.add(account)
        db.flush()
        return account

    account_ids = [account.id for account in accounts]
    owner_ids = {
        row[0]
        for row in db.query(models.GameRoom.created_by_id)
        .filter(models.GameRoom.created_by_id.in_(account_ids))
        .distinct()
        .all()
    }
    canonical = next((account for account in accounts if account.id in owner_ids), accounts[0])
    canonical.display_name = display_name
    canonical.picture_url = picture_url
    canonical.last_login_at = now
    canonical.is_allowed = bool(canonical.is_allowed or is_allowed_default)
    db.flush()
    return canonical
