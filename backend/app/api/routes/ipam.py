import csv
import io
import ipaddress
from ipaddress import summarize_address_range

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy import and_, func, literal
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.entities import IPAddress, ObjectHistory, Prefix, RoleEnum, VLAN, Vrf
from app.schemas.ipam import BulkReserveRequest, IPCreate, PrefixCreate, PrefixSplitRequest, VLANCreate, VrfCreate
from app.services.audit import record_change, stamp_change
from app.utils.ipam import ip_in_prefix, next_free_ip, parse_cidr, parse_ip, split_prefix

router = APIRouter(prefix="/ipam", tags=["ipam"])


def _is_postgres(db: Session) -> bool:
    bind = db.get_bind()
    return bool(bind and bind.dialect.name == "postgresql")


def _count_used_ips_in_prefix(db: Session, *, prefix: Prefix) -> int:
    if _is_postgres(db):
        return int(
            db.query(func.count(IPAddress.id))
            .filter(
                IPAddress.vrf_id == prefix.vrf_id,
                IPAddress.status.in_(["reserved", "assigned"]),
                IPAddress.address.cast(postgresql.INET).op("<<")(literal(prefix.cidr).cast(postgresql.CIDR)),
            )
            .scalar()
            or 0
        )

    ips = (
        db.query(IPAddress.address)
        .filter(IPAddress.vrf_id == prefix.vrf_id, IPAddress.status.in_(["reserved", "assigned"]))
        .all()
    )
    return sum(1 for (address,) in ips if ip_in_prefix(address, prefix.cidr))


def _query_ips_in_prefix(
    db: Session,
    *,
    prefix: Prefix,
    statuses: list[str] | None = None,
    limit: int | None = None,
    offset: int = 0,
) -> list[IPAddress]:
    query = db.query(IPAddress).filter(IPAddress.vrf_id == prefix.vrf_id)
    if statuses:
        query = query.filter(IPAddress.status.in_(statuses))

    if _is_postgres(db):
        query = query.filter(
            IPAddress.address.cast(postgresql.INET).op("<<")(literal(prefix.cidr).cast(postgresql.CIDR))
        )
        query = query.order_by(IPAddress.address.asc()).offset(offset)
        if limit is not None:
            query = query.limit(limit)
        return query.all()

    items = query.order_by(IPAddress.address.asc()).all()
    filtered = [item for item in items if ip_in_prefix(item.address, prefix.cidr)]
    if offset:
        filtered = filtered[offset:]
    if limit is not None:
        filtered = filtered[:limit]
    return filtered


def _validate_assignment(payload: IPCreate) -> None:
    if payload.assigned_type is None and payload.assigned_id is None:
        return
    raise HTTPException(status_code=400, detail="assigned_type/assigned_id are not supported in IPAM-only mode")


@router.get("/vrfs")
def list_vrfs(db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    return db.query(Vrf).order_by(Vrf.name.asc()).all()


@router.post("/vrfs")
def create_vrf(payload: VrfCreate, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = Vrf(name=payload.name, description=payload.description)
    stamp_change(obj, user.username)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    record_change(db, username=user.username, action="create", object_type="vrf", object_id=obj.id, diff=payload.model_dump())
    db.commit()
    return obj


@router.put("/vrfs/{vrf_id}")
def update_vrf(vrf_id: int, payload: VrfCreate, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = db.query(Vrf).filter(Vrf.id == vrf_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="VRF not found")
    old = {"name": obj.name, "description": obj.description}
    obj.name = payload.name
    obj.description = payload.description
    stamp_change(obj, user.username)
    db.commit()
    db.refresh(obj)
    record_change(db, username=user.username, action="update", object_type="vrf", object_id=obj.id, diff={"old": old, "new": payload.model_dump()})
    db.commit()
    return obj


@router.delete("/vrfs/{vrf_id}")
def delete_vrf(vrf_id: int, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = db.query(Vrf).filter(Vrf.id == vrf_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="VRF not found")
    obj_id = obj.id
    db.delete(obj)
    record_change(db, username=user.username, action="delete", object_type="vrf", object_id=obj_id, diff=None)
    db.commit()
    return {"deleted": obj_id}


@router.get("/prefixes")
def list_prefixes(
    db: Session = Depends(get_db),
    site_id: int | None = None,
    vrf_id: int | None = None,
    role: str | None = None,
    status: str | None = None,
    limit: int | None = None,
    offset: int = 0,
    _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly)),
):
    query = db.query(Prefix)
    if site_id:
        query = query.filter(Prefix.site_id == site_id)
    if vrf_id:
        query = query.filter(Prefix.vrf_id == vrf_id)
    if role:
        query = query.filter(Prefix.role == role)
    if status:
        query = query.filter(Prefix.status == status)
    query = query.order_by(Prefix.cidr.asc()).offset(offset)
    if limit is not None:
        query = query.limit(limit)
    return query.all()


@router.post("/prefixes")
def create_prefix(payload: PrefixCreate, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    parse_cidr(payload.cidr)

    exists = db.query(Prefix).filter(and_(Prefix.cidr == payload.cidr, Prefix.vrf_id == payload.vrf_id)).first()
    if exists:
        raise HTTPException(status_code=409, detail="Prefix already exists in VRF")

    obj = Prefix(**payload.model_dump())
    stamp_change(obj, user.username)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    record_change(db, username=user.username, action="create", object_type="prefix", object_id=obj.id, diff=payload.model_dump())
    db.commit()
    return obj


@router.put("/prefixes/{prefix_id}")
def update_prefix(prefix_id: int, payload: PrefixCreate, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = db.query(Prefix).filter(Prefix.id == prefix_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Prefix not found")
    parse_cidr(payload.cidr)
    duplicate = (
        db.query(Prefix)
        .filter(Prefix.id != prefix_id, Prefix.cidr == payload.cidr, Prefix.vrf_id == payload.vrf_id)
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="Prefix already exists in VRF")
    old = {"cidr": obj.cidr, "vrf_id": obj.vrf_id, "site_id": obj.site_id, "role": obj.role, "status": obj.status, "description": obj.description}
    for key, value in payload.model_dump().items():
        setattr(obj, key, value)
    stamp_change(obj, user.username)
    db.commit()
    db.refresh(obj)
    record_change(db, username=user.username, action="update", object_type="prefix", object_id=obj.id, diff={"old": old, "new": payload.model_dump()})
    db.commit()
    return obj


@router.delete("/prefixes/{prefix_id}")
def delete_prefix(prefix_id: int, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = db.query(Prefix).filter(Prefix.id == prefix_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Prefix not found")
    obj_id = obj.id
    db.delete(obj)
    record_change(db, username=user.username, action="delete", object_type="prefix", object_id=obj_id, diff=None)
    db.commit()
    return {"deleted": obj_id}


@router.get("/prefixes/{prefix_id}/utilization")
def prefix_utilization(prefix_id: int, db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    prefix = db.query(Prefix).filter(Prefix.id == prefix_id).first()
    if not prefix:
        raise HTTPException(status_code=404, detail="Prefix not found")
    network = parse_cidr(prefix.cidr)
    total_hosts = max(network.num_addresses - (2 if network.version == 4 and network.prefixlen < 31 else 0), 0)
    used = _count_used_ips_in_prefix(db, prefix=prefix)
    free = max(total_hosts - used, 0)
    pct = round((used / total_hosts) * 100, 2) if total_hosts else 0
    return {"prefix": prefix.cidr, "used": used, "free": free, "utilization_pct": pct}


@router.get("/prefixes/{prefix_id}/detail")
def prefix_detail(
    prefix_id: int,
    ip_limit: int = 500,
    ip_offset: int = 0,
    db: Session = Depends(get_db),
    _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly)),
):
    prefix = db.query(Prefix).filter(Prefix.id == prefix_id).first()
    if not prefix:
        raise HTTPException(status_code=404, detail="Prefix not found")

    utilization = prefix_utilization(prefix_id=prefix_id, db=db)
    next_ip = prefix_next_free_ip(prefix_id=prefix_id, db=db)
    ips = _query_ips_in_prefix(db, prefix=prefix, limit=ip_limit, offset=ip_offset)
    history = (
        db.query(ObjectHistory)
        .filter(ObjectHistory.object_type == "prefix", ObjectHistory.object_id == prefix.id)
        .order_by(ObjectHistory.changed_at.desc())
        .limit(20)
        .all()
    )
    return {
        "overview": prefix,
        "utilization": utilization,
        "next_free_ip": next_ip["next_free_ip"],
        "ips": ips,
        "history": history,
    }


@router.get("/prefixes/{prefix_id}/next-free-ip")
def prefix_next_free_ip(prefix_id: int, db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    prefix = db.query(Prefix).filter(Prefix.id == prefix_id).first()
    if not prefix:
        raise HTTPException(status_code=404, detail="Prefix not found")
    used_ips = [
        item.address
        for item in _query_ips_in_prefix(
            db,
            prefix=prefix,
            statuses=["reserved", "assigned"],
            limit=None,
            offset=0,
        )
    ]
    free_ip = next_free_ip(prefix.cidr, used_ips)
    return {"next_free_ip": free_ip}


@router.post("/prefixes/{prefix_id}/split")
def prefix_split(prefix_id: int, payload: PrefixSplitRequest, db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    prefix = db.query(Prefix).filter(Prefix.id == prefix_id).first()
    if not prefix:
        raise HTTPException(status_code=404, detail="Prefix not found")
    result = split_prefix(prefix.cidr, payload.new_prefix_length)
    return {"subprefixes": result}


@router.post("/prefixes/merge")
def prefix_merge(cidr_list: list[str], _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    if len(cidr_list) < 2:
        raise HTTPException(status_code=400, detail="Need at least two prefixes")
    nets = [parse_cidr(item) for item in cidr_list]
    merged = summarize_address_range(min(net.network_address for net in nets), max(net.broadcast_address for net in nets))
    return {"merged": [str(item) for item in merged]}


@router.get("/ips")
def list_ips(
    db: Session = Depends(get_db),
    q: str | None = None,
    limit: int | None = None,
    offset: int = 0,
    _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly)),
):
    query = db.query(IPAddress)
    if q:
        query = query.filter(IPAddress.address.ilike(f"%{q}%"))
    query = query.order_by(IPAddress.address.asc()).offset(offset)
    if limit is not None:
        query = query.limit(limit)
    return query.all()


@router.post("/ips")
def create_ip(payload: IPCreate, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    parse_ip(payload.address)
    _validate_assignment(payload)
    duplicate = db.query(IPAddress).filter(IPAddress.address == payload.address, IPAddress.vrf_id == payload.vrf_id).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="Duplicate IP in VRF")

    if not payload.out_of_scope:
        in_scope = db.query(Prefix).filter(Prefix.vrf_id == payload.vrf_id).all()
        if in_scope and not any(ip_in_prefix(payload.address, item.cidr) for item in in_scope):
            raise HTTPException(status_code=400, detail="IP does not belong to known prefix in VRF")

    obj = IPAddress(**payload.model_dump())
    stamp_change(obj, user.username)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    record_change(db, username=user.username, action="create", object_type="ip_address", object_id=obj.id, diff=payload.model_dump())
    db.commit()
    return obj


@router.put("/ips/{ip_id}")
def update_ip(ip_id: int, payload: IPCreate, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = db.query(IPAddress).filter(IPAddress.id == ip_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="IP not found")
    parse_ip(payload.address)
    _validate_assignment(payload)
    duplicate = (
        db.query(IPAddress)
        .filter(IPAddress.id != ip_id, IPAddress.address == payload.address, IPAddress.vrf_id == payload.vrf_id)
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="Duplicate IP in VRF")
    old = {"address": obj.address, "vrf_id": obj.vrf_id, "status": obj.status, "dns_name": obj.dns_name, "description": obj.description, "assigned_type": obj.assigned_type, "assigned_id": obj.assigned_id}
    for key, value in payload.model_dump().items():
        setattr(obj, key, value)
    stamp_change(obj, user.username)
    db.commit()
    db.refresh(obj)
    record_change(db, username=user.username, action="update", object_type="ip_address", object_id=obj.id, diff={"old": old, "new": payload.model_dump()})
    db.commit()
    return obj


@router.delete("/ips/{ip_id}")
def delete_ip(ip_id: int, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = db.query(IPAddress).filter(IPAddress.id == ip_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="IP not found")
    obj_id = obj.id
    db.delete(obj)
    record_change(db, username=user.username, action="delete", object_type="ip_address", object_id=obj_id, diff=None)
    db.commit()
    return {"deleted": obj_id}


@router.post("/ips/bulk-reserve")
def bulk_reserve(payload: BulkReserveRequest, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    start_ip = parse_ip(payload.start_ip)
    end_ip = parse_ip(payload.end_ip)
    if start_ip.version != end_ip.version:
        raise HTTPException(status_code=400, detail="Mixed IP versions are not allowed")
    if int(start_ip) > int(end_ip):
        raise HTTPException(status_code=400, detail="Invalid range")

    created = []
    current = int(start_ip)
    while current <= int(end_ip):
        value = str(ipaddress.ip_address(current))
        current += 1
        exists = db.query(IPAddress).filter(IPAddress.address == value, IPAddress.vrf_id == payload.vrf_id).first()
        if exists:
            continue
        item = IPAddress(
            address=value,
            vrf_id=payload.vrf_id,
            status="reserved",
            description=payload.description,
        )
        stamp_change(item, user.username)
        db.add(item)
        created.append(value)
    db.commit()
    return {"created": len(created), "items": created}


@router.get("/vlans")
def list_vlans(db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    return db.query(VLAN).order_by(VLAN.vid.asc()).all()


@router.post("/vlans")
def create_vlan(payload: VLANCreate, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    duplicate = db.query(VLAN).filter(VLAN.vid == payload.vid, VLAN.site_id == payload.site_id).first()
    if duplicate:
        raise HTTPException(status_code=409, detail="VLAN conflict in site scope")
    obj = VLAN(**payload.model_dump())
    stamp_change(obj, user.username)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    record_change(db, username=user.username, action="create", object_type="vlan", object_id=obj.id, diff=payload.model_dump())
    db.commit()
    return obj


@router.put("/vlans/{vlan_id}")
def update_vlan(vlan_id: int, payload: VLANCreate, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = db.query(VLAN).filter(VLAN.id == vlan_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="VLAN not found")
    duplicate = (
        db.query(VLAN)
        .filter(VLAN.id != vlan_id, VLAN.vid == payload.vid, VLAN.site_id == payload.site_id)
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="VLAN conflict in site scope")
    old = {"vid": obj.vid, "name": obj.name, "site_id": obj.site_id, "status": obj.status, "description": obj.description}
    for key, value in payload.model_dump().items():
        setattr(obj, key, value)
    stamp_change(obj, user.username)
    db.commit()
    db.refresh(obj)
    record_change(db, username=user.username, action="update", object_type="vlan", object_id=obj.id, diff={"old": old, "new": payload.model_dump()})
    db.commit()
    return obj


@router.delete("/vlans/{vlan_id}")
def delete_vlan(vlan_id: int, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = db.query(VLAN).filter(VLAN.id == vlan_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="VLAN not found")
    obj_id = obj.id
    db.delete(obj)
    record_change(db, username=user.username, action="delete", object_type="vlan", object_id=obj_id, diff=None)
    db.commit()
    return {"deleted": obj_id}


@router.get("/export/{object_type}")
def export_csv(object_type: str, db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    mapping = {
        "prefixes": (Prefix, ["cidr", "vrf", "site", "role", "status", "description"]),
        "ipaddresses": (IPAddress, ["address", "vrf", "status", "dns_name", "description", "assigned_type", "assigned_to"]),
        "vlans": (VLAN, ["vid", "name", "site", "status", "description"]),
    }
    if object_type not in mapping:
        raise HTTPException(status_code=404, detail="unsupported export type")
    model, fields = mapping[object_type]
    rows = db.query(model).all()

    stream = io.StringIO()
    writer = csv.DictWriter(stream, fieldnames=fields)
    writer.writeheader()
    for row in rows:
        if object_type == "prefixes":
            writer.writerow(
                {
                    "cidr": row.cidr,
                    "vrf": row.vrf_id,
                    "site": row.site_id,
                    "role": row.role,
                    "status": row.status,
                    "description": row.description,
                }
            )
        elif object_type == "ipaddresses":
            writer.writerow(
                {
                    "address": row.address,
                    "vrf": row.vrf_id,
                    "status": row.status,
                    "dns_name": row.dns_name,
                    "description": row.description,
                    "assigned_type": row.assigned_type,
                    "assigned_to": row.assigned_id,
                }
            )
        else:
            writer.writerow(
                {
                    "vid": row.vid,
                    "name": row.name,
                    "site": row.site_id,
                    "status": row.status,
                    "description": row.description,
                }
            )
    stream.seek(0)
    return StreamingResponse(stream, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={object_type}.csv"})


@router.post("/import/{object_type}")
def import_csv(object_type: str, file: UploadFile = File(...), db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    content = file.file.read().decode("utf-8")
    reader = csv.DictReader(io.StringIO(content))
    inserted = 0

    for row in reader:
        if object_type == "prefixes":
            payload = PrefixCreate(
                cidr=row["cidr"],
                vrf_id=int(row.get("vrf") or row.get("vrf_id")),
                site_id=int(row.get("site") or row.get("site_id")) if (row.get("site") or row.get("site_id")) else None,
                role=row.get("role") or "LAN",
                status=row.get("status") or "active",
                description=row.get("description"),
            )
            try:
                create_prefix(payload, db, user)
                inserted += 1
            except HTTPException:
                continue
        elif object_type == "ipaddresses":
            payload = IPCreate(
                address=row["address"],
                vrf_id=int(row.get("vrf") or row.get("vrf_id")),
                status=row.get("status") or "free",
                dns_name=row.get("dns_name"),
                description=row.get("description"),
                assigned_type=row.get("assigned_type"),
                assigned_id=int(row.get("assigned_to") or row.get("assigned_id")) if (row.get("assigned_to") or row.get("assigned_id")) else None,
            )
            try:
                create_ip(payload, db, user)
                inserted += 1
            except HTTPException:
                continue
        elif object_type == "vlans":
            payload = VLANCreate(
                vid=int(row["vid"]),
                name=row["name"],
                site_id=int(row.get("site") or row.get("site_id")) if (row.get("site") or row.get("site_id")) else None,
                status=row.get("status") or "active",
                description=row.get("description"),
            )
            try:
                create_vlan(payload, db, user)
                inserted += 1
            except HTTPException:
                continue
        else:
            raise HTTPException(status_code=404, detail="unsupported import type")

    return {"inserted": inserted}


@router.get("/history/{object_type}/{object_id}")
def object_history(object_type: str, object_id: int, db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    from app.models.entities import ObjectHistory

    return (
        db.query(ObjectHistory)
        .filter(ObjectHistory.object_type == object_type, ObjectHistory.object_id == object_id)
        .order_by(ObjectHistory.changed_at.desc())
        .all()
    )


@router.get("/stats")
def ipam_stats(db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    return {
        "prefixes": db.query(func.count(Prefix.id)).scalar(),
        "ips": db.query(func.count(IPAddress.id)).scalar(),
        "vlans": db.query(func.count(VLAN.id)).scalar(),
        "vrfs": db.query(func.count(Vrf.id)).scalar(),
    }

