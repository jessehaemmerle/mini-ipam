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
  const height = 360;
  const spacing = Math.max(140, Math.floor((width - 160) / Math.max(nodes.length, 1)));
  const layout = nodes.map((node, index) => ({
    ...node,
    x: 80 + index * spacing,
    y: index % 2 === 0 ? 90 : 240,
  }));
  const byId = Object.fromEntries(layout.map((item) => [item.id, item]));

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
    <svg viewBox={`0 0 ${width} ${height}`} className="h-96 w-full rounded-lg border border-slate-300 bg-white">
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
            <text x={cx} y={cy - 6} fontSize="10" textAnchor="middle" fill="#7c2d12">
              {edge.label}
            </text>
          </g>
        );
      })}
      {layout.map((node) => (
        <g key={node.id}>
          <rect x={node.x - 58} y={node.y - 18} width="116" height="36" rx="7" fill="#1d6b4f" />
          <text x={node.x} y={node.y + 4} fontSize="10" textAnchor="middle" fill="#fff">
            {node.label.length > 24 ? `${node.label.slice(0, 24)}...` : node.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
