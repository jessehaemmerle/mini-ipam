type CableEdge = {
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

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-96 w-full rounded-lg border border-slate-300 bg-white">
      {edges.map((edge, idx) => {
        const from = byId[edge.from];
        const to = byId[edge.to];
        if (!from || !to) return null;
        return (
          <g key={`${edge.from}-${edge.to}-${idx}`}>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#ea5c2b" strokeWidth="2.5" />
            <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 6} fontSize="10" textAnchor="middle" fill="#7c2d12">
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

