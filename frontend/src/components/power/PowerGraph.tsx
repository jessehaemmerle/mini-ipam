import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";

type Node = {
  id: string;
  label: string;
  kind?: "device" | "endpoint";
};

type Edge = {
  id: string;
  from: string;
  to: string;
  kind?: "association" | "connection";
};

type Props = {
  nodes: Node[];
  edges: Edge[];
};

export function PowerGraph({ nodes, edges }: Props) {
  const width = 1200;
  const height = 430;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

  const defaults = useMemo(() => {
    const deviceNodes = nodes.filter((node) => node.kind === "device");
    const endpointNodes = nodes.filter((node) => node.kind !== "device");
    const next: Record<string, { x: number; y: number }> = {};
    const placeColumn = (items: Node[], x: number) => {
      const gap = Math.max(50, Math.floor((height - 92) / Math.max(items.length, 1)));
      items.forEach((node, idx) => {
        next[node.id] = { x, y: 52 + idx * gap };
      });
    };
    placeColumn(deviceNodes, 310);
    placeColumn(endpointNodes, 890);
    return next;
  }, [nodes]);

  useEffect(() => {
    setPositions((prev) => {
      const next: Record<string, { x: number; y: number }> = {};
      nodes.forEach((node) => {
        next[node.id] = prev[node.id] || defaults[node.id];
      });
      return next;
    });
  }, [nodes, defaults]);

  const byId = Object.fromEntries(
    nodes.map((node) => [node.id, { ...node, ...(positions[node.id] || defaults[node.id]) }])
  );

  const toSvgPoint = (event: PointerEvent<SVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: ((event.clientX - rect.left) / rect.width) * width,
      y: ((event.clientY - rect.top) / rect.height) * height,
    };
  };

  const onNodePointerDown = (event: PointerEvent<SVGGElement>, nodeId: string) => {
    event.preventDefault();
    const current = byId[nodeId];
    if (!current) return;
    const p = toSvgPoint(event);
    dragRef.current = { id: nodeId, dx: current.x - p.x, dy: current.y - p.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    const p = toSvgPoint(event);
    const nextX = Math.max(66, Math.min(width - 66, p.x + drag.dx));
    const nextY = Math.max(28, Math.min(height - 28, p.y + drag.dy));
    setPositions((prev) => ({
      ...prev,
      [drag.id]: { x: nextX, y: nextY },
    }));
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const resetLayout = () => {
    setPositions(defaults);
  };

  const grouped = new Map<string, Edge[]>();
  for (const edge of edges) {
    const key = [edge.from, edge.to].sort().join("::");
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(edge);
  }
  const edgeMeta = new Map<string, { idx: number; total: number }>();
  for (const list of grouped.values()) {
    list.forEach((edge, idx) => edgeMeta.set(edge.id, { idx, total: list.length }));
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <p>Gerichtete Ansicht: Devices links, Endpunkte rechts. Gestrichelt = Zugehoerigkeit, Voll = echte Verbindung.</p>
        <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={resetLayout}>
          Layout zuruecksetzen
        </button>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="h-[30rem] w-full rounded-lg border border-slate-300 bg-white"
        style={{ touchAction: "none", userSelect: "none" }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <line x1="600" y1="16" x2="600" y2={height - 16} stroke="#e2e8f0" strokeDasharray="6 6" />
        <text x="310" y="22" fontSize="11" textAnchor="middle" fill="#475569">Devices</text>
        <text x="890" y="22" fontSize="11" textAnchor="middle" fill="#475569">Power Endpoints</text>
        {edges.map((edge, idx) => {
          const from = byId[edge.from];
          const to = byId[edge.to];
          if (!from || !to) return null;
          const meta = edgeMeta.get(edge.id) || { idx: 0, total: 1 };
          const mx = (from.x + to.x) / 2;
          const my = (from.y + to.y) / 2;
          const dx = to.x - from.x;
          const dy = to.y - from.y;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len;
          const ny = dx / len;
          const offset = (meta.idx - (meta.total - 1) / 2) * 16;
          const cx = mx + nx * offset;
          const cy = my + ny * offset;
          return (
            <g key={`${edge.from}-${edge.to}-${idx}`}>
              <path
                d={`M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`}
                fill="none"
                stroke={edge.kind === "association" ? "#64748b" : "#1d6b4f"}
                strokeWidth={edge.kind === "association" ? "1.8" : "3"}
                strokeDasharray={edge.kind === "association" ? "5 4" : "0"}
              />
            </g>
          );
        })}
        {nodes.map((node) => {
          const pos = byId[node.id];
          if (!pos) return null;
          return (
            <g key={node.id} onPointerDown={(event) => onNodePointerDown(event, node.id)} className="cursor-grab">
              <title>{node.label}</title>
              {node.kind === "device" ? (
                <rect x={pos.x - 66} y={pos.y - 18} width="132" height="36" rx="7" fill="#0f172a" />
              ) : (
                <ellipse cx={pos.x} cy={pos.y} rx="64" ry="20" fill="#1e293b" />
              )}
              <text x={pos.x} y={pos.y + 4} fontSize="10" textAnchor="middle" fill="#fff">
                {node.label.length > 28 ? `${node.label.slice(0, 28)}...` : node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
