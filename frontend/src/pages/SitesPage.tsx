import { FormEvent, useEffect, useState } from "react";

import { del, extractApiError, get, post, put } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";
import { Site } from "../types";

export function SitesPage() {
  const [items, setItems] = useState<Site[]>([]);
  const [form, setForm] = useState({ name: "", code: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = () => get<Site[]>("/dcim/sites").then(setItems);
  useEffect(() => {
    void load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await post("/dcim/sites", form);
      setForm({ name: "", code: "" });
      await load();
      setMessage("Site gespeichert.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const editSite = async (site: Site) => {
    const name = window.prompt("Site Name", site.name);
    if (!name) return;
    const code = window.prompt("Site Code", site.code);
    if (!code) return;
    try {
      await put(`/dcim/sites/${site.id}`, { name, code, address: null, description: null });
      await load();
      setMessage("Site aktualisiert.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const deleteSite = async (site: Site) => {
    if (!window.confirm(`Site ${site.name} wirklich löschen?`)) return;
    try {
      await del(`/dcim/sites/${site.id}`);
      await load();
      setMessage("Site gelöscht.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Sites" subtitle="Standorte mit optionaler Hierarchie" />
      <form className="card flex gap-2" onSubmit={submit}>
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" />
        <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Code" />
        <button className="btn" type="submit">Create</button>
      </form>
      {message && <div className="card border border-green-200 bg-green-50 text-sm text-green-800">{message}</div>}
      {error && <div className="card border border-red-200 bg-red-50 text-sm text-red-800">{error}</div>}
      <div className="card grid gap-2">
        {items.map((site) => (
          <div key={site.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3">
            <span>{site.name} ({site.code})</span>
            <span>
              <button className="mr-2 rounded border px-2 py-1 text-xs" onClick={() => void editSite(site)}>Edit</button>
              <button className="rounded border border-red-300 px-2 py-1 text-xs text-red-700" onClick={() => void deleteSite(site)}>Delete</button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

