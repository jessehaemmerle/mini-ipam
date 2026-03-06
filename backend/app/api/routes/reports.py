from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import and_, exists, func, literal, or_
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.entities import Cable, Device, IPAddress, Interface, PatchPort, PowerConnection, PowerInlet, Prefix, RoleEnum, VLAN
from app.utils.ipam import ip_in_prefix, parse_cidr

router = APIRouter(prefix="/reports", tags=["reports"])


def _total_hosts(cidr: str) -> int:
    network = parse_cidr(cidr)
    return max(network.num_addresses - (2 if network.version == 4 and network.prefixlen < 31 else 0), 0)


def _is_postgres(db: Session) -> bool:
    bind = db.get_bind()
    return bool(bind and bind.dialect.name == "postgresql")


@router.get("/ip-utilization")
def ip_utilization(
    site_id: int | None = None,
    vrf_id: int | None = None,
    limit: int = 200,
    offset: int = 0,
    db: Session = Depends(get_db),
    _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly)),
):
    query = db.query(Prefix)
    if site_id:
        query = query.filter(Prefix.site_id == site_id)
    if vrf_id:
        query = query.filter(Prefix.vrf_id == vrf_id)
    prefixes = query.order_by(Prefix.cidr.asc()).offset(offset).limit(limit).all()

    if not prefixes:
        return []

    used_by_prefix: dict[int, int] = {}
    if _is_postgres(db):
        prefix_ids = [item.id for item in prefixes]
        rows = (
            db.query(Prefix.id.label("prefix_id"), func.count(IPAddress.id).label("used"))
            .join(
                IPAddress,
                and_(
                    IPAddress.vrf_id == Prefix.vrf_id,
                    IPAddress.status.in_(["reserved", "assigned"]),
                    IPAddress.address.cast(postgresql.INET).op("<<")(Prefix.cidr.cast(postgresql.CIDR)),
                ),
            )
            .filter(Prefix.id.in_(prefix_ids))
            .group_by(Prefix.id)
            .all()
        )
        used_by_prefix = {int(row.prefix_id): int(row.used) for row in rows}
    else:
        vrf_ids = sorted({item.vrf_id for item in prefixes})
        ips = (
            db.query(IPAddress.address, IPAddress.vrf_id, IPAddress.status)
            .filter(IPAddress.vrf_id.in_(vrf_ids), IPAddress.status.in_(["reserved", "assigned"]))
            .all()
        )

        by_vrf: dict[int, list[str]] = defaultdict(list)
        for address, item_vrf_id, _ in ips:
            by_vrf[item_vrf_id].append(address)

        for prefix in prefixes:
            used_by_prefix[prefix.id] = sum(1 for address in by_vrf[prefix.vrf_id] if ip_in_prefix(address, prefix.cidr))

    result = []
    for prefix in prefixes:
        total = _total_hosts(prefix.cidr)
        used = used_by_prefix.get(prefix.id, 0)
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
    counts: defaultdict[tuple[str, int], int] = defaultdict(int)
    for cable in db.query(Cable).filter(Cable.status == "active").all():
        counts[(cable.endpoint_a_type, cable.endpoint_a_id)] += 1
        counts[(cable.endpoint_b_type, cable.endpoint_b_id)] += 1
    port_conflicts = [
        {"endpoint_type": endpoint_type, "endpoint_id": endpoint_id, "count": count}
        for (endpoint_type, endpoint_id), count in counts.items()
        if count > 1
    ]
    return {
        "duplicate_ips": [dict(item._mapping) for item in duplicate_ips],
        "vlan_conflicts": [dict(item._mapping) for item in vlan_conflicts],
        "port_conflicts": port_conflicts,
    }


@router.get("/unassigned-interfaces")
def unassigned_interfaces(
    limit: int = 200,
    offset: int = 0,
    db: Session = Depends(get_db),
    _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly)),
):
    connected = (
        db.query(Cable.endpoint_a_id.label("interface_id"))
        .filter(Cable.endpoint_a_type == "interface")
        .union(db.query(Cable.endpoint_b_id.label("interface_id")).filter(Cable.endpoint_b_type == "interface"))
        .subquery()
    )
    return (
        db.query(Interface)
        .outerjoin(connected, Interface.id == connected.c.interface_id)
        .filter(
            connected.c.interface_id.is_(None),
            Interface.access_vlan_id.is_(None),
            Interface.native_vlan_id.is_(None),
            or_(Interface.allowed_vlans.is_(None), Interface.allowed_vlans == ""),
        )
        .order_by(Interface.id.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/cable-orphans")
def cable_orphans(
    limit: int = 200,
    offset: int = 0,
    db: Session = Depends(get_db),
    _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly)),
):
    endpoint_missing = or_(
        and_(
            Cable.endpoint_a_type == "interface",
            ~exists().where(Interface.id == Cable.endpoint_a_id),
        ),
        and_(
            Cable.endpoint_a_type == "patch_port",
            ~exists().where(PatchPort.id == Cable.endpoint_a_id),
        ),
        and_(
            Cable.endpoint_b_type == "interface",
            ~exists().where(Interface.id == Cable.endpoint_b_id),
        ),
        and_(
            Cable.endpoint_b_type == "patch_port",
            ~exists().where(PatchPort.id == Cable.endpoint_b_id),
        ),
    )
    return (
        db.query(Cable)
        .filter(endpoint_missing)
        .order_by(Cable.id.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )


@router.get("/power-orphans")
def power_orphans(
    limit: int = 200,
    offset: int = 0,
    db: Session = Depends(get_db),
    _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly)),
):
    return (
        db.query(Device)
        .join(PowerInlet, PowerInlet.device_id == Device.id)
        .outerjoin(
            PowerConnection,
            and_(
                PowerConnection.src_type == literal("power_inlet"),
                PowerConnection.src_id == PowerInlet.id,
            ),
        )
        .filter(PowerConnection.id.is_(None))
        .distinct()
        .order_by(Device.id.asc())
        .offset(offset)
        .limit(limit)
        .all()
    )

