from collections import deque

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.entities import (
    Cable,
    Device,
    Interface,
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
    PDUOutletCreate,
    PowerConnectionCreate,
    PowerInletCreate,
    RackCreate,
    RackPlacementCreate,
    SiteCreate,
)
from app.services.audit import record_change, stamp_change

router = APIRouter(prefix="/dcim", tags=["dcim"])


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


@router.get("/devices")
def list_devices(db: Session = Depends(get_db), q: str | None = None, _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    query = db.query(Device)
    if q:
        query = query.filter(or_(Device.name.ilike(f"%{q}%"), Device.asset_tag.ilike(f"%{q}%"), Device.serial.ilike(f"%{q}%")))
    return query.order_by(Device.name.asc()).all()


@router.post("/devices")
def create_device(payload: DeviceCreate, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = Device(**payload.model_dump())
    stamp_change(obj, user.username)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    record_change(db, username=user.username, action="create", object_type="device", object_id=obj.id, diff=payload.model_dump())
    db.commit()
    return obj


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


@router.get("/patch-ports")
def list_patch_ports(db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    return db.query(PatchPort).order_by(PatchPort.panel_id.asc(), PatchPort.position.asc()).all()


@router.post("/patch-ports")
def create_patch_port(panel_id: int, position: int, front_port_name: str, back_port_name: str, allow_multi: bool = False, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = PatchPort(
        panel_id=panel_id,
        position=position,
        front_port_name=front_port_name,
        back_port_name=back_port_name,
        allow_multi=allow_multi,
    )
    stamp_change(obj, user.username)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


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


@router.post("/rack-placements")
def place_device(payload: RackPlacementCreate, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    rack = db.query(Rack).filter(Rack.id == payload.rack_id).first()
    if not rack:
        raise HTTPException(status_code=404, detail="Rack not found")
    if payload.u_start < 1 or payload.u_start + payload.u_height - 1 > rack.height_u:
        raise HTTPException(status_code=400, detail="Placement out of rack bounds")

    placements = db.query(RackPlacement).filter(RackPlacement.rack_id == payload.rack_id, RackPlacement.face == payload.face).all()
    for placement in placements:
        overlap = not (
            payload.u_start + payload.u_height - 1 < placement.u_start
            or payload.u_start > placement.u_start + placement.u_height - 1
        )
        if overlap:
            raise HTTPException(status_code=409, detail="Placement overlaps existing device")

    reserved = db.query(ReservedUSlot).filter(ReservedUSlot.rack_id == payload.rack_id).all()
    for slot in reserved:
        overlap = not (
            payload.u_start + payload.u_height - 1 < slot.u_start
            or payload.u_start > slot.u_start + slot.u_height - 1
        )
        if overlap:
            raise HTTPException(status_code=409, detail="Placement overlaps reserved slots")

    obj = RackPlacement(**payload.model_dump())
    stamp_change(obj, user.username)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/rack-placements/{rack_id}")
def rack_placements(rack_id: int, db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    return db.query(RackPlacement).filter(RackPlacement.rack_id == rack_id).all()


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
    return obj


@router.post("/power/outlets")
def create_pdu_outlet(payload: PDUOutletCreate, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = PDUOutlet(**payload.model_dump())
    stamp_change(obj, user.username)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/power/connections")
def create_power_connection(payload: PowerConnectionCreate, db: Session = Depends(get_db), user=Depends(require_roles(RoleEnum.admin, RoleEnum.editor))):
    obj = PowerConnection(**payload.model_dump())
    stamp_change(obj, user.username)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


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

