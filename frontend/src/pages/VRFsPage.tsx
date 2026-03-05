import { FormEvent, useEffect, useState } from "react";

import { del, extractApiError, get, post, put } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";
import { Vrf } from "../types";

export function VRFsPage() {
  const [items, setItems] = useState<Vrf[]>([]);
  const [name, setName] = useState("");
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

  const editVrf = async (item: Vrf) => {
    const nextName = window.prompt("VRF Name", item.name);
    if (!nextName) return;
    try {
      await put(`/ipam/vrfs/${item.id}`, { name: nextName.trim(), description: item.description ?? null });
      await load();
      setMessage("VRF aktualisiert.");
      setError("");
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
      <PageHeader title="VRFs" subtitle="Einfacher VRF-Scope fuer Prefixes/IPs" />
      <form className="card flex gap-2" onSubmit={submit}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        <button className="btn" type="submit" disabled={saving}>{saving ? "Speichert..." : "Add"}</button>
      </form>
      {message && <div className="card border border-green-200 bg-green-50 text-sm text-green-800">{message}</div>}
      {error && <div className="card border border-red-200 bg-red-50 text-sm text-red-800">{error}</div>}
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
            {items.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="p-2">{item.name}</td>
                <td className="p-2">{item.description || "-"}</td>
                <td className="p-2">
                  <button type="button" className="mr-2 rounded border px-2 py-1 text-xs" onClick={() => void editVrf(item)}>Edit</button>
                  <button type="button" className="rounded border border-red-300 px-2 py-1 text-xs text-red-700" onClick={() => void deleteVrf(item)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
