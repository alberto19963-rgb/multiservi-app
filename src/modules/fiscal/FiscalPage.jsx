import React, { useState, useEffect } from 'react';
import { Users, FileText, Plus, Save, AlertTriangle } from 'lucide-react';
import { db } from '../../api/electron';

export default function FiscalPage() {
  const [activeTab, setActiveTab] = useState('CLIENTS'); // 'CLIENTS', 'NCF'
  const [clients, setClients] = useState([]);
  const [ncfSequences, setNcfSequences] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Client Form
  const [clientForm, setClientForm] = useState({ name: '', rnc: '', type: 'FINAL', address: '', phone: '', email: '' });

  const loadData = async () => {
    if (!window.electronAPI) return; // Mock data handled elsewhere if needed
    
    if (activeTab === 'CLIENTS') {
       const data = await db.getClients();
       setClients(data || []);
    } else {
       // Load NCF Sequences (To be implemented in IPC)
       // const seq = await db.getNcfSequences();
       // setNcfSequences(seq);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleSaveClient = async (e) => {
    e.preventDefault();
    if (!window.electronAPI) return;
    try {
        await db.addClient(clientForm);
        setClientForm({ name: '', rnc: '', type: 'FINAL', address: '', phone: '', email: '' }); // Reset
        setIsModalOpen(false);
        loadData();
    } catch (e) {
        console.error(e);
        alert("Error guardando cliente");
    }
  };

  return (
    <div className="p-8 h-full flex flex-col">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Gestion Fiscal (DGII)</h1>
          <p className="text-gray-500">Administra Clientes y Secuencias de Comprobantes</p>
        </div>
      </div>

      <div className="flex space-x-1 bg-gray-200 p-1 rounded-xl w-fit mb-6">
        <button onClick={() => setActiveTab('CLIENTS')} className={`px-6 py-2 rounded-lg font-medium flex items-center ${activeTab === 'CLIENTS' ? 'bg-white shadow text-blue-600' : 'text-gray-500'}`}>
          <Users className="mr-2" size={18} /> Clientes
        </button>
        <button onClick={() => setActiveTab('NCF')} className={`px-6 py-2 rounded-lg font-medium flex items-center ${activeTab === 'NCF' ? 'bg-white shadow text-orange-600' : 'text-gray-500'}`}>
          <FileText className="mr-2" size={18} /> Secuencias NCF
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-1 p-6 overflow-auto">
        {activeTab === 'CLIENTS' ? (
            <div>
                <div className="flex justify-between mb-4">
                    <h2 className="text-xl font-bold">Directorio de Clientes</h2>
                    <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-blue-700">
                        <Plus size={18} className="mr-2"/> Nuevo Cliente
                    </button>
                </div>
                <table className="w-full text-left">
                    <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                            <th className="p-3">Razón Social</th>
                            <th className="p-3">RNC / Cédula</th>
                            <th className="p-3">Tipo Fiscal</th>
                            <th className="p-3">Teléfono</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {clients.map(c => (
                            <tr key={c.id}>
                                <td className="p-3 font-medium">{c.name}</td>
                                <td className="p-3 font-mono text-gray-600">{c.rnc}</td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${c.type === 'GOV' ? 'bg-purple-100 text-purple-700' : c.type === 'FISCAL' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                                        {c.type === 'GOV' ? 'GUBERNAMENTAL (B15)' : c.type === 'FISCAL' ? 'CRÉDITO FISCAL (B01)' : 'CONSUMO FINAL'}
                                    </span>
                                </td>
                                <td className="p-3 text-gray-500">{c.phone}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {clients.length === 0 && <div className="text-center py-10 text-gray-400">No hay clientes registrados</div>}
            </div>
        ) : (
            <div>
                <div className="flex items-center mb-6 text-orange-600 bg-orange-50 p-4 rounded-xl border border-orange-100">
                    <AlertTriangle className="mr-3" />
                    <div>
                        <h3 className="font-bold">Configuración Delicada</h3>
                        <p className="text-sm">Estas secuencias deben coincidir exactamente con las autorizadas por la DGII.</p>
                    </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {['B01 (Crédito Fiscal)', 'B02 (Consumo Final)', 'B15 (Gubernamental)'].map(type => (
                        <div key={type} className="border border-gray-200 rounded-xl p-6 hover:shadow-md transition-shadow">
                            <h3 className="font-bold text-gray-800 mb-4">{type}</h3>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold">Secuencia Actual</label>
                                    <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded p-2 font-mono text-lg" defaultValue={0} />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold">Límite Autorizado</label>
                                    <input type="number" className="w-full bg-gray-50 border border-gray-200 rounded p-2 font-mono text-lg" defaultValue={100} />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-500 uppercase font-bold">Vencimiento</label>
                                    <input type="date" className="w-full bg-gray-50 border border-gray-200 rounded p-2" />
                                </div>
                                <button className="w-full mt-2 bg-gray-800 text-white py-2 rounded-lg flex justify-center items-center hover:bg-black">
                                    <Save size={16} className="mr-2" /> Actualizar
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}
      </div>

       {/* Modal Client */}
       {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-lg">Nuevo Cliente</h3>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
                <form onSubmit={handleSaveClient} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Razón Social / Nombre</label>
                        <input required className="w-full border-b-2 border-gray-200 focus:border-blue-500 outline-none py-1" 
                            value={clientForm.name} onChange={e => setClientForm({...clientForm, name: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">RNC / Cédula</label>
                        <input required className="w-full bg-gray-50 rounded border border-gray-200 p-2" 
                            value={clientForm.rnc} onChange={e => setClientForm({...clientForm, rnc: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Comprobante</label>
                        <select className="w-full bg-gray-50 rounded border border-gray-200 p-2"
                             value={clientForm.type} onChange={e => setClientForm({...clientForm, type: e.target.value})}>
                            <option value="FINAL">Consumo Final (B02)</option>
                            <option value="FISCAL">Crédito Fiscal (B01)</option>
                            <option value="GOV">Gubernamental (B15)</option>
                        </select>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                        <input className="w-full bg-gray-50 rounded border border-gray-200 p-2 mb-3" 
                            value={clientForm.phone} onChange={e => setClientForm({...clientForm, phone: e.target.value})} />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico</label>
                        <input type="email" className="w-full bg-gray-50 rounded border border-gray-200 p-2" 
                            placeholder="ejemplo@correo.com"
                            value={clientForm.email} onChange={e => setClientForm({...clientForm, email: e.target.value})} />
                    </div>
                    
                    <button type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl mt-4 hover:bg-blue-700">Guardar Cliente</button>
                </form>
            </div>
        </div>
      )}
    </div>
  );
}
