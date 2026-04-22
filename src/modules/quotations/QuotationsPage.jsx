import React, { useState, useEffect } from 'react';
import { db } from '../../api/electron';
import { FileText, Plus, Search, CheckCircle, Printer, ArrowRight, Trash2, Minus, Landmark } from 'lucide-react';
import { cleanProductName } from '../../lib/utils';
import PaymentModal from '../../components/PaymentModal';

export default function QuotationsPage({ user }) {
    const [view, setView] = useState('LIST'); // LIST or NEW
    const [quotes, setQuotes] = useState([]);
    
    // NEW QUOTE STATE
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [search, setSearch] = useState('');
    const [clients, setClients] = useState([]);
    const [selectedClient, setSelectedClient] = useState(null);

    const [activeShift, setActiveShift] = useState(null);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [selectedQuoteForPayment, setSelectedQuoteForPayment] = useState(null);

    const loadQuotes = async () => {
        if (!window.electronAPI) return;
        try {
            const data = await db.getQuotes(); 
            setQuotes(data || []);
        } catch (e) {
            console.error(e);
        }
    };

    const loadProducts = async () => {
        if (!window.electronAPI) return;
        const data = await db.getProducts(search);
        setProducts(data || []);
    };

    const loadClients = async () => {
        if (!window.electronAPI) return;
        const data = await db.getClients();
        setClients(data || []);
    };

    const loadShift = async () => {
        if (!window.electronAPI || !user) return;
        const shift = await db.getActiveShift(user.id);
        setActiveShift(shift);
    };

    useEffect(() => {
        loadQuotes();
        loadShift();
    }, []);

    // --- NEW QUOTE LOGIC (Similar to POS) ---
    useEffect(() => {
        if (view === 'NEW') {
            loadProducts();
            loadClients();
        }
    }, [view, search]);

    const addToCart = (product) => {
        const existing = cart.find(item => item.id === product.id);
        if (existing) {
          updateQuantity(product.id, existing.quantity + 1);
        } else {
          setCart([...cart, { ...product, quantity: 1 }]);
        }
    };

    const removeFromCart = (id) => {
        setCart(cart.filter(item => item.id !== id));
    };

    const updateQuantity = (id, newQty) => {
        const q = parseFloat(newQty);
        if (isNaN(q) || q <= 0) return;
        setCart(cart.map(item => item.id === id ? { ...item, quantity: q } : item));
    };

    const handleCreateQuote = async () => {
        if (cart.length === 0) return;
        try {
            const quoteData = {
                client: selectedClient,
                items: cart,
                type: 'QUOTE' // Explicit type for clarity
            };
            await db.createQuote(quoteData);
            alert("Cotización Creada!");
            setCart([]);
            setView('LIST');
            loadQuotes();
        } catch (e) {
            console.error(e);
            alert("Error: " + e.message);
        }
    };

    const handleConvertToInvoiceDraft = (quote) => {
        if (!activeShift) {
            alert("Debe abrir la caja en el Punto de Venta para poder facturar.");
            return;
        }
        setSelectedQuoteForPayment(quote);
        setIsPaymentModalOpen(true);
    };

    const handleConvertToInvoice = async (payment) => {
        const quote = selectedQuoteForPayment;
        try {
            await db.convertQuoteToInvoice({ 
                quoteId: quote.id, 
                payment: payment, 
                shiftId: activeShift.id 
            });
            alert("¡Facturada con éxito!");
            setIsPaymentModalOpen(false);
            loadQuotes();
        } catch (e) {
            alert("Error al facturar: " + e.message);
        }
    };

    // --- RENDER ---

    if (view === 'NEW') {
        return (
            <div className="flex h-full p-6 gap-6">
                {/* Left: Product Selection */}
                <div className="flex-1 bg-white rounded-2xl p-6 shadow-sm border border-gray-200 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-xl font-bold flex items-center">
                            <Plus className="mr-2" /> Nueva Cotización
                        </h2>
                        <button onClick={() => setView('LIST')} className="text-gray-500 hover:text-gray-700">Cancelar</button>
                    </div>
                    
                    <input 
                      type="text" 
                      placeholder="Buscar producto..." 
                      className="w-full p-3 border rounded-xl mb-4"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                    />

                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto">
                        {products.map(p => (
                            <button key={p.id} onClick={() => addToCart(p)} className="p-3 border-2 border-gray-100 rounded-xl hover:border-blue-400 hover:shadow-md transition text-left group">
                                <div className="font-bold text-gray-800 text-sm leading-tight mb-1">{cleanProductName(p.name)}</div>
                                <div className="flex justify-between items-end">
                                    <div className="text-[10px] text-gray-400 uppercase font-bold group-hover:text-blue-500">{p.brand || 'Genérico'}</div>
                                    <div className="text-sm text-blue-600 font-black">${p.price}</div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right: Cart/Preview */}
                <div className="w-96 bg-white rounded-2xl p-6 shadow-xl border border-blue-100 flex flex-col">
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-1 text-gray-500">Cliente</label>
                        <select 
                            className="w-full border rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-blue-500"
                            onChange={e => {
                                const c = clients.find(cl => cl.id === parseInt(e.target.value));
                                setSelectedClient(c);
                            }}
                        >
                            <option value="">Cliente General</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>

                        <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
                            {cart.length === 0 && <div className="text-center py-10 text-gray-400 text-sm">Carrito vacío</div>}
                            {cart.map(item => (
                                <div key={item.id} className="bg-gray-50 p-3 rounded-2xl border border-gray-100 shadow-sm">
                                    <div className="flex justify-between items-start mb-2">
                                        <div className="flex-1 pr-2">
                                            <div className="font-bold text-gray-800 text-sm leading-tight">{cleanProductName(item.name)}</div>
                                            <div className="text-[10px] text-gray-400 uppercase font-bold">{item.brand}</div>
                                        </div>
                                        <button onClick={() => removeFromCart(item.id)} className="text-gray-300 hover:text-red-500 transition">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2 bg-white rounded-lg p-1 border border-gray-100">
                                            <button onClick={() => updateQuantity(item.id, item.quantity - 1)} className="p-1 hover:bg-gray-100 rounded-md text-gray-500"><Minus size={14}/></button>
                                            <input 
                                                type="number" 
                                                className="w-10 text-center font-bold text-blue-600 text-sm outline-none" 
                                                value={item.quantity}
                                                onChange={e => updateQuantity(item.id, e.target.value)}
                                            />
                                            <button onClick={() => updateQuantity(item.id, item.quantity + 1)} className="p-1 hover:bg-gray-100 rounded-md text-gray-500"><Plus size={14}/></button>
                                        </div>
                                        <div className="text-sm font-black text-gray-900">${(item.quantity * item.price).toLocaleString()}</div>
                                    </div>
                                </div>
                            ))}
                        </div>

                    <div className="text-xl font-bold text-right mb-4">
                        Total: ${cart.reduce((sum, i) => sum + (i.price * i.quantity), 0).toLocaleString()}
                    </div>

                    <button 
                        onClick={handleCreateQuote}
                        disabled={cart.length === 0}
                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 shadow-lg"
                    >
                        Guardar Cotización
                    </button>
                </div>

                <PaymentModal 
                    isOpen={isPaymentModalOpen} 
                    total={selectedQuoteForPayment?.total || 0}
                    onClose={() => setIsPaymentModalOpen(false)}
                    onConfirm={handleConvertToInvoice}
                />
            </div>
        );
    }

    // LIST VIEW
    return (
        <div className="p-8 h-full flex flex-col">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold text-gray-800 flex items-center">
                    <FileText className="mr-3" size={32} /> Cotizaciones
                </h1>
                <button 
                    onClick={() => setView('NEW')}
                    className="bg-gray-900 text-white px-6 py-3 rounded-xl hover:bg-black font-bold flex items-center shadow-lg"
                >
                    <Plus className="mr-2" size={20} /> Crear Nueva
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex-1 overflow-hidden flex flex-col">
                <div className="overflow-y-auto flex-1 p-6">
                    <table className="w-full">
                        <thead>
                            <tr className="text-left text-gray-500 border-b">
                                <th className="pb-3 pl-2">ID</th>
                                <th className="pb-3">Cliente</th>
                                <th className="pb-3">Fecha</th>
                                <th className="pb-3">Total</th>
                                <th className="pb-3">Estado</th>
                                <th className="pb-3 text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {quotes.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="text-center py-10 text-gray-400">
                                        No hay cotizaciones registradas
                                    </td>
                                </tr>
                            )}
                            {quotes.map(q => (
                                <tr key={q.id} className="border-b last:border-0 hover:bg-gray-50">
                                    <td className="py-4 pl-2 font-mono">#{q.id}</td>
                                    <td className="py-4">{q.clientName}</td>
                                    <td className="py-4 text-gray-500">{new Date(q.date).toLocaleDateString()}</td>
                                    <td className="py-4 font-bold text-gray-800">${q.total.toLocaleString()}</td>
                                    <td className="py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                            q.status === 'QUOTE' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                                        }`}>
                                            {q.status === 'QUOTE' ? 'PENDIENTE' : 'FACTURADA'}
                                        </span>
                                    </td>
                                    <td className="py-4 text-right space-x-2">
                                        <button className="text-gray-500 hover:text-gray-900" title="Imprimir PDF">
                                            <Printer size={18} />
                                        </button>
                                        {q.status === 'QUOTE' && (
                                            <button 
                                                onClick={() => handleConvertToInvoiceDraft(q)}
                                                className="bg-green-600 text-white px-3 py-1 rounded-lg text-sm font-bold hover:bg-green-700 inline-flex items-center"
                                            >
                                                Facturar <ArrowRight size={14} className="ml-1" />
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
