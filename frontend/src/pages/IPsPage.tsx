import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";

import { del, extractApiError, get, post, put } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";
import { IPAddress, Prefix, Vrf } from "../types";

function isIPv4(value: string): boolean {
  const parts = value.split(".");
  if (parts.length !== 4) return false;
  return parts.every((part) => {
    if (!/^\d+$/.test(part)) return false;
    const n = Number(part);
    return n >= 0 && n <= 255;
  });
}

function ipv4ToInt(value: string): number {
  const [a, b, c, d] = value.split(".").map((item) => Number(item));
  return ((a << 24) >>> 0) + ((b << 16) >>> 0) + ((c << 8) >>> 0) + d;
}

function isIpInCidrV4(ip: string, cidr: string): boolean {
  const [network, prefix] = cidr.split("/");
  if (!network || !prefix) return false;
  if (!isIPv4(ip) || !isIPv4(network)) return false;
  const prefixLen = Number(prefix);
  if (!Number.isInteger(prefixLen) || prefixLen < 0 || prefixLen > 32) return false;
  const mask = prefixLen === 0 ? 0 : (0xffffffff << (32 - prefixLen)) >>> 0;
  return (ipv4ToInt(ip) & mask) === (ipv4ToInt(network) & mask);
}

export function IPsPage() {
  const [items, setItems] = useState<IPAddress[]>([]);
  const [vrfs, setVrfs] = useState<Vrf[]>([]);
  const [prefixes, setPrefixes] = useState<Prefix[]>([]);
  const [filters, setFilters] = useState({ q: "", status: "" });
  const [entryMode, setEntryMode] = useState<"single" | "range">("single");
  const [form, setForm] = useState({
    address: "",
    vrf_id: 1,
    status: "reserved",
    dns_name: "",
    out_of_scope: false,
  });
  const [bulkForm, setBulkForm] = useState({ start_ip: "", end_ip: "", description: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ address: "", dns_name: "" });
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [ipData, vrfData, prefixData] = await Promise.all([
      get<IPAddress[]>("/ipam/ips"),
      get<Vrf[]>("/ipam/vrfs"),
      get<Prefix[]>("/ipam/prefixes"),
    ]);
    setItems(ipData);
    setVrfs(vrfData);
    setPrefixes(prefixData);
    setForm((prev) => (vrfData.some((item) => item.id === prev.vrf_id) ? prev : { ...prev, vrf_id: vrfData[0]?.id ?? prev.vrf_id }));
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredItems = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return items.filter((item) => {
      if (filters.status && item.status !== filters.status) return false;
      if (!q) return true;
      return item.address.toLowerCase().includes(q) || (item.dns_name || "").toLowerCase().includes(q);
    });
  }, [items, filters]);

  const selectedVrfPrefixes = useMemo(() => prefixes.filter((prefix) => prefix.vrf_id === form.vrf_id), [prefixes, form.vrf_id]);

  const ipPrefixCheck = useMemo(() => {
    const address = form.address.trim();
    if (!address) return { state: "empty" as const, matching: [] as Prefix[] };
    if (address.includes(":")) return { state: "ipv6" as const, matching: [] as Prefix[] };
    if (!isIPv4(address)) return { state: "invalid" as const, matching: [] as Prefix[] };
    const matching = selectedVrfPrefixes.filter((prefix) => isIpInCidrV4(address, prefix.cidr));
    return { state: matching.length > 0 ? ("in_scope" as const) : ("out_scope" as const), matching };
  }, [form.address, selectedVrfPrefixes]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.address.trim()) {
      setError("Bitte eine IP-Adresse eingeben.");
      setMessage("");
      return;
    }
    if (!vrfs.length) {
      setError("Keine VRF vorhanden. Bitte zuerst eine VRF anlegen.");
      setMessage("");
      return;
    }
    if (!form.out_of_scope && ipPrefixCheck.state === "invalid") {
      setError("IP-Format ungueltig.");
      setMessage("");
      return;
    }
    if (!form.out_of_scope && ipPrefixCheck.state === "out_scope") {
      setError("IP liegt in keinem bekannten Prefix der ausgewaehlten VRF.");
      setMessage("");
      return;
    }
    setError("");
    setMessage("");
    setSaving(true);
    try {
      await post("/ipam/ips", {
        address: form.address.trim(),
        vrf_id: form.vrf_id,
        status: form.status,
        dns_name: form.dns_name.trim() || null,
        description: null,
        out_of_scope: form.out_of_scope,
        assigned_type: null,
        assigned_id: null,
      });
      setForm({ ...form, address: "", dns_name: "", out_of_scope: false });
      await load();
      setMessage("IP erfolgreich gespeichert.");
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: IPAddress) => {
    setEditingId(item.id);
    setEditForm({ address: item.address, dns_name: item.dns_name || "" });
    setMessage("");
    setError("");
  };

  const saveEdit = async (item: IPAddress) => {
    if (!editForm.address.trim()) {
      setError("IP-Adresse ist erforderlich.");
      setMessage("");
      return;
    }
    try {
      await put(`/ipam/ips/${item.id}`, {
        address: editForm.address.trim(),
        vrf_id: item.vrf_id,
        status: item.status,
        dns_name: editForm.dns_name.trim() || null,
        description: item.description || null,
        out_of_scope: item.out_of_scope || false,
        assigned_type: null,
        assigned_id: null,
      });
      await load();
      setMessage("IP aktualisiert.");
      setError("");
      setEditingId(null);
    } catch (err: unknown) {
      setError(extractApiError(err));
    }
  };

  const deleteIp = async (item: IPAddress) => {
    if (!window.confirm(`IP ${item.address} wirklich löschen?`)) return;
    try {
      await del(`/ipam/ips/${item.id}`);
      await load();
      setMessage("IP gelöscht.");
    } catch (err: unknown) {
      setError(extractApiError(err));
    }
  };

  const submitBulkReserve = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const result = await post<{ created: number }>("/ipam/ips/bulk-reserve", {
        start_ip: bulkForm.start_ip,
        end_ip: bulkForm.end_ip,
        vrf_id: form.vrf_id,
        description: bulkForm.description || null,
      });
      await load();
      setBulkForm({ start_ip: "", end_ip: "", description: "" });
      setMessage(`${result.created} IPs reserviert.`);
    } catch (err: unknown) {
      setError(extractApiError(err));
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="IP-Adressen" subtitle="Einzelne IPs speichern oder Bereiche reservieren." meta={`${filteredItems.length} von ${items.length} Eintraegen sichtbar`} />
      <div className="card">
        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" className={entryMode === "single" ? "btn" : "btn-secondary"} onClick={() => setEntryMode("single")}>
            Einzelne IP
          </button>
          <button type="button" className={entryMode === "range" ? "btn" : "btn-secondary"} onClick={() => setEntryMode("range")}>
            IP-Bereich
          </button>
        </div>
        {entryMode === "single" ? (
          <form onSubmit={submit} className="grid gap-3 md:grid-cols-6">
        <div className="field md:col-span-2">
          <label className="field-label" htmlFor="ip-address">IP-Adresse</label>
          <input id="ip-address" className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="10.10.0.12" />
          {ipPrefixCheck.state === "invalid" && <p className="field-hint text-red-700">Ungueltiges IPv4-Format.</p>}
          {ipPrefixCheck.state === "ipv6" && !form.out_of_scope && <p className="field-hint text-amber-700">IPv6 wird serverseitig geprueft.</p>}
          {ipPrefixCheck.state === "in_scope" && <p className="field-hint text-green-700">IP liegt in Prefix: {ipPrefixCheck.matching[0].cidr}</p>}
          {ipPrefixCheck.state === "out_scope" && !form.out_of_scope && <p className="field-hint text-amber-700">IP liegt in keinem bekannten Prefix dieser VRF.</p>}
        </div>
        <div className="field md:col-span-2">
          <label className="field-label" htmlFor="ip-dns">DNS-Name</label>
          <input id="ip-dns" className="input" value={form.dns_name} onChange={(e) => setForm({ ...form, dns_name: e.target.value })} placeholder="server01.example.local" />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="ip-status">Status</label>
          <select id="ip-status" className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="reserved">reserved</option>
            <option value="assigned">assigned</option>
            <option value="free">free</option>
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="ip-vrf">VRF</label>
          <select id="ip-vrf" className="input" value={form.vrf_id} onChange={(e) => setForm({ ...form, vrf_id: Number(e.target.value) })} disabled={!vrfs.length}>
            {vrfs.map((vrf) => <option key={vrf.id} value={vrf.id}>{vrf.name}</option>)}
          </select>
        </div>
        <div className="field md:col-span-4">
          <label className="field-label" htmlFor="ip-out-of-scope">Prefix-Pruefung</label>
          <label className="flex items-center gap-2 text-sm text-slate-700" htmlFor="ip-out-of-scope">
            <input id="ip-out-of-scope" type="checkbox" checked={form.out_of_scope} onChange={(e) => setForm({ ...form, out_of_scope: e.target.checked })} />
            IP ausserhalb bekannter Prefixe in der VRF erlauben
          </label>
        </div>
        <div className="flex items-end">
          <button className="btn w-full md:w-auto" type="submit" disabled={saving || !vrfs.length}>{saving ? "Speichert..." : "IP speichern"}</button>
        </div>
          </form>
        ) : (
          <form onSubmit={submitBulkReserve} className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-4">
              <h2 className="text-lg font-semibold text-ink">IP-Bereich reservieren</h2>
            </div>
        <div className="field">
          <label className="field-label" htmlFor="bulk-start-ip">Start-IP</label>
          <input id="bulk-start-ip" className="input" value={bulkForm.start_ip} onChange={(e) => setBulkForm({ ...bulkForm, start_ip: e.target.value })} placeholder="10.10.0.100" />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="bulk-end-ip">End-IP</label>
          <input id="bulk-end-ip" className="input" value={bulkForm.end_ip} onChange={(e) => setBulkForm({ ...bulkForm, end_ip: e.target.value })} placeholder="10.10.0.120" />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="bulk-description">Beschreibung</label>
          <input id="bulk-description" className="input" value={bulkForm.description} onChange={(e) => setBulkForm({ ...bulkForm, description: e.target.value })} placeholder="optional" />
        </div>
        <div className="flex items-end">
          <button className="btn w-full md:w-auto" type="submit">Bereich reservieren</button>
        </div>
          </form>
        )}
      </div>

      {message && <div className="card border border-green-200 bg-green-50 text-sm text-green-800">{message}</div>}
      {error && <div className="card border border-red-200 bg-red-50 text-sm text-red-800">{error}</div>}

      <div className="card flex flex-wrap gap-2">
        <input className="input" value={filters.q} onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))} placeholder="Suche IP oder DNS" />
        <select className="input" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
          <option value="">alle Status</option>
          {Array.from(new Set(items.map((item) => item.status))).sort().map((status) => <option key={status} value={status}>{status}</option>)}
        </select>
        <button type="button" className="btn-secondary" onClick={() => setFilters({ q: "", status: "" })}>Filter zuruecksetzen</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">IP-Adresse</th>
              <th className="p-2">Status</th>
              <th className="p-2">DNS</th>
              <th className="p-2">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <Fragment key={item.id}>
                <tr className="border-b">
                  <td className="p-2 font-semibold">{item.address}</td>
                  <td className="p-2">{item.status}</td>
                  <td className="p-2">{item.dns_name || "-"}</td>
                  <td className="p-2">
                    {editingId === item.id ? (
                      <button type="button" className="btn-secondary mr-2 px-2 py-1 text-xs" onClick={() => setEditingId(null)}>Abbrechen</button>
                    ) : (
                      <button type="button" className="btn-secondary mr-2 px-2 py-1 text-xs" onClick={() => startEdit(item)}>Bearbeiten</button>
                    )}
                    <button type="button" className="btn-danger px-2 py-1 text-xs" onClick={() => void deleteIp(item)}>Loeschen</button>
                  </td>
                </tr>
                {editingId === item.id && (
                  <tr className="border-b bg-slate-50/80">
                    <td className="p-2" colSpan={4}>
                      <div className="grid gap-2 md:grid-cols-3">
                        <input className="input" value={editForm.address} onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))} placeholder="IP-Adresse" />
                        <input className="input" value={editForm.dns_name} onChange={(e) => setEditForm((prev) => ({ ...prev, dns_name: e.target.value }))} placeholder="DNS Name" />
                        <button type="button" className="btn" onClick={() => void saveEdit(item)}>Speichern</button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td className="p-3 text-sm text-slate-500" colSpan={4}>Keine IPs gefunden. Passe Filter oder Suche an.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
