import { NavLink } from "react-router-dom";

import { useSettings } from "../../context/SettingsContext";

type SidebarProps = {
  mobileOpen: boolean;
  onClose: () => void;
  onToggle: () => void;
};

export function Sidebar({ mobileOpen, onClose, onToggle }: SidebarProps) {
  const { labels } = useSettings();
  const navSections: Array<{ title: string; items: Array<[string, string]> }> = [
    {
      title: "Einstieg",
      items: [[labels.nav.dashboard, "/"]],
    },
    {
      title: "1. Netzwerk aufbauen",
      items: [
        [labels.nav.prefixes, "/ipam/prefixes"],
        [labels.nav.ips, "/ipam/ips"],
        [labels.nav.vrfs, "/ipam/vrfs"],
        [labels.nav.vlans, "/vlans"],
      ],
    },
    {
      title: "2. Infrastruktur erfassen",
      items: [
        [labels.nav.sites, "/sites"],
        [labels.nav.racks, "/racks"],
        [labels.nav.devices, "/devices"],
        [labels.nav.cabling, "/cabling"],
        [labels.nav.power, "/power"],
      ],
    },
    {
      title: "3. Pruefen & Verwalten",
      items: [
        [labels.nav.reports, "/reports"],
        [labels.nav.admin, "/admin"],
        [labels.nav.settings, "/settings"],
      ],
    },
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
        <div className="mb-4 border-b border-slate-200 pb-3">
          <p className="text-base font-semibold text-ink">mini-ipam</p>
          <p className="mt-1 text-sm text-slate-600">Arbeitsnavigation</p>
        </div>
        <div className="space-y-4">
          {navSections.map((section) => (
            <nav key={section.title} className="space-y-1" aria-label={section.title}>
              <p className="px-1 text-sm font-medium text-slate-500">{section.title}</p>
              {section.items.map(([label, to]) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `block rounded-md px-3 py-2 text-sm transition-colors ${
                      isActive ? "bg-brand text-white" : "text-slate-700 hover:bg-slate-100"
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
            </nav>
          ))}
        </div>
      </aside>
    </>
  );
}

