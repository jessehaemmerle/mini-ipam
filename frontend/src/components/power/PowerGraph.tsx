type Node = {
  id: string;
  label: string;
};

type Edge = {
  id: string;
  from: string;
  to: string;
};

type Props = {
  nodes: Node[];
  edges: Edge[];
};

export function PowerGraph({ nodes, edges }: Props) {
  const width = 1200;
  const height = 380;
  const spacing = Math.max(150, Math.floor((width - 160) / Math.max(nodes.length, 1)));
  const layout = nodes.map((node, index) => ({
    ...node,
    x: 80 + index * spacing,
    y: index % 2 === 0 ? 110 : 270,
  }));
  const byId = Object.fromEntries(layout.map((item) => [item.id, item]));

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
        const offset = (meta.idx - (meta.total - 1) / 2) * 16;
        const cx = mx + nx * offset;
        const cy = my + ny * offset;
        return (
          <g key={`${edge.from}-${edge.to}-${idx}`}>
            <path d={`M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`} fill="none" stroke="#1d6b4f" strokeWidth="3" />
          </g>
        );
      })}
      {layout.map((node) => (
        <g key={node.id}>
          <ellipse cx={node.x} cy={node.y} rx="64" ry="20" fill="#0f172a" />
          <text x={node.x} y={node.y + 4} fontSize="10" textAnchor="middle" fill="#fff">
            {node.label.length > 28 ? `${node.label.slice(0, 28)}...` : node.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
