import { FormEvent, useEffect, useState } from "react";

import { get, post } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";
import { Prefix, Vrf } from "../types";

export function PrefixesPage() {
  const [items, setItems] = useState<Prefix[]>([]);
  const [vrfs, setVrfs] = useState<Vrf[]>([]);
  const [form, setForm] = useState({ cidr: "", vrf_id: 1, role: "LAN" });

  const load = () => {
    get<Prefix[]>("/ipam/prefixes").then(setItems);
    get<Vrf[]>("/ipam/vrfs").then(setVrfs);
  };

  useEffect(() => {
    void load();
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await post("/ipam/prefixes", { ...form, status: "active" });
    setForm({ cidr: "", vrf_id: form.vrf_id, role: "LAN" });
    load();
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Prefixes" subtitle="Overview, schnelle Anlage, Auslastung je Prefix" />
      <form className="card flex flex-wrap items-end gap-2" onSubmit={onSubmit}>
        <div>
          <label className="muted">CIDR</label>
          <input className="input ml-2" value={form.cidr} onChange={(e) => setForm({ ...form, cidr: e.target.value })} placeholder="10.10.0.0/24" />
        </div>
        <div>
          <label className="muted">VRF</label>
          <select className="input ml-2" value={form.vrf_id} onChange={(e) => setForm({ ...form, vrf_id: Number(e.target.value) })}>
            {vrfs.map((vrf) => (
              <option key={vrf.id} value={vrf.id}>{vrf.name}</option>
            ))}
          </select>
        </div>
        <button className="btn" type="submit">Quick Create</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">CIDR</th>
              <th className="p-2">VRF</th>
              <th className="p-2">Role</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="p-2 font-semibold">{item.cidr}</td>
                <td className="p-2">{item.vrf_id}</td>
                <td className="p-2">{item.role}</td>
                <td className="p-2">{item.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

