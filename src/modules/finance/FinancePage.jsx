import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingDown, TrendingUp, Calendar, Plus, Save } from 'lucide-react';
import { db } from '../../api/electron';

export default function FinancePage() {
  const [stats, setStats] = useState({ sales: 0, expenses: 0, net: 0 });
  const [expenses, setExpenses] = useState([]);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [newExpense, setNewExpense] = useState({ description: '', amount: '', category: 'GENERAL' });

  const loadData = async () => {
    if (!window.electronAPI) return;
    const s = await db.getDailyStats();
    setStats(s || { sales: 0, expenses: 0, net: 0 });
    const e = await db.getExpenses();
    setExpenses(e || []);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddExpense = async (e) => {
      e.preventDefault();
      if (!newExpense.description || !newExpense.amount) return;

      try {
          await db.addExpense({
              description: newExpense.description,
              amount: parseFloat(newExpense.amount),
              category: newExpense.category
          });
          setShowExpenseModal(false);
          setNewExpense({ description: '', amount: '', category: 'GENERAL' });
          loadData();
      } catch (err) {
          console.error(err);
      }
  };

  const [showClosingModal, setShowClosingModal] = useState(false);
  const [closingData, setClosingData] = useState({ realTotal: '', notes: '' });

  const handleCloseCash = async (e) => {
      e.preventDefault();
      const realTotal = parseFloat(closingData.realTotal) || 0;
      const systemTotal = stats.sales - stats.expenses; // Net theoretical cash
      const difference = realTotal - systemTotal;

      try {
          await db.addCashClosing({
              systemTotal,
              realTotal,
              difference,
              notes: closingData.notes
          });
          setShowClosingModal(false);
          setClosingData({ realTotal: '', notes: '' });
          alert('Cierre de caja registrado correctamente');
          loadData(); // Reload to start fresh if implemented logic clears daily stats (optional)
      } catch (err) {
          console.error(err);
      }
  };

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800 flex items-center">
            <DollarSign className="mr-3 text-blue-600" size={32} />
            Finanzas & Reportes
        </h1>
        <button 
            onClick={() => setShowClosingModal(true)}
            className="bg-gray-900 text-white px-5 py-2.5 rounded-xl hover:bg-black transition-colors shadow-lg flex items-center space-x-2"
        >
            <TrendingUp size={20} />
            <span>Realizar Cierre del Día</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
           <div>
               <p className="text-sm text-gray-500 font-medium">Ventas de Hoy</p>
               <h2 className="text-2xl font-bold text-gray-900">${stats.sales.toFixed(2)}</h2>
           </div>
           <div className="bg-green-100 text-green-600 p-3 rounded-xl">
               <TrendingUp size={24} />
           </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
           <div>
               <p className="text-sm text-gray-500 font-medium">Gastos de Hoy</p>
               <h2 className="text-2xl font-bold text-red-600">${stats.expenses.toFixed(2)}</h2>
           </div>
           <div className="bg-red-100 text-red-600 p-3 rounded-xl">
               <TrendingDown size={24} />
           </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
           <div>
               <p className="text-sm text-gray-500 font-medium">Ganancia Neta (Est.)</p>
               <h2 className={`text-2xl font-bold ${stats.net >= 0 ? 'text-blue-600' : 'text-red-500'}`}>${stats.net.toFixed(2)}</h2>
           </div>
           <div className="bg-blue-100 text-blue-600 p-3 rounded-xl">
               <Calendar size={24} />
           </div>
        </div>
      </div>

      {/* Expenses Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-800">Registro de Gastos Recientes</h3>
              <button 
                onClick={() => setShowExpenseModal(true)}
                className="flex items-center space-x-2 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
              >
                  <Plus size={18} />
                  <span>Registrar Gasto</span>
              </button>
          </div>
          <div className="flex-1 overflow-auto p-0">
             <table className="w-full">
                 <thead className="bg-gray-50 text-gray-500 text-sm font-medium">
                     <tr>
                         <th className="px-6 py-4 text-left">Descripción</th>
                         <th className="px-6 py-4 text-left">Categoría</th>
                         <th className="px-6 py-4 text-right">Monto</th>
                         <th className="px-6 py-4 text-right">Fecha</th>
                     </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                     {expenses.length === 0 ? (
                         <tr><td colSpan="4" className="text-center py-8 text-gray-400">No hay gastos registrados hoy</td></tr>
                     ) : (
                         expenses.map(exp => (
                             <tr key={exp.id} className="hover:bg-gray-50/50">
                                 <td className="px-6 py-4 font-medium text-gray-800">{exp.description}</td>
                                 <td className="px-6 py-4"><span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">{exp.category}</span></td>
                                 <td className="px-6 py-4 text-right text-red-600 font-medium">-${exp.amount.toFixed(2)}</td>
                                 <td className="px-6 py-4 text-right text-gray-400 text-sm">{new Date(exp.date).toLocaleTimeString()}</td>
                             </tr>
                         ))
                     )}
                 </tbody>
             </table>
          </div>
      </div>

       {/* Expense Modal */}
       {showExpenseModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Registrar Nuevo Gasto</h2>
            <form onSubmit={handleAddExpense} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
                    <input 
                      autoFocus
                      type="text" 
                      className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                      placeholder="Ej. Compra de Botellones"
                      value={newExpense.description}
                      onChange={e => setNewExpense({...newExpense, description: e.target.value})}
                    />
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Monto ($)</label>
                        <input 
                        type="number" 
                        step="0.01"
                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                        value={newExpense.amount}
                        onChange={e => setNewExpense({...newExpense, amount: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Categoría</label>
                        <select 
                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none bg-white"
                        value={newExpense.category}
                        onChange={e => setNewExpense({...newExpense, category: e.target.value})}
                        >
                            <option value="GENERAL">General</option>
                            <option value="INSUMOS">Insumos</option>
                            <option value="SERVICIOS">Servicios</option>
                            <option value="NOMINA">Nómina</option>
                        </select>
                    </div>
                </div>

                <div className="flex gap-3 mt-6">
                    <button 
                      type="button" 
                      onClick={() => setShowExpenseModal(false)}
                      className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                    >
                        Cancelar
                    </button>
                    <button 
                      type="submit" 
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center justify-center space-x-2"
                    >
                        <Save size={18} />
                        <span>Guardar</span>
                    </button>
                </div>
            </form>
          </div>
        </div>
      )}

      {/* Closing Modal */}
      {showClosingModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-8">
            <h2 className="text-2xl font-bold mb-6 text-center">Cierre de Caja</h2>
            
            <div className="bg-gray-50 p-4 rounded-xl mb-6 space-y-2">
                <div className="flex justify-between">
                    <span className="text-gray-600">Ventas Sistema:</span>
                    <span className="font-bold text-gray-900">${stats.sales.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                    <span className="text-gray-600">Gastos Registrados:</span>
                    <span className="font-bold text-red-600">-${stats.expenses.toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between text-lg">
                    <span className="font-medium text-gray-800">Efectivo Esperado:</span>
                    <span className="font-bold text-blue-600">${stats.net.toFixed(2)}</span>
                </div>
            </div>

            <form onSubmit={handleCloseCash} className="space-y-5">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Efectivo en Caja (Real)</label>
                    <input 
                      autoFocus
                      type="number" 
                      step="0.01"
                      className="w-full border border-gray-300 rounded-xl p-3 text-lg font-bold text-right focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      value={closingData.realTotal}
                      onChange={e => setClosingData({...closingData, realTotal: e.target.value})}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notas / Observaciones</label>
                    <textarea 
                      className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none h-24 resize-none"
                      placeholder="Ej. Faltante por ajuste de cambio..."
                      value={closingData.notes}
                      onChange={e => setClosingData({...closingData, notes: e.target.value})}
                    />
                </div>

                <div className="flex gap-3 mt-8">
                    <button 
                      type="button" 
                      onClick={() => setShowClosingModal(false)}
                      className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 font-medium"
                    >
                        Cancelar
                    </button>
                    <button 
                      type="submit" 
                      className="flex-1 px-4 py-3 bg-gray-900 text-white rounded-xl hover:bg-black flex items-center justify-center space-x-2 font-medium"
                    >
                        <Save size={20} />
                        <span>Confirmar Cierre</span>
                    </button>
                </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
