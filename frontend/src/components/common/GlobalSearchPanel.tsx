import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { extractApiError, get, put } from "../../api/client";

type SearchBucket<T = Record<string, unknown>> = T[];
type SearchResult = {
  prefixes: SearchBucket;
  ips: SearchBucket;
  vlans: SearchBucket;
};

const EMPTY_RESULT: SearchResult = {
  prefixes: [],
  ips: [],
  vlans: [],
};

function valueToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

type GroupConfig = {
  key: keyof SearchResult;
  title: string;
  to: string;
  rowText: (item: Record<string, unknown>) => string;
};

const GROUPS: GroupConfig[] = [
  {
    key: "prefixes",
    title: "Netzbereiche",
    to: "/ipam/prefixes",
    rowText: (item) => valueToString(item.cidr),
  },
  {
    key: "ips",
    title: "IP-Adressen",
    to: "/ipam/ips",
    rowText: (item) => `${valueToString(item.address)} (${valueToString(item.status)})`,
  },
  {
    key: "vlans",
    title: "VLANs",
    to: "/vlans",
    rowText: (item) => `${valueToString(item.vid)} - ${valueToString(item.name)}`,
  },
];

export function GlobalSearchPanel() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult>(EMPTY_RESULT);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const totalHits = useMemo(() => {
    return (
      result.prefixes.length +
      result.ips.length +
      result.vlans.length
    );
  }, [result]);

  const runSearch = async () => {
    if (!query.trim()) {
      setResult(EMPTY_RESULT);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    setError("");
    setMessage("");
    try {
      const data = await get<SearchResult>("/search", { q: query.trim() });
      setResult(data);
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const copyValue = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`Kopiert: ${value}`);
      setError("");
    } catch {
      setError("Konnte nicht in die Zwischenablage kopieren.");
      setMessage("");
    }
  };

  const updateIpStatus = async (item: Record<string, unknown>, status: "free" | "reserved" | "assigned") => {
    try {
      await put(`/ipam/ips/${item.id}`, {
        address: item.address,
        vrf_id: item.vrf_id,
        status,
        dns_name: item.dns_name || null,
        description: item.description || null,
        out_of_scope: item.out_of_scope || false,
        assigned_type: null,
        assigned_id: null,
      });
      await runSearch();
      setMessage(`IP ${item.address} auf ${status} gesetzt.`);
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          className="input flex-1"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void runSearch();
            }
          }}
          placeholder="Suche nach IP, Netzwerk oder VLAN"
        />
        <button className="btn" type="button" onClick={() => void runSearch()} disabled={loading}>
          {loading ? "Suche laeuft..." : "Suchen"}
        </button>
        <button
          className="btn-secondary"
          type="button"
          onClick={() => {
            setQuery("");
            setResult(EMPTY_RESULT);
            setSearched(false);
            setMessage("");
            setError("");
          }}
        >
          Leeren
        </button>
      </div>

      {message && <div className="rounded-md border border-green-200 bg-green-50 p-2 text-sm text-green-800">{message}</div>}
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-2 text-sm text-red-800">{error}</div>}
      {searched && !loading && (
        <p className="text-sm text-slate-600">
          {totalHits} Treffer fuer "{query.trim()}".
        </p>
      )}

      {searched && !loading && totalHits === 0 && (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          Keine Treffer gefunden. Verwende einen kuerzeren oder allgemeineren Suchbegriff.
        </div>
      )}

      {totalHits > 0 && (
        <div className="space-y-3">
          {GROUPS.map((group) => {
            const items = (result[group.key] || []) as Record<string, unknown>[];
            if (!items.length) return null;
            return (
              <div key={group.key} className="rounded-md border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
                  <p className="text-sm font-semibold text-ink">
                    {group.title} ({items.length})
                  </p>
                  <button className="btn-secondary px-2 py-1 text-xs" type="button" onClick={() => navigate(group.to)}>
                    Seite oeffnen
                  </button>
                </div>
                <div className="divide-y divide-slate-200">
                  {items.slice(0, 8).map((item) => (
                    <div key={`${group.key}-${valueToString(item.id)}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span>{group.rowText(item)}</span>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => void copyValue(group.rowText(item))}>
                          Kopieren
                        </button>
                        {group.key === "ips" && (
                          <>
                            <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => void updateIpStatus(item, "free")}>
                              Als frei
                            </button>
                            <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => void updateIpStatus(item, "reserved")}>
                              Als reserviert
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
