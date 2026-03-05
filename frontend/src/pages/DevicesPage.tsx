import { FormEvent, useEffect, useState } from "react";

import { del, extractApiError, get, post, put } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";
import { Device, DeviceDetail, Rack, Site } from "../types";

export function DevicesPage() {
  const [items, setItems] = useState<Device[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<DeviceDetail | null>(null);
  const [form, setForm] = useState({
    name: "",
    role: "server",
    site_id: "" as number | "",
    rack_id: "" as number | "",
    rack_u_start: 1,
    rack_u_height: 1,
    rack_face: "front",
  });
  const [rackTargets, setRackTargets] = useState<Record<number, number | "">>({});
  const [siteTargets, setSiteTargets] = useState<Record<number, number | "">>({});
  const [newInterfaceName, setNewInterfaceName] = useState("eth0");
  const [newInletName, setNewInletName] = useState("PSU-A");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const [deviceData, rackData, siteData] = await Promise.all([
      get<Device[]>("/dcim/devices"),
      get<Rack[]>("/dcim/racks"),
      get<Site[]>("/dcim/sites"),
    ]);
    setItems(deviceData);
    setRacks(rackData);
    setSites(siteData);
    setRackTargets(Object.fromEntries(deviceData.map((item) => [item.id, item.rack_id ?? ""])));
    setSiteTargets(Object.fromEntries(deviceData.map((item) => [item.id, item.site_id ?? ""])));
  };

  useEffect(() => {
    void load();
  }, []);

  const loadDetail = (deviceId: number) => {
    setSelectedId(deviceId);
    get<DeviceDetail>(`/dcim/devices/${deviceId}/detail`).then(setDetail);
  };

  const updateDevice = async (
    item: Device,
    overrides: Partial<{ name: string; role: string; rack_id: number | null }>
  ) => {
    await put(`/dcim/devices/${item.id}`, {
      name: overrides.name ?? item.name,
      asset_tag: item.asset_tag ?? null,
      serial: item.serial ?? null,
      manufacturer: null,
      model: null,
      role: overrides.role ?? item.role,
      status: item.status,
      site_id: overrides.site_id !== undefined ? overrides.site_id : (item.site_id ?? null),
      rack_id: overrides.rack_id !== undefined ? overrides.rack_id : (item.rack_id ?? null),
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await post("/dcim/devices", {
        name: form.name,
        role: form.role,
        status: "active",
        site_id: form.site_id === "" ? null : form.site_id,
        rack_id: form.rack_id === "" ? null : form.rack_id,
        rack_u_start: form.rack_id === "" ? null : form.rack_u_start,
        rack_u_height: form.rack_u_height,
        rack_face: form.rack_face,
      });
      setForm({
        name: "",
        role: "server",
        site_id: "",
        rack_id: "",
        rack_u_start: 1,
        rack_u_height: 1,
        rack_face: "front",
      });
      await load();
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
      await updateDevice(item, { name, role });
      await load();
      if (selectedId === item.id) void loadDetail(item.id);
      setMessage("Device aktualisiert.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const assignRack = async (item: Device) => {
    const target = rackTargets[item.id];
    try {
      await updateDevice(item, { rack_id: target === "" ? null : target });
      await load();
      if (selectedId === item.id) void loadDetail(item.id);
      setMessage(target === "" ? "Rack-Zuweisung entfernt." : "Rack zugewiesen.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const assignSite = async (item: Device) => {
    const target = siteTargets[item.id];
    try {
      await updateDevice(item, { site_id: target === "" ? null : target });
      await load();
      if (selectedId === item.id) void loadDetail(item.id);
      setMessage(target === "" ? "Site-Zuweisung entfernt." : "Site zugewiesen.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const deleteDevice = async (item: Device) => {
    if (!window.confirm(`Device ${item.name} wirklich loeschen?`)) return;
    try {
      await del(`/dcim/devices/${item.id}`);
      await load();
      if (selectedId === item.id) {
        setSelectedId(null);
        setDetail(null);
      }
      setMessage("Device geloescht.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const addInterfaceToSelected = async () => {
    if (!detail) return;
    try {
      await post("/dcim/interfaces", {
        device_id: detail.overview.id,
        name: newInterfaceName,
        if_type: "copper",
      });
      await loadDetail(detail.overview.id);
      setMessage("Interface hinzugefuegt.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const addPowerInletToSelected = async () => {
    if (!detail) return;
    try {
      await post("/dcim/power/inlets", {
        device_id: detail.overview.id,
        name: newInletName,
      });
      await loadDetail(detail.overview.id);
      setMessage("Power Inlet hinzugefuegt.");
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
        <select
          className="input"
          value={form.site_id}
          onChange={(e) => setForm({ ...form, site_id: e.target.value ? Number(e.target.value) : "" })}
        >
          <option value="">keine Site</option>
          {sites.map((site) => (
            <option key={site.id} value={site.id}>{site.name}</option>
          ))}
        </select>
        <select
          className="input"
          value={form.rack_id}
          onChange={(e) => setForm({ ...form, rack_id: e.target.value ? Number(e.target.value) : "" })}
        >
          <option value="">kein Rack</option>
          {racks.map((rack) => (
            <option key={rack.id} value={rack.id}>{rack.name}</option>
          ))}
        </select>
        <div className="flex flex-col">
          <label className="muted">Position (U-Start)</label>
          <input
            className="input w-24"
            type="number"
            min={1}
            value={form.rack_u_start}
            disabled={form.rack_id === ""}
            onChange={(e) => setForm({ ...form, rack_u_start: Number(e.target.value) })}
            placeholder="z.B. 20"
            title="Start-U im Rack, bei dem das Geraet beginnt."
          />
          <span className="muted">Startslot im Rack (1 = unten)</span>
        </div>
        <div className="flex flex-col">
          <label className="muted">Hoehe (U)</label>
          <input
            className="input w-24"
            type="number"
            min={1}
            value={form.rack_u_height}
            disabled={form.rack_id === ""}
            onChange={(e) => setForm({ ...form, rack_u_height: Number(e.target.value) })}
            placeholder="z.B. 2"
            title="Geraetehoehe in Rack-Units (U)."
          />
          <span className="muted">Anzahl belegter Rack-Units</span>
        </div>
        <select
          className="input"
          value={form.rack_face}
          disabled={form.rack_id === ""}
          onChange={(e) => setForm({ ...form, rack_face: e.target.value })}
        >
          <option value="front">front</option>
          <option value="rear">rear</option>
        </select>
        <button className="btn" type="submit">Add</button>
      </form>
      {message && <div className="card border border-green-200 bg-green-50 text-sm text-green-800">{message}</div>}
      {error && <div className="card border border-red-200 bg-red-50 text-sm text-red-800">{error}</div>}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">Name</th>
              <th className="p-2">Role</th>
              <th className="p-2">Status</th>
              <th className="p-2">Site</th>
              <th className="p-2">Rack</th>
              <th className="p-2">Aktionen</th>
            </tr>
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
                  <div className="flex items-center gap-1">
                    <select
                      className="input h-8 py-1 text-xs"
                      value={siteTargets[d.id] ?? ""}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const value = e.target.value ? Number(e.target.value) : "";
                        setSiteTargets((prev) => ({ ...prev, [d.id]: value }));
                      }}
                    >
                      <option value="">keine Site</option>
                      {sites.map((site) => (
                        <option key={site.id} value={site.id}>{site.name}</option>
                      ))}
                    </select>
                    <button type="button" className="rounded border px-2 py-1 text-xs" onClick={(e) => { e.stopPropagation(); void assignSite(d); }}>Assign</button>
                  </div>
                </td>
                <td className="p-2">
                  <div className="flex items-center gap-1">
                    <select
                      className="input h-8 py-1 text-xs"
                      value={rackTargets[d.id] ?? ""}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const value = e.target.value ? Number(e.target.value) : "";
                        setRackTargets((prev) => ({ ...prev, [d.id]: value }));
                      }}
                    >
                      <option value="">kein Rack</option>
                      {racks.map((rack) => (
                        <option key={rack.id} value={rack.id}>{rack.name}</option>
                      ))}
                    </select>
                    <button type="button" className="rounded border px-2 py-1 text-xs" onClick={(e) => { e.stopPropagation(); void assignRack(d); }}>Assign</button>
                  </div>
                </td>
                <td className="p-2">
                  <button type="button" className="mr-2 rounded border px-2 py-1 text-xs" onClick={(e) => { e.stopPropagation(); void editDevice(d); }}>Edit</button>
                  <button type="button" className="rounded border border-red-300 px-2 py-1 text-xs text-red-700" onClick={(e) => { e.stopPropagation(); void deleteDevice(d); }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {detail && (
        <div className="card space-y-3">
          <div className="grid gap-4 md:grid-cols-4">
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
          <div className="flex flex-wrap gap-2">
            <input className="input" value={newInterfaceName} onChange={(e) => setNewInterfaceName(e.target.value)} placeholder="Interface name" />
            <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => void addInterfaceToSelected()}>Add Interface</button>
            <input className="input" value={newInletName} onChange={(e) => setNewInletName(e.target.value)} placeholder="Power inlet name" />
            <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => void addPowerInletToSelected()}>Add Power Inlet</button>
          </div>
        </div>
      )}
    </div>
  );
}
