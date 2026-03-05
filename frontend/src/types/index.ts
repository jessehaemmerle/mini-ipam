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
