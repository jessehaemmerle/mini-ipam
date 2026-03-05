import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { del, extractApiError, get, put } from "../../api/client";

type SearchBucket<T = Record<string, unknown>> = T[];
type SearchResult = {
  prefixes: SearchBucket;
  ips: SearchBucket;
  vlans: SearchBucket;
  devices: SearchBucket;
  racks: SearchBucket;
  cables: SearchBucket;
  patch_ports?: SearchBucket;
};

const EMPTY_RESULT: SearchResult = {
  prefixes: [],
  ips: [],
  vlans: [],
  devices: [],
  racks: [],
  cables: [],
  patch_ports: [],
};

function valueToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

export function GlobalSearchPanel() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<SearchResult>(EMPTY_RESULT);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const hasResult =
    result.prefixes.length > 0 ||
    result.ips.length > 0 ||
    result.vlans.length > 0 ||
    result.devices.length > 0 ||
    result.racks.length > 0 ||
    result.cables.length > 0 ||
    (result.patch_ports?.length || 0) > 0;

  const runSearch = async () => {
    if (!query.trim()) {
      setResult(EMPTY_RESULT);
      return;
    }
    setLoading(true);
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
        assigned_type: item.assigned_type || null,
        assigned_id: item.assigned_id || null,
      });
      await runSearch();
      setMessage(`IP ${item.address} auf ${status} gesetzt.`);
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const deleteCable = async (item: Record<string, unknown>) => {
    if (!window.confirm(`Kabel #${item.id} wirklich loeschen?`)) return;
    try {
      await del(`/dcim/cables/${item.id}`);
      await runSearch();
      setMessage(`Kabel #${item.id} geloescht.`);
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  return (
    <div className="card space-y-3">
      <div className="flex gap-2">
        <input
          className="input flex-1"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Global search: IP, Prefix, VLAN, Device, Rack, Cable"
        />
        <button className="btn" type="button" onClick={() => void runSearch()} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </div>

      {message && <div className="rounded border border-green-200 bg-green-50 p-2 text-sm text-green-800">{message}</div>}
      {error && <div className="rounded border border-red-200 bg-red-50 p-2 text-sm text-red-800">{error}</div>}

      {hasResult && (
        <div className="space-y-3 text-sm">
          <div>
            <p className="mb-1 font-semibold">Prefixes ({result.prefixes.length})</p>
            {result.prefixes.map((item) => (
              <div key={`prefix-${valueToString(item.id)}`} className="mb-1 flex flex-wrap items-center gap-2 border-b p-1">
                <span>{valueToString(item.cidr)}</span>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => navigate("/ipam/prefixes")}>Open</button>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => void copyValue(valueToString(item.cidr))}>Copy</button>
              </div>
            ))}
          </div>

          <div>
            <p className="mb-1 font-semibold">IPs ({result.ips.length})</p>
            {result.ips.map((item) => (
              <div key={`ip-${valueToString(item.id)}`} className="mb-1 flex flex-wrap items-center gap-2 border-b p-1">
                <span>{valueToString(item.address)} ({valueToString(item.status)})</span>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => navigate("/ipam/ips")}>Open</button>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => void copyValue(valueToString(item.address))}>Copy</button>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => void updateIpStatus(item, "free")}>Set free</button>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => void updateIpStatus(item, "reserved")}>Set reserved</button>
              </div>
            ))}
          </div>

          <div>
            <p className="mb-1 font-semibold">VLANs ({result.vlans.length})</p>
            {result.vlans.map((item) => (
              <div key={`vlan-${valueToString(item.id)}`} className="mb-1 flex flex-wrap items-center gap-2 border-b p-1">
                <span>{valueToString(item.vid)} / {valueToString(item.name)}</span>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => navigate("/vlans")}>Open</button>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => void copyValue(valueToString(item.name))}>Copy</button>
              </div>
            ))}
          </div>

          <div>
            <p className="mb-1 font-semibold">Devices ({result.devices.length})</p>
            {result.devices.map((item) => (
              <div key={`device-${valueToString(item.id)}`} className="mb-1 flex flex-wrap items-center gap-2 border-b p-1">
                <span>{valueToString(item.name)}</span>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => navigate("/devices")}>Open</button>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => void copyValue(valueToString(item.name))}>Copy</button>
              </div>
            ))}
          </div>

          <div>
            <p className="mb-1 font-semibold">Racks ({result.racks.length})</p>
            {result.racks.map((item) => (
              <div key={`rack-${valueToString(item.id)}`} className="mb-1 flex flex-wrap items-center gap-2 border-b p-1">
                <span>{valueToString(item.name)}</span>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => navigate("/racks")}>Open</button>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => void copyValue(valueToString(item.name))}>Copy</button>
              </div>
            ))}
          </div>

          <div>
            <p className="mb-1 font-semibold">Cables ({result.cables.length})</p>
            {result.cables.map((item) => (
              <div key={`cable-${valueToString(item.id)}`} className="mb-1 flex flex-wrap items-center gap-2 border-b p-1">
                <span>#{valueToString(item.id)} {valueToString(item.label)}</span>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => navigate("/cabling")}>Open</button>
                <button type="button" className="rounded border border-red-300 px-2 py-1 text-xs text-red-700" onClick={() => void deleteCable(item)}>Delete</button>
              </div>
            ))}
          </div>
          <div>
            <p className="mb-1 font-semibold">Patch Ports ({result.patch_ports?.length || 0})</p>
            {(result.patch_ports || []).map((item) => (
              <div key={`patch-${valueToString(item.id)}`} className="mb-1 flex flex-wrap items-center gap-2 border-b p-1">
                <span>{valueToString(item.front_port_name)} / {valueToString(item.back_port_name)}</span>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => navigate("/cabling")}>Open</button>
                <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => void copyValue(valueToString(item.front_port_name))}>Copy</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
