from pydantic import BaseModel, Field

from app.models.entities import CableStatus, DeviceStatus


class SiteCreate(BaseModel):
    name: str
    code: str
    address: str | None = None
    description: str | None = None


class RackCreate(BaseModel):
    site_id: int
    room_id: int | None = None
    name: str
    height_u: int = Field(default=42, ge=1, le=60)
    description: str | None = None


class DeviceCreate(BaseModel):
    name: str
    asset_tag: str | None = None
    serial: str | None = None
    manufacturer: str | None = None
    model: str | None = None
    role: str = "server"
    status: DeviceStatus = DeviceStatus.active
    site_id: int | None = None
    rack_id: int | None = None
    rack_u_start: int | None = None
    rack_u_height: int = 1
    rack_face: str = "front"
    rack_label: str | None = None


class InterfaceCreate(BaseModel):
    device_id: int
    name: str
    if_type: str = "copper"
    speed: str | None = None
    mac: str | None = None
    vlan_mode: str | None = None
    access_vlan_id: int | None = None
    native_vlan_id: int | None = None
    allowed_vlans: str | None = None
    allow_multi: bool = False


class RackPlacementCreate(BaseModel):
    rack_id: int
    device_id: int
    u_start: int
    u_height: int = 1
    face: str = "front"
    label: str | None = None


class CableCreate(BaseModel):
    endpoint_a_type: str
    endpoint_a_id: int
    endpoint_b_type: str
    endpoint_b_id: int
    cable_type: str = "cat6"
    length: str | None = None
    label: str | None = None
    status: CableStatus = CableStatus.active


class PatchPortCreate(BaseModel):
    panel_id: int
    position: int
    front_port_name: str
    back_port_name: str
    allow_multi: bool = False


class PowerInletCreate(BaseModel):
    device_id: int
    name: str
    inlet_type: str | None = None


class PDUOutletCreate(BaseModel):
    pdu_device_id: int
    name: str


class PowerConnectionCreate(BaseModel):
    src_type: str
    src_id: int
    dst_type: str
    dst_id: int

