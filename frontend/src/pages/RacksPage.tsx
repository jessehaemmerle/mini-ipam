import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

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
  const [editingRack, setEditingRack] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", height_u: 42 });
  const [filters, setFilters] = useState({ q: "", minHeight: 0, healthOnly: false });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const diagramWrapperRef = useRef<HTMLDivElement | null>(null);

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
  const filteredRacks = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return racks.filter((rackItem) => {
      if (filters.minHeight > 0 && rackItem.height_u < filters.minHeight) return false;
      if (!q) return true;
      return rackItem.name.toLowerCase().includes(q) || String(rackItem.site_id).includes(q);
    });
  }, [racks, filters]);
  const deviceNames = useMemo(
    () => Object.fromEntries((detail?.devices ?? []).map((d) => [d.device_id, d.name])),
    [detail]
  );
  const filteredDetailDevices = useMemo(() => {
    if (!detail) return [];
    if (!filters.healthOnly) return detail.devices;
    return detail.devices.filter((d) => d.missing_cable || d.missing_power);
  }, [detail, filters.healthOnly]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || form.height_u < 1) {
      setError("Rack-Name und Hoehe >= 1 sind erforderlich.");
      setMessage("");
      return;
    }
    try {
      await post("/dcim/racks", { ...form, name: form.name.trim() });
      setForm({ ...form, name: "" });
      await load();
      setMessage("Rack gespeichert.");
      setError("");
    } catch (err: unknown) {
      setError(extractApiError(err));
      setMessage("");
    }
  };

  const startEditRack = () => {
    const current = racks.find((r) => r.id === selectedRack);
    if (!current) return;
    setEditForm({ name: current.name, height_u: current.height_u });
    setEditingRack(true);
    setMessage("");
    setError("");
  };

  const saveRack = async () => {
    const current = racks.find((r) => r.id === selectedRack);
    if (!current) return;
    if (!editForm.name.trim() || editForm.height_u < 1) {
      setError("Rack-Name und Hoehe >= 1 sind erforderlich.");
      setMessage("");
      return;
    }
    try {
      await put(`/dcim/racks/${current.id}`, {
        site_id: current.site_id,
        room_id: null,
        name: editForm.name.trim(),
        height_u: Number(editForm.height_u),
        description: null,
      });
      await load();
      setMessage("Rack aktualisiert.");
      setError("");
      setEditingRack(false);
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

  const exportRackSvg = () => {
    const svg = diagramWrapperRef.current?.querySelector("svg");
    if (!svg || !rack) return;
    const serializer = new XMLSerializer();
    const raw = serializer.serializeToString(svg);
    const blob = new Blob([raw], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${rack.name}-${face}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Racks" subtitle="Front/Rear SVG mit U-Slot-Placement" />
      <form className="card grid gap-3 md:grid-cols-4" onSubmit={submit}>
        <div className="field md:col-span-2">
          <label className="field-label" htmlFor="rack-name">Rack Name</label>
          <input id="rack-name" className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="z.B. Rack-A1" />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="rack-height">Hoehe (U)</label>
          <input id="rack-height" className="input" type="number" min={1} value={form.height_u} onChange={(e) => setForm({ ...form, height_u: Number(e.target.value) })} />
        </div>
        <div className="flex items-end">
          <button className="btn w-full md:w-auto" type="submit">Rack anlegen</button>
        </div>
      </form>
      {message && <div className="card border border-green-200 bg-green-50 text-sm text-green-800">{message}</div>}
      {error && <div className="card border border-red-200 bg-red-50 text-sm text-red-800">{error}</div>}

      <div className="card flex flex-wrap items-center gap-2">
        <input
          className="input"
          value={filters.q}
          onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
          placeholder="Rack-Filter Name/Site-ID"
        />
        <input
          className="input w-32"
          type="number"
          min={0}
          value={filters.minHeight}
          onChange={(e) => setFilters((prev) => ({ ...prev, minHeight: Number(e.target.value) }))}
          placeholder="Min U"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.healthOnly}
            onChange={(e) => setFilters((prev) => ({ ...prev, healthOnly: e.target.checked }))}
          />
          nur Probleme
        </label>
        <button type="button" className="btn-secondary" onClick={() => setFilters({ q: "", minHeight: 0, healthOnly: false })}>
          Filter zuruecksetzen
        </button>
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
          {filteredRacks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <button type="button" className="btn" onClick={() => setFace(face === "front" ? "rear" : "front")}>Toggle {face === "front" ? "Rear" : "Front"}</button>
        <button type="button" className="btn-secondary" onClick={exportRackSvg}>Export SVG</button>
        {editingRack ? (
          <>
            <button type="button" className="btn-secondary" onClick={() => setEditingRack(false)}>Abbrechen</button>
            <button type="button" className="btn" onClick={() => void saveRack()}>Speichern</button>
          </>
        ) : (
          <button type="button" className="btn-secondary" onClick={startEditRack}>Bearbeiten</button>
        )}
        <button type="button" className="btn-danger" onClick={() => void deleteRack()}>Loeschen</button>
      </div>
      {editingRack && (
        <div className="card grid gap-2 md:grid-cols-4">
          <input
            className="input md:col-span-2"
            value={editForm.name}
            onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Rack Name"
          />
          <input
            className="input"
            type="number"
            min={1}
            value={editForm.height_u}
            onChange={(e) => setEditForm((prev) => ({ ...prev, height_u: Number(e.target.value) }))}
            placeholder="Hoehe U"
          />
        </div>
      )}

      {rack && (
        <div ref={diagramWrapperRef}>
          <RackDiagram heightU={rack.height_u} placements={placements} face={face} deviceNames={deviceNames} />
        </div>
      )}

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
            {filteredDetailDevices.map((d) => (
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
