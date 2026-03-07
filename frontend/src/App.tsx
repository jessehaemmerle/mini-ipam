import { useState } from "react";
import { Route, Routes } from "react-router-dom";

import { AppTopbar } from "./components/layout/AppTopbar";
import { Sidebar } from "./components/layout/Sidebar";
import { SettingsProvider } from "./context/SettingsContext";
import { AdminPage } from "./pages/AdminPage";
import { CablingPage } from "./pages/CablingPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DevicesPage } from "./pages/DevicesPage";
import { IPsPage } from "./pages/IPsPage";
import { PowerPage } from "./pages/PowerPage";
import { PrefixesPage } from "./pages/PrefixesPage";
import { RacksPage } from "./pages/RacksPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { SitesPage } from "./pages/SitesPage";
import { VLANsPage } from "./pages/VLANsPage";
import { VRFsPage } from "./pages/VRFsPage";

function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <SettingsProvider>
      <div className="flex min-h-screen bg-surface/30">
        <Sidebar
          mobileOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          onToggle={() => setMobileMenuOpen((prev) => !prev)}
        />
        <main className="flex-1 overflow-y-auto p-4 pt-16 md:p-6 md:pt-6">
          <div className="mx-auto w-full max-w-[1400px] space-y-4">
            <AppTopbar />
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/ipam/prefixes" element={<PrefixesPage />} />
              <Route path="/ipam/ips" element={<IPsPage />} />
              <Route path="/ipam/vrfs" element={<VRFsPage />} />
              <Route path="/vlans" element={<VLANsPage />} />
              <Route path="/sites" element={<SitesPage />} />
              <Route path="/racks" element={<RacksPage />} />
              <Route path="/devices" element={<DevicesPage />} />
              <Route path="/cabling" element={<CablingPage />} />
              <Route path="/power" element={<PowerPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </div>
        </main>
      </div>
    </SettingsProvider>
  );
}

export default App;

