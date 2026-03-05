import { FormEvent, useEffect, useState } from "react";

import { get, post } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";
import { Device, DeviceDetail } from "../types";

export function DevicesPage() {
  const [items, setItems] = useState<Device[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<DeviceDetail | null>(null);
  const [form, setForm] = useState({ name: "", role: "server" });

  const load = () => get<Device[]>("/dcim/devices").then(setItems);
  useEffect(() => {
    void load();
  }, []);

  const loadDetail = (deviceId: number) => {
    setSelectedId(deviceId);
    get<DeviceDetail>(`/dcim/devices/${deviceId}/detail`).then(setDetail);
  };

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
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left"><th className="p-2">Name</th><th className="p-2">Role</th><th className="p-2">Status</th></tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr
                key={d.id}
                className={`border-b cursor-pointer ${selectedId === d.id ? "bg-amber-50" : ""}`}
                onClick={() => loadDetail(d.id)}
              >
                <td className="p-2">{d.name}</td><td className="p-2">{d.role}</td><td className="p-2">{d.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="card grid gap-4 md:grid-cols-4">
          <div><p className="muted">Interfaces</p><p className="text-xl font-semibold">{detail.interfaces.length}</p></div>
          <div><p className="muted">IPs</p><p className="text-xl font-semibold">{detail.ips.length}</p></div>
          <div><p className="muted">Cables</p><p className="text-xl font-semibold">{detail.cabling.length}</p></div>
          <div>
            <p className="muted">Power</p>
            <p className={`text-xl font-semibold ${detail.power.has_power ? "text-brand" : "text-red-600"}`}>
              {detail.power.has_power ? "connected" : "missing"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

