from app.core.security import hash_password
from app.models.entities import Device, Prefix, Rack, RoleEnum, Site, User, VLAN, Vrf
from app.services.audit import stamp_change


def create_initial_admin(db, *, username: str, password: str) -> User | None:
    if db.query(User).first():
        return None

    admin = User(
        username=username,
        password_hash=hash_password(password),
        role=RoleEnum.admin,
    )
    stamp_change(admin, "system")
    db.add(admin)
    db.commit()
    db.refresh(admin)
    return admin


def seed_demo_data(db, *, actor: str) -> dict[str, int]:
    created: dict[str, int] = {"vrfs": 0, "sites": 0, "prefixes": 0, "vlans": 0, "racks": 0, "devices": 0}

    default_vrf = db.query(Vrf).filter(Vrf.name == "default").first()
    if not default_vrf:
        default_vrf = Vrf(name="default", description="Default VRF")
        stamp_change(default_vrf, actor)
        db.add(default_vrf)
        db.flush()
        created["vrfs"] += 1

    site = db.query(Site).filter(Site.code == "HQ").first()
    if not site:
        site = Site(
            name="HQ",
            code="HQ",
            address="Example Street 1",
            description="Seed site",
        )
        stamp_change(site, actor)
        db.add(site)
        db.flush()
        created["sites"] += 1

    existing_prefix = (
        db.query(Prefix)
        .filter(Prefix.cidr == "10.10.0.0/24", Prefix.vrf_id == default_vrf.id, Prefix.site_id == site.id)
        .first()
    )
    if not existing_prefix:
        prefix = Prefix(
            cidr="10.10.0.0/24",
            vrf_id=default_vrf.id,
            site_id=site.id,
            role="LAN",
            status="active",
            description="Seed prefix",
        )
        stamp_change(prefix, actor)
        db.add(prefix)
        created["prefixes"] += 1

    existing_vlan = db.query(VLAN).filter(VLAN.vid == 10, VLAN.site_id == site.id).first()
    if not existing_vlan:
        vlan = VLAN(vid=10, name="Users", site_id=site.id, status="active", description="Seed vlan")
        stamp_change(vlan, actor)
        db.add(vlan)
        created["vlans"] += 1

    rack = db.query(Rack).filter(Rack.site_id == site.id, Rack.name == "R1").first()
    if not rack:
        rack = Rack(site_id=site.id, name="R1", height_u=42, description="Demo rack")
        stamp_change(rack, actor)
        db.add(rack)
        db.flush()
        created["racks"] += 1

    existing_device = db.query(Device).filter(Device.name == "patchpanel-1").first()
    if not existing_device:
        device = Device(name="patchpanel-1", role="patchpanel", rack_id=rack.id, site_id=site.id)
        stamp_change(device, actor)
        db.add(device)
        created["devices"] += 1

    db.commit()
    return created
