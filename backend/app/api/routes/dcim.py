from collections import deque

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.entities import (
    Cable,
    Device,
    IPAddress,
    Interface,
    ObjectHistory,
    PDUOutlet,
    PatchPort,
    PowerConnection,
    PowerInlet,
    Rack,
    RackPlacement,
    ReservedUSlot,
    RoleEnum,
    Site,
)
from app.schemas.dcim import (
    CableCreate,
    DeviceCreate,
    InterfaceCreate,
    PatchPortCreate,
    PDUOutletCreate,
    PowerConnectionCreate,
    PowerInletCreate,
    RackCreate,
    RackPlacementCreate,
    SiteCreate,
)
from app.services.audit import record_change, stamp_change

router = APIRouter(prefix="/dcim", tags=["dcim"])


def _validate_rack_placement(
    db: Session,
    *,
    rack_id: int,
    u_start: int,
    u_height: int,
    face: str,
    ignore_device_id: int | None = None,
) -> None:
    rack = db.query(Rack).filter(Rack.id == rack_id).first()
    if not rack:
        raise HTTPException(status_code=404, detail="Rack not found")
    if u_start < 1 or u_start + u_height - 1 > rack.height_u:
        raise HTTPException(status_code=400, detail="Placement out of rack bounds")

    placements = db.query(RackPlacement).filter(RackPlacement.rack_id == rack_id, RackPlacement.face == face).all()
    for placement in placements:
        if ignore_device_id is not None and placement.device_id == ignore_device_id:
            continue
        overlap = not (
            u_start + u_height - 1 < placement.u_start
            or u_start > placement.u_start + placement.u_height - 1
        )
        if overlap:
            raise HTTPException(status_code=409, detail="Placement overlaps existing device")

    reserved = db.query(ReservedUSlot).filter(ReservedUSlot.rack_id == rack_id).all()
    for slot in reserved:
        overlap = not (
            u_start + u_height - 1 < slot.u_start
            or u_start > slot.u_start + slot.u_height - 1
        )
        if overlap:
            raise HTTPException(status_code=409, detail="Placement overlaps reserved slots")


@router.get("/sites")
def list_sites(db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    return db.query(Site).order_by(Site.name.asc()).all()


@router.post("/sites")
def create_site(payload: SiteCreate, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = Site(**payload.model_dump())
    stamp_change(obj, user.username)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    record_change(db, username=user.username, action="create", object_type="site", object_id=obj.id, diff=payload.model_dump())
    db.commit()
    return obj


@router.put("/sites/{site_id}")
def update_site(site_id: int, payload: SiteCreate, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = db.query(Site).filter(Site.id == site_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Site not found")
    old = {"name": obj.name, "code": obj.code, "address": obj.address, "description": obj.description}
    for key, value in payload.model_dump().items():
        setattr(obj, key, value)
    stamp_change(obj, user.username)
    db.commit()
    db.refresh(obj)
    record_change(db, username=user.username, action="update", object_type="site", object_id=obj.id, diff={"old": old, "new": payload.model_dump()})
    db.commit()
    return obj


@router.delete("/sites/{site_id}")
def delete_site(site_id: int, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = db.query(Site).filter(Site.id == site_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Site not found")
    obj_id = obj.id
    db.delete(obj)
    record_change(db, username=user.username, action="delete", object_type="site", object_id=obj_id, diff=None)
    db.commit()
    return {"deleted": obj_id}


@router.get("/racks")
def list_racks(db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    return db.query(Rack).order_by(Rack.name.asc()).all()


@router.post("/racks")
def create_rack(payload: RackCreate, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = Rack(**payload.model_dump())
    stamp_change(obj, user.username)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.put("/racks/{rack_id}")
def update_rack(rack_id: int, payload: RackCreate, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = db.query(Rack).filter(Rack.id == rack_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Rack not found")
    old = {"site_id": obj.site_id, "room_id": obj.room_id, "name": obj.name, "height_u": obj.height_u, "description": obj.description}
    for key, value in payload.model_dump().items():
        setattr(obj, key, value)
    stamp_change(obj, user.username)
    db.commit()
    db.refresh(obj)
    record_change(db, username=user.username, action="update", object_type="rack", object_id=obj.id, diff={"old": old, "new": payload.model_dump()})
    db.commit()
    return obj


@router.delete("/racks/{rack_id}")
def delete_rack(rack_id: int, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = db.query(Rack).filter(Rack.id == rack_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Rack not found")
    obj_id = obj.id
    db.delete(obj)
    record_change(db, username=user.username, action="delete", object_type="rack", object_id=obj_id, diff=None)
    db.commit()
    return {"deleted": obj_id}


@router.get("/devices")
def list_devices(db: Session = Depends(get_db), q: str | None = None, _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    query = db.query(Device)
    if q:
        query = query.filter(or_(Device.name.ilike(f"%{q}%"), Device.asset_tag.ilike(f"%{q}%"), Device.serial.ilike(f"%{q}%")))
    return query.order_by(Device.name.asc()).all()


@router.get("/devices/{device_id}/detail")
def device_detail(
    device_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly)),
):
    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    interfaces = db.query(Interface).filter(Interface.device_id == device.id).order_by(Interface.name.asc()).all()
    interface_ids = [item.id for item in interfaces]
    ips = (
        db.query(IPAddress)
        .filter(
            IPAddress.assigned_type == "interface",
            IPAddress.assigned_id.in_(interface_ids if interface_ids else [-1]),
        )
        .order_by(IPAddress.address.asc())
        .all()
    )
    cables = (
        db.query(Cable)
        .filter(
            or_(
                and_(Cable.endpoint_a_type == "interface", Cable.endpoint_a_id.in_(interface_ids if interface_ids else [-1])),
                and_(Cable.endpoint_b_type == "interface", Cable.endpoint_b_id.in_(interface_ids if interface_ids else [-1])),
            )
        )
        .all()
    )
    inlets = db.query(PowerInlet).filter(PowerInlet.device_id == device.id).all()
    inlet_ids = [item.id for item in inlets]
    power_connections = (
        db.query(PowerConnection)
        .filter(PowerConnection.src_type == "power_inlet", PowerConnection.src_id.in_(inlet_ids if inlet_ids else [-1]))
        .all()
    )
    history = (
        db.query(ObjectHistory)
        .filter(ObjectHistory.object_type == "device", ObjectHistory.object_id == device.id)
        .order_by(ObjectHistory.changed_at.desc())
        .limit(20)
        .all()
    )
    return {
        "overview": device,
        "interfaces": interfaces,
        "ips": ips,
        "cabling": cables,
        "power": {
            "inlets": inlets,
            "connections": power_connections,
            "has_power": bool(power_connections),
        },
        "history": history,
    }


@router.post("/devices")
def create_device(payload: DeviceCreate, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    device_data = payload.model_dump(exclude={"rack_u_start", "rack_u_height", "rack_face", "rack_label"})
    obj = Device(**device_data)
    stamp_change(obj, user.username)
    db.add(obj)
    db.flush()

    if payload.rack_id is not None and payload.rack_u_start is not None:
        _validate_rack_placement(
            db,
            rack_id=payload.rack_id,
            u_start=payload.rack_u_start,
            u_height=payload.rack_u_height,
            face=payload.rack_face,
            ignore_device_id=obj.id,
        )
        placement = RackPlacement(
            rack_id=payload.rack_id,
            device_id=obj.id,
            u_start=payload.rack_u_start,
            u_height=payload.rack_u_height,
            face=payload.rack_face,
            label=payload.rack_label,
        )
        stamp_change(placement, user.username)
        db.add(placement)

    db.commit()
    db.refresh(obj)
    record_change(db, username=user.username, action="create", object_type="device", object_id=obj.id, diff=payload.model_dump())
    db.commit()
    return obj


@router.put("/devices/{device_id}")
def update_device(device_id: int, payload: DeviceCreate, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = db.query(Device).filter(Device.id == device_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Device not found")
    old = {
        "name": obj.name,
        "asset_tag": obj.asset_tag,
        "serial": obj.serial,
        "manufacturer": obj.manufacturer,
        "model": obj.model,
        "role": obj.role,
        "status": obj.status,
        "site_id": obj.site_id,
        "rack_id": obj.rack_id,
    }
    for key, value in payload.model_dump(exclude={"rack_u_start", "rack_u_height", "rack_face", "rack_label"}).items():
        setattr(obj, key, value)
    stamp_change(obj, user.username)
    db.commit()
    db.refresh(obj)
    record_change(db, username=user.username, action="update", object_type="device", object_id=obj.id, diff={"old": old, "new": payload.model_dump()})
    db.commit()
    return obj


@router.delete("/devices/{device_id}")
def delete_device(device_id: int, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = db.query(Device).filter(Device.id == device_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Device not found")
    obj_id = obj.id
    db.delete(obj)
    record_change(db, username=user.username, action="delete", object_type="device", object_id=obj_id, diff=None)
    db.commit()
    return {"deleted": obj_id}


@router.get("/interfaces")
def list_interfaces(db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    return db.query(Interface).order_by(Interface.name.asc()).all()


@router.post("/interfaces")
def create_interface(payload: InterfaceCreate, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = Interface(**payload.model_dump())
    stamp_change(obj, user.username)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/endpoint-options")
def endpoint_options(db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    interfaces = db.query(Interface).order_by(Interface.device_id.asc(), Interface.name.asc()).all()
    patch_ports = db.query(PatchPort).order_by(PatchPort.panel_id.asc(), PatchPort.position.asc()).all()
    sites = {item.id: item.name for item in db.query(Site).all()}
    devices = {item.id: {"name": item.name, "site_id": item.site_id} for item in db.query(Device).all()}
    return {
        "interfaces": [
            {
                "id": item.id,
                "type": "interface",
                "name": item.name,
                "device_id": item.device_id,
                "device_name": devices.get(item.device_id, {}).get("name"),
                "site_id": devices.get(item.device_id, {}).get("site_id"),
                "site_name": sites.get(devices.get(item.device_id, {}).get("site_id")),
            }
            for item in interfaces
        ],
        "patch_ports": [
            {
                "id": item.id,
                "type": "patch_port",
                "name": f"{item.front_port_name}/{item.back_port_name}",
                "panel_id": item.panel_id,
                "panel_name": devices.get(item.panel_id, {}).get("name"),
                "site_id": devices.get(item.panel_id, {}).get("site_id"),
                "site_name": sites.get(devices.get(item.panel_id, {}).get("site_id")),
            }
            for item in patch_ports
        ],
    }


@router.get("/patch-ports")
def list_patch_ports(db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    return db.query(PatchPort).order_by(PatchPort.panel_id.asc(), PatchPort.position.asc()).all()


@router.post("/patch-ports")
def create_patch_port(payload: PatchPortCreate, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = PatchPort(**payload.model_dump())
    stamp_change(obj, user.username)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    record_change(db, username=user.username, action="create", object_type="patch_port", object_id=obj.id, diff=payload.model_dump())
    db.commit()
    return obj


@router.put("/patch-ports/{patch_port_id}")
def update_patch_port(
    patch_port_id: int,
    payload: PatchPortCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor)),
):
    obj = db.query(PatchPort).filter(PatchPort.id == patch_port_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Patch port not found")
    old = {
        "panel_id": obj.panel_id,
        "position": obj.position,
        "front_port_name": obj.front_port_name,
        "back_port_name": obj.back_port_name,
        "allow_multi": obj.allow_multi,
    }
    for key, value in payload.model_dump().items():
        setattr(obj, key, value)
    stamp_change(obj, user.username)
    db.commit()
    db.refresh(obj)
    record_change(
        db,
        username=user.username,
        action="update",
        object_type="patch_port",
        object_id=obj.id,
        diff={"old": old, "new": payload.model_dump()},
    )
    db.commit()
    return obj


@router.delete("/patch-ports/{patch_port_id}")
def delete_patch_port(
    patch_port_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor)),
):
    obj = db.query(PatchPort).filter(PatchPort.id == patch_port_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Patch port not found")
    obj_id = obj.id
    db.delete(obj)
    record_change(db, username=user.username, action="delete", object_type="patch_port", object_id=obj_id, diff=None)
    db.commit()
    return {"deleted": obj_id}


def _endpoint_busy(db: Session, endpoint_type: str, endpoint_id: int) -> bool:
    return (
        db.query(Cable)
        .filter(
            Cable.status == "active",
            or_(
                and_(Cable.endpoint_a_type == endpoint_type, Cable.endpoint_a_id == endpoint_id),
                and_(Cable.endpoint_b_type == endpoint_type, Cable.endpoint_b_id == endpoint_id),
            ),
        )
        .first()
        is not None
    )


def _is_multi_allowed(db: Session, endpoint_type: str, endpoint_id: int) -> bool:
    if endpoint_type == "interface":
        entity = db.query(Interface).filter(Interface.id == endpoint_id).first()
        return bool(entity and entity.allow_multi)
    if endpoint_type == "patch_port":
        entity = db.query(PatchPort).filter(PatchPort.id == endpoint_id).first()
        return bool(entity and entity.allow_multi)
    return False


@router.get("/cables")
def list_cables(db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    return db.query(Cable).order_by(Cable.id.desc()).all()


@router.post("/cables")
def create_cable(payload: CableCreate, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    for endpoint_type, endpoint_id in [
        (payload.endpoint_a_type, payload.endpoint_a_id),
        (payload.endpoint_b_type, payload.endpoint_b_id),
    ]:
        if not _is_multi_allowed(db, endpoint_type, endpoint_id) and _endpoint_busy(db, endpoint_type, endpoint_id):
            raise HTTPException(status_code=409, detail=f"Endpoint {endpoint_type}:{endpoint_id} already has active cable")

    obj = Cable(**payload.model_dump())
    stamp_change(obj, user.username)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    record_change(db, username=user.username, action="create", object_type="cable", object_id=obj.id, diff=payload.model_dump())
    db.commit()
    return obj


@router.delete("/cables/{cable_id}")
def delete_cable(cable_id: int, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = db.query(Cable).filter(Cable.id == cable_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Cable not found")
    obj_id = obj.id
    db.delete(obj)
    record_change(db, username=user.username, action="delete", object_type="cable", object_id=obj_id, diff=None)
    db.commit()
    return {"deleted": obj_id}


@router.post("/rack-placements")
def place_device(payload: RackPlacementCreate, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    _validate_rack_placement(
        db,
        rack_id=payload.rack_id,
        u_start=payload.u_start,
        u_height=payload.u_height,
        face=payload.face,
        ignore_device_id=payload.device_id,
    )

    obj = RackPlacement(**payload.model_dump())
    stamp_change(obj, user.username)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/rack-placements/{rack_id}")
def rack_placements(rack_id: int, db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    return db.query(RackPlacement).filter(RackPlacement.rack_id == rack_id).all()


@router.get("/racks/{rack_id}/detail")
def rack_detail(
    rack_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly)),
):
    rack = db.query(Rack).filter(Rack.id == rack_id).first()
    if not rack:
        raise HTTPException(status_code=404, detail="Rack not found")

    placements = db.query(RackPlacement).filter(RackPlacement.rack_id == rack.id).all()
    reserved_slots = db.query(ReservedUSlot).filter(ReservedUSlot.rack_id == rack.id).all()
    placement_by_device = {p.device_id: p for p in placements}
    devices = db.query(Device).filter(Device.rack_id == rack.id).all()

    details = []
    for dev in devices:
        interfaces = db.query(Interface).filter(Interface.device_id == dev.id).all()
        iface_ids = [item.id for item in interfaces]
        has_cable = (
            db.query(Cable)
            .filter(
                or_(
                    and_(Cable.endpoint_a_type == "interface", Cable.endpoint_a_id.in_(iface_ids if iface_ids else [-1])),
                    and_(Cable.endpoint_b_type == "interface", Cable.endpoint_b_id.in_(iface_ids if iface_ids else [-1])),
                )
            )
            .first()
            is not None
        )
        inlet_ids = [item[0] for item in db.query(PowerInlet.id).filter(PowerInlet.device_id == dev.id).all()]
        has_power = (
            db.query(PowerConnection)
            .filter(PowerConnection.src_type == "power_inlet", PowerConnection.src_id.in_(inlet_ids if inlet_ids else [-1]))
            .first()
            is not None
        )
        details.append(
            {
                "device_id": dev.id,
                "name": dev.name,
                "role": dev.role,
                "placed": dev.id in placement_by_device,
                "u_start": placement_by_device[dev.id].u_start if dev.id in placement_by_device else None,
                "u_height": placement_by_device[dev.id].u_height if dev.id in placement_by_device else None,
                "missing_cable": bool(interfaces) and not has_cable,
                "missing_power": bool(inlet_ids) and not has_power,
            }
        )

    return {
        "overview": rack,
        "placements": placements,
        "reserved_slots": reserved_slots,
        "devices": details,
    }


@router.get("/cable-path")
def cable_path_lookup(endpoint_type: str, endpoint_id: int, db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    graph: dict[tuple[str, int], list[tuple[str, int, int]]] = {}
    cables = db.query(Cable).filter(Cable.status == "active").all()

    for cable in cables:
        a = (cable.endpoint_a_type, cable.endpoint_a_id)
        b = (cable.endpoint_b_type, cable.endpoint_b_id)
        graph.setdefault(a, []).append((b[0], b[1], cable.id))
        graph.setdefault(b, []).append((a[0], a[1], cable.id))

    start = (endpoint_type, endpoint_id)
    if start not in graph:
        return {"nodes": [start], "edges": [], "table": []}

    visited: set[tuple[str, int]] = {start}
    queue: deque[tuple[str, int]] = deque([start])
    edges = []
    while queue:
        current = queue.popleft()
        for next_type, next_id, cable_id in graph.get(current, []):
            nxt = (next_type, next_id)
            edges.append({"from": current, "to": nxt, "cable_id": cable_id})
            if nxt not in visited:
                visited.add(nxt)
                queue.append(nxt)

    table = [
        {
            "from": f"{edge['from'][0]}:{edge['from'][1]}",
            "to": f"{edge['to'][0]}:{edge['to'][1]}",
            "cable_id": edge["cable_id"],
        }
        for edge in edges
    ]
    return {"nodes": [f"{n[0]}:{n[1]}" for n in visited], "edges": edges, "table": table}


@router.post("/power/inlets")
def create_power_inlet(payload: PowerInletCreate, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = PowerInlet(**payload.model_dump())
    stamp_change(obj, user.username)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    record_change(db, username=user.username, action="create", object_type="power_inlet", object_id=obj.id, diff=payload.model_dump())
    db.commit()
    return obj


@router.put("/power/inlets/{inlet_id}")
def update_power_inlet(
    inlet_id: int,
    payload: PowerInletCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor)),
):
    obj = db.query(PowerInlet).filter(PowerInlet.id == inlet_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Power inlet not found")
    old = {"device_id": obj.device_id, "name": obj.name, "inlet_type": obj.inlet_type}
    for key, value in payload.model_dump().items():
        setattr(obj, key, value)
    stamp_change(obj, user.username)
    db.commit()
    db.refresh(obj)
    record_change(
        db,
        username=user.username,
        action="update",
        object_type="power_inlet",
        object_id=obj.id,
        diff={"old": old, "new": payload.model_dump()},
    )
    db.commit()
    return obj


@router.delete("/power/inlets/{inlet_id}")
def delete_power_inlet(
    inlet_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor)),
):
    obj = db.query(PowerInlet).filter(PowerInlet.id == inlet_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Power inlet not found")
    obj_id = obj.id
    db.delete(obj)
    record_change(db, username=user.username, action="delete", object_type="power_inlet", object_id=obj_id, diff=None)
    db.commit()
    return {"deleted": obj_id}


@router.get("/power/inlets")
def list_power_inlets(db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    return db.query(PowerInlet).order_by(PowerInlet.device_id.asc(), PowerInlet.name.asc()).all()


@router.post("/power/outlets")
def create_pdu_outlet(payload: PDUOutletCreate, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = PDUOutlet(**payload.model_dump())
    stamp_change(obj, user.username)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    record_change(db, username=user.username, action="create", object_type="pdu_outlet", object_id=obj.id, diff=payload.model_dump())
    db.commit()
    return obj


@router.put("/power/outlets/{outlet_id}")
def update_pdu_outlet(
    outlet_id: int,
    payload: PDUOutletCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor)),
):
    obj = db.query(PDUOutlet).filter(PDUOutlet.id == outlet_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="PDU outlet not found")
    old = {"pdu_device_id": obj.pdu_device_id, "name": obj.name}
    for key, value in payload.model_dump().items():
        setattr(obj, key, value)
    stamp_change(obj, user.username)
    db.commit()
    db.refresh(obj)
    record_change(
        db,
        username=user.username,
        action="update",
        object_type="pdu_outlet",
        object_id=obj.id,
        diff={"old": old, "new": payload.model_dump()},
    )
    db.commit()
    return obj


@router.delete("/power/outlets/{outlet_id}")
def delete_pdu_outlet(
    outlet_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor)),
):
    obj = db.query(PDUOutlet).filter(PDUOutlet.id == outlet_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="PDU outlet not found")
    obj_id = obj.id
    db.delete(obj)
    record_change(db, username=user.username, action="delete", object_type="pdu_outlet", object_id=obj_id, diff=None)
    db.commit()
    return {"deleted": obj_id}


@router.get("/power/outlets")
def list_pdu_outlets(db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    return db.query(PDUOutlet).order_by(PDUOutlet.pdu_device_id.asc(), PDUOutlet.name.asc()).all()


@router.post("/power/connections")
def create_power_connection(payload: PowerConnectionCreate, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = PowerConnection(**payload.model_dump())
    stamp_change(obj, user.username)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    record_change(db, username=user.username, action="create", object_type="power_connection", object_id=obj.id, diff=payload.model_dump())
    db.commit()
    return obj


@router.put("/power/connections/{connection_id}")
def update_power_connection(
    connection_id: int,
    payload: PowerConnectionCreate,
    db: Session = Depends(get_db),
    user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor)),
):
    obj = db.query(PowerConnection).filter(PowerConnection.id == connection_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Power connection not found")
    old = {
        "src_type": obj.src_type,
        "src_id": obj.src_id,
        "dst_type": obj.dst_type,
        "dst_id": obj.dst_id,
    }
    for key, value in payload.model_dump().items():
        setattr(obj, key, value)
    stamp_change(obj, user.username)
    db.commit()
    db.refresh(obj)
    record_change(
        db,
        username=user.username,
        action="update",
        object_type="power_connection",
        object_id=obj.id,
        diff={"old": old, "new": payload.model_dump()},
    )
    db.commit()
    return obj


@router.delete("/power/connections/{connection_id}")
def delete_power_connection(
    connection_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor)),
):
    obj = db.query(PowerConnection).filter(PowerConnection.id == connection_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Power connection not found")
    obj_id = obj.id
    db.delete(obj)
    record_change(db, username=user.username, action="delete", object_type="power_connection", object_id=obj_id, diff=None)
    db.commit()
    return {"deleted": obj_id}


@router.get("/power/connections")
def list_power_connections(db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    return db.query(PowerConnection).order_by(PowerConnection.id.desc()).all()


@router.get("/power/map/rack/{rack_id}")
def rack_power_map(rack_id: int, db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    devices = db.query(Device).filter(Device.rack_id == rack_id).all()
    result = []
    for dev in devices:
        inlets = db.query(PowerInlet).filter(PowerInlet.device_id == dev.id).all()
        connections = []
        for inlet in inlets:
            conn = db.query(PowerConnection).filter(PowerConnection.src_type == "power_inlet", PowerConnection.src_id == inlet.id).all()
            connections.extend(conn)
        result.append({"device": dev.name, "power_inlets": len(inlets), "connections": [{"src": f"{c.src_type}:{c.src_id}", "dst": f"{c.dst_type}:{c.dst_id}"} for c in connections]})
    return result

