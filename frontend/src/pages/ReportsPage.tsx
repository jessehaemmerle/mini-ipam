import { useEffect, useMemo, useState } from "react";

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
type ReportView = "utilization" | "conflicts" | "interfaces" | "cables" | "power";

export function ReportsPage() {
  const [utilization, setUtilization] = useState<UtilizationRow[]>([]);
  const [conflicts, setConflicts] = useState<ConflictsResponse>({});
  const [orphans, setOrphans] = useState<InterfaceOrphanRow[]>([]);
  const [cableOrphans, setCableOrphans] = useState<CableOrphanRow[]>([]);
  const [powerOrphans, setPowerOrphans] = useState<PowerOrphanRow[]>([]);
  const [filter, setFilter] = useState("");
  const [limit, setLimit] = useState(100);
  const [offset, setOffset] = useState(0);
  const [activeView, setActiveView] = useState<ReportView>("utilization");
  const [loading, setLoading] = useState(false);

  const page = Math.floor(offset / limit) + 1;
  const pagingParams = { limit, offset };

  const loadUtilization = () => get<UtilizationRow[]>("/reports/ip-utilization", pagingParams).then(setUtilization);
  const loadOrphans = () => get<InterfaceOrphanRow[]>("/reports/unassigned-interfaces", pagingParams).then(setOrphans);
  const loadCableOrphans = () => get<CableOrphanRow[]>("/reports/cable-orphans", pagingParams).then(setCableOrphans);
  const loadPowerOrphans = () => get<PowerOrphanRow[]>("/reports/power-orphans", pagingParams).then(setPowerOrphans);
  const loadConflicts = () => get<ConflictsResponse>("/reports/conflicts").then(setConflicts);

  const loadView = async (view: ReportView) => {
    setLoading(true);
    try {
      if (view === "utilization") await loadUtilization();
      if (view === "interfaces") await loadOrphans();
      if (view === "cables") await loadCableOrphans();
      if (view === "power") await loadPowerOrphans();
      if (view === "conflicts") await loadConflicts();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadView(activeView);
  }, [activeView, limit, offset]);

  const filterAny = (value: unknown) => {
    if (!filter.trim()) return true;
    return JSON.stringify(value).toLowerCase().includes(filter.trim().toLowerCase());
  };

  const filteredUtilization = useMemo(() => utilization.filter(filterAny), [utilization, filter]);
  const filteredOrphans = useMemo(() => orphans.filter(filterAny), [orphans, filter]);
  const filteredCableOrphans = useMemo(() => cableOrphans.filter(filterAny), [cableOrphans, filter]);
  const filteredPowerOrphans = useMemo(() => powerOrphans.filter(filterAny), [powerOrphans, filter]);
  const conflictRows = useMemo(() => Object.entries(conflicts), [conflicts]);

  const isPagedView = activeView !== "conflicts";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Auswertungen"
        subtitle="Pruefe Netzwerkdaten, finde Konflikte und behebe fehlende Zuordnungen."
      />

      <div className="card flex flex-wrap gap-2">
        <button className={activeView === "utilization" ? "btn" : "btn-secondary"} onClick={() => setActiveView("utilization")}>
          IP-Auslastung
        </button>
        <button className={activeView === "conflicts" ? "btn" : "btn-secondary"} onClick={() => setActiveView("conflicts")}>
          Konflikte
        </button>
        <button className={activeView === "interfaces" ? "btn" : "btn-secondary"} onClick={() => setActiveView("interfaces")}>
          Unverbundene Interfaces
        </button>
        <button className={activeView === "cables" ? "btn" : "btn-secondary"} onClick={() => setActiveView("cables")}>
          Kabel-Orphans
        </button>
        <button className={activeView === "power" ? "btn" : "btn-secondary"} onClick={() => setActiveView("power")}>
          Power-Orphans
        </button>
      </div>

      <div className="card flex flex-wrap items-end gap-2">
        <div className="field">
          <label className="field-label" htmlFor="report-filter">Filter</label>
          <input id="report-filter" className="input" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Textsuche in sichtbaren Daten" />
        </div>
        {isPagedView && (
          <>
            <div className="field">
              <label className="field-label" htmlFor="report-limit">Eintraege pro Seite</label>
              <select
                id="report-limit"
                className="input"
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
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
                <button type="button" className="btn-secondary" onClick={() => setOffset((prev) => Math.max(0, prev - limit))} disabled={offset === 0}>
                  Zurueck
                </button>
                <span className="text-sm text-slate-700">{page}</span>
                <button type="button" className="btn-secondary" onClick={() => setOffset((prev) => prev + limit)}>
                  Weiter
                </button>
              </div>
            </div>
          </>
        )}
        <button type="button" className="btn-secondary" onClick={() => setFilter("")}>
          Filter loeschen
        </button>
      </div>

      {loading && <div className="card text-sm text-slate-600">Daten werden geladen...</div>}

      {!loading && activeView === "utilization" && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">Prefix</th>
                <th className="p-2">VRF</th>
                <th className="p-2">Benutzt</th>
                <th className="p-2">Frei</th>
                <th className="p-2">Auslastung</th>
              </tr>
            </thead>
            <tbody>
              {filteredUtilization.map((row) => (
                <tr key={`${row.prefix}-${row.vrf_id}`} className="border-b">
                  <td className="p-2 font-semibold">{row.prefix}</td>
                  <td className="p-2">{row.vrf_id}</td>
                  <td className="p-2">{row.used}</td>
                  <td className="p-2">{row.free}</td>
                  <td className="p-2">{row.utilization_pct.toFixed(1)}%</td>
                </tr>
              ))}
              {filteredUtilization.length === 0 && (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={5}>
                    Keine Eintraege gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && activeView === "conflicts" && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">Konflikttyp</th>
                <th className="p-2">Wert</th>
              </tr>
            </thead>
            <tbody>
              {conflictRows.map(([key, value]) => (
                <tr key={key} className="border-b">
                  <td className="p-2 font-semibold">{key}</td>
                  <td className="p-2">{JSON.stringify(value)}</td>
                </tr>
              ))}
              {conflictRows.length === 0 && (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={2}>
                    Keine Konflikte gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && activeView === "interfaces" && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">Interface ID</th>
                <th className="p-2">Device ID</th>
                <th className="p-2">Name</th>
                <th className="p-2">Typ</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrphans.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-2">{row.id}</td>
                  <td className="p-2">{row.device_id}</td>
                  <td className="p-2 font-semibold">{row.name}</td>
                  <td className="p-2">{row.if_type}</td>
                </tr>
              ))}
              {filteredOrphans.length === 0 && (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={4}>
                    Keine unverbundenen Interfaces gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && activeView === "cables" && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">Kabel ID</th>
                <th className="p-2">Endpunkt A</th>
                <th className="p-2">Endpunkt B</th>
                <th className="p-2">Typ</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filteredCableOrphans.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-2">{row.id}</td>
                  <td className="p-2">{`${row.endpoint_a_type}:${row.endpoint_a_id}`}</td>
                  <td className="p-2">{`${row.endpoint_b_type}:${row.endpoint_b_id}`}</td>
                  <td className="p-2">{row.cable_type}</td>
                  <td className="p-2">{row.status}</td>
                </tr>
              ))}
              {filteredCableOrphans.length === 0 && (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={5}>
                    Keine Kabel-Orphans gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {!loading && activeView === "power" && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">Device ID</th>
                <th className="p-2">Name</th>
                <th className="p-2">Rolle</th>
                <th className="p-2">Status</th>
                <th className="p-2">Site</th>
                <th className="p-2">Rack</th>
              </tr>
            </thead>
            <tbody>
              {filteredPowerOrphans.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-2">{row.id}</td>
                  <td className="p-2 font-semibold">{row.name}</td>
                  <td className="p-2">{row.role}</td>
                  <td className="p-2">{row.status}</td>
                  <td className="p-2">{row.site_id ?? "-"}</td>
                  <td className="p-2">{row.rack_id ?? "-"}</td>
                </tr>
              ))}
              {filteredPowerOrphans.length === 0 && (
                <tr>
                  <td className="p-3 text-slate-500" colSpan={6}>
                    Keine Power-Orphans gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
