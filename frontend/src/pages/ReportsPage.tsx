import { useState } from "react";

import { get } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";

export function ReportsPage() {
  const [utilization, setUtilization] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<Record<string, unknown>>({});
  const [orphans, setOrphans] = useState<any[]>([]);
  const [cableOrphans, setCableOrphans] = useState<any[]>([]);
  const [powerOrphans, setPowerOrphans] = useState<any[]>([]);
  const [filter, setFilter] = useState("");

  const filterAny = (value: unknown) => {
    if (!filter.trim()) return true;
    return JSON.stringify(value).toLowerCase().includes(filter.trim().toLowerCase());
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Reports" subtitle="Utilization, Konflikte, Orphans" />
      <div className="card">
        <input className="input" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Report-Filter (JSON Textsuche)" />
      </div>
      <div className="card flex flex-wrap gap-2">
        <button className="btn" onClick={() => get<any[]>("/reports/ip-utilization").then(setUtilization)}>IP Utilization</button>
        <button className="btn" onClick={() => get<Record<string, unknown>>("/reports/conflicts").then(setConflicts)}>Conflicts</button>
        <button className="btn" onClick={() => get<any[]>("/reports/unassigned-interfaces").then(setOrphans)}>Unassigned Interfaces</button>
        <button className="btn" onClick={() => get<any[]>("/reports/cable-orphans").then(setCableOrphans)}>Cable Orphans</button>
        <button className="btn" onClick={() => get<any[]>("/reports/power-orphans").then(setPowerOrphans)}>Power Orphans</button>
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

