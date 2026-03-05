import { FormEvent, useEffect, useState } from "react";

import { del, extractApiError, get, post, put } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";
import { Rack, Site } from "../types";

export function SitesPage() {
  const [items, setItems] = useState<Site[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [rackSiteTarget, setRackSiteTarget] = useState<Record<number, number>>({});
  const [form, setForm] = useState({ name: "", code: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const [siteData, rackData] = await Promise.all([
      get<Site[]>("/dcim/sites"),
      get<Rack[]>("/dcim/racks"),
    ]);
    setItems(siteData);
    setRacks(rackData);
    setRackSiteTarget(Object.fromEntries(rackData.map((rack) => [rack.id, rack.site_id])));
  };

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
    if (!window.confirm(`Site ${site.name} wirklich loeschen?`)) return;
    try {
      await del(`/dcim/sites/${site.id}`);
      await load();
      setMessage("Site geloescht.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const assignRackToSite = async (rack: Rack) => {
    const targetSiteId = rackSiteTarget[rack.id];
    if (!targetSiteId) {
      setError("Bitte eine gueltige Site auswaehlen.");
      setMessage("");
      return;
    }
    try {
      await put(`/dcim/racks/${rack.id}`, {
        site_id: targetSiteId,
        room_id: null,
        name: rack.name,
        height_u: rack.height_u,
        description: null,
      });
      await load();
      setMessage(`Rack ${rack.name} wurde der Site zugeordnet.`);
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Sites" subtitle="Standorte und Rack-Zuordnung" />
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
              <button type="button" className="mr-2 rounded border px-2 py-1 text-xs" onClick={() => void editSite(site)}>Edit</button>
              <button type="button" className="rounded border border-red-300 px-2 py-1 text-xs text-red-700" onClick={() => void deleteSite(site)}>Delete</button>
            </span>
          </div>
        ))}
      </div>

      <div className="card">
        <h3 className="mb-2 text-lg font-semibold">Racks zu Sites zuordnen</h3>
        <div className="space-y-2">
          {racks.map((rack) => (
            <div key={rack.id} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 p-2">
              <span className="w-40 text-sm font-medium">{rack.name}</span>
              <select
                className="input"
                value={rackSiteTarget[rack.id] || ""}
                onChange={(e) => setRackSiteTarget((prev) => ({ ...prev, [rack.id]: Number(e.target.value) }))}
              >
                {items.map((site) => (
                  <option key={`rack-${rack.id}-site-${site.id}`} value={site.id}>{site.name}</option>
                ))}
              </select>
              <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => void assignRackToSite(rack)}>Zuordnen</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
