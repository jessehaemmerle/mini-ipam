import { FormEvent, Fragment, useEffect, useMemo, useState } from "react";

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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ address: "", dns_name: "", assigned_id: "" as number | "" });
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [assignSavingId, setAssignSavingId] = useState<number | null>(null);

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
    if (!form.address.trim()) {
      setError("Bitte eine IP-Adresse eingeben.");
      setMessage("");
      return;
    }
    setError("");
    setMessage("");
    setSaving(true);
    try {
      await post("/ipam/ips", {
        address: form.address.trim(),
        vrf_id: form.vrf_id,
        status: form.status,
        dns_name: form.dns_name.trim() || null,
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

  const startEdit = (item: IPAddress) => {
    setEditingId(item.id);
    setEditForm({
      address: item.address,
      dns_name: item.dns_name || "",
      assigned_id: item.assigned_type === "device" && item.assigned_id ? item.assigned_id : "",
    });
    setMessage("");
    setError("");
  };

  const saveEdit = async (item: IPAddress) => {
    if (!editForm.address.trim()) {
      setError("IP-Adresse ist erforderlich.");
      setMessage("");
      return;
    }
    try {
      await put(`/ipam/ips/${item.id}`, {
        address: editForm.address.trim(),
        vrf_id: item.vrf_id,
        status: item.status,
        dns_name: editForm.dns_name.trim() || null,
        description: item.description || null,
        out_of_scope: item.out_of_scope || false,
        assigned_type: editForm.assigned_id === "" ? null : "device",
        assigned_id: editForm.assigned_id === "" ? null : editForm.assigned_id,
      });
      await load();
      setMessage("IP aktualisiert.");
      setError("");
      setEditingId(null);
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

  const assignDevice = async (item: IPAddress, target: number | "") => {
    try {
      setAssignSavingId(item.id);
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
    } finally {
      setAssignSavingId(null);
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
      <form onSubmit={submit} className="card grid gap-3 md:grid-cols-6">
        <div className="field md:col-span-2">
          <label className="field-label" htmlFor="ip-address">IP-Adresse</label>
          <input id="ip-address" className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="10.10.0.12" />
        </div>
        <div className="field md:col-span-2">
          <label className="field-label" htmlFor="ip-dns">DNS Name</label>
          <input id="ip-dns" className="input" value={form.dns_name} onChange={(e) => setForm({ ...form, dns_name: e.target.value })} placeholder="server01.example.local" />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="ip-status">Status</label>
          <select id="ip-status" className="input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="reserved">reserved</option>
            <option value="assigned">assigned</option>
            <option value="free">free</option>
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="ip-vrf">VRF</label>
          <input
            id="ip-vrf"
            className="input"
            type="number"
            min={1}
            value={form.vrf_id}
            onChange={(e) => setForm({ ...form, vrf_id: Number(e.target.value) || 1 })}
          />
        </div>
        <div className="field md:col-span-2">
          <label className="field-label" htmlFor="ip-assign-type">Zuweisung</label>
          <select
            id="ip-assign-type"
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
        </div>
        {form.assigned_type === "device" && (
          <div className="field md:col-span-2">
            <label className="field-label" htmlFor="ip-assign-device">Geraet</label>
            <select
              id="ip-assign-device"
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
          </div>
        )}
        <div className="flex items-end">
          <button className="btn w-full md:w-auto" type="submit" disabled={saving}>{saving ? "Speichert..." : "IP speichern"}</button>
        </div>
      </form>
      <form onSubmit={submitBulkReserve} className="card grid gap-3 md:grid-cols-4">
        <div className="field">
          <label className="field-label" htmlFor="bulk-start-ip">Start-IP</label>
          <input id="bulk-start-ip" className="input" value={bulkForm.start_ip} onChange={(e) => setBulkForm({ ...bulkForm, start_ip: e.target.value })} placeholder="10.10.0.100" />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="bulk-end-ip">End-IP</label>
          <input id="bulk-end-ip" className="input" value={bulkForm.end_ip} onChange={(e) => setBulkForm({ ...bulkForm, end_ip: e.target.value })} placeholder="10.10.0.120" />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="bulk-description">Beschreibung</label>
          <input id="bulk-description" className="input" value={bulkForm.description} onChange={(e) => setBulkForm({ ...bulkForm, description: e.target.value })} placeholder="optional" />
        </div>
        <div className="flex items-end">
          <button className="btn w-full md:w-auto" type="submit">Bereich reservieren</button>
        </div>
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
              <Fragment key={item.id}>
                <tr className="border-b">
                  <td className="p-2 font-semibold">{item.address}</td>
                  <td className="p-2">{item.status}</td>
                  <td className="p-2">{item.dns_name || "-"}</td>
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      <select
                        className="input h-8 py-1 text-xs"
                        value={assignTargets[item.id] ?? ""}
                        onChange={(e) =>
                          {
                            const nextTarget = e.target.value ? Number(e.target.value) : "";
                            setAssignTargets((prev) => ({
                              ...prev,
                              [item.id]: nextTarget,
                            }));
                            void assignDevice(item, nextTarget);
                          }
                        }
                        disabled={assignSavingId === item.id}
                      >
                        <option value="">kein Geraet</option>
                        {devices.map((device) => (
                          <option key={device.id} value={device.id}>
                            {device.name}
                          </option>
                        ))}
                      </select>
                      {assignSavingId === item.id && <span className="text-xs text-slate-500">Speichert...</span>}
                    </div>
                  </td>
                  <td className="p-2">
                    {editingId === item.id ? (
                      <button type="button" className="btn-secondary mr-2 px-2 py-1 text-xs" onClick={() => setEditingId(null)}>Abbrechen</button>
                    ) : (
                      <button type="button" className="btn-secondary mr-2 px-2 py-1 text-xs" onClick={() => startEdit(item)}>Bearbeiten</button>
                    )}
                    <button type="button" className="btn-danger px-2 py-1 text-xs" onClick={() => void deleteIp(item)}>Loeschen</button>
                  </td>
                </tr>
                {editingId === item.id && (
                  <tr className="border-b bg-slate-50/80">
                    <td className="p-2" colSpan={5}>
                      <div className="grid gap-2 md:grid-cols-4">
                        <input
                          className="input"
                          value={editForm.address}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, address: e.target.value }))}
                          placeholder="IP-Adresse"
                        />
                        <input
                          className="input"
                          value={editForm.dns_name}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, dns_name: e.target.value }))}
                          placeholder="DNS Name"
                        />
                        <select
                          className="input"
                          value={editForm.assigned_id}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, assigned_id: e.target.value ? Number(e.target.value) : "" }))}
                        >
                          <option value="">kein Geraet</option>
                          {devices.map((device) => (
                            <option key={`edit-device-${device.id}`} value={device.id}>{device.name}</option>
                          ))}
                        </select>
                        <button type="button" className="btn" onClick={() => void saveEdit(item)}>
                          Speichern
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
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

