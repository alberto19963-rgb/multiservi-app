import React, { useState, useEffect } from 'react';
import { db } from '../../api/electron';
import { FileText, Plus, Search, CheckCircle, Printer, ArrowRight, Trash2, Minus, Landmark, Mail, Eye, Download, Users } from 'lucide-react';
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
    
    // VIEW MODAL STATE
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [selectedQuoteItems, setSelectedQuoteItems] = useState([]);
    const [viewingQuote, setViewingQuote] = useState(null);
    const [isLoadingItems, setIsLoadingItems] = useState(false);

    // EMAIL MODAL STATE
    const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
    const [emailTarget, setEmailTarget] = useState('');
    const [quoteForEmail, setQuoteForEmail] = useState(null);

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

    const [isTypeModalOpen, setIsTypeModalOpen] = useState(false);
    const [selectedQuote, setSelectedQuote] = useState(null);

    const handleOpenTypeModal = (quote) => {
        setSelectedQuote(quote);
        setIsTypeModalOpen(true);
    };

    const handleConvertToInvoiceDirect = async (type) => {
        if (!selectedQuote) return;
        
        try {
            const items = await db.getInvoiceItems(selectedQuote.id);
            const res = await db.createInvoice({
                client: { 
                    id: selectedQuote.clientId, 
                    name: selectedQuote.clientName, 
                    rnc: selectedQuote.clientRnc, 
                    email: selectedQuote.clientEmail,
                    phone: selectedQuote.clientPhone 
                },
                items: items,
                type: type, // Seleccionado por el usuario
                isQuote: false,
                payment: null, // Crédito
                shiftId: activeShift?.id
            });

            if (res.success) {
                await db.deleteQuote(selectedQuote.id);
                alert(`Factura generada con éxito (${type})`);
                setIsTypeModalOpen(false);
                setSelectedQuote(null);
                loadQuotes();
            } else {
                alert("Error: " + res.message);
            }
        } catch (e) {
            alert("Error al facturar: " + e.message);
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
                payment: payment, // Now includes .type (FINAL/FISCAL)
                shiftId: activeShift.id 
            });
            alert("¡Facturada con éxito!");
            setIsPaymentModalOpen(false);
            loadQuotes();
        } catch (e) {
            alert("Error al facturar: " + e.message);
        }
    };

    const handlePrintQuote = async (quote) => {
        try {
            await db.printQuote(quote.id);
        } catch (e) {
            console.error(e);
            alert("Error al imprimir");
        }
    };

    const handleEmailQuote = (quote) => {
        setQuoteForEmail(quote);
        setEmailTarget(quote.clientEmail || "");
        setIsEmailModalOpen(true);
    };

    const confirmEmailSend = async () => {
        if (!emailTarget) return;
        try {
            const res = await db.emailQuote({ quoteId: quoteForEmail.id, email: emailTarget });
            if (res.success) alert("Cotización enviada con éxito!");
            else alert("Error: " + res.message);
            setIsEmailModalOpen(false);
        } catch (e) {
            alert("Error al enviar: " + e.message);
        }
    };

    const handleDownloadPDF = async (quote) => {
        try {
            const res = await db.downloadQuotePDF(quote.id);
            if (res.success) {
                alert("PDF guardado correctamente");
            } else if (res.message !== 'Cancelado por el usuario') {
                alert("Error al generar PDF: " + res.message);
            }
        } catch (e) {
            alert("Error al descargar: " + e.message);
        }
    };

    const handleDeleteQuote = async (quote) => {
        if (!window.confirm(`¿Estás seguro de que deseas eliminar la cotización #${quote.id}? Esta acción no se puede deshacer.`)) return;
        
        try {
            const res = await db.deleteQuote(quote.id);
            if (res.success) {
                loadQuotes();
            } else {
                alert("Error al eliminar: " + res.message);
            }
        } catch (e) {
            alert("Error: " + e.message);
        }
    };

    const handleViewQuote = async (quote) => {
        try {
            setIsLoadingItems(true);
            setIsViewModalOpen(true);
            setViewingQuote(quote);
            
            const items = await db.getInvoiceItems(quote.id);
            console.log("Items cargados:", items);
            setSelectedQuoteItems(items || []);
        } catch (e) {
            console.error("Error cargando items:", e);
            alert("Error al cargar detalles: " + e.message);
        } finally {
            setIsLoadingItems(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr || dateStr.includes('sql')) return 'Recién creada';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleDateString();
        } catch(e) { return dateStr; }
    }

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
            </div>
        );
    }

    return (
        <div className="p-8 h-full flex flex-col">
            {/* Header */}

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
                                    <td className="py-4 text-gray-500">{formatDate(q.date)}</td>
                                    <td className="py-4 font-bold text-gray-800">${q.total.toLocaleString()}</td>
                                    <td className="py-4">
                                        <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                            q.status === 'QUOTE' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'
                                        }`}>
                                            {q.status === 'QUOTE' ? 'PENDIENTE' : 'FACTURADA'}
                                        </span>
                                    </td>
                                    <td className="py-4 text-right space-x-2">
                                        <button 
                                            onClick={() => handleViewQuote(q)}
                                            className="text-gray-500 hover:text-blue-600 transition-colors" 
                                            title="Ver Detalles"
                                        >
                                            <Eye size={18} />
                                        </button>
                                        <button 
                                            onClick={() => handlePrintQuote(q)}
                                            className="text-gray-500 hover:text-blue-600 transition-colors" 
                                            title="Imprimir / PDF"
                                        >
                                            <Printer size={18} />
                                        </button>
                                        <button 
                                            onClick={() => handleEmailQuote(q)}
                                            className="text-gray-500 hover:text-blue-600 transition-colors" 
                                            title="Enviar por Correo"
                                        >
                                            <Mail size={18} />
                                        </button>
                                        <button 
                                            onClick={() => handleDownloadPDF(q)}
                                            className="text-gray-500 hover:text-blue-600 transition-colors" 
                                            title="Descargar PDF"
                                        >
                                            <Download size={18} />
                                        </button>
                                        <button 
                                            onClick={() => handleDeleteQuote(q)}
                                            className="text-gray-400 hover:text-red-500 transition-colors" 
                                            title="Eliminar Cotización"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                        {q.status === 'QUOTE' && (
                                            <div className="flex flex-col gap-1">
                                                <button 
                                                    onClick={() => handleConvertToInvoiceDraft(q)}
                                                    className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-green-700 inline-flex items-center justify-center whitespace-nowrap"
                                                >
                                                    Facturar POS <ArrowRight size={12} className="ml-1" />
                                                </button>
                                                <button 
                                                    onClick={() => handleOpenTypeModal(q)}
                                                    className="bg-blue-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold hover:bg-blue-700 inline-flex items-center justify-center whitespace-nowrap"
                                                >
                                                    Facturar Crédito <Landmark size={12} className="ml-1" />
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
            <PaymentModal 
                isOpen={isPaymentModalOpen} 
                total={selectedQuoteForPayment?.total || 0}
                onClose={() => setIsPaymentModalOpen(false)}
                onConfirm={handleConvertToInvoice}
            />

            {/* MODAL PARA VER DETALLES */}
            {isViewModalOpen && viewingQuote && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-lg shadow-[0_20px_50px_rgba(0,0,0,0.3)] overflow-hidden p-8 border border-gray-100 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-black text-gray-800">Detalles Cotización #{viewingQuote.id}</h2>
                            <button onClick={() => setIsViewModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <Plus className="rotate-45" size={24} />
                            </button>
                        </div>
                        
                        <div className="mb-6 bg-blue-50 p-4 rounded-2xl border border-blue-100">
                            <p className="text-sm text-blue-800"><strong>Cliente:</strong> {viewingQuote.clientName}</p>
                            <p className="text-sm text-blue-800"><strong>Fecha:</strong> {formatDate(viewingQuote.date)}</p>
                        </div>

                        <div className="space-y-3 max-h-96 overflow-y-auto mb-6 pr-2 custom-scrollbar">
                        {isLoadingItems ? (
                            <div className="flex flex-col items-center py-10 text-blue-400">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                                <span className="font-bold">Cargando productos...</span>
                            </div>
                        ) : selectedQuoteItems.length === 0 ? (
                            <div className="text-center py-10 text-gray-400 italic">No se encontraron productos vinculados.</div>
                        ) : (
                            selectedQuoteItems.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center border-b border-gray-50 pb-3 last:border-0">
                                    <div>
                                        <div className="font-bold text-gray-800">{item.productName || 'Producto'}</div>
                                        <div className="text-xs text-gray-400 font-medium">{item.quantity} unidades × ${item.price.toLocaleString()}</div>
                                    </div>
                                    <div className="font-black text-gray-900">${(item.quantity * item.price).toLocaleString()}</div>
                                </div>
                            ))
                        )}
                    </div>

                        <div className="text-right border-t border-gray-100 pt-6">
                            <div className="text-xs text-gray-400 uppercase font-black mb-1">Total de la Cotización</div>
                            <div className="text-3xl font-black text-blue-600">${viewingQuote.total.toLocaleString()}</div>
                        </div>

                        <button 
                            onClick={() => setIsViewModalOpen(false)}
                            className="w-full mt-8 bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-black transition-all shadow-lg active:scale-[0.98]"
                        >
                            Entendido
                        </button>
                    </div>
                </div>
            )}

            {/* MODAL PARA ENVIAR CORREO */}
            {isEmailModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl w-full max-w-sm shadow-[0_20px_50px_rgba(0,0,0,0.3)] p-8 border border-gray-100 animate-in fade-in zoom-in duration-200">
                        <div className="flex justify-center mb-4">
                            <div className="bg-blue-100 p-4 rounded-full text-blue-600">
                                <Mail size={32} />
                            </div>
                        </div>
                        <h2 className="text-2xl font-black mb-2 text-center text-gray-800">Enviar Cotización</h2>
                        <p className="text-sm text-gray-500 mb-6 text-center">La cotización se enviará como un documento PDF profesional.</p>
                        
                        <div className="mb-6">
                            <label className="text-[10px] font-black uppercase text-gray-400 mb-1 block ml-1">Correo del destinatario</label>
                            <input 
                                type="email" 
                                className="w-full border-2 border-gray-50 rounded-2xl p-4 outline-none focus:border-blue-500 font-bold text-gray-700 transition-all bg-gray-50 focus:bg-white"
                                placeholder="cliente@correo.com"
                                value={emailTarget}
                                onChange={e => setEmailTarget(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setIsEmailModalOpen(false)} className="flex-1 py-4 font-bold text-gray-400 hover:text-gray-600 transition-colors">Cancelar</button>
                            <button onClick={confirmEmailSend} className="flex-1 bg-blue-600 text-white py-4 rounded-2xl font-bold hover:bg-blue-700 shadow-lg transition-all active:scale-[0.98]">Enviar Ahora</button>
                        </div>
                    </div>
                </div>
            )}
            {/* MODAL SELECTOR DE TIPO DE FACTURA */}
            {isTypeModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2rem] w-full max-w-md p-8 shadow-2xl scale-in-center overflow-hidden relative">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-10 -mt-10" />
                        
                        <h2 className="text-2xl font-black text-gray-900 mb-2 relative">¿Qué tipo de factura deseas?</h2>
                        <p className="text-gray-500 mb-8 text-sm relative">Selecciona el comprobante fiscal para esta cuenta a crédito.</p>

                        <div className="space-y-3 relative">
                            <button 
                                onClick={() => handleConvertToInvoiceDirect('FISCAL')}
                                className="w-full group p-4 bg-gray-50 border-2 border-transparent hover:border-blue-600 hover:bg-blue-50 rounded-2xl transition-all flex items-center gap-4 text-left"
                            >
                                <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform">
                                    <Landmark size={24} />
                                </div>
                                <div>
                                    <div className="font-black text-gray-900">Crédito Fiscal (B01)</div>
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Para Empresas y RNC</div>
                                </div>
                            </button>

                            <button 
                                onClick={() => handleConvertToInvoiceDirect('FINAL')}
                                className="w-full group p-4 bg-gray-50 border-2 border-transparent hover:border-green-600 hover:bg-green-50 rounded-2xl transition-all flex items-center gap-4 text-left"
                            >
                                <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform">
                                    <Users size={24} />
                                </div>
                                <div>
                                    <div className="font-black text-gray-900">Consumidor Final (B02)</div>
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Para Personas Físicas</div>
                                </div>
                            </button>

                            <button 
                                onClick={() => handleConvertToInvoiceDirect('GOV')}
                                className="w-full group p-4 bg-gray-50 border-2 border-transparent hover:border-purple-600 hover:bg-purple-50 rounded-2xl transition-all flex items-center gap-4 text-left"
                            >
                                <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-gray-100 flex items-center justify-center text-purple-600 group-hover:scale-110 transition-transform">
                                    <Landmark size={24} />
                                </div>
                                <div>
                                    <div className="font-black text-gray-900">Gubernamental (B15)</div>
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Ventas al Estado Dominicano</div>
                                </div>
                            </button>
                        </div>

                        <button 
                            onClick={() => setIsTypeModalOpen(false)}
                            className="w-full mt-8 py-4 text-gray-400 font-bold hover:text-gray-600 transition-colors"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
