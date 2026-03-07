import { Link, useLocation } from "react-router-dom";

type RouteMeta = {
  title: string;
  step: string;
  next?: { to: string; label: string };
};

const ROUTES: Array<{ match: (path: string) => boolean; meta: RouteMeta }> = [
  {
    match: (path) => path === "/",
    meta: {
      title: "Startseite",
      step: "Schritt 1 von 4: Grundlagen anlegen",
      next: { to: "/ipam/vrfs", label: "Weiter: Netzraeume" },
    },
  },
  {
    match: (path) => path.startsWith("/ipam/vrfs"),
    meta: {
      title: "Netzraeume (VRF)",
      step: "Schritt 1 von 4: Netzraum definieren",
      next: { to: "/ipam/prefixes", label: "Weiter: Netzbereiche" },
    },
  },
  {
    match: (path) => path.startsWith("/ipam/prefixes"),
    meta: {
      title: "Netzbereiche",
      step: "Schritt 2 von 4: CIDR-Bereiche erfassen",
      next: { to: "/ipam/ips", label: "Weiter: IP-Adressen" },
    },
  },
  {
    match: (path) => path.startsWith("/ipam/ips"),
    meta: {
      title: "IP-Adressen",
      step: "Schritt 3 von 4: Adressen reservieren oder zuweisen",
      next: { to: "/devices", label: "Weiter: Geraete pflegen" },
    },
  },
  {
    match: (path) => path.startsWith("/devices"),
    meta: {
      title: "Geraete",
      step: "Schritt 4 von 4: Infrastruktur verknuepfen",
      next: { to: "/cabling", label: "Weiter: Verkabelung" },
    },
  },
  {
    match: (path) => path.startsWith("/cabling"),
    meta: {
      title: "Verkabelung",
      step: "Infrastruktur: Verbindungen herstellen",
      next: { to: "/reports", label: "Weiter: Qualitaetspruefung" },
    },
  },
  {
    match: (path) => path.startsWith("/reports"),
    meta: {
      title: "Auswertungen",
      step: "Pruefung: Datenqualitaet und Konflikte",
    },
  },
];

function getRouteMeta(pathname: string): RouteMeta {
  const entry = ROUTES.find((item) => item.match(pathname));
  return (
    entry?.meta || {
      title: "Arbeitsbereich",
      step: "Arbeitsmodus",
    }
  );
}

export function AppTopbar() {
  const location = useLocation();
  const meta = getRouteMeta(location.pathname);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
      <div>
        <p className="text-base font-semibold text-ink">{meta.title}</p>
        <p className="text-sm text-slate-600">{meta.step}</p>
      </div>
      {meta.next && (
        <Link className="btn-secondary" to={meta.next.to}>
          {meta.next.label}
        </Link>
      )}
    </div>
  );
}
