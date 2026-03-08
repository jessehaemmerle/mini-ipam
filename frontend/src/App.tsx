import { useState } from "react";
import { Route, Routes } from "react-router-dom";

import { AppTopbar } from "./components/layout/AppTopbar";
import { Sidebar } from "./components/layout/Sidebar";
import { SettingsProvider } from "./context/SettingsContext";
import { AdminPage } from "./pages/AdminPage";
import { DashboardPage } from "./pages/DashboardPage";
import { IPsPage } from "./pages/IPsPage";
import { PrefixesPage } from "./pages/PrefixesPage";
import { SettingsPage } from "./pages/SettingsPage";
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

