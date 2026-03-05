import { useEffect, useState } from "react";

import { get } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";

export function DashboardPage() {
  const [stats, setStats] = useState<Record<string, number>>({});

  useEffect(() => {
    get<Record<string, number>>("/ipam/stats").then(setStats).catch(() => setStats({}));
  }, []);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="IPAM-first Übersicht mit Schnellzugriffen" />
      <div className="grid gap-4 md:grid-cols-4">
        {Object.entries(stats).map(([key, value]) => (
          <div key={key} className="card">
            <p className="muted">{key}</p>
            <p className="text-3xl font-bold text-brand">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
