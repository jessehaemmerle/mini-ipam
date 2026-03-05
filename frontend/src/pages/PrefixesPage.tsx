import { FormEvent, useEffect, useMemo, useState } from "react";

import { del, extractApiError, get, post, put } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";
import { Prefix, PrefixDetail, Vrf } from "../types";

export function PrefixesPage() {
  const [items, setItems] = useState<Prefix[]>([]);
  const [vrfs, setVrfs] = useState<Vrf[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PrefixDetail | null>(null);
  const [tab, setTab] = useState<"overview" | "ips" | "history">("overview");
  const [form, setForm] = useState({ cidr: "", vrf_id: 1, role: "LAN" });
  const [filters, setFilters] = useState({ q: "", vrf_id: "" as number | "", role: "", status: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    get<Prefix[]>("/ipam/prefixes").then(setItems);
    get<Vrf[]>("/ipam/vrfs").then(setVrfs);
  };

  const loadDetail = (id: number) => {
    setSelectedId(id);
    get<PrefixDetail>(`/ipam/prefixes/${id}/detail`).then(setDetail);
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredItems = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return items.filter((item) => {
      if (filters.vrf_id !== "" && item.vrf_id !== filters.vrf_id) return false;
      if (filters.role && item.role !== filters.role) return false;
      if (filters.status && item.status !== filters.status) return false;
      if (!q) return true;
      return item.cidr.toLowerCase().includes(q) || item.role.toLowerCase().includes(q);
    });
  }, [items, filters]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await post("/ipam/prefixes", { ...form, status: "active" });
      setForm({ cidr: "", vrf_id: form.vrf_id, role: "LAN" });
      load();
      setMessage("Prefix gespeichert.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const editPrefix = async (item: Prefix) => {
    const cidr = window.prompt("CIDR", item.cidr);
    if (!cidr) return;
    const role = window.prompt("Role", item.role);
    if (!role) return;
    try {
      await put(`/ipam/prefixes/${item.id}`, {
        cidr,
        vrf_id: item.vrf_id,
        site_id: item.site_id ?? null,
        role,
        status: item.status,
        description: item.description ?? null,
      });
      await load();
      if (selectedId === item.id) {
        loadDetail(item.id);
      }
      setMessage("Prefix aktualisiert.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const deletePrefix = async (item: Prefix) => {
    if (!window.confirm(`Prefix ${item.cidr} wirklich löschen?`)) return;
    try {
      await del(`/ipam/prefixes/${item.id}`);
      await load();
      if (selectedId === item.id) {
        setSelectedId(null);
        setDetail(null);
      }
      setMessage("Prefix gelöscht.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Prefixes" subtitle="Overview, schnelle Anlage, Auslastung je Prefix" />
      <form className="card flex flex-wrap items-end gap-2" onSubmit={onSubmit}>
        <div>
          <label className="muted">CIDR</label>
          <input className="input ml-2" value={form.cidr} onChange={(e) => setForm({ ...form, cidr: e.target.value })} placeholder="10.10.0.0/24" />
        </div>
        <div>
          <label className="muted">VRF</label>
          <select className="input ml-2" value={form.vrf_id} onChange={(e) => setForm({ ...form, vrf_id: Number(e.target.value) })}>
            {vrfs.map((vrf) => (
              <option key={vrf.id} value={vrf.id}>{vrf.name}</option>
            ))}
          </select>
        </div>
        <button className="btn" type="submit">Quick Create</button>
      </form>
      {message && <div className="card border border-green-200 bg-green-50 text-sm text-green-800">{message}</div>}
      {error && <div className="card border border-red-200 bg-red-50 text-sm text-red-800">{error}</div>}
      <div className="card flex flex-wrap gap-2">
        <input
          className="input"
          value={filters.q}
          onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
          placeholder="Suche CIDR/Role"
        />
        <select className="input" value={filters.vrf_id} onChange={(e) => setFilters((prev) => ({ ...prev, vrf_id: e.target.value ? Number(e.target.value) : "" }))}>
          <option value="">alle VRFs</option>
          {vrfs.map((vrf) => (
            <option key={`filter-vrf-${vrf.id}`} value={vrf.id}>{vrf.name}</option>
          ))}
        </select>
        <select className="input" value={filters.role} onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}>
          <option value="">alle Roles</option>
          {Array.from(new Set(items.map((item) => item.role))).sort().map((role) => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
        <select className="input" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
          <option value="">alle Status</option>
          {Array.from(new Set(items.map((item) => item.status))).sort().map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">CIDR</th>
              <th className="p-2">VRF</th>
              <th className="p-2">Role</th>
              <th className="p-2">Status</th>
              <th className="p-2">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr
                key={item.id}
                className={`border-b cursor-pointer ${selectedId === item.id ? "bg-amber-50" : ""}`}
                onClick={() => loadDetail(item.id)}
              >
                <td className="p-2 font-semibold">{item.cidr}</td>
                <td className="p-2">{item.vrf_id}</td>
                <td className="p-2">{item.role}</td>
                <td className="p-2">{item.status}</td>
                <td className="p-2">
                  <button className="mr-2 rounded border px-2 py-1 text-xs" onClick={(e) => { e.stopPropagation(); void editPrefix(item); }}>Edit</button>
                  <button className="rounded border border-red-300 px-2 py-1 text-xs text-red-700" onClick={(e) => { e.stopPropagation(); void deletePrefix(item); }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="card space-y-3">
          <div className="flex gap-2">
            <button className="btn" onClick={() => setTab("overview")}>Overview</button>
            <button className="btn" onClick={() => setTab("ips")}>IPs</button>
            <button className="btn" onClick={() => setTab("history")}>History</button>
          </div>
          {tab === "overview" && (
            <div className="grid gap-2 md:grid-cols-4">
              <div><p className="muted">Prefix</p><p className="font-semibold">{detail.overview.cidr}</p></div>
              <div><p className="muted">Used</p><p className="font-semibold">{detail.utilization.used}</p></div>
              <div><p className="muted">Free</p><p className="font-semibold">{detail.utilization.free}</p></div>
              <div><p className="muted">Next Free IP</p><p className="font-semibold">{detail.next_free_ip || "-"}</p></div>
            </div>
          )}
          {tab === "ips" && (
            <div className="max-h-56 overflow-auto text-sm">
              {detail.ips.map((ip) => <div key={ip.id} className="border-b p-2">{ip.address} ({ip.status})</div>)}
            </div>
          )}
          {tab === "history" && (
            <div className="max-h-56 overflow-auto text-sm">
              {detail.history.map((h) => <div key={h.id} className="border-b p-2">{h.changed_at} - {h.action} by {h.changed_by}</div>)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

