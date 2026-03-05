from pydantic import BaseModel, Field

from app.models.entities import IPStatus, PrefixStatus, VLANStatus


class VrfCreate(BaseModel):
    name: str
    description: str | None = None


class PrefixCreate(BaseModel):
    cidr: str
    vrf_id: int
    site_id: int | None = None
    role: str = "LAN"
    status: PrefixStatus = PrefixStatus.active
    description: str | None = None


class PrefixSplitRequest(BaseModel):
    new_prefix_length: int = Field(ge=1, le=128)


class IPCreate(BaseModel):
    address: str
    vrf_id: int
    status: IPStatus = IPStatus.free
    dns_name: str | None = None
    description: str | None = None
    out_of_scope: bool = False
    assigned_type: str | None = None
    assigned_id: int | None = None


class BulkReserveRequest(BaseModel):
    start_ip: str
    end_ip: str
    vrf_id: int
    description: str | None = None


class VLANCreate(BaseModel):
    vid: int = Field(ge=1, le=4094)
    name: str
    site_id: int | None = None
    status: VLANStatus = VLANStatus.active
    description: str | None = None
