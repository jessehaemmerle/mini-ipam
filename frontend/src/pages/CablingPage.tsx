import { FormEvent, useEffect, useMemo, useState } from "react";

import { del, extractApiError, get, post, put } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";
import { Cable, Device, EndpointOption, PatchPort, Rack, Site } from "../types";

type EndpointResponse = {
  interfaces: EndpointOption[];
  patch_ports: EndpointOption[];
};

type RackSelectValue = number | "";

export function CablingPage() {
  const [cables, setCables] = useState<Cable[]>([]);
  const [patchPorts, setPatchPorts] = useState<PatchPort[]>([]);
  const [endpointOptions, setEndpointOptions] = useState<EndpointOption[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [racks, setRacks] = useState<Rack[]>([]);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [listFilter, setListFilter] = useState({ q: "", cable_type: "" });
  const [patchFilter, setPatchFilter] = useState({ q: "", panel_id: "" as number | "" });
  const [editingPatchPortId, setEditingPatchPortId] = useState<number | null>(null);
  const [dragSourceKey, setDragSourceKey] = useState("");
  const [dropTargetKey, setDropTargetKey] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectForm, setConnectForm] = useState({
    rack_a: "" as RackSelectValue,
    rack_b: "" as RackSelectValue,
    cable_type: "cat6",
    label: "",
  });
  const [patchPortForm, setPatchPortForm] = useState({
    panel_id: "" as number | "",
    position: 1,
    front_port_name: "",
    back_port_name: "",
    allow_multi: false,
  });

  const deviceById = useMemo(() => Object.fromEntries(devices.map((d) => [d.id, d])), [devices]);
  const siteById = useMemo(() => Object.fromEntries(sites.map((s) => [s.id, s])), [sites]);
  const endpointByKey = useMemo(
    () => Object.fromEntries(endpointOptions.map((item) => [`${item.type}:${item.id}`, item])),
    [endpointOptions]
  );
  const patchPanels = useMemo(() => devices.filter((device) => device.role === "patchpanel"), [devices]);

  const rackChoices = useMemo(() => {
    return [...racks]
      .sort((left, right) => {
        const leftSite = siteById[left.site_id]?.name || "";
        const rightSite = siteById[right.site_id]?.name || "";
        return leftSite === rightSite ? left.name.localeCompare(right.name) : leftSite.localeCompare(rightSite);
      })
      .map((rack) => ({
        id: rack.id,
        label: `${siteById[rack.site_id]?.name || "Ohne Site"} / ${rack.name}`,
      }));
  }, [racks, siteById]);

  const endpointLabel = (option: EndpointOption) => {
    if (option.type === "interface") {
      return `${option.device_name || `device-${option.device_id}`} / ${option.name}`;
    }
    return `${option.panel_name || `panel-${option.panel_id}`} / ${option.name}`;
  };

  const endpointLabelByKey = (type: string, id: number) => {
    const option = endpointByKey[`${type}:${id}`];
    if (!option) return `${type}:${id}`;
    return endpointLabel(option);
  };

  const endpointsByDeviceId = useMemo(() => {
    const grouped = new Map<number, EndpointOption[]>();
    endpointOptions.forEach((option) => {
      const deviceId = option.type === "interface" ? option.device_id : option.panel_id;
      if (!deviceId) return;
      const current = grouped.get(deviceId) || [];
      current.push(option);
      grouped.set(deviceId, current);
    });
    grouped.forEach((items, key) => {
      grouped.set(
        key,
        items.sort((left, right) => {
          return endpointLabel(left).localeCompare(endpointLabel(right));
        })
      );
    });
    return grouped;
  }, [endpointOptions]);

  const cableCountByEndpoint = useMemo(() => {
    const counts: Record<string, number> = {};
    cables.forEach((cable) => {
      const left = `${cable.endpoint_a_type}:${cable.endpoint_a_id}`;
      const right = `${cable.endpoint_b_type}:${cable.endpoint_b_id}`;
      counts[left] = (counts[left] || 0) + 1;
      counts[right] = (counts[right] || 0) + 1;
    });
    return counts;
  }, [cables]);

  const devicesForRack = (rackId: RackSelectValue) => {
    if (rackId === "") return [];
    return devices
      .filter((device) => device.rack_id === rackId)
      .sort((left, right) => left.name.localeCompare(right.name));
  };

  const rackADevices = useMemo(() => devicesForRack(connectForm.rack_a), [devices, connectForm.rack_a]);
  const rackBDevices = useMemo(() => devicesForRack(connectForm.rack_b), [devices, connectForm.rack_b]);

  const filteredCables = useMemo(() => {
    const q = listFilter.q.trim().toLowerCase();
    return cables.filter((item) => {
      if (listFilter.cable_type && item.cable_type !== listFilter.cable_type) return false;
      if (!q) return true;
      return (
        String(item.id).includes(q) ||
        (item.label || "").toLowerCase().includes(q) ||
        endpointLabelByKey(item.endpoint_a_type, item.endpoint_a_id).toLowerCase().includes(q) ||
        endpointLabelByKey(item.endpoint_b_type, item.endpoint_b_id).toLowerCase().includes(q)
      );
    });
  }, [cables, listFilter, endpointByKey]);

  const filteredPatchPorts = useMemo(() => {
    const q = patchFilter.q.trim().toLowerCase();
    return patchPorts.filter((port) => {
      if (patchFilter.panel_id !== "" && port.panel_id !== patchFilter.panel_id) return false;
      if (!q) return true;
      return (
        String(port.position).includes(q) ||
        port.front_port_name.toLowerCase().includes(q) ||
        port.back_port_name.toLowerCase().includes(q) ||
        (deviceById[port.panel_id]?.name || "").toLowerCase().includes(q)
      );
    });
  }, [patchPorts, patchFilter, deviceById]);

  const load = async () => {
    try {
      const [options, cableData, deviceData, siteData, patchPortData, rackData] = await Promise.all([
        get<EndpointResponse>("/dcim/endpoint-options"),
        get<Cable[]>("/dcim/cables"),
        get<Device[]>("/dcim/devices"),
        get<Site[]>("/dcim/sites"),
        get<PatchPort[]>("/dcim/patch-ports"),
        get<Rack[]>("/dcim/racks"),
      ]);
      const mergedOptions = [...options.interfaces, ...options.patch_ports];
      setEndpointOptions(mergedOptions);
      setCables(cableData);
      setDevices(deviceData);
      setSites(siteData);
      setPatchPorts(patchPortData);
      setRacks(rackData);
      setPatchPortForm((prev) => ({
        ...prev,
        panel_id: prev.panel_id || deviceData.find((d) => d.role === "patchpanel")?.id || "",
      }));

      const sortedRacks = [...rackData].sort((left, right) => left.name.localeCompare(right.name));
      setConnectForm((prev) => ({
        ...prev,
        rack_a: prev.rack_a || sortedRacks[0]?.id || "",
        rack_b: prev.rack_b || sortedRacks[1]?.id || sortedRacks[0]?.id || "",
      }));
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const connectEndpoints = async (sourceKey: string, targetKey: string) => {
    const source = endpointByKey[sourceKey];
    const target = endpointByKey[targetKey];
    if (!source || !target) {
      setError("Bitte gueltige Endpunkte waehlen.");
      setMessage("");
      return;
    }
    if (source.id === target.id && source.type === target.type) {
      setError("Start- und Endpunkt duerfen nicht identisch sein.");
      setMessage("");
      return;
    }

    try {
      setConnecting(true);
      await post("/dcim/cables", {
        endpoint_a_type: source.type,
        endpoint_a_id: source.id,
        endpoint_b_type: target.type,
        endpoint_b_id: target.id,
        cable_type: connectForm.cable_type,
        label: connectForm.label.trim() || null,
        status: "active",
      });
      setMessage("Kabel erstellt.");
      setError("");
      setDragSourceKey("");
      setDropTargetKey("");
      setConnectForm((prev) => ({ ...prev, label: "" }));
      await load();
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    } finally {
      setConnecting(false);
    }
  };

  const handleEndpointClick = (key: string) => {
    if (!dragSourceKey) {
      setDragSourceKey(key);
      return;
    }
    if (dragSourceKey === key) {
      setDragSourceKey("");
      return;
    }
    void connectEndpoints(dragSourceKey, key);
  };

  const handleEndpointDrop = async (targetKey: string) => {
    if (!dragSourceKey) return;
    await connectEndpoints(dragSourceKey, targetKey);
  };

  const deleteCable = async (cableId: number) => {
    if (!window.confirm(`Kabel #${cableId} wirklich loeschen?`)) return;
    try {
      await del(`/dcim/cables/${cableId}`);
      await load();
      setMessage("Kabel geloescht.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const submitPatchPort = async (e: FormEvent) => {
    e.preventDefault();
    if (patchPortForm.panel_id === "") {
      setError("Bitte Patchpanel auswaehlen.");
      setMessage("");
      return;
    }
    try {
      const payload = {
        panel_id: patchPortForm.panel_id,
        position: patchPortForm.position,
        front_port_name: patchPortForm.front_port_name,
        back_port_name: patchPortForm.back_port_name,
        allow_multi: patchPortForm.allow_multi,
      };
      if (editingPatchPortId) {
        await put(`/dcim/patch-ports/${editingPatchPortId}`, payload);
      } else {
        await post("/dcim/patch-ports", payload);
      }
      setEditingPatchPortId(null);
      setPatchPortForm({
        panel_id: patchPortForm.panel_id,
        position: 1,
        front_port_name: "",
        back_port_name: "",
        allow_multi: false,
      });
      await load();
      setMessage(editingPatchPortId ? "Patchport aktualisiert." : "Patchport erstellt.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const startEditPatchPort = (port: PatchPort) => {
    setEditingPatchPortId(port.id);
    setPatchPortForm({
      panel_id: port.panel_id,
      position: port.position,
      front_port_name: port.front_port_name,
      back_port_name: port.back_port_name,
      allow_multi: !!port.allow_multi,
    });
  };

  const deletePatchPort = async (patchPortId: number) => {
    if (!window.confirm(`Patchport #${patchPortId} wirklich loeschen?`)) return;
    try {
      await del(`/dcim/patch-ports/${patchPortId}`);
      await load();
      setMessage("Patchport geloescht.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const renderRackColumn = (title: string, rackValue: RackSelectValue, onRackChange: (value: RackSelectValue) => void, list: Device[]) => {
    const rackLabel = rackValue === "" ? "Kein Rack ausgewaehlt" : rackChoices.find((rack) => rack.id === rackValue)?.label || "Rack";
    return (
      <div className="card">
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <div className="field">
            <label className="field-label">{title}</label>
            <select
              className="input"
              value={rackValue}
              onChange={(e) => onRackChange(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Rack waehlen</option>
              {rackChoices.map((rack) => (
                <option key={`${title}-rack-${rack.id}`} value={rack.id}>
                  {rack.label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-sm text-slate-600">{rackLabel}</p>
        </div>

        {rackValue === "" && <p className="text-sm text-slate-500">Bitte ein Rack auswaehlen.</p>}

        {rackValue !== "" && list.length === 0 && (
          <p className="text-sm text-slate-500">In diesem Rack sind keine Geraete eingetragen.</p>
        )}

        <div className="space-y-3">
          {list.map((device) => {
            const endpoints = endpointsByDeviceId.get(device.id) || [];
            return (
              <div key={`${title}-device-${device.id}`} className="rounded-md border border-slate-200 p-3">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">{device.name}</p>
                  <p className="text-xs text-slate-500">{device.role}</p>
                </div>

                {endpoints.length === 0 && (
                  <p className="text-sm text-slate-500">Keine Endpunkte (Interfaces/Patchports) vorhanden.</p>
                )}

                {endpoints.length > 0 && (
                  <div className="grid gap-2">
                    {endpoints.map((option) => {
                      const key = `${option.type}:${option.id}`;
                      const isSelected = dragSourceKey === key;
                      const isDropTarget = dropTargetKey === key;
                      const cableCount = cableCountByEndpoint[key] || 0;
                      return (
                        <button
                          key={`${title}-endpoint-${key}`}
                          type="button"
                          draggable
                          onDragStart={() => setDragSourceKey(key)}
                          onDragEnd={() => setDropTargetKey("")}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDropTargetKey(key);
                          }}
                          onDragLeave={() => {
                            setDropTargetKey((prev) => (prev === key ? "" : prev));
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            void handleEndpointDrop(key);
                          }}
                          onClick={() => handleEndpointClick(key)}
                          className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                            isSelected
                              ? "border-brand bg-green-50 text-ink"
                              : isDropTarget
                                ? "border-amber-400 bg-amber-50 text-ink"
                                : "border-slate-200 bg-white text-ink hover:bg-slate-50"
                          }`}
                          disabled={connecting}
                        >
                          <span>{option.name}</span>
                          <span className="text-xs text-slate-500">{cableCount > 0 ? `belegt (${cableCount})` : "frei"}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Verkabelung" subtitle="Rack auswaehlen, Endpunkt ziehen und auf Ziel-Endpunkt ablegen." />

      <div className="card grid gap-3 md:grid-cols-3">
        <div className="field">
          <label className="field-label" htmlFor="cable-type">Kabeltyp</label>
          <select
            id="cable-type"
            className="input"
            value={connectForm.cable_type}
            onChange={(e) => setConnectForm((prev) => ({ ...prev, cable_type: e.target.value }))}
          >
            <option value="cat6">cat6</option>
            <option value="fiber">fiber</option>
            <option value="dac">dac</option>
          </select>
        </div>
        <div className="field md:col-span-2">
          <label className="field-label" htmlFor="cable-label">Kabel-Label (optional)</label>
          <input
            id="cable-label"
            className="input"
            value={connectForm.label}
            onChange={(e) => setConnectForm((prev) => ({ ...prev, label: e.target.value }))}
            placeholder="z. B. Uplink R1-R2"
          />
        </div>
        <p className="md:col-span-3 text-sm text-slate-600">
          Bedienung: Endpunkt anklicken oder ziehen, dann auf den Ziel-Endpunkt klicken/ablegen. Ein erneuter Klick auf den selben Endpunkt hebt die Auswahl auf.
        </p>
      </div>

      {message && <div className="card border border-green-200 bg-green-50 text-sm text-green-800">{message}</div>}
      {error && <div className="card border border-red-200 bg-red-50 text-sm text-red-800">{error}</div>}

      <div className="grid gap-4 lg:grid-cols-2">
        {renderRackColumn("Rack A", connectForm.rack_a, (value) => setConnectForm((prev) => ({ ...prev, rack_a: value })), rackADevices)}
        {renderRackColumn("Rack B", connectForm.rack_b, (value) => setConnectForm((prev) => ({ ...prev, rack_b: value })), rackBDevices)}
      </div>

      <div className="card overflow-x-auto">
        <div className="mb-2 flex flex-wrap gap-2">
          <input
            className="input"
            value={listFilter.q}
            onChange={(e) => setListFilter((prev) => ({ ...prev, q: e.target.value }))}
            placeholder="Filter ID, Label oder Endpunkt"
          />
          <select className="input" value={listFilter.cable_type} onChange={(e) => setListFilter((prev) => ({ ...prev, cable_type: e.target.value }))}>
            <option value="">alle Kabeltypen</option>
            {Array.from(new Set(cables.map((cable) => cable.cable_type))).sort().map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <button type="button" className="btn-secondary" onClick={() => setListFilter({ q: "", cable_type: "" })}>
            Zuruecksetzen
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">ID</th>
              <th className="p-2">Endpunkt A</th>
              <th className="p-2">Endpunkt B</th>
              <th className="p-2">Typ</th>
              <th className="p-2">Label</th>
              <th className="p-2">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filteredCables.map((cable) => (
              <tr key={cable.id} className="border-b">
                <td className="p-2">{cable.id}</td>
                <td className="p-2">{endpointLabelByKey(cable.endpoint_a_type, cable.endpoint_a_id)}</td>
                <td className="p-2">{endpointLabelByKey(cable.endpoint_b_type, cable.endpoint_b_id)}</td>
                <td className="p-2">{cable.cable_type}</td>
                <td className="p-2">{cable.label || "-"}</td>
                <td className="p-2">
                  <button type="button" className="btn-danger px-2 py-1 text-xs" onClick={() => void deleteCable(cable.id)}>
                    Loeschen
                  </button>
                </td>
              </tr>
            ))}
            {filteredCables.length === 0 && (
              <tr>
                <td className="p-3 text-sm text-slate-500" colSpan={6}>
                  Keine Kabel gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="card space-y-2">
        <h2 className="text-lg font-semibold text-ink">Patchpanel Ports</h2>
        <form className="flex flex-wrap items-end gap-2" onSubmit={submitPatchPort}>
          <select
            className="input"
            value={patchPortForm.panel_id}
            onChange={(e) => setPatchPortForm({ ...patchPortForm, panel_id: e.target.value ? Number(e.target.value) : "" })}
          >
            <option value="">Patchpanel waehlen</option>
            {patchPanels.map((panel) => (
              <option key={`panel-${panel.id}`} value={panel.id}>
                {panel.name}
              </option>
            ))}
          </select>
          <input
            className="input w-24"
            type="number"
            min={1}
            value={patchPortForm.position}
            onChange={(e) => setPatchPortForm({ ...patchPortForm, position: Number(e.target.value) })}
            placeholder="Pos"
          />
          <input className="input" value={patchPortForm.front_port_name} onChange={(e) => setPatchPortForm({ ...patchPortForm, front_port_name: e.target.value })} placeholder="Front Port" />
          <input className="input" value={patchPortForm.back_port_name} onChange={(e) => setPatchPortForm({ ...patchPortForm, back_port_name: e.target.value })} placeholder="Back Port" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={patchPortForm.allow_multi} onChange={(e) => setPatchPortForm({ ...patchPortForm, allow_multi: e.target.checked })} />
            allow_multi
          </label>
          <button className="btn" type="submit">
            {editingPatchPortId ? "Port speichern" : "Port anlegen"}
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          <input className="input" value={patchFilter.q} onChange={(e) => setPatchFilter((prev) => ({ ...prev, q: e.target.value }))} placeholder="Filter Port/Panel" />
          <select className="input" value={patchFilter.panel_id} onChange={(e) => setPatchFilter((prev) => ({ ...prev, panel_id: e.target.value ? Number(e.target.value) : "" }))}>
            <option value="">alle Panels</option>
            {patchPanels.map((panel) => (
              <option key={`filter-panel-${panel.id}`} value={panel.id}>
                {panel.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn-secondary" onClick={() => setPatchFilter({ q: "", panel_id: "" })}>
            Zuruecksetzen
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="p-2">ID</th>
                <th className="p-2">Panel</th>
                <th className="p-2">Pos</th>
                <th className="p-2">Front</th>
                <th className="p-2">Back</th>
                <th className="p-2">Multi</th>
                <th className="p-2">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filteredPatchPorts.map((port) => (
                <tr key={port.id} className="border-b">
                  <td className="p-2">{port.id}</td>
                  <td className="p-2">{deviceById[port.panel_id]?.name || `panel-${port.panel_id}`}</td>
                  <td className="p-2">{port.position}</td>
                  <td className="p-2">{port.front_port_name}</td>
                  <td className="p-2">{port.back_port_name}</td>
                  <td className="p-2">{port.allow_multi ? "yes" : "no"}</td>
                  <td className="p-2">
                    <button type="button" className="btn-secondary mr-2 px-2 py-1 text-xs" onClick={() => startEditPatchPort(port)}>
                      Bearbeiten
                    </button>
                    <button type="button" className="btn-danger px-2 py-1 text-xs" onClick={() => void deletePatchPort(port.id)}>
                      Loeschen
                    </button>
                  </td>
                </tr>
              ))}
              {filteredPatchPorts.length === 0 && (
                <tr>
                  <td className="p-3 text-sm text-slate-500" colSpan={7}>
                    Keine Patchports gefunden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
