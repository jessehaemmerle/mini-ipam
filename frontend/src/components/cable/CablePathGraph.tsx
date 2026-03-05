type Edge = { from: [string, number]; to: [string, number]; cable_id: number };

type Props = {
  nodes: string[];
  edges: Edge[];
};

export function CablePathGraph({ nodes, edges }: Props) {
  const width = 900;
  const spacing = 150;
  const layout = nodes.map((id, idx) => ({ id, x: 100 + idx * spacing, y: idx % 2 === 0 ? 90 : 220 }));

  return (
    <svg viewBox={`0 0 ${width} 320`} className="h-80 w-full rounded-lg border border-slate-300 bg-white">
      {edges.map((edge, idx) => {
        const from = layout.find((n) => n.id === `${edge.from[0]}:${edge.from[1]}`);
        const to = layout.find((n) => n.id === `${edge.to[0]}:${edge.to[1]}`);
        if (!from || !to) return null;
        return (
          <g key={`${edge.cable_id}-${idx}`}>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#ea5c2b" strokeWidth="3" />
            <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 6} fontSize="10" fill="#7c2d12">
              C{edge.cable_id}
            </text>
          </g>
        );
      })}
      {layout.map((node) => (
        <g key={node.id}>
          <circle cx={node.x} cy={node.y} r="18" fill="#1d6b4f" />
          <text x={node.x} y={node.y + 32} fontSize="10" textAnchor="middle" fill="#0f172a">
            {node.id}
          </text>
        </g>
      ))}
    </svg>
  );
}

