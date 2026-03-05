from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.entities import Cable, Device, IPAddress, Prefix, Rack, RoleEnum, VLAN

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
def global_search(q: str, db: Session = Depends(get_db), _=Depends(require_roles(RoleEnum.admin, RoleEnum.editor, RoleEnum.readonly))):
    term = f"%{q}%"
    return {
        "prefixes": db.query(Prefix).filter(or_(Prefix.cidr.ilike(term), Prefix.description.ilike(term))).limit(20).all(),
        "ips": db.query(IPAddress).filter(or_(IPAddress.address.ilike(term), IPAddress.dns_name.ilike(term))).limit(20).all(),
        "vlans": db.query(VLAN).filter(or_(VLAN.name.ilike(term), VLAN.description.ilike(term))).limit(20).all(),
        "devices": db.query(Device).filter(or_(Device.name.ilike(term), Device.asset_tag.ilike(term), Device.serial.ilike(term))).limit(20).all(),
        "racks": db.query(Rack).filter(Rack.name.ilike(term)).limit(20).all(),
        "cables": db.query(Cable).filter(Cable.label.ilike(term)).limit(20).all(),
    }

