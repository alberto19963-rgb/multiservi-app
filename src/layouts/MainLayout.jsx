import React, { useState } from 'react';
import { useLocation, Outlet, Link } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  FileText, 
  TrendingDown, 
  Settings, 
  LogOut,
  Factory,
  Users,
  DollarSign,
  Clock,
  Briefcase
} from 'lucide-react';
import QuickClockModal from '../components/QuickClockModal';

const SidebarItem = ({ to, icon, label, active }) => {
  const Icon = icon;
  return (
    <Link
      to={to}
      className={`flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${
        active 
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
          : 'text-gray-400 hover:bg-gray-800 hover:text-white'
      }`}
    >
      <Icon size={22} />
      <span className="font-medium">{label}</span>
    </Link>
  );
};

export default function MainLayout({ user, hasProAccess, onLogout }) {
  const location = useLocation();
  const isAdmin = user?.role === 'ADMIN';
  const isProduction = user?.role === 'PRODUCTION';
  const isCashier = user?.role === 'CASHIER';

  const [isClockOpen, setIsClockOpen] = useState(false);

  const handleLogout = async () => {
        try {
            if (window.electronAPI) {
                // Consultamos si hay un turno abierto para este usuario
                const activeShift = await window.electronAPI.invoke("db:get-active-shift", user.id);
                if (activeShift) {
                    alert("⚠️ SEGURIDAD: No puede cerrar sesión mientras tenga una caja abierta.\n\nPor favor, cierre su turno en el Punto de Venta antes de salir del sistema.");
                    return;
                }
            }
            onLogout();
        } catch (e) {
            console.error("Error validando cierre de caja:", e);
            onLogout(); // En caso de error crítico, permitimos salir para no bloquear al usuario
        }
    };

    return (
        <div className="flex h-screen w-screen bg-gray-900 text-gray-100 overflow-hidden font-sans relative">
            <QuickClockModal isOpen={isClockOpen} onClose={() => setIsClockOpen(false)} />

            {/* Sidebar */}
            <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col p-4 z-20">
                <div className="flex items-center space-x-3 px-4 py-4 mb-8">
                    <div className="w-10 h-10 bg-linear-to-tr from-blue-500 to-purple-600 rounded-full flex items-center justify-center font-bold text-xl text-white shadow-lg">
                        {user?.name?.charAt(0) || 'M'}
                    </div>
                    <div>
                        <h1 className="font-bold text-lg leading-tight truncate w-32">{user?.name}</h1>
                        <span className="text-xs text-gray-500">{user?.role}</span>
                    </div>
                </div>

                <nav className="flex-1 space-y-2 overflow-y-auto custom-scrollbar">
                    <SidebarItem to="/" icon={LayoutDashboard} label="Dashboard" active={location.pathname === '/'} />

                    {(isAdmin || isCashier) && (
                        <>
                            <SidebarItem to="/pos" icon={ShoppingCart} label="Punto de Venta" active={location.pathname === '/pos'} />
                            <SidebarItem to="/quotations" icon={FileText} label="Cotizaciones" active={location.pathname === '/quotations'} />
                        </>
                    )}
                    
                    <SidebarItem to="/inventory" icon={Package} label="Inventario" active={location.pathname === '/inventory'} />

                    {(isAdmin || isProduction) && (
                        <SidebarItem to="/production" icon={Factory} label="Producción" active={location.pathname === '/production'} />
                    )}

                    {isAdmin && (
                        <>
                            {hasProAccess && <SidebarItem to="/fiscal" icon={FileText} label="Fiscal / NCF" active={location.pathname === '/fiscal'} />}
                            <SidebarItem to="/finance" icon={DollarSign} label="Finanzas" active={location.pathname === '/finance'} />
                            <SidebarItem to="/users" icon={Users} label="Usuarios" active={location.pathname === '/users'} />

                        </>
                    )}

                    {hasProAccess && <SidebarItem to="/timeclock" icon={Clock} label="Recursos Humanos" active={location.pathname === '/timeclock'} />}
                </nav>

                <div className="mt-auto pt-4 border-t border-gray-800 space-y-2">
                    
                    {/* Quick Clock Button: Only visible in POS, Inventory, Production */}
                    {['/pos', '/inventory', '/production'].some(path => location.pathname.startsWith(path)) && (
                        <button 
                            onClick={() => setIsClockOpen(true)}
                            className="w-full flex items-center justify-center p-3 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 hover:text-white rounded-xl transition border border-blue-500/30 group mb-2"
                            title="Asistencia Rápida"
                        >
                            <div className="w-6 h-6 flex items-center justify-center font-bold border border-current rounded-full mr-3 group-hover:bg-blue-500 group-hover:border-transparent group-hover:text-white transition">A</div>
                            <span className="font-medium text-sm">Asistencia Rápida</span>
                        </button>
                    )}

                    {isAdmin && <SidebarItem to="/settings" icon={Settings} label="Configuración" active={location.pathname === '/settings'} />}
                    <button 
                        onClick={handleLogout}
                        className="flex w-full items-center space-x-3 px-4 py-3 text-red-400 hover:bg-red-500/10 hover:text-red-500 rounded-xl transition-colors">
                        <LogOut size={22} />
                        <span className="font-medium">Salir</span>
                    </button>
                </div>
            </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto bg-gray-50 text-gray-900 relative">
        <Outlet />
      </main>


    </div>
  );
}
