import { FormEvent, useEffect, useState } from "react";

import { get, post } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";
import { Device } from "../types";

export function DevicesPage() {
  const [items, setItems] = useState<Device[]>([]);
  const [form, setForm] = useState({ name: "", role: "server" });

  const load = () => get<Device[]>("/dcim/devices").then(setItems);
  useEffect(load, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await post("/dcim/devices", { ...form, status: "active" });
    setForm({ name: "", role: "server" });
    load();
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Devices" subtitle="Inventar, Rollen, Serials, Asset-Tags" />
      <form className="card flex gap-2" onSubmit={submit}>
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Device name" />
        <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="server">server</option>
          <option value="switch">switch</option>
          <option value="patchpanel">patchpanel</option>
          <option value="pdu">pdu</option>
          <option value="ups">ups</option>
        </select>
        <button className="btn" type="submit">Add</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-2">Name</th><th className="p-2">Role</th><th className="p-2">Status</th></tr></thead><tbody>{items.map((d) => <tr key={d.id} className="border-b"><td className="p-2">{d.name}</td><td className="p-2">{d.role}</td><td className="p-2">{d.status}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}
