from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from app.api.routes import auth, dcim, ipam, reports, search, system
from app.core.config import settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.session import engine
from app.models.entities import Device, Prefix, Rack, RoleEnum, Site, User, VLAN, Vrf

app = FastAPI(title="mini-ipam", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(ipam.router, prefix="/api")
app.include_router(dcim.router, prefix="/api")
app.include_router(search.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(system.router, prefix="/api")


@app.on_event("startup")
def bootstrap() -> None:
    Base.metadata.create_all(bind=engine)
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)

    with Session(engine) as db:
        if not db.query(User).first():
            db.add(
                User(
                    username=settings.admin_user,
                    password_hash=hash_password(settings.admin_pass),
                    role=RoleEnum.admin,
                    last_changed_by="system",
                )
            )

        default_vrf = db.query(Vrf).filter(Vrf.name == "default").first()
        if not default_vrf:
            default_vrf = Vrf(name="default", description="Default VRF", last_changed_by="system")
            db.add(default_vrf)
            db.flush()

        if not db.query(Site).first():
            site = Site(
                name="HQ",
                code="HQ",
                address="Example Street 1",
                description="Seed site",
                last_changed_by="system",
            )
            db.add(site)
            db.flush()

            db.add(Prefix(cidr="10.10.0.0/24", vrf_id=default_vrf.id, site_id=site.id, role="LAN", status="active", description="Seed prefix", last_changed_by="system"))
            db.add(VLAN(vid=10, name="Users", site_id=site.id, status="active", description="Seed vlan", last_changed_by="system"))
            rack = Rack(site_id=site.id, name="R1", height_u=42, description="Demo rack", last_changed_by="system")
            db.add(rack)
            db.flush()
            db.add(Device(name="patchpanel-1", role="patchpanel", rack_id=rack.id, site_id=site.id, last_changed_by="system"))

        db.commit()

