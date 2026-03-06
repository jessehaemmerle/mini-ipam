import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";

import { del, extractApiError, get, post, put } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";
import { VLAN } from "../types";

export function VLANsPage() {
  const [items, setItems] = useState<VLAN[]>([]);
  const [form, setForm] = useState({ vid: 10, name: "" });
  const [filters, setFilters] = useState({ q: "", status: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ vid: "", name: "" });
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const load = () => get<VLAN[]>("/ipam/vlans").then(setItems);
  useEffect(() => {
    void load();
  }, []);

  const filteredItems = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return items.filter((item) => {
      if (filters.status && item.status !== filters.status) return false;
      if (!q) return true;
      return item.name.toLowerCase().includes(q) || String(item.vid).includes(q);
    });
  }, [items, filters]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || form.vid < 1 || form.vid > 4094) {
      setError("Bitte VLAN-ID 1-4094 und Namen eingeben.");
      setMessage("");
      return;
    }
    setError("");
    setMessage("");
    setSaving(true);
    try {
      await post("/ipam/vlans", { ...form, status: "active" });
      setForm({ ...form, name: "" });
      await load();
      setMessage("VLAN erfolgreich gespeichert.");
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: VLAN) => {
    setEditingId(item.id);
    setEditForm({ vid: String(item.vid), name: item.name });
    setError("");
    setMessage("");
  };

  const saveEdit = async (item: VLAN) => {
    const vid = Number(editForm.vid);
    if (!editForm.name.trim() || Number.isNaN(vid) || vid < 1 || vid > 4094) {
      setError("Bitte VLAN-ID 1-4094 und Namen eingeben.");
      setMessage("");
      return;
    }
    try {
      await put(`/ipam/vlans/${item.id}`, {
        vid,
        name: editForm.name.trim(),
        site_id: item.site_id ?? null,
        status: item.status,
        description: null,
      });
      await load();
      setMessage("VLAN aktualisiert.");
      setError("");
      setEditingId(null);
    } catch (err: unknown) {
      setError(extractApiError(err));
    }
  };

  const deleteVlan = async (item: VLAN) => {
    if (!window.confirm(`VLAN ${item.vid} wirklich löschen?`)) return;
    try {
      await del(`/ipam/vlans/${item.id}`);
      await load();
      setMessage("VLAN gelöscht.");
    } catch (err: unknown) {
      setError(extractApiError(err));
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="VLANs" subtitle="Site-scoped VLAN Verwaltung" />
      <form className="card grid gap-3 md:grid-cols-4" onSubmit={submit}>
        <div className="field">
          <label className="field-label" htmlFor="vlan-vid">VLAN-ID</label>
          <input
            id="vlan-vid"
            className="input"
            type="number"
            min={1}
            max={4094}
            value={form.vid}
            onChange={(e) => setForm({ ...form, vid: Number(e.target.value) })}
          />
        </div>
        <div className="field md:col-span-2">
          <label className="field-label" htmlFor="vlan-name">Name</label>
          <input id="vlan-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="z.B. MGMT" />
        </div>
        <div className="flex items-end">
          <button className="btn w-full md:w-auto" type="submit" disabled={saving}>{saving ? "Speichert..." : "VLAN anlegen"}</button>
        </div>
      </form>
      {message && <div className="card border border-green-200 bg-green-50 text-sm text-green-800">{message}</div>}
      {error && <div className="card border border-red-200 bg-red-50 text-sm text-red-800">{error}</div>}
      <div className="card flex flex-wrap gap-2">
        <input
          className="input"
          value={filters.q}
          onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
          placeholder="Suche VID/Name"
        />
        <select className="input" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
          <option value="">alle Status</option>
          {Array.from(new Set(items.map((item) => item.status))).sort().map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        <button type="button" className="btn-secondary" onClick={() => setFilters({ q: "", status: "" })}>
          Zuruecksetzen
        </button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left"><th className="p-2">VID</th><th className="p-2">Name</th><th className="p-2">Status</th><th className="p-2">Aktionen</th></tr></thead>
          <tbody>
            {filteredItems.map((item) => (
              <Fragment key={item.id}>
                <tr className="border-b">
                  <td className="p-2">{item.vid}</td>
                  <td className="p-2">{item.name}</td>
                  <td className="p-2">{item.status}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-2">
                      {editingId === item.id ? (
                        <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => setEditingId(null)}>Abbrechen</button>
                      ) : (
                        <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => startEdit(item)}>Bearbeiten</button>
                      )}
                      <button type="button" className="btn-danger px-2 py-1 text-xs" onClick={() => void deleteVlan(item)}>Loeschen</button>
                    </div>
                  </td>
                </tr>
                {editingId === item.id && (
                  <tr className="border-b bg-slate-50/80">
                    <td className="p-2" colSpan={4}>
                      <div className="grid gap-2 md:grid-cols-4">
                        <input
                          className="input"
                          type="number"
                          min={1}
                          max={4094}
                          value={editForm.vid}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, vid: e.target.value }))}
                        />
                        <input
                          className="input md:col-span-2"
                          value={editForm.name}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder="VLAN Name"
                        />
                        <button type="button" className="btn" onClick={() => void saveEdit(item)}>
                          Speichern
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td className="p-3 text-sm text-slate-500" colSpan={4}>
                  Keine VLANs gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

