import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";

import { del, extractApiError, get, post, put } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";
import { Rack, Site } from "../types";

export function SitesPage() {
  const [items, setItems] = useState<Site[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [rackSiteTarget, setRackSiteTarget] = useState<Record<number, number>>({});
  const [siteFilter, setSiteFilter] = useState("");
  const [rackFilter, setRackFilter] = useState({ q: "", site_id: "" as number | "" });
  const [form, setForm] = useState({ name: "", code: "" });
  const [editingSiteId, setEditingSiteId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", code: "" });
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

  const filteredSites = useMemo(() => {
    const q = siteFilter.trim().toLowerCase();
    if (!q) return items;
    return items.filter((site) => site.name.toLowerCase().includes(q) || site.code.toLowerCase().includes(q));
  }, [items, siteFilter]);

  const filteredRacks = useMemo(() => {
    const q = rackFilter.q.trim().toLowerCase();
    return racks.filter((rack) => {
      if (rackFilter.site_id !== "" && rack.site_id !== rackFilter.site_id) return false;
      if (!q) return true;
      return rack.name.toLowerCase().includes(q);
    });
  }, [racks, rackFilter]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim()) {
      setError("Name und Code sind erforderlich.");
      setMessage("");
      return;
    }
    try {
      await post("/dcim/sites", { name: form.name.trim(), code: form.code.trim() });
      setForm({ name: "", code: "" });
      await load();
      setMessage("Site gespeichert.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const startEditSite = (site: Site) => {
    setEditingSiteId(site.id);
    setEditForm({ name: site.name, code: site.code });
    setMessage("");
    setError("");
  };

  const saveEditSite = async (site: Site) => {
    if (!editForm.name.trim() || !editForm.code.trim()) {
      setError("Name und Code sind erforderlich.");
      setMessage("");
      return;
    }
    try {
      await put(`/dcim/sites/${site.id}`, {
        name: editForm.name.trim(),
        code: editForm.code.trim(),
        address: null,
        description: null,
      });
      await load();
      setMessage("Site aktualisiert.");
      setError("");
      setEditingSiteId(null);
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
      <form className="card grid gap-3 md:grid-cols-4" onSubmit={submit}>
        <div className="field md:col-span-2">
          <label className="field-label" htmlFor="site-name">Name</label>
          <input id="site-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="z.B. Vienna DC" />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="site-code">Code</label>
          <input id="site-code" className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="VIE1" />
        </div>
        <div className="flex items-end">
          <button className="btn w-full md:w-auto" type="submit">Site anlegen</button>
        </div>
      </form>
      {message && <div className="card border border-green-200 bg-green-50 text-sm text-green-800">{message}</div>}
      {error && <div className="card border border-red-200 bg-red-50 text-sm text-red-800">{error}</div>}

      <div className="card flex flex-wrap items-end gap-2">
        <div className="field">
          <label className="field-label" htmlFor="site-filter">Site Filter</label>
          <input id="site-filter" className="input" value={siteFilter} onChange={(e) => setSiteFilter(e.target.value)} placeholder="Name/Code" />
        </div>
        <button type="button" className="btn-secondary" onClick={() => setSiteFilter("")}>
          Zuruecksetzen
        </button>
      </div>
      <div className="card grid gap-2">
        {filteredSites.map((site) => (
          <Fragment key={site.id}>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-200 p-3">
              <span>{site.name} ({site.code})</span>
              <span className="flex gap-2">
                {editingSiteId === site.id ? (
                  <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => setEditingSiteId(null)}>Abbrechen</button>
                ) : (
                  <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={() => startEditSite(site)}>Bearbeiten</button>
                )}
                <button type="button" className="btn-danger px-2 py-1 text-xs" onClick={() => void deleteSite(site)}>Loeschen</button>
              </span>
            </div>
            {editingSiteId === site.id && (
              <div className="grid gap-2 rounded-md border border-slate-200 bg-slate-50/80 p-3 md:grid-cols-4">
                <input
                  className="input md:col-span-2"
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="Name"
                />
                <input
                  className="input"
                  value={editForm.code}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, code: e.target.value }))}
                  placeholder="Code"
                />
                <button type="button" className="btn" onClick={() => void saveEditSite(site)}>
                  Speichern
                </button>
              </div>
            )}
          </Fragment>
        ))}
        {filteredSites.length === 0 && (
          <div className="rounded-md border border-slate-200 p-3 text-sm text-slate-500">Keine Sites gefunden.</div>
        )}
      </div>

      <div className="card">
        <h3 className="mb-2 text-lg font-semibold">Racks zu Sites zuordnen</h3>
        <div className="mb-2 flex flex-wrap gap-2">
          <input
            className="input"
            value={rackFilter.q}
            onChange={(e) => setRackFilter((prev) => ({ ...prev, q: e.target.value }))}
            placeholder="Rack filtern (Name)"
          />
          <select
            className="input"
            value={rackFilter.site_id}
            onChange={(e) => setRackFilter((prev) => ({ ...prev, site_id: e.target.value ? Number(e.target.value) : "" }))}
          >
            <option value="">alle Sites</option>
            {items.map((site) => (
              <option key={`rack-filter-site-${site.id}`} value={site.id}>{site.name}</option>
            ))}
          </select>
          <button type="button" className="btn-secondary" onClick={() => setRackFilter({ q: "", site_id: "" })}>
            Zuruecksetzen
          </button>
        </div>
        <div className="space-y-2">
          {filteredRacks.map((rack) => (
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
              <button type="button" className="btn-secondary" onClick={() => void assignRackToSite(rack)}>Zuordnen</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
