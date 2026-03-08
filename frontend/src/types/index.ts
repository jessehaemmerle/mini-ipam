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
  out_of_scope?: boolean;
  assigned_type?: string | null;
  assigned_id?: number | null;
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
