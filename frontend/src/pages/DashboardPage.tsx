import { useEffect, useState } from "react";

import { get } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";

export function DashboardPage() {
  const [stats, setStats] = useState<Record<string, number>>({});
  const [q, setQ] = useState("");
  const [searchResult, setSearchResult] = useState<Record<string, unknown> | null>(null);

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
      <div className="card mt-4 flex gap-2">
        <input
          className="input flex-1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Global search: IP, Prefix, VLAN, Device, Rack, Cable"
        />
        <button
          className="btn"
          onClick={() => {
            if (!q.trim()) return;
            get<Record<string, unknown>>("/search", { q: q.trim() }).then(setSearchResult);
          }}
        >
          Search
        </button>
      </div>
      {searchResult && (
        <div className="card mt-4 whitespace-pre-wrap text-xs">{JSON.stringify(searchResult, null, 2)}</div>
      )}
    </div>
  );
}

