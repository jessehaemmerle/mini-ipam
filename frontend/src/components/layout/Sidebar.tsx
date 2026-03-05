import { NavLink } from "react-router-dom";

const nav = [
  ["Dashboard", "/"],
  ["Prefixes", "/ipam/prefixes"],
  ["IPs", "/ipam/ips"],
  ["VRFs", "/ipam/vrfs"],
  ["VLANs", "/vlans"],
  ["Sites", "/sites"],
  ["Racks", "/racks"],
  ["Devices", "/devices"],
  ["Cabling", "/cabling"],
  ["Power", "/power"],
  ["Reports", "/reports"],
  ["Admin", "/admin"]
];

export function Sidebar() {
  return (
    <aside className="w-60 border-r border-slate-200 bg-white p-4">
      <div className="mb-6 rounded-lg bg-ink p-3 text-white">
        <h1 className="text-lg font-bold">mini-ipam</h1>
        <p className="text-xs text-slate-300">IPAM-first DCIM</p>
      </div>
      <nav className="space-y-1">
        {nav.map(([label, to]) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `block rounded-md px-3 py-2 text-sm ${
                isActive ? "bg-brand text-white" : "text-slate-700 hover:bg-slate-100"
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

