import { FormEvent, useEffect, useState } from "react";

import { get, post } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";
import { VLAN } from "../types";

export function VLANsPage() {
  const [items, setItems] = useState<VLAN[]>([]);
  const [form, setForm] = useState({ vid: 10, name: "" });

  const load = () => get<VLAN[]>("/ipam/vlans").then(setItems);
  useEffect(load, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await post("/ipam/vlans", { ...form, status: "active" });
    setForm({ ...form, name: "" });
    load();
  };

  return (
    <div className="space-y-4">
      <PageHeader title="VLANs" subtitle="Site-scoped VLAN Verwaltung" />
      <form className="card flex gap-2" onSubmit={submit}>
        <input className="input w-24" type="number" value={form.vid} onChange={(e) => setForm({ ...form, vid: Number(e.target.value) })} />
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name" />
        <button className="btn" type="submit">Create</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left"><th className="p-2">VID</th><th className="p-2">Name</th><th className="p-2">Status</th></tr></thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b"><td className="p-2">{item.vid}</td><td className="p-2">{item.name}</td><td className="p-2">{item.status}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
