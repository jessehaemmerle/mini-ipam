from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.entities import AuditLog, ObjectHistory


def record_change(
    db: Session,
    *,
    username: str,
    action: str,
    object_type: str,
    object_id: int,
    diff: dict | None = None,
) -> None:
    entry = AuditLog(
        username=username,
        action=action,
        object_type=object_type,
        object_id=object_id,
        diff=diff,
    )
    history = ObjectHistory(
        object_type=object_type,
        object_id=object_id,
        changed_by=username,
        action=action,
        diff=diff,
    )
    db.add(entry)
    db.add(history)


def stamp_change(model_obj: object, username: str) -> None:
    setattr(model_obj, "last_changed_by", username)
    setattr(model_obj, "last_changed_at", datetime.now(timezone.utc))

