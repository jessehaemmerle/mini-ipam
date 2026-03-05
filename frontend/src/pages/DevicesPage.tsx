import { FormEvent, useEffect, useState } from "react";

import { del, extractApiError, get, post, put } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";
import { Device, DeviceDetail } from "../types";

export function DevicesPage() {
  const [items, setItems] = useState<Device[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<DeviceDetail | null>(null);
  const [form, setForm] = useState({ name: "", role: "server" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
    try {
      await post("/dcim/devices", { ...form, status: "active" });
      setForm({ name: "", role: "server" });
      load();
      setMessage("Device gespeichert.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const editDevice = async (item: Device) => {
    const name = window.prompt("Device Name", item.name);
    if (!name) return;
    const role = window.prompt("Role", item.role);
    if (!role) return;
    try {
      await put(`/dcim/devices/${item.id}`, {
        name,
        asset_tag: item.asset_tag ?? null,
        serial: item.serial ?? null,
        manufacturer: null,
        model: null,
        role,
        status: item.status,
        site_id: null,
        rack_id: item.rack_id ?? null,
      });
      await load();
      if (selectedId === item.id) loadDetail(item.id);
      setMessage("Device aktualisiert.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const deleteDevice = async (item: Device) => {
    if (!window.confirm(`Device ${item.name} wirklich löschen?`)) return;
    try {
      await del(`/dcim/devices/${item.id}`);
      await load();
      if (selectedId === item.id) {
        setSelectedId(null);
        setDetail(null);
      }
      setMessage("Device gelöscht.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
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
      {message && <div className="card border border-green-200 bg-green-50 text-sm text-green-800">{message}</div>}
      {error && <div className="card border border-red-200 bg-red-50 text-sm text-red-800">{error}</div>}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left"><th className="p-2">Name</th><th className="p-2">Role</th><th className="p-2">Status</th><th className="p-2">Aktionen</th></tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr
                key={d.id}
                className={`border-b cursor-pointer ${selectedId === d.id ? "bg-amber-50" : ""}`}
                onClick={() => loadDetail(d.id)}
              >
                <td className="p-2">{d.name}</td>
                <td className="p-2">{d.role}</td>
                <td className="p-2">{d.status}</td>
                <td className="p-2">
                  <button className="mr-2 rounded border px-2 py-1 text-xs" onClick={(e) => { e.stopPropagation(); void editDevice(d); }}>Edit</button>
                  <button className="rounded border border-red-300 px-2 py-1 text-xs text-red-700" onClick={(e) => { e.stopPropagation(); void deleteDevice(d); }}>Delete</button>
                </td>
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

