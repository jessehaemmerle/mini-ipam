import { FormEvent, useEffect, useState } from "react";

import { extractApiError, get, post } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";
import { IPAddress } from "../types";

export function IPsPage() {
  const [items, setItems] = useState<IPAddress[]>([]);
  const [form, setForm] = useState({ address: "", vrf_id: 1, status: "reserved", dns_name: "" });
  const [message, setMessage] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const load = () => get<IPAddress[]>("/ipam/ips").then(setItems);

  useEffect(() => {
    void load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    try {
      await post("/ipam/ips", form);
      setForm({ ...form, address: "", dns_name: "" });
      await load();
      setMessage("IP erfolgreich gespeichert.");
    } catch (err: unknown) {
      setError(extractApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="IP Addresses" subtitle="Assignments, Reservierungen und DNS-Name" />
      <form onSubmit={submit} className="card flex flex-wrap items-end gap-2">
        <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="10.10.0.12" />
        <input className="input" value={form.dns_name} onChange={(e) => setForm({ ...form, dns_name: e.target.value })} placeholder="dns name" />
        <button className="btn" type="submit" disabled={saving}>{saving ? "Speichert..." : "Quick Reserve"}</button>
      </form>
      {message && <div className="card border border-green-200 bg-green-50 text-sm text-green-800">{message}</div>}
      {error && <div className="card border border-red-200 bg-red-50 text-sm text-red-800">{error}</div>}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="p-2">Address</th>
              <th className="p-2">Status</th>
              <th className="p-2">DNS</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b">
                <td className="p-2 font-semibold">{item.address}</td>
                <td className="p-2">{item.status}</td>
                <td className="p-2">{item.dns_name || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

