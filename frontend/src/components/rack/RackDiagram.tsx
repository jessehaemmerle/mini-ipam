import { RackPlacement } from "../../types";

type Props = {
  heightU: number;
  placements: RackPlacement[];
  face: "front" | "rear";
  deviceNames?: Record<number, string>;
};

const U_HEIGHT = 16;

export function RackDiagram({ heightU, placements, face, deviceNames = {} }: Props) {
  const width = 380;
  const height = heightU * U_HEIGHT + 40;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-[70vh] max-h-[760px] w-full rounded-lg border border-slate-300 bg-white">
      <rect x="20" y="20" width={width - 40} height={height - 30} fill="#f8fafc" stroke="#334155" />
      {Array.from({ length: heightU }).map((_, idx) => {
        const y = 20 + idx * U_HEIGHT;
        const u = heightU - idx;
        return (
          <g key={u}>
            {u % 2 === 0 && <rect x="20" y={y} width={width - 40} height={U_HEIGHT} fill="#f1f5f9" />}
            <line x1="20" y1={y} x2={width - 20} y2={y} stroke="#cbd5e1" />
            <text x="6" y={y + 12} fontSize="10" fill="#64748b">
              {u}U
            </text>
          </g>
        );
      })}
      {placements
        .filter((p) => p.face === face)
        .map((placement) => {
          const y = 20 + (heightU - placement.u_start - placement.u_height + 1) * U_HEIGHT;
          const label = placement.label || deviceNames[placement.device_id] || `Device ${placement.device_id}`;
          return (
            <g key={placement.id}>
              <rect x="28" y={y} width={width - 56} height={placement.u_height * U_HEIGHT} fill="#1d6b4f" opacity="0.9" rx="4" />
              <title>{`${label} | ${placement.u_start}-${placement.u_start + placement.u_height - 1}U`}</title>
              <text x="36" y={y + 14} fill="#fff" fontSize="11">
                {label.length > 42 ? `${label.slice(0, 42)}...` : label}
              </text>
            </g>
          );
        })}
    </svg>
  );
}

