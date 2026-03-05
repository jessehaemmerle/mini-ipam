from fastapi import APIRouter, Depends
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.entities import Cable, Device, IPAddress, Interface, PowerConnection, PowerInlet, Prefix, RoleEnum, VLAN
from app.utils.ipam import ip_in_prefix, parse_cidr

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/ip-utilization")
def ip_utilization(site_id: int | None = None, vrf_id: int | None = None, db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    query = db.query(Prefix)
    if site_id:
        query = query.filter(Prefix.site_id == site_id)
    if vrf_id:
        query = query.filter(Prefix.vrf_id == vrf_id)

    prefixes = query.all()
    ips = db.query(IPAddress).all()
    result = []
    for prefix in prefixes:
        network = parse_cidr(prefix.cidr)
        total = max(network.num_addresses - (2 if network.version == 4 and network.prefixlen < 31 else 0), 0)
        used = sum(1 for ip in ips if ip.vrf_id == prefix.vrf_id and ip.status in {"reserved", "assigned"} and ip_in_prefix(ip.address, prefix.cidr))
        result.append({"prefix": prefix.cidr, "vrf_id": prefix.vrf_id, "site_id": prefix.site_id, "used": used, "free": max(total - used, 0), "utilization_pct": round((used / total) * 100, 2) if total else 0})
    return result


@router.get("/conflicts")
def conflicts(db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    duplicate_ips = (
        db.query(IPAddress.address, IPAddress.vrf_id, func.count(IPAddress.id).label("count"))
        .group_by(IPAddress.address, IPAddress.vrf_id)
        .having(func.count(IPAddress.id) > 1)
        .all()
    )
    vlan_conflicts = (
        db.query(VLAN.vid, VLAN.site_id, func.count(VLAN.id).label("count"))
        .group_by(VLAN.vid, VLAN.site_id)
        .having(func.count(VLAN.id) > 1)
        .all()
    )
    port_conflicts = (
        db.query(Cable.endpoint_a_type, Cable.endpoint_a_id, func.count(Cable.id).label("count"))
        .filter(Cable.status == "active")
        .group_by(Cable.endpoint_a_type, Cable.endpoint_a_id)
        .having(func.count(Cable.id) > 1)
        .all()
    )
    return {
        "duplicate_ips": [dict(item._mapping) for item in duplicate_ips],
        "vlan_conflicts": [dict(item._mapping) for item in vlan_conflicts],
        "port_conflicts": [dict(item._mapping) for item in port_conflicts],
    }


@router.get("/unassigned-interfaces")
def unassigned_interfaces(db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    connected_ids = set(
        [x[0] for x in db.query(Cable.endpoint_a_id).filter(Cable.endpoint_a_type == "interface").all()]
        + [x[0] for x in db.query(Cable.endpoint_b_id).filter(Cable.endpoint_b_type == "interface").all()]
    )
    all_interfaces = db.query(Interface).all()
    return [
        item
        for item in all_interfaces
        if item.id not in connected_ids and not item.access_vlan_id and not item.native_vlan_id and not item.allowed_vlans
    ]


@router.get("/cable-orphans")
def cable_orphans(db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    interfaces = {item.id for item in db.query(Interface.id).all()}
    cables = db.query(Cable).all()
    orphans = []
    for cable in cables:
        a_exists = cable.endpoint_a_type != "interface" or cable.endpoint_a_id in interfaces
        b_exists = cable.endpoint_b_type != "interface" or cable.endpoint_b_id in interfaces
        if not a_exists or not b_exists:
            orphans.append(cable)
    return orphans


@router.get("/power-orphans")
def power_orphans(db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    inlet_ids = {item.id for item in db.query(PowerInlet).all()}
    connected = {item.src_id for item in db.query(PowerConnection).filter(PowerConnection.src_type == "power_inlet").all()}
    device_ids = [item.device_id for item in db.query(PowerInlet).filter(PowerInlet.id.in_(inlet_ids - connected)).all()]
    return db.query(Device).filter(Device.id.in_(device_ids)).all()

