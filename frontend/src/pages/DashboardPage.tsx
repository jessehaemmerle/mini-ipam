import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { get } from "../api/client";
import { GlobalSearchPanel } from "../components/common/GlobalSearchPanel";
import { PageHeader } from "../components/common/PageHeader";

export function DashboardPage() {
  const [stats, setStats] = useState<Record<string, number>>({});

  useEffect(() => {
    get<Record<string, number>>("/ipam/stats").then(setStats).catch(() => setStats({}));
  }, []);

  const statRows = Object.entries(stats)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({
      key,
      label: key
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase()),
      value,
    }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Startseite"
        subtitle="Diese Seite fuehrt durch die wichtigsten Schritte der Ersteinrichtung."
        meta={`${Object.keys(stats).length} Kennzahlen verfuegbar`}
      />

      <div className="card">
        <h2 className="text-lg font-semibold text-ink">Schnellstart</h2>
        <ol className="mt-3 space-y-3 text-sm text-slate-700">
          <li>
            1. Netzraum anlegen:{" "}
            <Link className="font-semibold text-brand hover:underline" to="/ipam/vrfs">
              Zur Seite Netzraeume (VRF)
            </Link>
          </li>
          <li>
            2. Netzbereich erfassen:{" "}
            <Link className="font-semibold text-brand hover:underline" to="/ipam/prefixes">
              Zur Seite Netzbereiche
            </Link>
          </li>
          <li>
            3. Einzelne IP-Adresse speichern:{" "}
            <Link className="font-semibold text-brand hover:underline" to="/ipam/ips">
              Zur Seite IP-Adressen
            </Link>
          </li>
          <li>
            4. Danach Infrastruktur pflegen:{" "}
            <Link className="font-semibold text-brand hover:underline" to="/devices">
              Zur Seite Geraete
            </Link>
          </li>
        </ol>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="text-lg font-semibold text-ink">Aktueller Stand</h2>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">Bereich</th>
              <th className="p-2">Anzahl</th>
            </tr>
          </thead>
          <tbody>
            {statRows.map((row) => (
              <tr key={row.key} className="border-b last:border-b-0">
                <td className="p-2">{row.label}</td>
                <td className="p-2 font-semibold text-brand">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {Object.keys(stats).length === 0 && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Keine Dashboard-Daten verfuegbar.
        </div>
      )}

      <div className="card">
        <h2 className="text-lg font-semibold text-ink">Suche</h2>
        <p className="mt-1 text-sm text-slate-600">Direktes Finden von Prefixen, IPs, Geraeten und anderen Objekten.</p>
        <GlobalSearchPanel />
      </div>
    </div>
  );
}

