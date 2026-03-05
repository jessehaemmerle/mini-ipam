import { FormEvent, useEffect, useMemo, useState } from "react";

import { del, extractApiError, get, post, put } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";
import { Device, IPAddress } from "../types";

export function IPsPage() {
  const [items, setItems] = useState<IPAddress[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [assignTargets, setAssignTargets] = useState<Record<number, number | "">>({});
  const [filters, setFilters] = useState({ q: "", status: "", assigned: "" as "" | "assigned" | "unassigned" });
  const [form, setForm] = useState({
    address: "",
    vrf_id: 1,
    status: "reserved",
    dns_name: "",
    assigned_type: "" as "" | "device",
    assigned_id: "" as number | "",
  });
  const [bulkForm, setBulkForm] = useState({ start_ip: "", end_ip: "", description: "" });
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [ipData, deviceData] = await Promise.all([
      get<IPAddress[]>("/ipam/ips"),
      get<Device[]>("/dcim/devices"),
    ]);
    setItems(ipData);
    setDevices(deviceData);
    setAssignTargets(
      Object.fromEntries(
        ipData.map((item) => [
          item.id,
          item.assigned_type === "device" && item.assigned_id ? item.assigned_id : "",
        ])
      )
    );
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredItems = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return items.filter((item) => {
      if (filters.status && item.status !== filters.status) return false;
      const isAssignedDevice = item.assigned_type === "device" && !!item.assigned_id;
      if (filters.assigned === "assigned" && !isAssignedDevice) return false;
      if (filters.assigned === "unassigned" && isAssignedDevice) return false;
      if (!q) return true;
      const deviceName = item.assigned_id ? devices.find((d) => d.id === item.assigned_id)?.name || "" : "";
      return item.address.toLowerCase().includes(q) || (item.dns_name || "").toLowerCase().includes(q) || deviceName.toLowerCase().includes(q);
    });
  }, [items, devices, filters]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      await post("/ipam/ips", {
        address: form.address,
        vrf_id: form.vrf_id,
        status: form.status,
        dns_name: form.dns_name || null,
        description: null,
        out_of_scope: false,
        assigned_type: form.assigned_type || null,
        assigned_id: form.assigned_type === "device" && form.assigned_id !== "" ? form.assigned_id : null,
      });
      setForm({ ...form, address: "", dns_name: "", assigned_type: "", assigned_id: "" });
      await load();
      setMessage("IP erfolgreich gespeichert.");
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const editIp = async (item: IPAddress) => {
    const addr = window.prompt("IP Adresse", item.address);
    if (!addr) return;
    const dns = window.prompt("DNS Name", item.dns_name || "");
    const currentDevice =
      item.assigned_type === "device" && item.assigned_id ? String(item.assigned_id) : "";
    const deviceInput = window.prompt("Device ID fuer Zuordnung (leer = keine)", currentDevice);
    if (deviceInput === null) return;
    const deviceId = deviceInput.trim() ? Number(deviceInput.trim()) : null;
    if (deviceInput.trim() && Number.isNaN(deviceId)) {
      setError("Ungueltige Device ID.");
      return;
    }
    try {
      await put(`/ipam/ips/${item.id}`, {
        address: addr,
        vrf_id: item.vrf_id,
        status: item.status,
        dns_name: dns || null,
        description: item.description || null,
        out_of_scope: item.out_of_scope || false,
        assigned_type: deviceId ? "device" : null,
        assigned_id: deviceId,
      });
      await load();
      setMessage("IP aktualisiert.");
    } catch (err: unknown) {
      setError(extractApiError(err));
    }
  };

  const deleteIp = async (item: IPAddress) => {
    if (!window.confirm(`IP ${item.address} wirklich löschen?`)) return;
    try {
      await del(`/ipam/ips/${item.id}`);
      await load();
      setMessage("IP gelöscht.");
    } catch (err: unknown) {
      setError(extractApiError(err));
    }
  };

  const assignDevice = async (item: IPAddress) => {
    const target = assignTargets[item.id];
    try {
      await put(`/ipam/ips/${item.id}`, {
        address: item.address,
        vrf_id: item.vrf_id,
        status: item.status,
        dns_name: item.dns_name || null,
        description: item.description || null,
        out_of_scope: item.out_of_scope || false,
        assigned_type: target === "" ? null : "device",
        assigned_id: target === "" ? null : target,
      });
      await load();
      setMessage(target === "" ? "Geraetezuweisung entfernt." : "Geraet zugewiesen.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const submitBulkReserve = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      const result = await post<{ created: number }>("/ipam/ips/bulk-reserve", {
        start_ip: bulkForm.start_ip,
        end_ip: bulkForm.end_ip,
        vrf_id: form.vrf_id,
        description: bulkForm.description || null,
      });
      await load();
      setBulkForm({ start_ip: "", end_ip: "", description: "" });
      setMessage(`${result.created} IPs reserviert.`);
    } catch (err: unknown) {
      setError(extractApiError(err));
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="IP Addresses"
        subtitle="Assignments, Reservierungen und DNS-Name"
        meta={`${filteredItems.length} von ${items.length} IPs`}
      />
      <form onSubmit={submit} className="card flex flex-wrap items-end gap-2">
        <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="10.10.0.12" />
        <input className="input" value={form.dns_name} onChange={(e) => setForm({ ...form, dns_name: e.target.value })} placeholder="dns name" />
        <select
          className="input"
          value={form.assigned_type}
          onChange={(e) =>
            setForm({
              ...form,
              assigned_type: e.target.value as "" | "device",
              assigned_id: "",
            })
          }
        >
          <option value="">keine Zuordnung</option>
          <option value="device">Geraet</option>
        </select>
        {form.assigned_type === "device" && (
          <select
            className="input"
            value={form.assigned_id}
            onChange={(e) => setForm({ ...form, assigned_id: e.target.value ? Number(e.target.value) : "" })}
          >
            <option value="">Geraet waehlen</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name}
              </option>
            ))}
          </select>
        )}
        <button className="btn" type="submit" disabled={saving}>{saving ? "Speichert..." : "Quick Reserve"}</button>
      </form>
      <form onSubmit={submitBulkReserve} className="card flex flex-wrap items-end gap-2">
        <input className="input" value={bulkForm.start_ip} onChange={(e) => setBulkForm({ ...bulkForm, start_ip: e.target.value })} placeholder="Start IP (z.B. 10.10.0.100)" />
        <input className="input" value={bulkForm.end_ip} onChange={(e) => setBulkForm({ ...bulkForm, end_ip: e.target.value })} placeholder="End IP (z.B. 10.10.0.120)" />
        <input className="input" value={bulkForm.description} onChange={(e) => setBulkForm({ ...bulkForm, description: e.target.value })} placeholder="Beschreibung (optional)" />
        <button className="btn" type="submit">Bulk Reserve</button>
      </form>
      {message && <div className="card border border-green-200 bg-green-50 text-sm text-green-800">{message}</div>}
      {error && <div className="card border border-red-200 bg-red-50 text-sm text-red-800">{error}</div>}
      <div className="card flex flex-wrap gap-2">
        <input
          className="input"
          value={filters.q}
          onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
          placeholder="Suche IP/DNS/Geraet"
        />
        <select className="input" value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}>
          <option value="">alle Status</option>
          {Array.from(new Set(items.map((item) => item.status))).sort().map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
        <select
          className="input"
          value={filters.assigned}
          onChange={(e) => setFilters((prev) => ({ ...prev, assigned: e.target.value as "" | "assigned" | "unassigned" }))}
        >
          <option value="">alle Zuweisungen</option>
          <option value="assigned">mit Geraet</option>
          <option value="unassigned">ohne Geraet</option>
        </select>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => setFilters({ q: "", status: "", assigned: "" })}
        >
          Filter zuruecksetzen
        </button>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">Address</th>
              <th className="p-2">Status</th>
              <th className="p-2">DNS</th>
              <th className="p-2">Assignment</th>
              <th className="p-2">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="p-2 font-semibold">{item.address}</td>
                <td className="p-2">{item.status}</td>
                <td className="p-2">{item.dns_name || "-"}</td>
                <td className="p-2">
                  <div className="flex items-center gap-1">
                    <select
                      className="input h-8 py-1 text-xs"
                      value={assignTargets[item.id] ?? ""}
                      onChange={(e) =>
                        setAssignTargets((prev) => ({
                          ...prev,
                          [item.id]: e.target.value ? Number(e.target.value) : "",
                        }))
                      }
                    >
                      <option value="">kein Geraet</option>
                      {devices.map((device) => (
                        <option key={device.id} value={device.id}>
                          {device.name}
                        </option>
                      ))}
                    </select>
                    <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => void assignDevice(item)}>
                      Assign
                    </button>
                  </div>
                </td>
                <td className="p-2">
                  <button type="button" className="mr-2 rounded border px-2 py-1 text-xs" onClick={() => void editIp(item)}>Edit</button>
                  <button type="button" className="rounded border border-red-300 px-2 py-1 text-xs text-red-700" onClick={() => void deleteIp(item)}>Delete</button>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td className="p-3 text-sm text-slate-500" colSpan={5}>
                  Keine IPs gefunden. Passe Filter oder Suche an.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

