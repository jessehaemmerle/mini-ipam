import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";

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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ cidr: "", role: "" });
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

  const roleOptions = useMemo(() => {
    return Array.from(new Set(["LAN", ...items.map((item) => item.role)])).sort();
  }, [items]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.cidr.trim()) {
      setError("Bitte eine CIDR eingeben.");
      setMessage("");
      return;
    }
    try {
      await post("/ipam/prefixes", { ...form, cidr: form.cidr.trim(), status: "active" });
      setForm({ cidr: "", vrf_id: form.vrf_id, role: "LAN" });
      load();
      setMessage("Prefix gespeichert.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const startEdit = (item: Prefix) => {
    setEditingId(item.id);
    setEditForm({ cidr: item.cidr, role: item.role });
    setError("");
    setMessage("");
  };

  const saveEdit = async (item: Prefix) => {
    if (!editForm.cidr.trim() || !editForm.role.trim()) {
      setError("CIDR und Role sind erforderlich.");
      setMessage("");
      return;
    }
    try {
      await put(`/ipam/prefixes/${item.id}`, {
        cidr: editForm.cidr.trim(),
        vrf_id: item.vrf_id,
        site_id: null,
        role: editForm.role.trim(),
        status: item.status,
        description: item.description ?? null,
      });
      await load();
      if (selectedId === item.id) {
        loadDetail(item.id);
      }
      setMessage("Prefix aktualisiert.");
      setError("");
      setEditingId(null);
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
      <PageHeader
        title="Netzbereiche"
        subtitle="Hier werden zusammenhaengende Netzbereiche (CIDR) verwaltet."
        meta={`${filteredItems.length} von ${items.length} Eintraegen sichtbar`}
      />
      <form className="card grid gap-3 md:grid-cols-4" onSubmit={onSubmit}>
        <div className="field md:col-span-2">
          <label className="field-label" htmlFor="prefix-cidr">CIDR</label>
          <input
            id="prefix-cidr"
            className="input"
            value={form.cidr}
            onChange={(e) => setForm({ ...form, cidr: e.target.value })}
            placeholder="10.10.0.0/24"
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="prefix-vrf">VRF</label>
          <select
            id="prefix-vrf"
            className="input"
            value={form.vrf_id}
            onChange={(e) => setForm({ ...form, vrf_id: Number(e.target.value) })}
          >
            {vrfs.map((vrf) => (
              <option key={vrf.id} value={vrf.id}>{vrf.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="prefix-role">Nutzung</label>
          <select
            id="prefix-role"
            className="input"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value })}
          >
            {roleOptions.map((role) => (
              <option key={role} value={role}>{role}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-4 flex flex-wrap items-center gap-2">
          <button className="btn" type="submit">Netzbereich speichern</button>
          <p className="field-hint">Beispiel: 10.10.0.0/24</p>
        </div>
      </form>
      {message && <div className="card border border-green-200 bg-green-50 text-sm text-green-800">{message}</div>}
      {error && <div className="card border border-red-200 bg-red-50 text-sm text-red-800">{error}</div>}
      <div className="card flex flex-wrap items-end gap-2">
        <input
          className="input"
          value={filters.q}
          onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
          placeholder="Suche CIDR/Nutzung"
        />
        <select className="input" value={filters.vrf_id} onChange={(e) => setFilters((prev) => ({ ...prev, vrf_id: e.target.value ? Number(e.target.value) : "" }))}>
          <option value="">alle VRFs</option>
          {vrfs.map((vrf) => (
            <option key={`filter-vrf-${vrf.id}`} value={vrf.id}>{vrf.name}</option>
          ))}
        </select>
        <select className="input" value={filters.role} onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))}>
          <option value="">alle Nutzungen</option>
          {roleOptions.map((role) => (
            <option key={role} value={role}>{role}</option>
          ))}
        </select>
        <select className="input" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
          <option value="">alle Status</option>
          {Array.from(new Set(items.map((item) => item.status))).sort().map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setFilters({ q: "", vrf_id: "", role: "", status: "" })}
        >
          Filter zuruecksetzen
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">CIDR</th>
              <th className="p-2">VRF</th>
              <th className="p-2">Nutzung</th>
              <th className="p-2">Status</th>
              <th className="p-2">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <Fragment key={item.id}>
                <tr
                  className={`border-b cursor-pointer ${selectedId === item.id ? "bg-amber-50" : ""}`}
                  onClick={() => loadDetail(item.id)}
                >
                  <td className="p-2 font-semibold">{item.cidr}</td>
                  <td className="p-2">{item.vrf_id}</td>
                  <td className="p-2">{item.role}</td>
                  <td className="p-2">{item.status}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-2">
                      {editingId === item.id ? (
                        <button
                          className="btn-secondary px-2 py-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingId(null);
                          }}
                        >
                          Abbrechen
                        </button>
                      ) : (
                        <button
                          className="btn-secondary px-2 py-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(item);
                          }}
                        >
                          Bearbeiten
                        </button>
                      )}
                      <button
                        className="btn-danger px-2 py-1 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          void deletePrefix(item);
                        }}
                      >
                        Loeschen
                      </button>
                    </div>
                  </td>
                </tr>
                {editingId === item.id && (
                  <tr className="border-b bg-slate-50/80">
                    <td className="p-2" colSpan={5}>
                      <div className="grid gap-2 md:grid-cols-4">
                        <input
                          className="input md:col-span-2"
                          value={editForm.cidr}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, cidr: e.target.value }))}
                          placeholder="CIDR"
                        />
                        <select
                          className="input"
                          value={editForm.role}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value }))}
                        >
                          {roleOptions.map((role) => (
                            <option key={`edit-role-${role}`} value={role}>{role}</option>
                          ))}
                        </select>
                        <button className="btn" type="button" onClick={() => void saveEdit(item)}>
                          Aenderungen speichern
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td className="p-3 text-sm text-slate-500" colSpan={5}>
                  Keine Prefixe gefunden. Passe Filter oder Suche an.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="card space-y-3">
          <div className="flex gap-2">
            <button className={tab === "overview" ? "btn" : "btn-secondary"} onClick={() => setTab("overview")}>Uebersicht</button>
            <button className={tab === "ips" ? "btn" : "btn-secondary"} onClick={() => setTab("ips")}>Adressen</button>
            <button className={tab === "history" ? "btn" : "btn-secondary"} onClick={() => setTab("history")}>Aenderungen</button>
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

