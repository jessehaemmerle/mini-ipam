import { FormEvent, useEffect, useState } from "react";

import { del, extractApiError, get, post, put } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";
import { VLAN } from "../types";

export function VLANsPage() {
  const [items, setItems] = useState<VLAN[]>([]);
  const [form, setForm] = useState({ vid: 10, name: "" });
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const load = () => get<VLAN[]>("/ipam/vlans").then(setItems);
  useEffect(() => {
    void load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
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

  const editVlan = async (item: VLAN) => {
    const vidInput = window.prompt("VID", String(item.vid));
    if (!vidInput) return;
    const nameInput = window.prompt("Name", item.name);
    if (!nameInput) return;
    try {
      await put(`/ipam/vlans/${item.id}`, {
        vid: Number(vidInput),
        name: nameInput,
        site_id: item.site_id ?? null,
        status: item.status,
        description: null,
      });
      await load();
      setMessage("VLAN aktualisiert.");
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
      <form className="card flex gap-2" onSubmit={submit}>
        <input className="input w-24" type="number" value={form.vid} onChange={(e) => setForm({ ...form, vid: Number(e.target.value) })} />
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" />
        <button className="btn" type="submit" disabled={saving}>{saving ? "Speichert..." : "Create"}</button>
      </form>
      {message && <div className="card border border-green-200 bg-green-50 text-sm text-green-800">{message}</div>}
      {error && <div className="card border border-red-200 bg-red-50 text-sm text-red-800">{error}</div>}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left"><th className="p-2">VID</th><th className="p-2">Name</th><th className="p-2">Status</th><th className="p-2">Aktionen</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="p-2">{item.vid}</td>
                <td className="p-2">{item.name}</td>
                <td className="p-2">{item.status}</td>
                <td className="p-2">
                  <button className="mr-2 rounded border px-2 py-1 text-xs" onClick={() => void editVlan(item)}>Edit</button>
                  <button className="rounded border border-red-300 px-2 py-1 text-xs text-red-700" onClick={() => void deleteVlan(item)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

