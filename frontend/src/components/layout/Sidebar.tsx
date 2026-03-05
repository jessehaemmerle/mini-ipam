import { NavLink } from "react-router-dom";

import { useSettings } from "../../context/SettingsContext";

export function Sidebar() {
  const { labels } = useSettings();
  const nav = [
    [labels.nav.dashboard, "/"],
    [labels.nav.prefixes, "/ipam/prefixes"],
    [labels.nav.ips, "/ipam/ips"],
    [labels.nav.vrfs, "/ipam/vrfs"],
    [labels.nav.vlans, "/vlans"],
    [labels.nav.sites, "/sites"],
    [labels.nav.racks, "/racks"],
    [labels.nav.devices, "/devices"],
    [labels.nav.cabling, "/cabling"],
    [labels.nav.power, "/power"],
    [labels.nav.reports, "/reports"],
    [labels.nav.admin, "/admin"],
    [labels.nav.settings, "/settings"],
  ];

  return (
    <aside className="app-sidebar w-60 border-r border-slate-200 bg-white p-4">
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

