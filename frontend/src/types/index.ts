export type Prefix = {
  id: number;
  cidr: string;
  vrf_id: number;
  site_id?: number | null;
  role: string;
  status: string;
  description?: string | null;
};

export type IPAddress = {
  id: number;
  address: string;
  vrf_id: number;
  status: string;
  dns_name?: string | null;
  description?: string | null;
};

export type Vrf = {
  id: number;
  name: string;
  description?: string | null;
};

export type VLAN = {
  id: number;
  vid: number;
  name: string;
  site_id?: number | null;
  status: string;
};

export type Site = {
  id: number;
  name: string;
  code: string;
};

export type Rack = {
  id: number;
  name: string;
  site_id: number;
  height_u: number;
};

export type RackPlacement = {
  id: number;
  rack_id: number;
  device_id: number;
  u_start: number;
  u_height: number;
  face: string;
  label?: string | null;
};

export type Device = {
  id: number;
  name: string;
  role: string;
  status: string;
  rack_id?: number | null;
  serial?: string | null;
  asset_tag?: string | null;
};

export type Cable = {
  id: number;
  endpoint_a_type: string;
  endpoint_a_id: number;
  endpoint_b_type: string;
  endpoint_b_id: number;
  cable_type: string;
  label?: string | null;
  status: string;
};

export type PrefixDetail = {
  overview: Prefix;
  utilization: {
    prefix: string;
    used: number;
    free: number;
    utilization_pct: number;
  };
  next_free_ip: string | null;
  ips: IPAddress[];
  history: Array<{
    id: number;
    changed_at: string;
    changed_by: string;
    action: string;
    diff?: Record<string, unknown> | null;
  }>;
};

export type DeviceDetail = {
  overview: Device;
  interfaces: Array<{ id: number; name: string; if_type: string; speed?: string | null }>;
  ips: IPAddress[];
  cabling: Cable[];
  power: {
    inlets: Array<{ id: number; name: string }>;
    connections: Array<{ id: number; src_type: string; src_id: number; dst_type: string; dst_id: number }>;
    has_power: boolean;
  };
  history: Array<{ id: number; changed_at: string; changed_by: string; action: string }>;
};

export type RackDetail = {
  overview: Rack;
  placements: RackPlacement[];
  reserved_slots: Array<{ id: number; u_start: number; u_height: number; reason?: string | null }>;
  devices: Array<{
    device_id: number;
    name: string;
    role: string;
    missing_cable: boolean;
    missing_power: boolean;
  }>;
};

