import { FormEvent, useEffect, useState } from "react";

import { get, post } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";
import { Site } from "../types";

export function SitesPage() {
  const [items, setItems] = useState<Site[]>([]);
  const [form, setForm] = useState({ name: "", code: "" });

  const load = () => get<Site[]>("/dcim/sites").then(setItems);
  useEffect(() => {
    void load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await post("/dcim/sites", form);
    setForm({ name: "", code: "" });
    load();
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Sites" subtitle="Standorte mit optionaler Hierarchie" />
      <form className="card flex gap-2" onSubmit={submit}>
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" />
        <input className="input" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="Code" />
        <button className="btn" type="submit">Create</button>
      </form>
      <div className="card grid gap-2">
        {items.map((site) => <div key={site.id} className="rounded-md border border-slate-200 p-3">{site.name} ({site.code})</div>)}
      </div>
    </div>
  );
}

