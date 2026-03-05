import { useState } from "react";

import { get } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";

export function ReportsPage() {
  const [utilization, setUtilization] = useState<any[]>([]);
  const [conflicts, setConflicts] = useState<Record<string, unknown>>({});
  const [orphans, setOrphans] = useState<any[]>([]);

  return (
    <div className="space-y-4">
      <PageHeader title="Reports" subtitle="Utilization, Konflikte, Orphans" />
      <div className="card flex flex-wrap gap-2">
        <button className="btn" onClick={() => get<any[]>("/reports/ip-utilization").then(setUtilization)}>IP Utilization</button>
        <button className="btn" onClick={() => get<Record<string, unknown>>("/reports/conflicts").then(setConflicts)}>Conflicts</button>
        <button className="btn" onClick={() => get<any[]>("/reports/unassigned-interfaces").then(setOrphans)}>Unassigned Interfaces</button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card whitespace-pre-wrap text-xs">{JSON.stringify(utilization, null, 2)}</div>
        <div className="card whitespace-pre-wrap text-xs">{JSON.stringify(conflicts, null, 2)}</div>
        <div className="card whitespace-pre-wrap text-xs">{JSON.stringify(orphans, null, 2)}</div>
      </div>
    </div>
  );
}

