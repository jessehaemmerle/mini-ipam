from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.core.config import settings
from app.db.session import get_db
from app.models.entities import Attachment, Comment, RoleEnum, Tag, TagLink
from app.services.audit import stamp_change

router = APIRouter(prefix="/system", tags=["system"])


@router.get("/healthz")
def healthz():
    return {"status": "ok"}


@router.get("/readyz")
def readyz(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"status": "ready"}


@router.get("/tags")
def list_tags(db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    return db.query(Tag).order_by(Tag.name.asc()).all()


@router.post("/tags")
def create_tag(name: str, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    tag = Tag(name=name)
    stamp_change(tag, user.username)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return tag


@router.post("/tag-links")
def create_tag_link(tag_id: int, object_type: str, object_id: int, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = TagLink(tag_id=tag_id, object_type=object_type, object_id=object_id)
    stamp_change(obj, user.username)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/comments")
def list_comments(object_type: str, object_id: int, db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    return db.query(Comment).filter(Comment.object_type == object_type, Comment.object_id == object_id).all()


@router.post("/comments")
def create_comment(object_type: str = Form(...), object_id: int = Form(...), content: str = Form(...), db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = Comment(object_type=object_type, object_id=object_id, content=content, created_by=user.username)
    stamp_change(obj, user.username)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/attachments")
def upload_attachment(
    object_type: str = Form(...),
    object_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor)),
):
    upload_root = Path(settings.upload_dir)
    upload_root.mkdir(parents=True, exist_ok=True)
    safe_filename = Path(file.filename).name
    target = upload_root / f"{object_type}_{object_id}_{safe_filename}"
    target.write_bytes(file.file.read())

    obj = Attachment(object_type=object_type, object_id=object_id, filename=safe_filename, stored_path=str(target))
    stamp_change(obj, user.username)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/attachments")
def list_attachments(object_type: str, object_id: int, db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    return db.query(Attachment).filter(Attachment.object_type == object_type, Attachment.object_id == object_id).all()

