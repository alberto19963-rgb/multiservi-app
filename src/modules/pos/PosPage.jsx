import React, { useState, useEffect } from 'react';
import { Search, Plus, Trash2, Printer, ChevronRight, ArrowLeft, Layers, Box, Tag, Package, Landmark } from 'lucide-react';
import { db } from '../../api/electron';
import { cleanProductName } from '../../lib/utils';
import PaymentModal from '../../components/PaymentModal';

function IconDisplay({ icon, size = '4xl', className = '' }) {
  if (!icon) return <span className={`text-${size} ${className}`}>📦</span>;
  if (icon.startsWith('data:image')) {
    const pixelSize = size === '4xl' ? 48 : size === '2xl' ? 32 : 16;
    return <img src={icon} alt="icon" className={`object-contain ${className}`} style={{ width: pixelSize, height: pixelSize }} />;
  }
  return <span className={`text-${size} leading-none ${className}`}>{icon}</span>;
}

const formatMoney = (amount) => {
  return Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function PosPage({ user }) {
  const [navPath, setNavPath] = useState([]); // Array of { id, name, type: 'FAMILY' | 'VARIANT' }
  const [items, setItems] = useState([]); // Families, Variants or SKUs
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState([]);
  const [invoiceType, setInvoiceType] = useState('FINAL');
  const [rncInput, setRncInput] = useState('');
  const [clientNameInput, setClientNameInput] = useState('');
  const [isSearchingRnc, setIsSearchingRnc] = useState(false);

  // --- SHIFTS & PAYMENT STATE ---
  const [activeShift, setActiveShift] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isOpeningShift, setIsOpeningShift] = useState(false);
  const [isClosingShift, setIsClosingShift] = useState(false);
  const [shiftFormData, setShiftFormData] = useState({ baseAmount: '0', realCash: '', realCard: '', notes: '' });

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (!window.electronAPI) {
        setItems([{ id: 1, name: 'Cloro (MOCK)', price: 150, stock: 10 }]);
        setIsLoading(false);
        return;
      }

      // Contexto: Búsqueda activa (Lista plana)
      if (search.trim()) {
        const data = await db.getProducts(search);
        setItems(data.map(p => ({ ...p, _type: 'SKU' })));
        setIsLoading(false);
        return;
      }

      // Contexto: Navegación Jerárquica
      const lastPath = navPath[navPath.length - 1];
      
      if (!lastPath) {
        // Nivel 0: Familias
        const families = await db.getFamilies();
        setItems(families.map(f => ({ ...f, _type: 'FAMILY' })));
      } else if (lastPath.type === 'FAMILY') {
        // Nivel 1: Variantes
        const variants = await db.getVariants(lastPath.id);
        setItems(variants.map(v => ({ ...v, _type: 'VARIANT' })));
      } else if (lastPath.type === 'VARIANT') {
        // Nivel 2: SKUs
        const skus = await db.getSkus(lastPath.id);
        setItems(skus.map(s => ({ ...s, _type: 'SKU' })));
      }
    } catch (error) {
      console.error("Error loading POS data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [search, navPath]);

  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState(null); // null = Consumer Final
  const [itbis, setItbis] = useState(0);

  // Move loadClients definition before useEffect
  const loadClients = async () => {
      try {
        if (!window.electronAPI) return;
        const data = await db.getClients();
        setClients(data);
      } catch (e) { console.error(e); }
  };

  const loadShift = async () => {
      if (!window.electronAPI || !user) return;
      const shift = await db.getActiveShift(user.id);
      setActiveShift(shift);
  };

  useEffect(() => {
    loadClients();
    loadShift();

    // SaaS Auto-Refresh Listener
    if (window.electronAPI) {
        const removeListener = window.electronAPI.onCloudSyncRefresh((type) => {
            console.log(`[SaaS] Sincronización detectada (${type}), refrescando POS...`);
            loadData();
        });
        return () => removeListener();
    }
  }, []);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'F1') {
        e.preventDefault();
        document.getElementById('pos-search-input')?.focus();
      }
      if (e.key === 'F2') {
        e.preventDefault();
        document.getElementById('pos-checkout-btn')?.click();
      }
      if (e.key === 'F4') {
        e.preventDefault();
        setCart([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleCheckoutDraft = async () => {
    if (cart.length === 0) return;
    if (!activeShift) {
        alert("¡Debe abrir la caja primero para poder cobrar!");
        setIsOpeningShift(true);
        return;
    }
    setIsPaymentModalOpen(true);
  };

  const triggerPayment = async (payment) => {
    try {
        let clientObj = null;
        if (invoiceType === 'FISCAL') {
            if (!rncInput || !clientNameInput) {
                alert("Para Crédito Fiscal debe llenar RNC y Razón Social");
                return;
            }
            clientObj = { rnc: rncInput, name: clientNameInput, id: null };
        } else if (selectedClient) {
            clientObj = selectedClient;
        }

        const invoiceData = {
            client: clientObj,
            items: cart,
            type: invoiceType,
            payment: payment,
            shiftId: activeShift?.id
        };
        
        if (!window.electronAPI) {
            alert("Modo Dev: Factura creada (Simulada)");
            setCart([]);
            setIsPaymentModalOpen(false);
            return;
        }

        const result = await db.createInvoice(invoiceData);
        alert(`Factura ${result.ncf} Generada con Éxito! ${payment.method === 'CASH' ? '\nDevuelta: $' + payment.change : ''}`);
        
        setCart([]);
        setSearch('');
        setRncInput('');
        setClientNameInput('');
        setIsPaymentModalOpen(false);
        loadShift(); // Refresh totals in shift
    } catch (e) {
        console.error(e);
        alert("Error al generar factura: " + e.message);
    }
  };

  const toggleDrawer = () => {
      console.log("Comando Gaveta: Abriendo...");
      alert("Comando Gaveta Enviado");
  };

  const handleOpenShift = async () => {
      if (!window.electronAPI) return;
      try {
          const shift = await db.openShift({
              userId: user.id,
              baseAmount: parseFloat(shiftFormData.baseAmount) || 0
          });
          setActiveShift(shift);
          setIsOpeningShift(false);
      } catch(e) { alert("Error al abrir caja"); }
  };

  const handleCloseShift = async () => {
      if (!window.electronAPI) return;
      try {
          await db.closeShift({
              shiftId: activeShift.id,
              realCash: parseFloat(shiftFormData.realCash) || 0,
              realCard: parseFloat(shiftFormData.realCard) || 0,
              notes: shiftFormData.notes
          });
          setActiveShift(null);
          setIsClosingShift(false);
          alert("Turno cerrado exitosamente. Reporte generado.");
      } catch(e) { alert("Error al cerrar caja"); }
  };

  const handleSearchRnc = async () => {
      if (!rncInput || !window.electronAPI) return;
      setIsSearchingRnc(true);
      try {
          const res = await db.searchRNC(rncInput);
          if (res && res.success) {
              setClientNameInput(res.name);
          } else {
              alert("No encontrado o error en conexión.");
          }
      } catch (e) {}
      setIsSearchingRnc(false);
  };

  const handleItemClick = (item) => {
    if (item._type === 'FAMILY') {
      setNavPath([...navPath, { id: item.id, name: item.name, type: 'FAMILY' }]);
      setSearch('');
    } else if (item._type === 'VARIANT') {
      setNavPath([...navPath, { id: item.id, name: item.name, type: 'VARIANT' }]);
      setSearch('');
    } else if (item._type === 'SKU' || !item._type) {
      // If it's a SKU (or legacy product without type), add to cart
      addToCart(item);
    }
  };

  const goBack = () => {
    setNavPath(navPath.slice(0, -1));
  };

  const resetNav = () => {
    setNavPath([]);
    setSearch('');
  };

  const addToCart = (product) => {
    // Resolve name redundancy: De-duplicate parts separated by " - "
    let displayName = product.name;
    if (displayName.includes(" - ")) {
       const parts = displayName.split(" - ").map(p => p.trim());
       const uniqueParts = [];
       parts.forEach(p => {
          // Si el componente 'p' no está contenido ya en lo que hemos guardado, y tampoco lo que hemos guardado lo contiene a él
          if (!uniqueParts.some(up => up.toLowerCase().includes(p.toLowerCase()) || p.toLowerCase().includes(up.toLowerCase()))) {
             uniqueParts.push(p);
          }
       });
       displayName = uniqueParts.join(" - ");
    }

    const existing = cart.find(item => item.id === product.id);
    if (existing) {
      setCart(cart.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { ...product, name: displayName, quantity: 1 }]);
    }
  };

  const removeFromCart = (id) => {
    setCart(cart.filter(item => item.id !== id));
  };

  const updateQuantity = (id, newQuantity) => {
    const qty = parseFloat(newQuantity);
    if (isNaN(qty) || qty <= 0) return;
    setCart(cart.map(item => item.id === id ? { ...item, quantity: qty } : item));
  };

  return (
    <>
      <div className="flex h-full">
      {/* ... Left: Product Grid (unchanged props) ... */}
      <div className="flex-1 p-6 flex flex-col relative">
        
        {/* TOP BAR: Shift Management */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-white p-5 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4">
                <div className={`p-3 rounded-2xl ${activeShift ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    <Landmark size={24} />
                </div>
                <div>
                    <h3 className="font-black text-gray-800 leading-none">
                        {activeShift ? `Caja Abierta - ${user.name}` : 'Caja Cerrada'}
                    </h3>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">
                        {(() => {
                            if (!activeShift?.startTime) return 'Caja abierta recientemente';
                            // Convertir formato SQLite (YYYY-MM-DD HH:MM:SS) a ISO para que JS lo entienda
                            const dateStr = activeShift.startTime.includes(' ') && !activeShift.startTime.includes('T') 
                                ? activeShift.startTime.replace(' ', 'T') 
                                : activeShift.startTime;
                            const d = new Date(dateStr);
                            return isNaN(d.getTime()) 
                                ? 'Iniciado recientemente' 
                                : `Iniciado: ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}`;
                        })()}
                    </p>
                </div>
            </div>

            <div className="flex gap-3">
                {activeShift ? (
                    <>
                        <div className="flex items-center gap-6 px-6 border-l md:border-x border-gray-100 mx-0 md:mx-4">
                            <div className="text-center">
                                <p className="text-[10px] text-gray-400 font-bold uppercase">Efectivo</p>
                                <p className="font-black text-green-600">${formatMoney(activeShift.totalCash || 0)}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-[10px] text-gray-400 font-bold uppercase">Tarjeta</p>
                                <p className="font-black text-blue-600">${formatMoney(activeShift.totalCard || 0)}</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => {
                                setShiftFormData({ ...shiftFormData, realCash: '', realCard: '', notes: '' });
                                setIsClosingShift(true);
                            }}
                            className="bg-gray-900 text-white px-6 py-2.5 rounded-2xl font-bold text-sm hover:bg-black transition shadow-lg"
                        >
                            Cerrar Turno
                        </button>
                    </>
                ) : (
                    <button 
                        onClick={() => setIsOpeningShift(true)}
                        className="bg-green-600 text-white px-8 py-2.5 rounded-2xl font-bold text-sm hover:bg-green-700 transition shadow-lg"
                    >
                        Abrir Caja
                    </button>
                )}
                <button onClick={toggleDrawer} className="p-2.5 bg-gray-100 text-gray-500 rounded-2xl hover:bg-gray-200" title="Abrir Gaveta Manual">
                    <Printer size={20} />
                </button>
            </div>
        </div>

        <div className="flex z-10 w-full mb-6">
          <div className="relative w-full shadow-md rounded-2xl bg-white border border-gray-100 flex items-center p-2 focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all">
            <Search className="text-gray-400 ml-3 mr-2" size={24} />
            <input 
              id="pos-search-input"
              type="text"
              className="w-full h-12 outline-none text-gray-700 text-lg sm:text-xl px-2 font-medium bg-transparent"
              placeholder="Buscar producto o escanear código (F1)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        </div>

        {/* Breadcrumbs / Navigation Status */}
        {!search && (
          <div className="flex items-center gap-2 mb-4 text-sm overflow-x-auto whitespace-nowrap pb-1">
            <button 
              onClick={resetNav}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition ${navPath.length === 0 ? 'bg-blue-100 text-blue-700 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              <Layers size={14} /> Inicio
            </button>
            {navPath.map((p, idx) => (
              <React.Fragment key={idx}>
                <ChevronRight size={14} className="text-gray-300 flex-shrink-0" />
                <button 
                  onClick={() => setNavPath(navPath.slice(0, idx + 1))}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-lg transition ${idx === navPath.length - 1 ? 'bg-blue-100 text-blue-700 font-bold' : 'text-gray-500 hover:bg-gray-100'}`}
                >
                  {p.type === 'FAMILY' ? <Box size={14} /> : <Tag size={14} />}
                  {cleanProductName(p.name)}
                </button>
              </React.Fragment>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto content-start pb-4">
          {items.map(item => (
            <button 
              key={`${item._type}-${item.id}`}
              onClick={() => handleItemClick(item)}
              className={`bg-white p-4 rounded-2xl border-2 transition-all text-center flex flex-col items-center justify-center relative group
                ${item._type === 'SKU' ? 'border-gray-100 hover:border-blue-400 hover:shadow-lg' : 'border-blue-50 hover:border-blue-200 hover:bg-blue-50/30'}`}
            >
              {/* Icon rendering logic based on level */}
              <div className="mb-3">
                {item._type === 'FAMILY' ? (
                  <IconDisplay icon={item.icon} size="4xl" />
                ) : item._type === 'VARIANT' ? (
                  <div className="bg-blue-100 p-3 rounded-xl text-blue-600 group-hover:scale-110 transition">
                    <Box size={24} />
                  </div>
                ) : (
                  <div className="bg-gray-50 p-3 rounded-xl text-gray-400 group-hover:text-blue-500 transition">
                    <Package size={24} />
                  </div>
                )}
              </div>

              <h3 className={`font-bold leading-tight ${item._type === 'SKU' ? 'text-gray-800 text-sm' : 'text-blue-800 text-sm'}`}>
                {cleanProductName(item.name)}
              </h3>

              {item.brand && <span className="text-[10px] text-gray-400 uppercase mt-1">{item.brand}</span>}

              {item._type === 'SKU' && (
                <div className="mt-3 flex items-center justify-between w-full">
                  <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-md">
                    STOCK: {item.stock}
                  </span>
                  <span className="font-black text-blue-600 text-base">${formatMoney(item.price)}</span>
                </div>
              )}

              {/* Badges for navigation */}
              {item._type === 'FAMILY' && (
                <span className="absolute top-2 right-2 bg-blue-100 text-blue-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {item.variant_count || 0}
                </span>
              )}
              {item._type === 'VARIANT' && (
                <span className="absolute top-2 right-2 bg-blue-100 text-blue-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {item.sku_count || 0}
                </span>
              )}

              {item._type !== 'SKU' && (
                <div className="mt-2 text-blue-400 opacity-0 group-hover:opacity-100 transition">
                  <ChevronRight size={16} className="mx-auto" />
                </div>
              )}
            </button>
          ))}
          
          {items.length === 0 && !isLoading && (
             <div className="col-span-full py-10 text-center text-gray-400">
                <Box size={40} className="mx-auto mb-2 opacity-20" />
                <p>No hay elementos en esta categoría</p>
                {navPath.length > 0 && <button onClick={goBack} className="text-blue-500 hover:underline mt-2">Regresar</button>}
             </div>
          )}
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-96 bg-white border-l border-gray-200 flex flex-col shadow-xl">
        <div className="p-6 border-b border-gray-100 bg-gray-50">
          <h2 className="text-xl font-bold flex items-center mb-4">
            <Printer className="mr-2" size={20} />
            Facturación
          </h2>
          
          <div className="flex space-x-2 mb-4 bg-gray-200 p-1 rounded-lg">
             <button onClick={() => setInvoiceType('FINAL')} className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${invoiceType === 'FINAL' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Consumo</button>
             <button onClick={() => setInvoiceType('FISCAL')} className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${invoiceType === 'FISCAL' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>Fiscal (B01)</button>
          </div>

          {invoiceType === 'FINAL' ? (
             <select 
               className="w-full bg-white border border-gray-200 rounded p-2 text-sm text-gray-700 outline-none"
               onChange={(e) => {
                   const clientId = parseInt(e.target.value);
                   const client = clients.find(c => c.id === clientId);
                   setSelectedClient(client || null);
               }}
             >
               <option value="">Cliente General</option>
               {clients.map(c => (
                   <option key={c.id} value={c.id}>{c.name}</option>
               ))}
             </select>
          ) : (
             <div className="space-y-3 bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                <div className="flex space-x-2">
                   <input type="text" placeholder="RNC o Cédula..." value={rncInput} onChange={e => setRncInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearchRnc()} className="flex-1 p-2 text-sm rounded-lg border border-blue-200 outline-none focus:border-blue-400 bg-white" />
                   <button onClick={handleSearchRnc} className="bg-blue-600 text-white px-4 rounded-lg hover:bg-blue-700 transition flex items-center justify-center">
                       {isSearchingRnc ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Search size={16} />}
                   </button>
                </div>
                <input type="text" placeholder="Razón Social (Aparecerá aquí)" value={clientNameInput} onChange={e => setClientNameInput(e.target.value)} className="w-full p-2 text-sm rounded-lg border border-blue-200 outline-none focus:border-blue-400 bg-white font-medium text-gray-800" />
             </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 && (
            <div className="text-center text-gray-400 mt-10">
              Carrito vacío
            </div>
          )}
          {cart.map(item => (
            <div key={item.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg">
              <div>
                <div className="font-medium">{cleanProductName(item.name)}</div>
                <div className="flex items-center space-x-2 mt-1">
                   <button 
                     onClick={() => updateQuantity(item.id, item.quantity - 1)}
                     className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded shadow-sm text-gray-700 font-bold hover:bg-gray-300"
                   >
                     -
                   </button>
                   <input 
                     type="number" 
                     value={item.quantity} 
                     onChange={(e) => updateQuantity(item.id, e.target.value)} 
                     className="w-16 text-center border-none bg-white rounded shadow-inner py-0.5 font-bold text-blue-600"
                   />
                   <button 
                     onClick={() => updateQuantity(item.id, item.quantity + 1)}
                     className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded shadow-sm text-gray-700 font-bold hover:bg-gray-300"
                   >
                     +
                   </button>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <span className="font-bold">${formatMoney(item.quantity * item.price)}</span>
                <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-600">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 bg-white border-t border-gray-100 shadow-xl">
          {(() => {
              const currentSubtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
              const currentTax = currentSubtotal * 0.18;
              const currentTotal = currentSubtotal + currentTax;
              
              return (
                  <>
                    <div className="flex justify-between text-gray-600 mb-2 font-medium">
                        <span>Subtotal</span>
                        <span>${formatMoney(currentSubtotal)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600 mb-4 font-medium">
                        <span>Itbis (18%)</span>
                        <span>${formatMoney(currentTax)}</span>
                    </div>
                    <div className="flex justify-between text-2xl font-black text-gray-900 mb-6">
                        <span>Total</span>
                        <span>${formatMoney(currentTotal)}</span>
                    </div>
                  </>
              );
          })()}

             <button 
                id="pos-checkout-btn"
                disabled={cart.length === 0}
                onClick={handleCheckoutDraft}
                className={`w-full py-5 rounded-2xl font-black text-xl flex flex-col items-center justify-center transition-all shadow-xl shadow-blue-500/20 active:scale-95 ${cart.length === 0 ? 'bg-gray-200 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
             >
               <span>COBRAR E IMPRIMIR (F2)</span>
             </button>
             <button onClick={() => setCart([])} className="text-gray-400 text-xs font-bold hover:text-red-500 mt-2">Vaciar Carrito (F4)</button>
          </div>
        </div>
      </div>

      {/* --- MODALS --- */}
      
      {/* Payment Modal */}
      <PaymentModal 
        isOpen={isPaymentModalOpen} 
        total={cart.reduce((sum, i) => sum + (i.price * i.quantity), 0) * 1.18}
        onClose={() => setIsPaymentModalOpen(false)}
        onConfirm={triggerPayment}
      />

      {/* Open Shift Modal */}
      {isOpeningShift && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl flex flex-col items-center">
                <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6">
                    <Landmark size={40} />
                </div>
                <h2 className="text-2xl font-black text-gray-800 mb-2">Apertura de Caja</h2>
                <p className="text-gray-500 text-center mb-8">Ingrese el monto en efectivo con el que inicia el turno para el fondo de caja.</p>
                
                <div className="w-full mb-8">
                    <label className="text-gray-400 font-bold text-xs uppercase block mb-2 px-1">Fondo Inicial (RD$)</label>
                    <input 
                        autoFocus
                        type="number"
                        className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-5 text-3xl font-black text-gray-800 focus:border-green-500 transition-all outline-none text-center"
                        value={shiftFormData.baseAmount}
                        onChange={e => setShiftFormData({...shiftFormData, baseAmount: e.target.value})}
                    />
                </div>

                <div className="flex gap-4 w-full">
                    <button onClick={() => setIsOpeningShift(false)} className="flex-1 py-4 text-gray-500 font-bold hover:bg-gray-100 rounded-2xl">Cancelar</button>
                    <button onClick={handleOpenShift} className="flex-1 py-4 bg-green-600 text-white font-black rounded-2xl shadow-lg hover:bg-green-700">ABRIR TURNO</button>
                </div>
            </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {isClosingShift && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-xl p-8 shadow-2xl overflow-y-auto max-h-[90vh]">
                <h2 className="text-2xl font-black text-gray-800 mb-6">Cierre de Caja y Arqueo</h2>
                
                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Efectivo en Sistema</p>
                        <p className="text-2xl font-black text-gray-800">${formatMoney((activeShift.totalCash || 0) + (activeShift.baseAmount || 0))}</p>
                    </div>
                    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                        <p className="text-[10px] text-gray-400 font-bold uppercase mb-1">Tarjeta en Sistema</p>
                        <p className="text-2xl font-black text-gray-800">${formatMoney(activeShift.totalCard || 0)}</p>
                    </div>
                </div>

                <div className="space-y-6 mb-8">
                    <div>
                        <label className="text-gray-400 font-bold text-xs uppercase block mb-2">Efectivo Físico en Caja</label>
                        <input 
                            type="number"
                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-xl font-bold text-gray-800 focus:border-blue-500 transition-all outline-none"
                            placeholder="Monto contado..."
                            value={shiftFormData.realCash}
                            onChange={e => setShiftFormData({...shiftFormData, realCash: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="text-gray-400 font-bold text-xs uppercase block mb-2">Voucher Tarjeta (Total)</label>
                        <input 
                            type="number"
                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-xl font-bold text-gray-800 focus:border-blue-500 transition-all outline-none"
                            placeholder="Monto según verifón..."
                            value={shiftFormData.realCard}
                            onChange={e => setShiftFormData({...shiftFormData, realCard: e.target.value})}
                        />
                    </div>
                    <div>
                        <label className="text-gray-400 font-bold text-xs uppercase block mb-2">Notas del Cierre</label>
                        <textarea 
                            className="w-full bg-gray-50 border-2 border-gray-100 rounded-2xl p-4 text-sm font-medium text-gray-700 focus:border-blue-500 transition-all outline-none h-24 resize-none"
                            placeholder="Opcional: novedades, descuadres..."
                            value={shiftFormData.notes}
                            onChange={e => setShiftFormData({...shiftFormData, notes: e.target.value})}
                        ></textarea>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button onClick={() => setIsClosingShift(false)} className="flex-1 py-4 text-gray-500 font-bold hover:bg-gray-100 rounded-2xl">Volver</button>
                    <button onClick={handleCloseShift} className="flex-1 py-4 bg-gray-900 text-white font-black rounded-2xl shadow-lg hover:bg-black uppercase tracking-widest">FINALIZAR TURNO</button>
                </div>
            </div>
        </div>
      )}
    </>
  );
}
