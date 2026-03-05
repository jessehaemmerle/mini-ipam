import { FormEvent, useState } from "react";

import { get, post } from "../api/client";
import { CablePathGraph } from "../components/cable/CablePathGraph";
import { PageHeader } from "../components/common/PageHeader";

type PathResult = {
  nodes: string[];
  edges: { from: [string, number]; to: [string, number]; cable_id: number }[];
  table: { from: string; to: string; cable_id: number }[];
};

export function CablingPage() {
  const [path, setPath] = useState<PathResult | null>(null);
  const [lookup, setLookup] = useState({ endpoint_type: "interface", endpoint_id: 1 });
  const [form, setForm] = useState({ endpoint_a_type: "interface", endpoint_a_id: 1, endpoint_b_type: "patch_port", endpoint_b_id: 1, cable_type: "cat6", label: "" });

  const runLookup = async () => {
    const data = await get<PathResult>("/dcim/cable-path", lookup as unknown as Record<string, unknown>);
    setPath(data);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await post("/dcim/cables", { ...form, status: "active" });
    runLookup();
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Cabling" subtitle="Kabel-Liste und Path-Graph über Patchpanels" />
      <form className="card flex flex-wrap items-end gap-2" onSubmit={submit}>
        <input className="input w-28" value={form.endpoint_a_type} onChange={(e) => setForm({ ...form, endpoint_a_type: e.target.value })} />
        <input className="input w-24" type="number" value={form.endpoint_a_id} onChange={(e) => setForm({ ...form, endpoint_a_id: Number(e.target.value) })} />
        <input className="input w-28" value={form.endpoint_b_type} onChange={(e) => setForm({ ...form, endpoint_b_type: e.target.value })} />
        <input className="input w-24" type="number" value={form.endpoint_b_id} onChange={(e) => setForm({ ...form, endpoint_b_id: Number(e.target.value) })} />
        <input className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="label" />
        <button className="btn" type="submit">Create Cable</button>
      </form>

      <div className="card flex gap-2">
        <input className="input w-28" value={lookup.endpoint_type} onChange={(e) => setLookup({ ...lookup, endpoint_type: e.target.value })} />
        <input className="input w-24" type="number" value={lookup.endpoint_id} onChange={(e) => setLookup({ ...lookup, endpoint_id: Number(e.target.value) })} />
        <button className="btn" onClick={runLookup}>Show Path</button>
      </div>

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

