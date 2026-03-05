import { useEffect, useState } from "react";

import { get } from "../api/client";
import { GlobalSearchPanel } from "../components/common/GlobalSearchPanel";
import { PageHeader } from "../components/common/PageHeader";

export function DashboardPage() {
  const [stats, setStats] = useState<Record<string, number>>({});

  useEffect(() => {
    get<Record<string, number>>("/ipam/stats").then(setStats).catch(() => setStats({}));
  }, []);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="IPAM-first Übersicht mit Schnellzugriffen"
        meta={`${Object.keys(stats).length} Kennzahlen`}
      />
      <div className="grid gap-4 md:grid-cols-4">
        {Object.entries(stats).map(([key, value]) => (
          <div key={key} className="card">
            <p className="muted">{key}</p>
            <p className="text-3xl font-bold text-brand">{value}</p>
          </div>
        ))}
      </div>
      {Object.keys(stats).length === 0 && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Keine Dashboard-Daten verfuegbar.
        </div>
      )}
      <div className="mt-4">
        <GlobalSearchPanel />
      </div>
    </div>
  );
}

