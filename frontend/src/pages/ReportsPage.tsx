import { useEffect, useState } from "react";

import { get } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";

type UtilizationRow = {
  prefix: string;
  vrf_id: number;
  site_id: number | null;
  used: number;
  free: number;
  utilization_pct: number;
};

type InterfaceOrphanRow = {
  id: number;
  device_id: number;
  name: string;
  if_type: string;
  access_vlan_id?: number | null;
  native_vlan_id?: number | null;
  allowed_vlans?: string | null;
};

type CableOrphanRow = {
  id: number;
  endpoint_a_type: string;
  endpoint_a_id: number;
  endpoint_b_type: string;
  endpoint_b_id: number;
  cable_type: string;
  status: string;
  label?: string | null;
};

type PowerOrphanRow = {
  id: number;
  name: string;
  role: string;
  status: string;
  site_id?: number | null;
  rack_id?: number | null;
};

type ConflictsResponse = Record<string, unknown>;
type PagedReport = "utilization" | "orphans" | "cableOrphans" | "powerOrphans";

export function ReportsPage() {
  const [utilization, setUtilization] = useState<UtilizationRow[]>([]);
  const [conflicts, setConflicts] = useState<ConflictsResponse>({});
  const [orphans, setOrphans] = useState<InterfaceOrphanRow[]>([]);
  const [cableOrphans, setCableOrphans] = useState<CableOrphanRow[]>([]);
  const [powerOrphans, setPowerOrphans] = useState<PowerOrphanRow[]>([]);
  const [filter, setFilter] = useState("");
  const [limit, setLimit] = useState(100);
  const [offset, setOffset] = useState(0);
  const [activePagedReport, setActivePagedReport] = useState<PagedReport | null>(null);

  const page = Math.floor(offset / limit) + 1;

  const pagingParams = { limit, offset };

  const loadUtilization = () => get<UtilizationRow[]>("/reports/ip-utilization", pagingParams).then(setUtilization);
  const loadOrphans = () => get<InterfaceOrphanRow[]>("/reports/unassigned-interfaces", pagingParams).then(setOrphans);
  const loadCableOrphans = () => get<CableOrphanRow[]>("/reports/cable-orphans", pagingParams).then(setCableOrphans);
  const loadPowerOrphans = () => get<PowerOrphanRow[]>("/reports/power-orphans", pagingParams).then(setPowerOrphans);
  const loadConflicts = () => get<ConflictsResponse>("/reports/conflicts").then(setConflicts);

  const loadActivePagedReport = (report: PagedReport) => {
    if (report === "utilization") return loadUtilization();
    if (report === "orphans") return loadOrphans();
    if (report === "cableOrphans") return loadCableOrphans();
    return loadPowerOrphans();
  };

  useEffect(() => {
    if (!activePagedReport) return;
    void loadActivePagedReport(activePagedReport);
  }, [activePagedReport, limit, offset]);

  const filterAny = (value: unknown) => {
    if (!filter.trim()) return true;
    return JSON.stringify(value).toLowerCase().includes(filter.trim().toLowerCase());
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Reports" subtitle="Utilization, Konflikte, Orphans" />
      <div className="card flex flex-wrap items-end gap-2">
        <div className="field">
          <label className="field-label" htmlFor="report-filter">Filter</label>
          <input id="report-filter" className="input" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="JSON Textsuche" />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="report-limit">Limit</label>
          <select
            id="report-limit"
            className="input"
            value={limit}
            onChange={(e) => {
              const nextLimit = Number(e.target.value);
              setLimit(nextLimit);
              setOffset(0);
            }}
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={200}>200</option>
          </select>
        </div>
        <div className="field">
          <label className="field-label">Seite</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setOffset((prev) => Math.max(0, prev - limit))}
              disabled={offset === 0}
            >
              Zurueck
            </button>
            <span className="text-sm font-medium text-slate-600">{page}</span>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setOffset((prev) => prev + limit)}
            >
              Weiter
            </button>
          </div>
        </div>
        <button type="button" className="btn-secondary" onClick={() => setFilter("")}>
          Zuruecksetzen
        </button>
      </div>
      <div className="card flex flex-wrap gap-2">
        <button className="btn" onClick={() => setActivePagedReport("utilization")}>IP Utilization</button>
        <button className="btn" onClick={() => void loadConflicts()}>Conflicts</button>
        <button className="btn" onClick={() => setActivePagedReport("orphans")}>Unassigned Interfaces</button>
        <button className="btn" onClick={() => setActivePagedReport("cableOrphans")}>Cable Orphans</button>
        <button className="btn" onClick={() => setActivePagedReport("powerOrphans")}>Power Orphans</button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card whitespace-pre-wrap text-xs">{JSON.stringify(utilization.filter(filterAny), null, 2)}</div>
        <div className="card whitespace-pre-wrap text-xs">{JSON.stringify(conflicts, null, 2)}</div>
        <div className="card whitespace-pre-wrap text-xs">{JSON.stringify(orphans.filter(filterAny), null, 2)}</div>
        <div className="card whitespace-pre-wrap text-xs">{JSON.stringify(cableOrphans.filter(filterAny), null, 2)}</div>
        <div className="card whitespace-pre-wrap text-xs">{JSON.stringify(powerOrphans.filter(filterAny), null, 2)}</div>
      </div>
    </div>
  );
}

