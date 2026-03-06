import { FormEvent, useEffect, useMemo, useState } from "react";

import { del, extractApiError, get, post, put } from "../api/client";
import { PowerGraph } from "../components/power/PowerGraph";
import { Device, PDUOutlet, PowerConnection, PowerInlet, Rack } from "../types";
import { PageHeader } from "../components/common/PageHeader";

export function PowerPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [inlets, setInlets] = useState<PowerInlet[]>([]);
  const [outlets, setOutlets] = useState<PDUOutlet[]>([]);
  const [connections, setConnections] = useState<PowerConnection[]>([]);
  const [rackId, setRackId] = useState<number>(0);
  const [map, setMap] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ q: "", device_id: "" as number | "" });
  const [editingInletId, setEditingInletId] = useState<number | null>(null);
  const [editingOutletId, setEditingOutletId] = useState<number | null>(null);
  const [editingConnectionId, setEditingConnectionId] = useState<number | null>(null);
  const [showOnlyUnconnected, setShowOnlyUnconnected] = useState(true);

  const [inletForm, setInletForm] = useState({ device_id: 0, name: "PSU-A" });
  const [outletForm, setOutletForm] = useState({ pdu_device_id: 0, name: "Outlet-1" });
  const [connectionForm, setConnectionForm] = useState({ src_id: 0, dst_id: 0 });

  const deviceById = useMemo(
    () => Object.fromEntries(devices.map((d) => [d.id, d.name])),
    [devices]
  );
  const inletById = useMemo(
    () => Object.fromEntries(inlets.map((i) => [i.id, i])),
    [inlets]
  );
  const outletById = useMemo(
    () => Object.fromEntries(outlets.map((o) => [o.id, o])),
    [outlets]
  );
  const powerGraphData = useMemo(() => {
    const nodeMap = new Map<string, { id: string; label: string; kind?: "device" | "endpoint" }>();
    const edges: Array<{ id: string; from: string; to: string; kind?: "association" | "connection" }> = [];

    for (const inlet of inlets) {
      const deviceNode = `device:${inlet.device_id}`;
      const inletNode = `power_inlet:${inlet.id}`;
      nodeMap.set(deviceNode, { id: deviceNode, label: deviceById[inlet.device_id] || `device-${inlet.device_id}`, kind: "device" as const });
      nodeMap.set(inletNode, { id: inletNode, label: `IN ${inlet.name} #${inlet.id}`, kind: "endpoint" as const });
      edges.push({ id: `assoc-in-${inlet.id}`, from: deviceNode, to: inletNode, kind: "association" });
    }

    for (const outlet of outlets) {
      const deviceNode = `device:${outlet.pdu_device_id}`;
      const outletNode = `pdu_outlet:${outlet.id}`;
      nodeMap.set(deviceNode, { id: deviceNode, label: deviceById[outlet.pdu_device_id] || `pdu-${outlet.pdu_device_id}`, kind: "device" as const });
      nodeMap.set(outletNode, { id: outletNode, label: `OUT ${outlet.name} #${outlet.id}`, kind: "endpoint" as const });
      edges.push({ id: `assoc-out-${outlet.id}`, from: deviceNode, to: outletNode, kind: "association" });
    }

    for (const c of connections) {
      let from = `${c.src_type}:${c.src_id}`;
      let to = `${c.dst_type}:${c.dst_id}`;
      let fromLabel = from;
      let toLabel = to;

      if (c.src_type === "power_inlet" && inletById[c.src_id]) {
        const inlet = inletById[c.src_id];
        fromLabel = `${deviceById[inlet.device_id] || `device-${inlet.device_id}`} / ${inlet.name}`;
      }
      if (c.dst_type === "pdu_outlet" && outletById[c.dst_id]) {
        const outlet = outletById[c.dst_id];
        toLabel = `${deviceById[outlet.pdu_device_id] || `pdu-${outlet.pdu_device_id}`} / ${outlet.name}`;
      }
      nodeMap.set(from, { id: from, label: fromLabel, kind: "endpoint" as const });
      nodeMap.set(to, { id: to, label: toLabel, kind: "endpoint" as const });
      edges.push({ id: `power-${c.id}`, from, to, kind: "connection" });
    }
    return { nodes: Array.from(nodeMap.values()), edges };
  }, [connections, inletById, outletById, deviceById]);
  const filteredInlets = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return inlets.filter((item) => {
      if (filters.device_id !== "" && item.device_id !== filters.device_id) return false;
      if (!q) return true;
      return item.name.toLowerCase().includes(q) || (deviceById[item.device_id] || "").toLowerCase().includes(q);
    });
  }, [inlets, filters, deviceById]);
  const filteredOutlets = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return outlets.filter((item) => {
      if (filters.device_id !== "" && item.pdu_device_id !== filters.device_id) return false;
      if (!q) return true;
      return item.name.toLowerCase().includes(q) || (deviceById[item.pdu_device_id] || "").toLowerCase().includes(q);
    });
  }, [outlets, filters, deviceById]);
  const filteredConnections = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return connections.filter((item) => {
      const srcName = item.src_type === "power_inlet" && inletById[item.src_id]
        ? `${inletById[item.src_id].name} ${deviceById[inletById[item.src_id].device_id] || ""}`.toLowerCase()
        : `${item.src_type}:${item.src_id}`.toLowerCase();
      const dstName = item.dst_type === "pdu_outlet" && outletById[item.dst_id]
        ? `${outletById[item.dst_id].name} ${deviceById[outletById[item.dst_id].pdu_device_id] || ""}`.toLowerCase()
        : `${item.dst_type}:${item.dst_id}`.toLowerCase();
      if (filters.device_id !== "") {
        const srcDevice = item.src_type === "power_inlet" && inletById[item.src_id] ? inletById[item.src_id].device_id : null;
        const dstDevice = item.dst_type === "pdu_outlet" && outletById[item.dst_id] ? outletById[item.dst_id].pdu_device_id : null;
        if (srcDevice !== filters.device_id && dstDevice !== filters.device_id) return false;
      }
      if (!q) return true;
      return String(item.id).includes(q) || srcName.includes(q) || dstName.includes(q);
    });
  }, [connections, filters, inletById, outletById, deviceById]);
  const connectedInletIds = useMemo(
    () => new Set(connections.filter((c) => c.src_type === "power_inlet").map((c) => c.src_id)),
    [connections]
  );
  const connectedOutletIds = useMemo(
    () => new Set(connections.filter((c) => c.dst_type === "pdu_outlet").map((c) => c.dst_id)),
    [connections]
  );
  const connectableInlets = useMemo(() => {
    if (!showOnlyUnconnected || editingConnectionId) return inlets;
    return inlets.filter((i) => !connectedInletIds.has(i.id));
  }, [inlets, showOnlyUnconnected, editingConnectionId, connectedInletIds]);
  const connectableOutlets = useMemo(() => {
    if (!showOnlyUnconnected || editingConnectionId) return outlets;
    return outlets.filter((o) => !connectedOutletIds.has(o.id));
  }, [outlets, showOnlyUnconnected, editingConnectionId, connectedOutletIds]);

  const load = async () => {
    const [deviceData, rackData, inletData, outletData, connectionData] = await Promise.all([
      get<Device[]>("/dcim/devices"),
      get<Rack[]>("/dcim/racks"),
      get<PowerInlet[]>("/dcim/power/inlets"),
      get<PDUOutlet[]>("/dcim/power/outlets"),
      get<PowerConnection[]>("/dcim/power/connections"),
    ]);
    setDevices(deviceData);
    setRacks(rackData);
    setInlets(inletData);
    setOutlets(outletData);
    setConnections(connectionData);

    if (!rackId || !rackData.some((rack) => rack.id === rackId)) {
      setRackId(rackData[0]?.id || 0);
    }
    setInletForm((prev) => ({ ...prev, device_id: prev.device_id || deviceData[0]?.id || 0 }));
    setOutletForm((prev) => ({ ...prev, pdu_device_id: prev.pdu_device_id || deviceData.find((d) => d.role === "pdu")?.id || deviceData[0]?.id || 0 }));
    setConnectionForm((prev) => ({ ...prev, src_id: prev.src_id || inletData[0]?.id || 0, dst_id: prev.dst_id || outletData[0]?.id || 0 }));
  };

  const loadMap = async (targetRackId?: number) => {
    const id = targetRackId ?? rackId;
    if (!id) return;
    const data = await get<Array<Record<string, unknown>>>(`/dcim/power/map/rack/${id}`);
    setMap(data);
  };

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, []);

  useEffect(() => {
    if (!rackId) return;
    void loadMap(rackId);
  }, [rackId]);

  useEffect(() => {
    setConnectionForm((prev) => ({
      src_id: connectableInlets.some((item) => item.id === prev.src_id) ? prev.src_id : (connectableInlets[0]?.id || 0),
      dst_id: connectableOutlets.some((item) => item.id === prev.dst_id) ? prev.dst_id : (connectableOutlets[0]?.id || 0),
    }));
  }, [connectableInlets, connectableOutlets]);

  const submitInlet = async (e: FormEvent) => {
    e.preventDefault();
    if (!inletForm.device_id || !inletForm.name.trim()) {
      setError("Bitte Device und Inlet-Name ausfuellen.");
      setMessage("");
      return;
    }
    try {
      if (editingInletId) {
        await put(`/dcim/power/inlets/${editingInletId}`, inletForm);
      } else {
        await post("/dcim/power/inlets", inletForm);
      }
      await load();
      setEditingInletId(null);
      setMessage(editingInletId ? "Power Inlet aktualisiert." : "Power Inlet erstellt.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const submitOutlet = async (e: FormEvent) => {
    e.preventDefault();
    if (!outletForm.pdu_device_id || !outletForm.name.trim()) {
      setError("Bitte PDU/UPS Device und Outlet-Name ausfuellen.");
      setMessage("");
      return;
    }
    try {
      if (editingOutletId) {
        await put(`/dcim/power/outlets/${editingOutletId}`, outletForm);
      } else {
        await post("/dcim/power/outlets", outletForm);
      }
      await load();
      setEditingOutletId(null);
      setMessage(editingOutletId ? "PDU Outlet aktualisiert." : "PDU Outlet erstellt.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const startEditInlet = (inlet: PowerInlet) => {
    setEditingInletId(inlet.id);
    setInletForm({ device_id: inlet.device_id, name: inlet.name });
    setMessage("");
    setError("");
  };

  const cancelEditInlet = () => {
    setEditingInletId(null);
    setInletForm({ device_id: devices[0]?.id || 0, name: "PSU-A" });
  };

  const deleteInlet = async (inletId: number) => {
    if (!window.confirm(`Power Inlet #${inletId} wirklich loeschen?`)) return;
    try {
      await del(`/dcim/power/inlets/${inletId}`);
      if (editingInletId === inletId) cancelEditInlet();
      await load();
      await loadMap();
      setMessage("Power Inlet geloescht.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const startEditOutlet = (outlet: PDUOutlet) => {
    setEditingOutletId(outlet.id);
    setOutletForm({ pdu_device_id: outlet.pdu_device_id, name: outlet.name });
    setMessage("");
    setError("");
  };

  const cancelEditOutlet = () => {
    setEditingOutletId(null);
    setOutletForm({ pdu_device_id: devices.find((d) => d.role === "pdu")?.id || devices[0]?.id || 0, name: "Outlet-1" });
  };

  const deleteOutlet = async (outletId: number) => {
    if (!window.confirm(`PDU Outlet #${outletId} wirklich loeschen?`)) return;
    try {
      await del(`/dcim/power/outlets/${outletId}`);
      if (editingOutletId === outletId) cancelEditOutlet();
      await load();
      await loadMap();
      setMessage("PDU Outlet geloescht.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const submitConnection = async (e: FormEvent) => {
    e.preventDefault();
    if (!connectionForm.src_id || !connectionForm.dst_id) {
      setError("Bitte Inlet und Outlet auswaehlen.");
      setMessage("");
      return;
    }
    try {
      const payload = {
        src_type: "power_inlet",
        src_id: connectionForm.src_id,
        dst_type: "pdu_outlet",
        dst_id: connectionForm.dst_id,
      };
      if (editingConnectionId) {
        await put(`/dcim/power/connections/${editingConnectionId}`, payload);
      } else {
        await post("/dcim/power/connections", payload);
      }
      await load();
      await loadMap();
      setEditingConnectionId(null);
      setMessage(editingConnectionId ? "Power Connection aktualisiert." : "Power Connection erstellt.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const startEditConnection = (connection: PowerConnection) => {
    setEditingConnectionId(connection.id);
    setConnectionForm({ src_id: connection.src_id, dst_id: connection.dst_id });
    setMessage("");
    setError("");
  };

  const cancelEditConnection = () => {
    setEditingConnectionId(null);
    setConnectionForm({ src_id: inlets[0]?.id || 0, dst_id: outlets[0]?.id || 0 });
  };

  const deleteConnection = async (connectionId: number) => {
    if (!window.confirm(`Power Connection #${connectionId} wirklich loeschen?`)) return;
    try {
      await del(`/dcim/power/connections/${connectionId}`);
      if (editingConnectionId === connectionId) {
        setEditingConnectionId(null);
        setConnectionForm({ src_id: inlets[0]?.id || 0, dst_id: outlets[0]?.id || 0 });
      }
      await load();
      await loadMap();
      setMessage("Power Connection geloescht.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Power" subtitle="Einfacher Workflow: Endpunkte anlegen, verbinden, Rack-Map automatisch aktualisieren" />
      {message && <div className="card border border-green-200 bg-green-50 text-sm text-green-800">{message}</div>}
      {error && <div className="card border border-red-200 bg-red-50 text-sm text-red-800">{error}</div>}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Devices</p>
          <p className="text-2xl font-semibold">{devices.length}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Inlets</p>
          <p className="text-2xl font-semibold">{inlets.length}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Outlets</p>
          <p className="text-2xl font-semibold">{outlets.length}</p>
        </div>
        <div className="card">
          <p className="text-xs uppercase tracking-wide text-slate-500">Connections</p>
          <p className="text-2xl font-semibold">{connections.length}</p>
        </div>
      </div>
      <div className="card flex flex-wrap gap-2">
        <input
          className="input"
          value={filters.q}
          onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
          placeholder="Suche Name, Device oder ID"
        />
        <select
          className="input"
          value={filters.device_id}
          onChange={(e) => setFilters((prev) => ({ ...prev, device_id: e.target.value ? Number(e.target.value) : "" }))}
        >
          <option value="">alle Devices</option>
          {devices.map((d) => <option key={`power-filter-device-${d.id}`} value={d.id}>{d.name}</option>)}
        </select>
        <button type="button" className="btn-secondary" onClick={() => setFilters({ q: "", device_id: "" })}>
          Zuruecksetzen
        </button>
      </div>

      <form className="card flex flex-wrap items-end gap-2" onSubmit={submitInlet}>
        <p className="w-full text-sm font-semibold text-slate-700">1) Inlet anlegen</p>
        <div>
          <label className="muted">Target Device</label>
          <select className="input ml-2" value={inletForm.device_id} onChange={(e) => setInletForm({ ...inletForm, device_id: Number(e.target.value) })}>
            {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <input className="input" value={inletForm.name} onChange={(e) => setInletForm({ ...inletForm, name: e.target.value })} placeholder="PSU-A" />
        <button className="btn" type="submit" disabled={!devices.length}>{editingInletId ? "Inlet speichern" : "Inlet anlegen"}</button>
        {editingInletId && <button type="button" className="btn-secondary" onClick={cancelEditInlet}>Abbrechen</button>}
      </form>

      <form className="card flex flex-wrap items-end gap-2" onSubmit={submitOutlet}>
        <p className="w-full text-sm font-semibold text-slate-700">2) Outlet anlegen</p>
        <div>
          <label className="muted">PDU/UPS Device</label>
          <select className="input ml-2" value={outletForm.pdu_device_id} onChange={(e) => setOutletForm({ ...outletForm, pdu_device_id: Number(e.target.value) })}>
            {devices.filter((d) => d.role === "pdu" || d.role === "ups").map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <input className="input" value={outletForm.name} onChange={(e) => setOutletForm({ ...outletForm, name: e.target.value })} placeholder="Outlet-1" />
        <button className="btn" type="submit" disabled={!devices.some((d) => d.role === "pdu" || d.role === "ups")}>{editingOutletId ? "Outlet speichern" : "Outlet anlegen"}</button>
        {editingOutletId && <button type="button" className="btn-secondary" onClick={cancelEditOutlet}>Abbrechen</button>}
      </form>

      <form className="card flex flex-wrap items-end gap-2" onSubmit={submitConnection}>
        <p className="w-full text-sm font-semibold text-slate-700">3) Verbinden</p>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={showOnlyUnconnected}
            onChange={(e) => setShowOnlyUnconnected(e.target.checked)}
          />
          Nur unverbundene Endpunkte anzeigen
        </label>
        <div>
          <label className="muted">Power Inlet</label>
          <select className="input ml-2" value={connectionForm.src_id} onChange={(e) => setConnectionForm({ ...connectionForm, src_id: Number(e.target.value) })}>
            {connectableInlets.map((i) => <option key={i.id} value={i.id}>{i.name} ({deviceById[i.device_id] || `device-${i.device_id}`})</option>)}
          </select>
        </div>
        <div>
          <label className="muted">PDU Outlet</label>
          <select className="input ml-2" value={connectionForm.dst_id} onChange={(e) => setConnectionForm({ ...connectionForm, dst_id: Number(e.target.value) })}>
            {connectableOutlets.map((o) => <option key={o.id} value={o.id}>{o.name} ({deviceById[o.pdu_device_id] || `pdu-${o.pdu_device_id}`})</option>)}
          </select>
        </div>
        <button className="btn" type="submit" disabled={!connectableInlets.length || !connectableOutlets.length}>{editingConnectionId ? "Verbindung speichern" : "Verbinden"}</button>
        {editingConnectionId && (
          <button type="button" className="btn-secondary" onClick={cancelEditConnection}>Abbrechen</button>
        )}
      </form>

      <div className="card overflow-x-auto">
        <p className="mb-2 text-sm font-semibold">Power Inlets</p>
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left"><th className="p-2">ID</th><th className="p-2">Name</th><th className="p-2">Device</th><th className="p-2">Actions</th></tr></thead>
          <tbody>
            {filteredInlets.map((i) => (
              <tr key={i.id} className="border-b">
                <td className="p-2">{i.id}</td>
                <td className="p-2">{i.name}</td>
                <td className="p-2">{deviceById[i.device_id] || `device-${i.device_id}`}</td>
                <td className="p-2">
                  <button type="button" className="btn-secondary mr-2 px-2 py-1 text-xs" onClick={() => startEditInlet(i)}>Bearbeiten</button>
                  <button type="button" className="btn-danger px-2 py-1 text-xs" onClick={() => void deleteInlet(i.id)}>Loeschen</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <p className="mb-2 text-sm font-semibold">PDU Outlets</p>
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left"><th className="p-2">ID</th><th className="p-2">Name</th><th className="p-2">PDU/UPS</th><th className="p-2">Actions</th></tr></thead>
          <tbody>
            {filteredOutlets.map((o) => (
              <tr key={o.id} className="border-b">
                <td className="p-2">{o.id}</td>
                <td className="p-2">{o.name}</td>
                <td className="p-2">{deviceById[o.pdu_device_id] || `pdu-${o.pdu_device_id}`}</td>
                <td className="p-2">
                  <button type="button" className="btn-secondary mr-2 px-2 py-1 text-xs" onClick={() => startEditOutlet(o)}>Bearbeiten</button>
                  <button type="button" className="btn-danger px-2 py-1 text-xs" onClick={() => void deleteOutlet(o.id)}>Loeschen</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card overflow-x-auto">
        <p className="mb-2 text-sm font-semibold">Power Connections</p>
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left"><th className="p-2">ID</th><th className="p-2">Source</th><th className="p-2">Target</th><th className="p-2">Actions</th></tr></thead>
          <tbody>
            {filteredConnections.map((c) => (
              <tr key={c.id} className="border-b">
                <td className="p-2">{c.id}</td>
                <td className="p-2">
                  {c.src_type === "power_inlet" && inletById[c.src_id]
                    ? `${inletById[c.src_id].name} (${deviceById[inletById[c.src_id].device_id] || `device-${inletById[c.src_id].device_id}`})`
                    : `${c.src_type}:${c.src_id}`}
                </td>
                <td className="p-2">
                  {c.dst_type === "pdu_outlet" && outletById[c.dst_id]
                    ? `${outletById[c.dst_id].name} (${deviceById[outletById[c.dst_id].pdu_device_id] || `pdu-${outletById[c.dst_id].pdu_device_id}`})`
                    : `${c.dst_type}:${c.dst_id}`}
                </td>
                <td className="p-2">
                  <button type="button" className="btn-secondary mr-2 px-2 py-1 text-xs" onClick={() => startEditConnection(c)}>Bearbeiten</button>
                  <button type="button" className="btn-danger px-2 py-1 text-xs" onClick={() => void deleteConnection(c.id)}>Loeschen</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {powerGraphData.nodes.length > 0 && (
        <div className="card">
          <h3 className="mb-2 text-lg font-semibold">Power Topology</h3>
          <PowerGraph nodes={powerGraphData.nodes} edges={powerGraphData.edges} />
        </div>
      )}

      <div className="card flex flex-wrap gap-2">
        <select className="input" value={rackId} onChange={(e) => setRackId(Number(e.target.value))}>
          {racks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button type="button" className="btn" onClick={() => void loadMap()}>Rack Power Map neu laden</button>
      </div>
      <div className="card whitespace-pre-wrap text-sm">{JSON.stringify(map, null, 2)}</div>
    </div>
  );
}
