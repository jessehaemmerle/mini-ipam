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
  const height = 380;
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});

  const defaults = useMemo(() => {
    const spacing = Math.max(150, Math.floor((width - 160) / Math.max(nodes.length, 1)));
    return Object.fromEntries(
      nodes.map((node, index) => [
        node.id,
        {
          x: 80 + index * spacing,
          y: index % 2 === 0 ? 110 : 270,
        },
      ])
    );
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
    if (!dragRef.current) return;
    const p = toSvgPoint(event);
    const nextX = Math.max(66, Math.min(width - 66, p.x + dragRef.current.dx));
    const nextY = Math.max(28, Math.min(height - 28, p.y + dragRef.current.dy));
    setPositions((prev) => ({
      ...prev,
      [dragRef.current!.id]: { x: nextX, y: nextY },
    }));
  };

  const onPointerUp = () => {
    dragRef.current = null;
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
    <svg
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      className="h-96 w-full rounded-lg border border-slate-300 bg-white"
      style={{ touchAction: "none", userSelect: "none" }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
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
  );
}
