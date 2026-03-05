import { FormEvent, useState } from "react";

import { formPost, get, post } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";

export function AdminPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [login, setLogin] = useState({ username: "admin", password: "admin" });
  const [file, setFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<"prefixes" | "ipaddresses" | "vlans">("prefixes");

  const submitLogin = async (e: FormEvent) => {
    e.preventDefault();
    await post("/auth/login", login);
  };

  const submitSearch = async () => {
    setResult(await get<Record<string, unknown>>("/search", { q: query }));
  };

  const importCsv = async () => {
    if (!file) return;
    const data = new FormData();
    data.append("file", file);
    setResult(await formPost<Record<string, unknown>>(`/ipam/import/${importType}`, data));
  };

  const exportCsv = (type: "prefixes" | "ipaddresses" | "vlans") => {
    window.open(`/api/ipam/export/${type}`, "_blank");
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Admin" subtitle="Lokale Anmeldung, Suche, CSV Import" />

      <form className="card flex flex-wrap gap-2" onSubmit={submitLogin}>
        <input className="input" value={login.username} onChange={(e) => setLogin({ ...login, username: e.target.value })} />
        <input className="input" type="password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
        <button className="btn" type="submit">Login</button>
      </form>

      <div className="card flex gap-2">
        <input className="input flex-1" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search IP/Prefix/VLAN/Device/Rack/Cable" />
        <button className="btn" onClick={submitSearch}>Search</button>
      </div>

      <div className="card flex flex-wrap gap-2">
        <select className="input" value={importType} onChange={(e) => setImportType(e.target.value as "prefixes" | "ipaddresses" | "vlans")}>
          <option value="prefixes">prefixes</option>
          <option value="ipaddresses">ipaddresses</option>
          <option value="vlans">vlans</option>
        </select>
        <input className="input" type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <button className="btn" onClick={importCsv}>Import CSV</button>
      </div>

      <div className="card flex flex-wrap gap-2">
        <button className="btn" onClick={() => exportCsv("prefixes")}>Export Prefixes CSV</button>
        <button className="btn" onClick={() => exportCsv("ipaddresses")}>Export IPs CSV</button>
        <button className="btn" onClick={() => exportCsv("vlans")}>Export VLANs CSV</button>
      </div>

      <div className="card whitespace-pre-wrap text-xs">{JSON.stringify(result, null, 2)}</div>
    </div>
  );
}

