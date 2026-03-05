import { NavLink } from "react-router-dom";

import { useSettings } from "../../context/SettingsContext";

type SidebarProps = {
  mobileOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
};

export function Sidebar({ mobileOpen, onClose, onToggle }: SidebarProps) {
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
    <>
      <button
        type="button"
        onClick={onToggle}
        className="fixed left-3 top-3 z-40 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm lg:hidden"
      >
        Menu
      </button>
      {mobileOpen && (
        <button
          type="button"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          aria-label="Navigation schliessen"
        />
      )}
      <aside
        className={`app-sidebar fixed inset-y-0 left-0 z-50 w-64 border-r border-slate-200 bg-white p-4 transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 rounded-lg bg-ink p-3 text-white">
          <h1 className="text-lg font-bold">mini-ipam</h1>
          <p className="text-xs text-slate-300">IPAM-first DCIM</p>
        </div>
        <nav className="space-y-1">
          {nav.map(([label, to]) => (
            <NavLink
              key={to}
              to={to}
              onClick={onClose}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? "bg-brand text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}

