from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.entities import RoleEnum, SessionToken, User
from app.schemas.auth import LoginRequest, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=UserOut)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username, User.is_active.is_(True)).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(user.username, user.role.value)
    session = SessionToken(
        user_id=user.id,
        token=token,
        expires_at=datetime.now(timezone.utc) + timedelta(minutes=settings.token_expire_minutes),
        last_changed_by=user.username,
    )
    db.add(session)
    db.commit()

    response.set_cookie(
        "session_token",
        token,
        httponly=True,
        samesite="strict",
        secure=settings.cookie_secure,
        max_age=settings.token_expire_minutes * 60,
    )
    return user


@router.post("/logout")
def logout(response: Response, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    db.query(SessionToken).filter(SessionToken.user_id == user.id).delete()
    db.commit()
    response.delete_cookie("session_token")
    return {"message": "logged out"}


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user


@router.post("/bootstrap")
def bootstrap_admin(db: Session = Depends(get_db)):
    existing = db.query(User).count()
    if existing > 0:
        return {"message": "already bootstrapped"}
    admin = User(
        username=settings.admin_user,
        password_hash=hash_password(settings.admin_pass),
        role=RoleEnum.admin,
        last_changed_by="system",
    )
    db.add(admin)
    db.commit()
    return {"message": "admin created", "username": settings.admin_user}
