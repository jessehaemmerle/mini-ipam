import { FormEvent, useState } from "react";

import { get, post } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";

export function PowerPage() {
  const [rackId, setRackId] = useState(1);
  const [map, setMap] = useState<any[]>([]);
  const [form, setForm] = useState({ src_type: "power_inlet", src_id: 1, dst_type: "pdu_outlet", dst_id: 1 });

  const loadMap = async () => setMap(await get<any[]>(`/dcim/power/map/rack/${rackId}`));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await post("/dcim/power/connections", form);
    loadMap();
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Power" subtitle="PDU/UPS/Circuit Mapping und Orphans" />
      <form className="card flex gap-2" onSubmit={submit}>
        <input className="input w-28" value={form.src_type} onChange={(e) => setForm({ ...form, src_type: e.target.value })} />
        <input className="input w-20" type="number" value={form.src_id} onChange={(e) => setForm({ ...form, src_id: Number(e.target.value) })} />
        <input className="input w-28" value={form.dst_type} onChange={(e) => setForm({ ...form, dst_type: e.target.value })} />
        <input className="input w-20" type="number" value={form.dst_id} onChange={(e) => setForm({ ...form, dst_id: Number(e.target.value) })} />
        <button className="btn" type="submit">Connect</button>
      </form>
      <div className="card flex gap-2">
        <input className="input w-20" type="number" value={rackId} onChange={(e) => setRackId(Number(e.target.value))} />
        <button className="btn" onClick={loadMap}>Load Rack Power Map</button>
      </div>
      <div className="card whitespace-pre-wrap text-sm">{JSON.stringify(map, null, 2)}</div>
    </div>
  );
}

