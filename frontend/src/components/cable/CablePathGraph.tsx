import { PointerEvent, useEffect, useMemo, useRef, useState } from "react";

type Edge = { from: [string, number]; to: [string, number]; cable_id: number };

type Props = {
  nodes: string[];
  edges: Edge[];
};

export function CablePathGraph({ nodes, edges }: Props) {
  const width = 900;
  const height = 360;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

  const defaults = useMemo(() => {
    const spacing = Math.max(120, Math.floor((width - 140) / Math.max(nodes.length, 1)));
    return Object.fromEntries(
      nodes.map((id, idx) => [id, { x: 70 + idx * spacing, y: height / 2 }])
    );
  }, [nodes]);

  useEffect(() => {
    setPositions((prev) => {
      const next: Record<string, { x: number; y: number }> = {};
      nodes.forEach((id) => {
        next[id] = prev[id] || defaults[id];
      });
      return next;
    });
  }, [nodes, defaults]);

  const layout = nodes.map((id) => ({ id, ...(positions[id] || defaults[id]) }));

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
    const current = layout.find((item) => item.id === nodeId);
    if (!current) return;
    const p = toSvgPoint(event);
    dragRef.current = { id: nodeId, dx: current.x - p.x, dy: current.y - p.y };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const p = toSvgPoint(event);
    const nextX = Math.max(30, Math.min(width - 30, p.x + dragRef.current.dx));
    const nextY = Math.max(30, Math.min(height - 30, p.y + dragRef.current.dy));
    setPositions((prev) => ({
      ...prev,
      [dragRef.current!.id]: { x: nextX, y: nextY },
    }));
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const resetLayout = () => {
    setPositions(defaults);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
        <p>Pfadansicht in Reihenfolge. Knoten koennen fuer bessere Lesbarkeit verschoben werden.</p>
        <button type="button" className="btn-secondary px-2 py-1 text-xs" onClick={resetLayout}>
          Layout zuruecksetzen
        </button>
      </div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="h-80 w-full rounded-lg border border-slate-300 bg-white"
        style={{ touchAction: "none", userSelect: "none" }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        <line x1="30" y1={height / 2} x2={width - 30} y2={height / 2} stroke="#e2e8f0" strokeDasharray="6 6" />
        {edges.map((edge, idx) => {
          const from = layout.find((n) => n.id === `${edge.from[0]}:${edge.from[1]}`);
          const to = layout.find((n) => n.id === `${edge.to[0]}:${edge.to[1]}`);
          if (!from || !to) return null;
          return (
            <g key={`${edge.cable_id}-${idx}`}>
              <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#ea5c2b" strokeWidth="3" />
              <rect x={(from.x + to.x) / 2 - 18} y={(from.y + to.y) / 2 - 20} width="36" height="14" rx="4" fill="#fff7ed" />
              <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 10} fontSize="10" textAnchor="middle" fill="#7c2d12">
                C{edge.cable_id}
              </text>
            </g>
          );
        })}
        {layout.map((node) => (
          <g key={node.id} onPointerDown={(event) => onNodePointerDown(event, node.id)} className="cursor-grab">
            <title>{node.id}</title>
            <circle cx={node.x} cy={node.y} r="18" fill="#1d6b4f" />
            <text x={node.x} y={node.y + 34} fontSize="10" textAnchor="middle" fill="#0f172a">
              {node.id.length > 26 ? `${node.id.slice(0, 26)}...` : node.id}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

