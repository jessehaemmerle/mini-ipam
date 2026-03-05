import { FormEvent, useEffect, useMemo, useState } from "react";

import { extractApiError, get, post } from "../api/client";
import { PowerGraph } from "../components/power/PowerGraph";
import { Device, PDUOutlet, PowerConnection, PowerInlet, Rack } from "../types";
import { PageHeader } from "../components/common/PageHeader";

export function PowerPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);
  const [inlets, setInlets] = useState<PowerInlet[]>([]);
  const [outlets, setOutlets] = useState<PDUOutlet[]>([]);
  const [connections, setConnections] = useState<PowerConnection[]>([]);
  const [rackId, setRackId] = useState<number>(1);
  const [map, setMap] = useState<Array<Record<string, unknown>>>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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
    const nodeMap = new Map<string, { id: string; label: string }>();
    const edges = connections.map((c) => {
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
      nodeMap.set(from, { id: from, label: fromLabel });
      nodeMap.set(to, { id: to, label: toLabel });
      return { from, to };
    });
    return { nodes: Array.from(nodeMap.values()), edges };
  }, [connections, inletById, outletById, deviceById]);

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

    if (rackData[0]?.id && !rackId) setRackId(rackData[0].id);
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

  const submitInlet = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await post("/dcim/power/inlets", inletForm);
      await load();
      setMessage("Power Inlet erstellt.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const submitOutlet = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await post("/dcim/power/outlets", outletForm);
      await load();
      setMessage("PDU Outlet erstellt.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const submitConnection = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await post("/dcim/power/connections", {
        src_type: "power_inlet",
        src_id: connectionForm.src_id,
        dst_type: "pdu_outlet",
        dst_id: connectionForm.dst_id,
      });
      await load();
      await loadMap();
      setMessage("Power Connection erstellt.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Power" subtitle="Inlets/Outlets anlegen, verbinden und Rack-Map anzeigen" />
      {message && <div className="card border border-green-200 bg-green-50 text-sm text-green-800">{message}</div>}
      {error && <div className="card border border-red-200 bg-red-50 text-sm text-red-800">{error}</div>}

      <form className="card flex flex-wrap items-end gap-2" onSubmit={submitInlet}>
        <div>
          <label className="muted">Device fuer Inlet</label>
          <select className="input ml-2" value={inletForm.device_id} onChange={(e) => setInletForm({ ...inletForm, device_id: Number(e.target.value) })}>
            {devices.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <input className="input" value={inletForm.name} onChange={(e) => setInletForm({ ...inletForm, name: e.target.value })} placeholder="PSU-A" />
        <button className="btn" type="submit">Create Inlet</button>
      </form>

      <form className="card flex flex-wrap items-end gap-2" onSubmit={submitOutlet}>
        <div>
          <label className="muted">PDU Device</label>
          <select className="input ml-2" value={outletForm.pdu_device_id} onChange={(e) => setOutletForm({ ...outletForm, pdu_device_id: Number(e.target.value) })}>
            {devices.filter((d) => d.role === "pdu" || d.role === "ups").map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <input className="input" value={outletForm.name} onChange={(e) => setOutletForm({ ...outletForm, name: e.target.value })} placeholder="Outlet-1" />
        <button className="btn" type="submit">Create Outlet</button>
      </form>

      <form className="card flex flex-wrap items-end gap-2" onSubmit={submitConnection}>
        <div>
          <label className="muted">Power Inlet</label>
          <select className="input ml-2" value={connectionForm.src_id} onChange={(e) => setConnectionForm({ ...connectionForm, src_id: Number(e.target.value) })}>
            {inlets.map((i) => <option key={i.id} value={i.id}>{i.name} ({deviceById[i.device_id] || `device-${i.device_id}`})</option>)}
          </select>
        </div>
        <div>
          <label className="muted">PDU Outlet</label>
          <select className="input ml-2" value={connectionForm.dst_id} onChange={(e) => setConnectionForm({ ...connectionForm, dst_id: Number(e.target.value) })}>
            {outlets.map((o) => <option key={o.id} value={o.id}>{o.name} ({deviceById[o.pdu_device_id] || `pdu-${o.pdu_device_id}`})</option>)}
          </select>
        </div>
        <button className="btn" type="submit">Connect</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left"><th className="p-2">ID</th><th className="p-2">Source</th><th className="p-2">Target</th></tr></thead>
          <tbody>
            {connections.map((c) => (
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

      <div className="card flex gap-2">
        <select className="input" value={rackId} onChange={(e) => setRackId(Number(e.target.value))}>
          {racks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button type="button" className="btn" onClick={() => void loadMap()}>Load Rack Power Map</button>
      </div>
      <div className="card whitespace-pre-wrap text-sm">{JSON.stringify(map, null, 2)}</div>
    </div>
  );
}
