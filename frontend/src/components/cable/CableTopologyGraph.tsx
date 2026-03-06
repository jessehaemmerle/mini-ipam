import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";

type CableEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
};

type Props = {
  nodes: Array<{ id: string; label: string }>;
  edges: CableEdge[];
};

export function CableTopologyGraph({ nodes, edges }: Props) {
  const width = 1100;
  const height = 420;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

  const defaults = useMemo(() => {
    const byType: Record<string, Array<{ id: string }>> = { interface: [], patch_port: [], other: [] };
    nodes.forEach((node) => {
      const type = node.id.split(":")[0];
      if (type === "interface") byType.interface.push(node);
      else if (type === "patch_port") byType.patch_port.push(node);
      else byType.other.push(node);
    });

    const columns = [
      { key: "interface", x: 280 },
      { key: "patch_port", x: 820 },
      { key: "other", x: 550 },
    ] as const;
    const next: Record<string, { x: number; y: number }> = {};

    columns.forEach((column) => {
      const list = byType[column.key];
      const gap = Math.max(54, Math.floor((height - 96) / Math.max(list.length, 1)));
      list.forEach((node, idx) => {
        next[node.id] = {
          x: column.x,
          y: 56 + idx * gap,
        };
      });
    });

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
    const nextX = Math.max(60, Math.min(width - 60, p.x + drag.dx));
    const nextY = Math.max(30, Math.min(height - 30, p.y + drag.dy));
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

  const grouped = new Map<string, CableEdge[]>();
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
        <p>Knoten ziehen zum Umordnen. Interface links, Patch-Port rechts. Mehrfachkabel sind parallel gekruemmt.</p>
        <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={resetLayout}>
          Layout zuruecksetzen
        </button>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="h-[28rem] w-full rounded-lg border border-slate-300 bg-white"
        style={{ touchAction: "none", userSelect: "none" }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <rect x="0" y="0" width={width} height={height} fill="#ffffff" />
        <line x1="550" y1="18" x2="550" y2={height - 18} stroke="#e2e8f0" strokeDasharray="5 5" />
        <text x="280" y="20" fontSize="11" textAnchor="middle" fill="#475569">Interfaces</text>
        <text x="820" y="20" fontSize="11" textAnchor="middle" fill="#475569">Patch Ports</text>
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
          const offset = (meta.idx - (meta.total - 1) / 2) * 18;
          const cx = mx + nx * offset;
          const cy = my + ny * offset;
          return (
            <g key={`${edge.from}-${edge.to}-${idx}`}>
              <path d={`M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`} fill="none" stroke="#ea5c2b" strokeWidth="2.5" />
              <rect x={cx - 46} y={cy - 18} width="92" height="14" rx="4" fill="#fff7ed" opacity="0.95" />
              <text x={cx} y={cy - 8} fontSize="10" textAnchor="middle" fill="#7c2d12">
                {edge.label}
              </text>
            </g>
          );
        })}
        {nodes.map((node) => {
          const pos = byId[node.id];
          if (!pos) return null;
          return (
            <g key={node.id} onPointerDown={(event) => onNodePointerDown(event, node.id)} className="cursor-grab">
              <title>{node.label}</title>
              <rect x={pos.x - 58} y={pos.y - 18} width="116" height="36" rx="7" fill="#1d6b4f" />
              <text x={pos.x} y={pos.y + 4} fontSize="10" textAnchor="middle" fill="#fff">
                {node.label.length > 24 ? `${node.label.slice(0, 24)}...` : node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
