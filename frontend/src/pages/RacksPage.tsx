import { FormEvent, useEffect, useMemo, useState } from "react";

import { get, post } from "../api/client";
import { PageHeader } from "../components/common/PageHeader";
import { RackDiagram } from "../components/rack/RackDiagram";
import { Rack, RackDetail, RackPlacement } from "../types";

export function RacksPage() {
  const [racks, setRacks] = useState<Rack[]>([]);
  const [placements, setPlacements] = useState<RackPlacement[]>([]);
  const [detail, setDetail] = useState<RackDetail | null>(null);
  const [selectedRack, setSelectedRack] = useState<number | null>(null);
  const [face, setFace] = useState<"front" | "rear">("front");
  const [form, setForm] = useState({ site_id: 1, name: "", height_u: 42 });

  const load = async () => {
    const rackData = await get<Rack[]>("/dcim/racks");
    setRacks(rackData);
    const activeRack = selectedRack ?? rackData[0]?.id;
    if (activeRack) {
      setSelectedRack(activeRack);
      setPlacements(await get<RackPlacement[]>(`/dcim/rack-placements/${activeRack}`));
      setDetail(await get<RackDetail>(`/dcim/racks/${activeRack}/detail`));
    }
  };

  useEffect(() => {
    load();
  }, []);

  const rack = useMemo(() => racks.find((r) => r.id === selectedRack), [racks, selectedRack]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    await post("/dcim/racks", form);
    setForm({ ...form, name: "" });
    load();
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Racks" subtitle="Front/Rear SVG mit U-Slot-Placement" />
      <form className="card flex gap-2" onSubmit={submit}>
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Rack name" />
        <input className="input w-24" type="number" value={form.height_u} onChange={(e) => setForm({ ...form, height_u: Number(e.target.value) })} />
        <button className="btn" type="submit">Create Rack</button>
      </form>

      <div className="card flex flex-wrap items-center gap-2">
        <select
          className="input"
          value={selectedRack || ""}
          onChange={async (e) => {
            const id = Number(e.target.value);
            setSelectedRack(id);
            setPlacements(await get<RackPlacement[]>(`/dcim/rack-placements/${id}`));
            setDetail(await get<RackDetail>(`/dcim/racks/${id}/detail`));
          }}
        >
          {racks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button className="btn" onClick={() => setFace(face === "front" ? "rear" : "front")}>Toggle {face === "front" ? "Rear" : "Front"}</button>
      </div>

      {rack && <RackDiagram heightU={rack.height_u} placements={placements} face={face} />}

      {detail && (
        <div className="card">
          <h3 className="mb-2 text-lg font-semibold">Rack Health</h3>
          <div className="grid gap-2 md:grid-cols-3">
            <div><p className="muted">Placed Devices</p><p className="font-semibold">{detail.devices.length}</p></div>
            <div><p className="muted">Reserved U Slots</p><p className="font-semibold">{detail.reserved_slots.length}</p></div>
            <div>
              <p className="muted">Issues</p>
              <p className="font-semibold text-red-600">
                {detail.devices.filter((d) => d.missing_cable || d.missing_power).length}
              </p>
            </div>
          </div>
          <div className="mt-3 max-h-56 overflow-auto text-sm">
            {detail.devices.map((d) => (
              <div key={d.device_id} className="border-b p-2">
                {d.name} ({d.role}) | cable: {d.missing_cable ? "missing" : "ok"} | power: {d.missing_power ? "missing" : "ok"}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

