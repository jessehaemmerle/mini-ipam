import { FormEvent, useEffect, useMemo, useState } from "react";

import { extractApiError, get, post } from "../api/client";
import { CablePathGraph } from "../components/cable/CablePathGraph";
import { CableTopologyGraph } from "../components/cable/CableTopologyGraph";
import { PageHeader } from "../components/common/PageHeader";
import { Cable, Device, EndpointOption, Site } from "../types";

type PathResult = {
  nodes: string[];
  edges: { from: [string, number]; to: [string, number]; cable_id: number }[];
  table: { from: string; to: string; cable_id: number }[];
};

type EndpointResponse = {
  interfaces: EndpointOption[];
  patch_ports: EndpointOption[];
};

export function CablingPage() {
  const [path, setPath] = useState<PathResult | null>(null);
  const [cables, setCables] = useState<Cable[]>([]);
  const [endpointOptions, setEndpointOptions] = useState<EndpointOption[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [lookupKey, setLookupKey] = useState("");
  const [form, setForm] = useState({
    site_a: "",
    device_a: "",
    endpoint_a_key: "",
    site_b: "",
    device_b: "",
    endpoint_b_key: "",
    cable_type: "cat6",
    label: "",
  });

  const optionByKey = useMemo(
    () => Object.fromEntries(endpointOptions.map((item) => [`${item.type}:${item.id}`, item])),
    [endpointOptions]
  );
  const deviceChoices = useMemo(() => {
    const map = new Map<string, string>();
    devices.forEach((dev) => {
      map.set(`device:${dev.id}`, dev.name);
    });
    endpointOptions.forEach((opt) => {
      if (opt.type === "patch_port" && opt.panel_id && opt.panel_name) map.set(`panel:${opt.panel_id}`, opt.panel_name);
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [devices, endpointOptions]);
  const deviceSiteMap = useMemo(() => {
    const map = new Map<string, string>();
    devices.forEach((dev) => {
      if (dev.site_id) map.set(`device:${dev.id}`, String(dev.site_id));
    });
    endpointOptions.forEach((opt) => {
      const key = opt.type === "interface" ? `device:${opt.device_id}` : `panel:${opt.panel_id}`;
      if (key && opt.site_id) map.set(key, String(opt.site_id));
    });
    return map;
  }, [devices, endpointOptions]);
  const siteChoices = useMemo(() => {
    return [...sites]
      .map((s) => ({ id: s.id, name: s.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [sites]);
  const endpointAOptions = useMemo(
    () =>
      endpointOptions.filter((opt) => {
        if (form.site_a && String(opt.site_id) !== form.site_a) return false;
        if (!form.device_a) return true;
        if (form.device_a.startsWith("device:")) return opt.type === "interface" && `device:${opt.device_id}` === form.device_a;
        return opt.type === "patch_port" && `panel:${opt.panel_id}` === form.device_a;
      }),
    [endpointOptions, form.site_a, form.device_a]
  );
  const endpointBOptions = useMemo(
    () =>
      endpointOptions.filter((opt) => {
        if (form.site_b && String(opt.site_id) !== form.site_b) return false;
        if (!form.device_b) return true;
        if (form.device_b.startsWith("device:")) return opt.type === "interface" && `device:${opt.device_id}` === form.device_b;
        return opt.type === "patch_port" && `panel:${opt.panel_id}` === form.device_b;
      }),
    [endpointOptions, form.site_b, form.device_b]
  );
  const deviceAChoices = useMemo(() => {
    return deviceChoices.filter((d) => {
      if (!form.site_a) return true;
      return deviceSiteMap.get(d.value) === form.site_a;
    });
  }, [deviceChoices, deviceSiteMap, form.site_a]);
  const deviceBChoices = useMemo(() => {
    return deviceChoices.filter((d) => {
      if (!form.site_b) return true;
      return deviceSiteMap.get(d.value) === form.site_b;
    });
  }, [deviceChoices, deviceSiteMap, form.site_b]);

  const endpointLabel = (type: string, id: number) => {
    const opt = optionByKey[`${type}:${id}`];
    if (!opt) return `${type}:${id}`;
    if (opt.type === "interface") {
      return `${opt.site_name ? `[${opt.site_name}] ` : ""}${opt.device_name || `device-${opt.device_id}`} / ${opt.name}`;
    }
    return `${opt.site_name ? `[${opt.site_name}] ` : ""}${opt.panel_name || `panel-${opt.panel_id}`} / ${opt.name}`;
  };

  const topologyData = useMemo(() => {
    const nodeMap = new Map<string, { id: string; label: string }>();
    const edges = cables.map((c) => {
      const from = `${c.endpoint_a_type}:${c.endpoint_a_id}`;
      const to = `${c.endpoint_b_type}:${c.endpoint_b_id}`;
      nodeMap.set(from, { id: from, label: endpointLabel(c.endpoint_a_type, c.endpoint_a_id) });
      nodeMap.set(to, { id: to, label: endpointLabel(c.endpoint_b_type, c.endpoint_b_id) });
      return { id: `cable-${c.id}`, from, to, label: c.label || `${c.cable_type} #${c.id}` };
    });
    return { nodes: Array.from(nodeMap.values()), edges };
  }, [cables, endpointOptions]);

  const load = async () => {
    try {
      const [options, cableData, deviceData, siteData] = await Promise.all([
        get<EndpointResponse>("/dcim/endpoint-options"),
        get<Cable[]>("/dcim/cables"),
        get<Device[]>("/dcim/devices"),
        get<Site[]>("/dcim/sites"),
      ]);
      const merged = [...options.interfaces, ...options.patch_ports];
      setEndpointOptions(merged);
      setCables(cableData);
      setDevices(deviceData);
      setSites(siteData);

      const defaultKey = merged[0] ? `${merged[0].type}:${merged[0].id}` : "";
      setLookupKey((prev) => prev || defaultKey);
      setForm((prev) => ({
        ...prev,
        site_a: prev.site_a || "",
        device_a: prev.device_a || "",
        endpoint_a_key: prev.endpoint_a_key || defaultKey,
        site_b: prev.site_b || "",
        device_b: prev.device_b || "",
        endpoint_b_key: prev.endpoint_b_key || (merged[1] ? `${merged[1].type}:${merged[1].id}` : defaultKey),
      }));
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (form.endpoint_a_key && !endpointAOptions.some((opt) => `${opt.type}:${opt.id}` === form.endpoint_a_key)) {
      setForm((prev) => ({ ...prev, endpoint_a_key: "" }));
    }
  }, [endpointAOptions, form.endpoint_a_key]);

  useEffect(() => {
    if (form.endpoint_b_key && !endpointBOptions.some((opt) => `${opt.type}:${opt.id}` === form.endpoint_b_key)) {
      setForm((prev) => ({ ...prev, endpoint_b_key: "" }));
    }
  }, [endpointBOptions, form.endpoint_b_key]);

  const runLookup = async () => {
    const source = optionByKey[lookupKey];
    if (!source) return;
    const data = await get<PathResult>("/dcim/cable-path", {
      endpoint_type: source.type,
      endpoint_id: source.id,
    });
    setPath(data);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const a = optionByKey[form.endpoint_a_key];
    const b = optionByKey[form.endpoint_b_key];
    if (!a || !b) {
      setError("Bitte fuer beide Seiten ein Endpoint auswaehlen.");
      setMessage("");
      return;
    }
    if (a.id === b.id && a.type === b.type) {
      setError("Start- und Endpunkt duerfen nicht identisch sein.");
      return;
    }
    try {
      await post("/dcim/cables", {
        endpoint_a_type: a.type,
        endpoint_a_id: a.id,
        endpoint_b_type: b.type,
        endpoint_b_id: b.id,
        cable_type: form.cable_type,
        label: form.label || null,
        status: "active",
      });
      setMessage("Kabel erstellt.");
      setError("");
      await load();
      await runLookup();
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Cabling" subtitle="Kabel zwischen Interfaces und Patchports mit Path-Ansicht" />
      <form className="card flex flex-wrap items-end gap-2" onSubmit={submit}>
        <div>
          <label className="muted">Site A</label>
          <select className="input ml-2" value={form.site_a} onChange={(e) => setForm({ ...form, site_a: e.target.value, device_a: "", endpoint_a_key: "" })}>
            <option value="">alle</option>
            {siteChoices.map((s) => (
              <option key={`site-a-${s.id}`} value={String(s.id)}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="muted">Geraet/Panel A</label>
          <select className="input ml-2" value={form.device_a} onChange={(e) => setForm({ ...form, device_a: e.target.value, endpoint_a_key: "" })}>
            <option value="">alle</option>
            {deviceAChoices.map((d) => (
              <option key={`dev-a-${d.value}`} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="muted">Endpoint A</label>
          <select className="input ml-2" value={form.endpoint_a_key} onChange={(e) => setForm({ ...form, endpoint_a_key: e.target.value })}>
            <option value="">bitte waehlen</option>
            {endpointAOptions.map((opt) => (
              <option key={`a-${opt.type}-${opt.id}`} value={`${opt.type}:${opt.id}`}>
                {opt.type === "interface"
                  ? `${opt.site_name ? `[${opt.site_name}] ` : ""}${opt.device_name || `device-${opt.device_id}`} / ${opt.name}`
                  : `${opt.site_name ? `[${opt.site_name}] ` : ""}${opt.panel_name || `panel-${opt.panel_id}`} / ${opt.name}`}
              </option>
            ))}
          </select>
          {endpointAOptions.length === 0 && <div className="muted mt-1 text-xs">Keine Endpunkte fuer die Auswahl vorhanden.</div>}
        </div>
        <div>
          <label className="muted">Site B</label>
          <select className="input ml-2" value={form.site_b} onChange={(e) => setForm({ ...form, site_b: e.target.value, device_b: "", endpoint_b_key: "" })}>
            <option value="">alle</option>
            {siteChoices.map((s) => (
              <option key={`site-b-${s.id}`} value={String(s.id)}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="muted">Geraet/Panel B</label>
          <select className="input ml-2" value={form.device_b} onChange={(e) => setForm({ ...form, device_b: e.target.value, endpoint_b_key: "" })}>
            <option value="">alle</option>
            {deviceBChoices.map((d) => (
              <option key={`dev-b-${d.value}`} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="muted">Endpoint B</label>
          <select className="input ml-2" value={form.endpoint_b_key} onChange={(e) => setForm({ ...form, endpoint_b_key: e.target.value })}>
            <option value="">bitte waehlen</option>
            {endpointBOptions.map((opt) => (
              <option key={`b-${opt.type}-${opt.id}`} value={`${opt.type}:${opt.id}`}>
                {opt.type === "interface"
                  ? `${opt.site_name ? `[${opt.site_name}] ` : ""}${opt.device_name || `device-${opt.device_id}`} / ${opt.name}`
                  : `${opt.site_name ? `[${opt.site_name}] ` : ""}${opt.panel_name || `panel-${opt.panel_id}`} / ${opt.name}`}
              </option>
            ))}
          </select>
          {endpointBOptions.length === 0 && <div className="muted mt-1 text-xs">Keine Endpunkte fuer die Auswahl vorhanden.</div>}
        </div>
        <input className="input" value={form.cable_type} onChange={(e) => setForm({ ...form, cable_type: e.target.value })} placeholder="cat6/fiber/dac" />
        <input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Label" />
        <button className="btn" type="submit">Create Cable</button>
      </form>

      {message && <div className="card border border-green-200 bg-green-50 text-sm text-green-800">{message}</div>}
      {error && <div className="card border border-red-200 bg-red-50 text-sm text-red-800">{error}</div>}

      <div className="card flex gap-2">
        <select className="input" value={lookupKey} onChange={(e) => setLookupKey(e.target.value)}>
          {endpointOptions.map((opt) => (
            <option key={`lookup-${opt.type}-${opt.id}`} value={`${opt.type}:${opt.id}`}>
              {opt.type === "interface"
                ? `${opt.site_name ? `[${opt.site_name}] ` : ""}${opt.device_name || `device-${opt.device_id}`} / ${opt.name}`
                : `${opt.site_name ? `[${opt.site_name}] ` : ""}${opt.panel_name || `panel-${opt.panel_id}`} / ${opt.name}`}
            </option>
          ))}
        </select>
        <button type="button" className="btn" onClick={() => void runLookup()}>Show Path</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left"><th className="p-2">ID</th><th className="p-2">A</th><th className="p-2">B</th><th className="p-2">Type</th><th className="p-2">Label</th></tr>
          </thead>
          <tbody>
            {cables.map((c) => (
              <tr key={c.id} className="border-b">
                <td className="p-2">{c.id}</td>
                <td className="p-2">{endpointLabel(c.endpoint_a_type, c.endpoint_a_id)}</td>
                <td className="p-2">{endpointLabel(c.endpoint_b_type, c.endpoint_b_id)}</td>
                <td className="p-2">{c.cable_type}</td>
                <td className="p-2">{c.label || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {topologyData.nodes.length > 0 && (
        <div className="card">
          <h3 className="mb-2 text-lg font-semibold">Cable Topology</h3>
          <CableTopologyGraph nodes={topologyData.nodes} edges={topologyData.edges} />
        </div>
      )}

      {path && (
        <>
          <CablePathGraph nodes={path.nodes} edges={path.edges} />
          <div className="card overflow-x-auto">
            <table className="w-full text-sm"><thead><tr className="border-b"><th className="p-2 text-left">From</th><th className="p-2 text-left">To</th><th className="p-2 text-left">Cable</th></tr></thead><tbody>{path.table.map((r, i) => <tr key={`${r.cable_id}-${i}`} className="border-b"><td className="p-2">{r.from}</td><td className="p-2">{r.to}</td><td className="p-2">{r.cable_id}</td></tr>)}</tbody></table>
          </div>
        </>
      )}
    </div>
  );
}
