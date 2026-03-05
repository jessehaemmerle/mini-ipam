from datetime import datetime
from enum import Enum

from sqlalchemy import (
    JSON,
    Boolean,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RoleEnum(str, Enum):
    admin = "admin"
    editor = "editor"
    readonly = "readonly"


class PrefixStatus(str, Enum):
    active = "active"
    planned = "planned"
    reserved = "reserved"
    deprecated = "deprecated"


class IPStatus(str, Enum):
    free = "free"
    reserved = "reserved"
    assigned = "assigned"


class VLANStatus(str, Enum):
    active = "active"
    planned = "planned"
    reserved = "reserved"
    deprecated = "deprecated"


class DeviceStatus(str, Enum):
    active = "active"
    planned = "planned"
    staged = "staged"
    offline = "offline"


class CableStatus(str, Enum):
    active = "active"
    planned = "planned"
    decommissioned = "decommissioned"


class TimeAuditMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    last_changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_changed_by: Mapped[str | None] = mapped_column(String(64), nullable=True)


class User(Base, TimeAuditMixin):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[RoleEnum] = mapped_column(SAEnum(RoleEnum), default=RoleEnum.admin)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class SessionToken(Base, TimeAuditMixin):
    __tablename__ = "session_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    token: Mapped[str] = mapped_column(String(512), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class Site(Base, TimeAuditMixin):
    __tablename__ = "sites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    code: Mapped[str] = mapped_column(String(32), unique=True)
    address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class Building(Base, TimeAuditMixin):
    __tablename__ = "buildings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(128))


class Room(Base, TimeAuditMixin):
    __tablename__ = "rooms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"))
    building_id: Mapped[int | None] = mapped_column(ForeignKey("buildings.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(128))


class Vrf(Base, TimeAuditMixin):
    __tablename__ = "vrfs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class Prefix(Base, TimeAuditMixin):
    __tablename__ = "prefixes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cidr: Mapped[str] = mapped_column(String(64), index=True)
    vrf_id: Mapped[int] = mapped_column(ForeignKey("vrfs.id", ondelete="CASCADE"))
    site_id: Mapped[int | None] = mapped_column(ForeignKey("sites.id", ondelete="SET NULL"))
    role: Mapped[str] = mapped_column(String(32), default="LAN")
    status: Mapped[PrefixStatus] = mapped_column(SAEnum(PrefixStatus), default=PrefixStatus.active)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (UniqueConstraint("cidr", "vrf_id", name="uq_prefix_cidr_vrf"),)


class Endpoint(Base, TimeAuditMixin):
    __tablename__ = "endpoints"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    endpoint_type: Mapped[str] = mapped_column(String(32), default="service")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class IPAddress(Base, TimeAuditMixin):
    __tablename__ = "ip_addresses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    address: Mapped[str] = mapped_column(String(64), index=True)
    vrf_id: Mapped[int] = mapped_column(ForeignKey("vrfs.id", ondelete="CASCADE"))
    status: Mapped[IPStatus] = mapped_column(SAEnum(IPStatus), default=IPStatus.free)
    dns_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    out_of_scope: Mapped[bool] = mapped_column(Boolean, default=False)
    assigned_type: Mapped[str | None] = mapped_column(String(32), nullable=True)
    assigned_id: Mapped[int | None] = mapped_column(Integer, nullable=True)

    __table_args__ = (UniqueConstraint("address", "vrf_id", name="uq_ip_vrf"),)


class VLANGroup(Base, TimeAuditMixin):
    __tablename__ = "vlan_groups"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    site_id: Mapped[int | None] = mapped_column(ForeignKey("sites.id", ondelete="SET NULL"))


class VLAN(Base, TimeAuditMixin):
    __tablename__ = "vlans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    vid: Mapped[int] = mapped_column(Integer)
    name: Mapped[str] = mapped_column(String(128))
    site_id: Mapped[int | None] = mapped_column(ForeignKey("sites.id", ondelete="SET NULL"))
    vlan_group_id: Mapped[int | None] = mapped_column(ForeignKey("vlan_groups.id", ondelete="SET NULL"))
    status: Mapped[VLANStatus] = mapped_column(SAEnum(VLANStatus), default=VLANStatus.active)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (UniqueConstraint("vid", "site_id", name="uq_vlan_vid_site"),)


class Rack(Base, TimeAuditMixin):
    __tablename__ = "racks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    site_id: Mapped[int] = mapped_column(ForeignKey("sites.id", ondelete="CASCADE"))
    room_id: Mapped[int | None] = mapped_column(ForeignKey("rooms.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(128))
    height_u: Mapped[int] = mapped_column(Integer, default=42)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)


class Device(Base, TimeAuditMixin):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    asset_tag: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    serial: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    manufacturer: Mapped[str | None] = mapped_column(String(128), nullable=True)
    model: Mapped[str | None] = mapped_column(String(128), nullable=True)
    role: Mapped[str] = mapped_column(String(64), default="server")
    status: Mapped[DeviceStatus] = mapped_column(SAEnum(DeviceStatus), default=DeviceStatus.active)
    site_id: Mapped[int | None] = mapped_column(ForeignKey("sites.id", ondelete="SET NULL"))
    rack_id: Mapped[int | None] = mapped_column(ForeignKey("racks.id", ondelete="SET NULL"))


class RackPlacement(Base, TimeAuditMixin):
    __tablename__ = "rack_placements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    rack_id: Mapped[int] = mapped_column(ForeignKey("racks.id", ondelete="CASCADE"))
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"), unique=True)
    u_start: Mapped[int] = mapped_column(Integer)
    u_height: Mapped[int] = mapped_column(Integer)
    face: Mapped[str] = mapped_column(String(16), default="front")
    label: Mapped[str | None] = mapped_column(String(128), nullable=True)


class ReservedUSlot(Base, TimeAuditMixin):
    __tablename__ = "reserved_u_slots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    rack_id: Mapped[int] = mapped_column(ForeignKey("racks.id", ondelete="CASCADE"))
    u_start: Mapped[int] = mapped_column(Integer)
    u_height: Mapped[int] = mapped_column(Integer, default=1)
    reason: Mapped[str | None] = mapped_column(String(255), nullable=True)


class Interface(Base, TimeAuditMixin):
    __tablename__ = "interfaces"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(128))
    if_type: Mapped[str] = mapped_column(String(32), default="copper")
    speed: Mapped[str | None] = mapped_column(String(32), nullable=True)
    mac: Mapped[str | None] = mapped_column(String(32), nullable=True)
    vlan_mode: Mapped[str | None] = mapped_column(String(16), nullable=True)
    access_vlan_id: Mapped[int | None] = mapped_column(ForeignKey("vlans.id", ondelete="SET NULL"))
    native_vlan_id: Mapped[int | None] = mapped_column(ForeignKey("vlans.id", ondelete="SET NULL"))
    allowed_vlans: Mapped[str | None] = mapped_column(String(255), nullable=True)
    allow_multi: Mapped[bool] = mapped_column(Boolean, default=False)

    __table_args__ = (UniqueConstraint("device_id", "name", name="uq_device_ifname"),)


class PatchPort(Base, TimeAuditMixin):
    __tablename__ = "patch_ports"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    panel_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"))
    position: Mapped[int] = mapped_column(Integer)
    front_port_name: Mapped[str] = mapped_column(String(128))
    back_port_name: Mapped[str] = mapped_column(String(128))
    allow_multi: Mapped[bool] = mapped_column(Boolean, default=False)


class Cable(Base, TimeAuditMixin):
    __tablename__ = "cables"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    endpoint_a_type: Mapped[str] = mapped_column(String(32))
    endpoint_a_id: Mapped[int] = mapped_column(Integer)
    endpoint_b_type: Mapped[str] = mapped_column(String(32))
    endpoint_b_id: Mapped[int] = mapped_column(Integer)
    cable_type: Mapped[str] = mapped_column(String(32), default="cat6")
    length: Mapped[str | None] = mapped_column(String(32), nullable=True)
    label: Mapped[str | None] = mapped_column(String(128), nullable=True, index=True)
    status: Mapped[CableStatus] = mapped_column(SAEnum(CableStatus), default=CableStatus.active)


class PowerCircuit(Base, TimeAuditMixin):
    __tablename__ = "power_circuits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(128), unique=True)
    location: Mapped[str | None] = mapped_column(String(128), nullable=True)


class PDUOutlet(Base, TimeAuditMixin):
    __tablename__ = "pdu_outlets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pdu_device_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(128))


class PowerInlet(Base, TimeAuditMixin):
    __tablename__ = "power_inlets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(128))
    inlet_type: Mapped[str | None] = mapped_column(String(32), nullable=True)


class PowerConnection(Base, TimeAuditMixin):
    __tablename__ = "power_connections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    src_type: Mapped[str] = mapped_column(String(32))
    src_id: Mapped[int] = mapped_column(Integer)
    dst_type: Mapped[str] = mapped_column(String(32))
    dst_id: Mapped[int] = mapped_column(Integer)


class Tag(Base, TimeAuditMixin):
    __tablename__ = "tags"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(64), unique=True)


class TagLink(Base, TimeAuditMixin):
    __tablename__ = "tag_links"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tag_id: Mapped[int] = mapped_column(ForeignKey("tags.id", ondelete="CASCADE"))
    object_type: Mapped[str] = mapped_column(String(64))
    object_id: Mapped[int] = mapped_column(Integer)


class Comment(Base, TimeAuditMixin):
    __tablename__ = "comments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    object_type: Mapped[str] = mapped_column(String(64))
    object_id: Mapped[int] = mapped_column(Integer)
    content: Mapped[str] = mapped_column(Text)
    created_by: Mapped[str] = mapped_column(String(64))


class Attachment(Base, TimeAuditMixin):
    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    object_type: Mapped[str] = mapped_column(String(64))
    object_id: Mapped[int] = mapped_column(Integer)
    filename: Mapped[str] = mapped_column(String(255))
    stored_path: Mapped[str] = mapped_column(String(512))


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    username: Mapped[str] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(16))
    object_type: Mapped[str] = mapped_column(String(64))
    object_id: Mapped[int] = mapped_column(Integer)
    diff: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class ObjectHistory(Base):
    __tablename__ = "object_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    changed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    object_type: Mapped[str] = mapped_column(String(64), index=True)
    object_id: Mapped[int] = mapped_column(Integer, index=True)
    changed_by: Mapped[str] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(16))
    diff: Mapped[dict | None] = mapped_column(JSON, nullable=True)
