import { FormEvent, useEffect, useMemo, useState } from "react";

import { del, extractApiError, get, post, put } from "../api/client";
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
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    const rackData = await get<Rack[]>("/dcim/racks");
    setRacks(rackData);
    const activeRack = selectedRack ?? rackData[0]?.id;
    if (activeRack) {
      setSelectedRack(activeRack);
      try {
        setPlacements(await get<RackPlacement[]>(`/dcim/rack-placements/${activeRack}`));
      } catch {
        setPlacements([]);
      }
      try {
        setDetail(await get<RackDetail>(`/dcim/racks/${activeRack}/detail`));
      } catch {
        setDetail(null);
      }
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const rack = useMemo(() => racks.find((r) => r.id === selectedRack), [racks, selectedRack]);
  const deviceNames = useMemo(
    () => Object.fromEntries((detail?.devices ?? []).map((d) => [d.device_id, d.name])),
    [detail]
  );

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await post("/dcim/racks", form);
      setForm({ ...form, name: "" });
      await load();
      setMessage("Rack gespeichert.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const editRack = async () => {
    const current = racks.find((r) => r.id === selectedRack);
    if (!current) return;
    const name = window.prompt("Rack Name", current.name);
    if (!name) return;
    const height = window.prompt("Height U", String(current.height_u));
    if (!height) return;
    try {
      await put(`/dcim/racks/${current.id}`, {
        site_id: current.site_id,
        room_id: null,
        name,
        height_u: Number(height),
        description: null,
      });
      await load();
      setMessage("Rack aktualisiert.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const deleteRack = async () => {
    const current = racks.find((r) => r.id === selectedRack);
    if (!current) return;
    if (!window.confirm(`Rack ${current.name} wirklich loeschen?`)) return;
    try {
      await del(`/dcim/racks/${current.id}`);
      await load();
      setMessage("Rack geloescht.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Racks" subtitle="Front/Rear SVG mit U-Slot-Placement" />
      <form className="card flex gap-2" onSubmit={submit}>
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Rack name" />
        <input className="input w-24" type="number" value={form.height_u} onChange={(e) => setForm({ ...form, height_u: Number(e.target.value) })} />
        <button className="btn" type="submit">Create Rack</button>
      </form>
      {message && <div className="card border border-green-200 bg-green-50 text-sm text-green-800">{message}</div>}
      {error && <div className="card border border-red-200 bg-red-50 text-sm text-red-800">{error}</div>}

      <div className="card flex flex-wrap items-center gap-2">
        <select
          className="input"
          value={selectedRack || ""}
          onChange={async (e) => {
            const id = Number(e.target.value);
            setSelectedRack(id);
            try {
              setPlacements(await get<RackPlacement[]>(`/dcim/rack-placements/${id}`));
            } catch {
              setPlacements([]);
            }
            try {
              setDetail(await get<RackDetail>(`/dcim/racks/${id}/detail`));
            } catch {
              setDetail(null);
            }
          }}
        >
          {racks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button type="button" className="btn" onClick={() => setFace(face === "front" ? "rear" : "front")}>Toggle {face === "front" ? "Rear" : "Front"}</button>
        <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => void editRack()}>Edit Rack</button>
        <button type="button" className="rounded border border-red-300 px-3 py-2 text-sm text-red-700" onClick={() => void deleteRack()}>Delete Rack</button>
      </div>

      {rack && <RackDiagram heightU={rack.height_u} placements={placements} face={face} deviceNames={deviceNames} />}

      {detail && (
        <div className="card">
          <h3 className="mb-2 text-lg font-semibold">Rack Health</h3>
          <div className="grid gap-2 md:grid-cols-3">
            <div><p className="muted">Assigned Devices</p><p className="font-semibold">{detail.devices.length}</p></div>
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
                {d.name} ({d.role}) | {d.placed ? `placed U${d.u_start} (${d.u_height}U)` : "unplaced"} | cable: {d.missing_cable ? "missing" : "ok"} | power: {d.missing_power ? "missing" : "ok"}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
