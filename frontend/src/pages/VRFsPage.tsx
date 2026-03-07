import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";

import { del, extractApiError, get, post, put } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";
import { Vrf } from "../types";

export function VRFsPage() {
  const [items, setItems] = useState<Vrf[]>([]);
  const [name, setName] = useState("");
  const [filter, setFilter] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", description: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const data = await get<Vrf[]>("/ipam/vrfs");
    setItems(data);
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredItems = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.name.toLowerCase().includes(q) || (item.description || "").toLowerCase().includes(q));
  }, [items, filter]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Bitte einen VRF-Namen eingeben.");
      setMessage("");
      return;
    }
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await post("/ipam/vrfs", { name: name.trim() });
      setName("");
      await load();
      setMessage("VRF gespeichert.");
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (item: Vrf) => {
    setEditingId(item.id);
    setEditForm({ name: item.name, description: item.description || "" });
    setError("");
    setMessage("");
  };

  const saveEdit = async (item: Vrf) => {
    if (!editForm.name.trim()) {
      setError("VRF-Name darf nicht leer sein.");
      setMessage("");
      return;
    }
    try {
      await put(`/ipam/vrfs/${item.id}`, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
      });
      await load();
      setMessage("VRF aktualisiert.");
      setError("");
      setEditingId(null);
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const deleteVrf = async (item: Vrf) => {
    if (!window.confirm(`VRF ${item.name} wirklich loeschen?`)) return;
    try {
      await del(`/ipam/vrfs/${item.id}`);
      await load();
      setMessage("VRF geloescht.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Netzraeume (VRF)" subtitle="Trennt Netzbereiche logisch, damit gleiche IP-Bereiche mehrfach verwendet werden koennen." />
      <form className="card grid gap-3 md:grid-cols-3" onSubmit={submit}>
        <div className="field md:col-span-2">
          <label htmlFor="vrf-name" className="field-label">VRF Name</label>
          <input id="vrf-name" className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="z.B. PROD" />
        </div>
        <div className="flex items-end">
          <button className="btn w-full md:w-auto" type="submit" disabled={saving}>{saving ? "Speichert..." : "VRF anlegen"}</button>
        </div>
      </form>
      {message && <div className="card border border-green-200 bg-green-50 text-sm text-green-800">{message}</div>}
      {error && <div className="card border border-red-200 bg-red-50 text-sm text-red-800">{error}</div>}
      <div className="card flex flex-wrap items-end gap-2">
        <div className="field">
          <label className="field-label" htmlFor="vrf-filter">Suche</label>
          <input id="vrf-filter" className="input" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Name oder Beschreibung" />
        </div>
        <button type="button" className="btn-secondary" onClick={() => setFilter("")}>
          Zuruecksetzen
        </button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">Name</th>
              <th className="p-2">Beschreibung</th>
              <th className="p-2">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <Fragment key={item.id}>
                <tr className="border-b">
                  <td className="p-2">{item.name}</td>
                  <td className="p-2">{item.description || "-"}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-2">
                      {editingId === item.id ? (
                        <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => setEditingId(null)}>Abbrechen</button>
                      ) : (
                        <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => startEdit(item)}>Bearbeiten</button>
                      )}
                      <button type="button" className="btn-danger px-2 py-1 text-xs" onClick={() => void deleteVrf(item)}>Loeschen</button>
                    </div>
                  </td>
                </tr>
                {editingId === item.id && (
                  <tr className="border-b bg-slate-50/80">
                    <td className="p-2" colSpan={3}>
                      <div className="grid gap-2 md:grid-cols-4">
                        <input
                          className="input"
                          value={editForm.name}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder="VRF Name"
                        />
                        <input
                          className="input md:col-span-2"
                          value={editForm.description}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                          placeholder="Beschreibung (optional)"
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
                <td className="p-3 text-sm text-slate-500" colSpan={3}>
                  Keine VRFs gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
