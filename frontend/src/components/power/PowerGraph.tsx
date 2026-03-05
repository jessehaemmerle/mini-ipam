type Node = {
  id: string;
  label: string;
};

type Edge = {
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

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-96 w-full rounded-lg border border-slate-300 bg-white">
      {edges.map((edge, idx) => {
        const from = byId[edge.from];
        const to = byId[edge.to];
        if (!from || !to) return null;
        return (
          <g key={`${edge.from}-${edge.to}-${idx}`}>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#1d6b4f" strokeWidth="3" />
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

