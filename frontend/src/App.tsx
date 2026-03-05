import { Route, Routes } from "react-router-dom";

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
  return (
    <SettingsProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-6">
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
        </main>
      </div>
    </SettingsProvider>
  );
}

export default App;

