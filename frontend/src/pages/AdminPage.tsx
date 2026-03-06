import { FormEvent, useState } from "react";

import { formPost, post } from "../api/client";
import { GlobalSearchPanel } from "../components/common/GlobalSearchPanel";
import { PageHeader } from "../components/common/PageHeader";

export function AdminPage() {
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [login, setLogin] = useState({ username: "admin", password: "admin" });
  const [file, setFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<"prefixes" | "ipaddresses" | "vlans">("prefixes");

  const submitLogin = async (e: FormEvent) => {
    e.preventDefault();
    await post("/auth/login", login);
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

      <form className="card grid gap-3 md:grid-cols-3" onSubmit={submitLogin}>
        <div className="field">
          <label className="field-label" htmlFor="admin-user">Username</label>
          <input id="admin-user" className="input" value={login.username} onChange={(e) => setLogin({ ...login, username: e.target.value })} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="admin-pass">Password</label>
          <input id="admin-pass" className="input" type="password" value={login.password} onChange={(e) => setLogin({ ...login, password: e.target.value })} />
        </div>
        <div className="flex items-end">
          <button className="btn w-full md:w-auto" type="submit">Login</button>
        </div>
      </form>

      <GlobalSearchPanel />

      <div className="card flex flex-wrap items-end gap-2">
        <div className="field">
          <label className="field-label" htmlFor="admin-import-type">Import Typ</label>
          <select id="admin-import-type" className="input" value={importType} onChange={(e) => setImportType(e.target.value as "prefixes" | "ipaddresses" | "vlans")}>
            <option value="prefixes">prefixes</option>
            <option value="ipaddresses">ipaddresses</option>
            <option value="vlans">vlans</option>
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="admin-import-file">CSV Datei</label>
          <input id="admin-import-file" className="input" type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </div>
        <button className="btn" type="button" onClick={importCsv}>CSV importieren</button>
      </div>

      <div className="card flex flex-wrap gap-2">
        <button className="btn-secondary" type="button" onClick={() => exportCsv("prefixes")}>Prefixes CSV</button>
        <button className="btn-secondary" type="button" onClick={() => exportCsv("ipaddresses")}>IPs CSV</button>
        <button className="btn-secondary" type="button" onClick={() => exportCsv("vlans")}>VLANs CSV</button>
      </div>

      <div className="card whitespace-pre-wrap text-xs">{JSON.stringify(result, null, 2)}</div>
    </div>
  );
}
