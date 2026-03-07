import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";

type ThemeMode = "light" | "dark";
type Language = "de" | "en";

type Labels = {
  nav: {
    dashboard: string;
    prefixes: string;
    ips: string;
    vrfs: string;
    vlans: string;
    sites: string;
    racks: string;
    devices: string;
    cabling: string;
    power: string;
    reports: string;
    admin: string;
    settings: string;
  };
  settings: {
    title: string;
    subtitle: string;
    theme: string;
    darkMode: string;
    language: string;
    english: string;
    german: string;
  };
};

type SettingsContextValue = {
  theme: ThemeMode;
  language: Language;
  setTheme: (theme: ThemeMode) => void;
  setLanguage: (language: Language) => void;
  labels: Labels;
};

const STORAGE_THEME_KEY = "mini_ipam_theme";
const STORAGE_LANG_KEY = "mini_ipam_language";

const LABELS: Record<Language, Labels> = {
  de: {
    nav: {
      dashboard: "Start",
      prefixes: "Netzbereiche",
      ips: "IP-Adressen",
      vrfs: "Netzraeume (VRF)",
      vlans: "VLANs",
      sites: "Standorte",
      racks: "Racks",
      devices: "Geraete",
      cabling: "Verkabelung",
      power: "Strom",
      reports: "Reports",
      admin: "Admin",
      settings: "Einstellungen",
    },
    settings: {
      title: "Einstellungen",
      subtitle: "Darstellung und Sprache konfigurieren",
      theme: "Design",
      darkMode: "Dark Mode",
      language: "Sprache",
      english: "Englisch",
      german: "Deutsch",
    },
  },
  en: {
    nav: {
      dashboard: "Home",
      prefixes: "Network Prefixes",
      ips: "IP Addresses",
      vrfs: "Network Scopes (VRF)",
      vlans: "VLANs",
      sites: "Sites",
      racks: "Racks",
      devices: "Devices",
      cabling: "Cabling",
      power: "Power",
      reports: "Reports",
      admin: "Admin",
      settings: "Settings",
    },
    settings: {
      title: "Settings",
      subtitle: "Configure appearance and language",
      theme: "Theme",
      darkMode: "Dark mode",
      language: "Language",
      english: "English",
      german: "German",
    },
  },
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const stored = localStorage.getItem(STORAGE_THEME_KEY);
    return stored === "dark" ? "dark" : "light";
  });
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem(STORAGE_LANG_KEY);
    return stored === "en" ? "en" : "de";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_THEME_KEY, theme);
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(STORAGE_LANG_KEY, language);
    document.documentElement.setAttribute("lang", language);
  }, [language]);

  const value = useMemo<SettingsContextValue>(
    () => ({
      theme,
      language,
      setTheme: setThemeState,
      setLanguage: setLanguageState,
      labels: LABELS[language],
    }),
    [theme, language]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used inside SettingsProvider");
  return context;
}

