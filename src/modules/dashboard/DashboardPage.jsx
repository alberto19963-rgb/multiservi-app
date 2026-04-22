import React, { useState, useEffect } from 'react';
import { db, system } from '../../api/electron';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Package, 
  Users, 
  Settings,
  AlertCircle,
  Cloud,
  CheckCircle2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ sales: 0, expenses: 0, net: 0, lowStock: 0 });
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [appVersion, setAppVersion] = useState('v1.0.0');

  useEffect(() => {
    // Clock
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
        setLoading(true);
        if (window.electronAPI) {
            const daily = await db.getDailyStats();
            const lowStock = await db.getLowStockCount();
            const version = await system.getVersion();
            
            setStats({
                ...daily,
                lowStock: lowStock || 0
            });
            setAppVersion(`v${version}`);
        } else {
            // Demo mode
            setStats({ sales: 15400, expenses: 3200, net: 12200, lowStock: 5 });
            setAppVersion('v0.0.6-demo');
        }
    } catch (e) {
        console.error("Dashboard Load Error:", e);
    } finally {
        setLoading(false);
    }
  };

  const statCards = [
    { title: 'Ventas de Hoy', value: stats.sales, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
    { title: 'Gastos de Hoy', value: stats.expenses, icon: TrendingDown, color: 'text-red-600', bg: 'bg-red-50' },
    { title: 'Beneficio Neto', value: stats.net, icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-50' },
  ];

  const quickActions = [
      { label: 'Nueva Venta', icon: ShoppingCart, path: '/pos', color: 'bg-blue-600 text-white hover:bg-blue-700' },
      { label: 'Ver Inventario', icon: Package, path: '/inventory', color: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50' },
      { label: 'Registrar Cliente', icon: Users, path: '/fiscal', color: 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50' },
  ];

  const formatMoney = (val) => {
      return Number(val || 0).toLocaleString('es-DO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <div className="p-8 h-full flex flex-col overflow-y-auto">
      
      {/* Welcome Section */}
      <div className="flex justify-between items-end mb-8">
          <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Panel Principal</h1>
              <p className="text-gray-500 text-lg">Bienvenido al sistema de Gestion Empresarial</p>
          </div>
          <div className="text-right">
              <p className="text-3xl font-mono font-bold text-gray-800">
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-gray-500 uppercase font-bold text-sm">
                  {currentTime.toLocaleDateString(['es-DO'], { weekday: 'long', day: 'numeric', month: 'long' })}
              </p>
          </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {statCards.map((stat, idx) => (
              <div key={idx} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center transition-transform hover:scale-105 cursor-pointer">
                  <div className={`p-4 rounded-xl ${stat.bg} mr-5`}>
                      <stat.icon className={stat.color} size={32} />
                  </div>
                  <div>
                      <p className="text-gray-500 font-medium mb-1">{stat.title}</p>
                      <h3 className="text-2xl font-bold text-gray-900">
                          {loading ? '...' : `RD$ ${formatMoney(stat.value)}`}
                      </h3>
                  </div>
              </div>
          ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 flex-1">
          
          {/* Quick Actions */}
          <div className="lg:col-span-2">
              <h2 className="text-xl font-bold text-gray-800 mb-5 flex items-center">
                  <Settings className="mr-2" size={20}/> Accesos Rápidos
              </h2>
              <div className="grid grid-cols-2 gap-4">
                  {quickActions.map((action, idx) => (
                      <button 
                        key={idx}
                        onClick={() => navigate(action.path)}
                        className={`p-6 rounded-2xl shadow-sm flex flex-col items-center justify-center transition-all ${action.color} h-40`}
                      >
                          <action.icon size={32} className="mb-3" />
                          <span className="font-bold text-lg">{action.label}</span>
                      </button>
                  ))}
                   {/* Create Expense Shortcut */}
                  <button 
                        onClick={() => navigate('/finance')}
                        className="p-6 rounded-2xl shadow-sm flex flex-col items-center justify-center transition-all bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 h-40"
                      >
                          <TrendingDown size={32} className="mb-3 text-red-500" />
                          <span className="font-bold text-lg">Registrar Gasto</span>
                  </button>
              </div>
          </div>

          {/* Notifications / Alerts */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 h-full flex flex-col">
              <h2 className="text-xl font-bold text-gray-800 mb-5 flex items-center">
                  <AlertCircle className="mr-2 text-orange-500" size={20}/> Avisos
              </h2>
              
              <div className="space-y-4 flex-1">
                  {/* REAL Low Stock Alert */}
                  {stats.lowStock > 0 ? (
                    <div 
                        onClick={() => navigate('/inventory')}
                        className="flex items-start p-4 bg-orange-50 rounded-2xl border border-orange-100 cursor-pointer hover:bg-orange-100 transition-colors"
                    >
                        <div className="bg-orange-100 p-2 rounded-full mr-3 text-orange-600">
                            <Package size={20} />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 text-sm">Inventario Crítico</h4>
                            <p className="text-xs text-orange-700 mt-1">Hay <strong>{stats.lowStock} productos</strong> por debajo del stock mínimo. Haz clic para revisar.</p>
                        </div>
                    </div>
                  ) : (
                    <div className="flex items-start p-4 bg-green-50 rounded-2xl border border-green-100">
                        <div className="bg-green-100 p-2 rounded-full mr-3 text-green-600">
                            <CheckCircle2 size={20} />
                        </div>
                        <div>
                            <h4 className="font-bold text-gray-900 text-sm">Inventario en Orden</h4>
                            <p className="text-xs text-green-700 mt-1">Todos los productos tienen stock suficiente actualmente.</p>
                        </div>
                    </div>
                  )}

                  {/* Sync Status */}
                  <div className="flex items-start p-4 bg-blue-50 rounded-2xl border border-blue-100">
                      <div className="bg-blue-100 p-2 rounded-full mr-3 text-blue-600">
                          <Cloud size={20} />
                      </div>
                      <div>
                          <h4 className="font-bold text-gray-900 text-sm">Sincronización P2P</h4>
                          <p className="text-xs text-blue-700 mt-1">Nodos locales vinculados. Datos en tiempo real disponibles.</p>
                      </div>
                  </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                   <p className="text-xs text-gray-400 font-medium">Sistema {appVersion} • Gestion Empresarial</p>
              </div>

          </div>

      </div>

    </div>
  );
}
