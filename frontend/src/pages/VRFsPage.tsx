import { FormEvent, useEffect, useState } from "react";

import { get, post } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";
import { Vrf } from "../types";

export function VRFsPage() {
  const [items, setItems] = useState<Vrf[]>([]);
  const [name, setName] = useState("");

  const load = () => get<Vrf[]>("/ipam/vrfs").then(setItems);
  useEffect(load, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await post("/ipam/vrfs", { name });
    setName("");
    load();
  };

  return (
    <div className="space-y-4">
      <PageHeader title="VRFs" subtitle="Einfacher VRF-Scope für Prefixes/IPs" />
      <form className="card flex gap-2" onSubmit={submit}>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        <button className="btn" type="submit">Add</button>
      </form>
      <div className="card grid gap-2">
        {items.map((item) => (
          <div key={item.id} className="rounded-md border border-slate-200 p-3">{item.name}</div>
        ))}
      </div>
    </div>
  );
}
