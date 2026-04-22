import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import PosPage from './modules/pos/PosPage';
import InventoryPage from './modules/inventory/InventoryPage';
import FiscalPage from './modules/fiscal/FiscalPage';
import LoginPage from './modules/auth/LoginPage';

import FinancePage from './modules/finance/FinancePage';
import UsersPage from './modules/users/UsersPage';
import SettingsPage from './modules/settings/SettingsPage';
import ProductionPage from './modules/production/ProductionPage';
import QuotationsPage from './modules/quotations/QuotationsPage';

import TimeClockPage from './modules/clock/TimeClockPage';
import DashboardPage from './modules/dashboard/DashboardPage';
import { supabase } from './lib/supabase';

// Placeholder Pages


import SetupPage from './modules/setup/SetupPage';

function App() {
  const [user, setUser] = useState(null); // { name, role }
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [hasProAccess, setHasProAccess] = useState(false);

  useEffect(() => {
    async function checkSetup() {
      try {
        let code = "";
        if (window.electronAPI) {
          code = await window.electronAPI.invoke("db:get-setting", "company_code");
        } else {
          code = localStorage.getItem("company_code");
        }
        
        if (code && code.trim() !== "") {
          setIsSetupComplete(true);
          
          // Verificar licencia para habilitar módulos Pro
          try {
            const { data: comp } = await supabase
              .from('companies')
              .select('max_devices, status')
              .eq('company_code', code.trim())
              .single();
            
            if (comp) {
              const isPro = comp.max_devices >= 3 || comp.status === 'DEMO';
              setHasProAccess(isPro);
            }
          } catch (licenseErr) {
            console.error("Error validando licencia:", licenseErr);
          }
        }
      } catch (e) {
        console.error("Error validando configuración:", e);
      } finally {
        setLoadingConfig(false);
      }
    }
    checkSetup();
  }, []);

  if (loadingConfig) {
    return <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-500">Cargando sistema...</div>;
  }

  if (!isSetupComplete) {
    return <SetupPage onSetupComplete={() => setIsSetupComplete(true)} />;
  }

  if (!user) {
      return <LoginPage onLogin={setUser} />;
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MainLayout user={user} hasProAccess={hasProAccess} onLogout={() => setUser(null)} />}>
          <Route index element={<DashboardPage />} />
          <Route path="pos" element={<PosPage user={user} />} />
          <Route path="quotations" element={<QuotationsPage user={user} />} />
          
          {/* Inventory: Visible to Admin, Cashier, Production */}
          <Route path="inventory" element={(user.role === 'ADMIN' || user.role === 'CASHIER' || user.role === 'PRODUCTION') ? <InventoryPage /> : <Navigate to="/" />} />
          
          {/* Production: Admin + Production */}
          <Route path="production" element={(user.role === 'ADMIN' || user.role === 'PRODUCTION') ? <ProductionPage /> : <Navigate to="/" />} />
          
          {/* Admin Only */}
          <Route path="fiscal" element={(user.role === 'ADMIN' && hasProAccess) ? <FiscalPage /> : <Navigate to="/" />} />
          <Route path="finance" element={user.role === 'ADMIN' ? <FinancePage /> : <Navigate to="/" />} />
          <Route path="users" element={user.role === 'ADMIN' ? <UsersPage /> : <Navigate to="/" />} />
          <Route path="settings" element={user.role === 'ADMIN' ? <SettingsPage hasProAccess={hasProAccess} /> : <Navigate to="/" />} />

          <Route path="timeclock" element={hasProAccess ? <TimeClockPage /> : <Navigate to="/" />} /> 
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
