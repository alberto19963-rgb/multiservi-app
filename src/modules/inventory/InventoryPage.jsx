import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Search, Package, ChevronRight, ArrowLeft, Barcode, Edit2, Trash2, AlertTriangle, Box, Tag, Layers, List, Save } from 'lucide-react';
import { db } from '../../api/electron';
import { cleanProductName } from '../../lib/utils';

// ── Utilidades ──────────────────────────────────────────────────────────────
const UNIT_OPTIONS = ['UNI', 'GAL', 'LIT', 'LIB', 'KG', 'CAJA', 'FARDO', 'PAQUETE', 'SACO', 'ROLLO', 'PAR', 'M', 'M2'];
const DEFAULT_ICONS = ['📦', '💧', '🧴', '🧼', '🍺', '🌾', '🧂', '🛢️', '🎁', '🧻', '🏗️', '🍬', '💊', '🧃', '🥩', '🧹', '🪣'];

function IconDisplay({ icon, size = '4xl', className = '' }) {
  if (!icon) return <span className={`text-${size} ${className}`}>📦</span>;
  if (icon.startsWith('data:image')) {
    return <img src={icon} alt="icon" className={`object-contain ${className}`} style={{ width: size === '4xl' ? '48px' : '32px', height: size === '4xl' ? '48px' : '32px' }} />;
  }
  return <span className={`text-${size} leading-none ${className}`}>{icon}</span>;
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-lg text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function StockBadge({ stock, minStock }) {
  const low = stock <= (minStock || 5);
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${low ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>
      {low && <AlertTriangle size={10} className="inline mr-1" />}
      {stock}
    </span>
  );
}

// ── Entrada Rápida de Inventario ─────────────────────────────────────────────
function QuickStockModal({ onClose, onStockAdjusted }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [adjustQty, setAdjustQty] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const delay = setTimeout(async () => {
      const q = query.trim();
      if (q.length > 1) {
        const res = await db.searchSkusGlobal(q);
        setResults(res || []);
        
        // Auto-selección si el código de barras coincide exactamente
        if (res.length === 1 && res[0].barcode === q) {
          setSelected(res[0]);
        }
      } else {
        setResults([]);
      }
    }, 300);
    return () => clearTimeout(delay);
  }, [query]);

  const handleSave = async () => {
    const qty = parseFloat(adjustQty);
    if (!selected || isNaN(qty) || qty === 0) return;
    
    setIsSaving(true);
    await db.adjustSkuStock({ id: selected.id, delta: qty, barcode: selected.barcode });
    setIsSaving(false);
    
    // Limpiar para el siguiente escaneo
    setSelected(null);
    setAdjustQty('');
    setQuery('');
    setResults([]);
    document.getElementById('quick-stock-search')?.focus();
    
    if (onStockAdjusted) onStockAdjusted();
  };

  return (
    <Modal title="Inventario Nuevo (Entrada Rápida)" onClose={onClose}>
      <div className="space-y-4">
        {!selected ? (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Escanear Código o Buscar Nombre</label>
            <div className="relative">
              <Search className="absolute left-3 top-3 text-gray-400" size={18} />
              <input
                id="quick-stock-search"
                autoFocus
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Ej: 5534514 o 'Cloro'..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>
            
            <div className="mt-4 max-h-60 overflow-y-auto space-y-2">
              {results.map(item => (
                <div 
                  key={item.id} 
                  onClick={() => setSelected(item)}
                  className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-blue-50 border border-gray-100 rounded-xl cursor-pointer transition group"
                >
                  <IconDisplay icon={item.family_icon} size="2xl" />
                  <div className="flex-1">
                    <div className="font-bold text-sm text-gray-800">
                      {cleanProductName(`${item.family_name} - ${item.variant_name} - ${item.sku_name}`)}
                    </div>
                    <div className="text-[10px] text-gray-500 uppercase">{item.brand} • {item.barcode || 'Sin código'}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-blue-600">Stock: {item.stock}</div>
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-blue-500" />
                  </div>
                </div>
              ))}
              {query.length > 1 && results.length === 0 && (
                <div className="text-center py-4 text-gray-400 text-sm">No se encontraron productos</div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
             <div className="flex items-center gap-3 mb-4">
                <IconDisplay icon={selected.family_icon} size="2xl" />
                <div>
                   <div className="font-bold text-gray-800">{selected.sku_name}</div>
                   <div className="text-xs text-blue-600 font-medium">Actual: {selected.stock} {selected.unit}</div>
                </div>
                <button onClick={() => setSelected(null)} className="ml-auto text-gray-400 hover:text-gray-600 text-sm">Cambiar</button>
             </div>
             
             <div className="flex gap-2">
               <div className="flex-1">
                 <label className="block text-[10px] font-bold text-gray-500 mb-1 ml-1">CANTIDAD A SUMAR</label>
                 <input
                   autoFocus
                   type="number"
                   className="w-full px-4 py-3 border-2 border-blue-200 rounded-xl focus:border-blue-500 outline-none font-bold text-xl text-blue-700"
                   placeholder="Ej: 24"
                   value={adjustQty}
                   onChange={e => setAdjustQty(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && handleSave()}
                 />
               </div>
               <button 
                 onClick={handleSave}
                 disabled={isSaving || !adjustQty}
                 className="mt-5 px-6 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md font-bold flex items-center gap-2 transition disabled:opacity-50"
               >
                 {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Save size={20} />}
                 Cargar
               </button>
             </div>
          </div>
        )}
        <div className="text-center">
           <p className="text-[10px] text-gray-400">Escanea el código de barras para una carga más rápida</p>
        </div>
      </div>
    </Modal>
  );
}

// ── Nivel 1: Familias ────────────────────────────────────────────────────────
function FamiliesView({ onSelectFamily }) {
  const [families, setFamilies] = useState([]);
  const [icons, setIcons] = useState(DEFAULT_ICONS);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', icon: '📦' });
  const [showQuickStock, setShowQuickStock] = useState(false);

  const load = useCallback(async () => {
    if (!window.electronAPI) return;
    const [fams, storedIcons] = await Promise.all([
      db.getFamilies(),
      db.getSetting('inventory_icons')
    ]);
    setFamilies(fams || []);
    if (storedIcons) {
      try { setIcons(JSON.parse(storedIcons)); } catch (e) { setIcons(DEFAULT_ICONS); }
    }
  }, []);

  useEffect(() => { 
    load(); 
    
    // SaaS Auto-Refresh Listener
    if (window.electronAPI) {
        const removeListener = window.electronAPI.onCloudSyncRefresh((type) => {
            console.log(`[SaaS] Sincronización detectada en Inventario (${type}), refrescando...`);
            load();
        });
        return () => removeListener();
    }
  }, [load]);

  const saveIconsConfig = async (newIcons) => {
    setIcons(newIcons);
    await db.saveSetting('inventory_icons', JSON.stringify(newIcons));
  };

  const handleUploadIcon = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Check file size (limit to 200kb for Base64 storage)
    if (file.size > 200 * 1024) {
      alert('La imagen es muy pesada. Usa una de menos de 200KB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target.result;
      if (!icons.includes(base64)) {
        saveIconsConfig([...icons, base64]);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteIcon = (iconToDelete, e) => {
    e.stopPropagation();
    if (!confirm('¿Quitar este icono de la lista?')) return;
    const newIcons = icons.filter(i => i !== iconToDelete);
    saveIconsConfig(newIcons);
    if (form.icon === iconToDelete) setForm({ ...form, icon: '📦' });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (modal?.edit) {
      await db.updateFamily({ id: modal.edit.id, name: form.name, icon: form.icon });
    } else {
      await db.addFamily({ name: form.name, icon: form.icon });
    }
    setModal(null);
    load();
  };

  const handleDelete = async (family) => {
    if (!confirm(`¿Eliminar la familia "${family.name}" y todos sus productos?`)) return;
    await db.deleteFamily(family.id);
    load();
  };

  const openAdd = () => {
    setForm({ name: '', icon: '📦' });
    setModal('add');
  };

  const openEdit = (family) => {
    setForm({ name: family.name, icon: family.icon || '📦' });
    setModal({ edit: family });
  };

  const filtered = families.filter(f => f.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="p-8 h-full flex flex-col">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventario</h1>
          <p className="text-gray-500 text-sm mt-1">Selecciona una familia de productos para gestionar</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowQuickStock(true)}
            className="border-2 border-blue-600 text-blue-600 hover:bg-blue-50 px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold transition"
          >
            <Barcode size={18} /> Inventario Nuevo
          </button>
          <button
            onClick={openAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-sm transition"
          >
            <Plus size={18} /> Nueva Familia
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-2.5 mb-6 shadow-sm">
        <Search size={18} className="text-gray-400" />
        <input
          className="flex-1 outline-none text-gray-700 placeholder-gray-400"
          placeholder="Buscar familia..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Grid de Familias */}
      {filtered.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <Layers size={64} className="mb-4 opacity-30" />
            <p className="font-medium">No hay familias creadas</p>
            <p className="text-sm">Haz clic en "Nueva Familia" para comenzar</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 overflow-y-auto pb-4">
            {filtered.map(family => (
              <div
                key={family.id}
                onClick={() => onSelectFamily(family)}
                className="bg-white border border-gray-200 hover:border-blue-300 hover:shadow-md rounded-2xl p-5 cursor-pointer transition group relative"
              >
                <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                  <button onClick={e => { e.stopPropagation(); openEdit(family); }} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                    <Edit2 size={14} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(family); }} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="mb-3 flex items-center justify-center h-12">
                   <IconDisplay icon={family.icon} size="4xl" />
                </div>
                <div className="font-bold text-gray-800 text-sm leading-tight text-center">{family.name}</div>
                <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  <Package size={11} />
                  {family.variant_count || 0} producto{family.variant_count !== 1 ? 's' : ''}
                </div>
                <div className="mt-3 flex items-center text-blue-500 text-xs font-medium group-hover:text-blue-700 transition">
                  Ver productos <ChevronRight size={14} />
                </div>
              </div>
          ))}
        </div>
      )}

      {/* Modal — Entrada Rápida de Inventario */}
      {showQuickStock && (
        <QuickStockModal 
          onClose={() => setShowQuickStock(false)} 
          onStockAdjusted={load}
        />
      )}

      {/* Modal — Nueva Familia */}
      {modal && (
        <Modal title={modal?.edit ? 'Editar Familia' : 'Nueva Familia'} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Familia</label>
              <input
                autoFocus
                className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="Ej: Agua, Cloro, Desinfectante..."
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && handleSave()}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Ícono</label>
              <div className="grid grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1">
                {icons.map(icon => (
                  <div key={icon} className="relative group">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, icon })}
                      className={`w-full aspect-square flex items-center justify-center rounded-xl border-2 transition ${form.icon === icon ? 'border-blue-500 bg-blue-50 text-blue-600' : 'border-gray-100 hover:border-gray-300'}`}
                    >
                      <IconDisplay icon={icon} size="2xl" />
                    </button>
                    <button 
                      onClick={(e) => handleDeleteIcon(icon, e)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[10px] opacity-0 group-hover:opacity-100 transition shadow-sm"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                
                {/* Botón Subir */}
                <label className="aspect-square flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition text-gray-400 hover:text-blue-500">
                  <Plus size={20} />
                  <span className="text-[10px] font-bold mt-1">Subir</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleUploadIcon} />
                </label>
              </div>
              <p className="text-[10px] text-gray-400 mt-2 italic px-1">
                * Recomendado: PNG/SVG cuadrado (1:1), fondo transparente, 128x128px.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition">Cancelar</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-sm">
                {modal?.edit ? 'Guardar Cambios' : 'Crear Familia'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Nivel 2: Variantes ───────────────────────────────────────────────────────
function VariantsView({ family, onBack, onSelectVariant }) {
  const [variants, setVariants] = useState([]);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({ name: '', brand: '', description: '' });

  const load = useCallback(async () => {
    if (!window.electronAPI) return;
    const data = await db.getVariants(family.id);
    setVariants(data || []);
  }, [family.id]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    if (modal?.edit) {
      await db.updateVariant({ id: modal.edit.id, ...form });
    } else {
      await db.addVariant({ familyId: family.id, ...form });
    }
    setModal(null);
    load();
  };

  const handleDelete = async (v) => {
    if (!confirm(`¿Eliminar el producto "${v.name}"?`)) return;
    await db.deleteVariant(v.id);
    load();
  };

  const openEdit = (v) => {
    setForm({ name: v.name, brand: v.brand || '', description: v.description || '' });
    setModal({ edit: v });
  };

  return (
    <div className="p-8 h-full flex flex-col">
      {/* Breadcrumb */}
      <button onClick={onBack} className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm mb-4 w-fit transition">
        <ArrowLeft size={16} /> Todas las Familias
      </button>

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <div className="flex items-center gap-3">
            <IconDisplay icon={family.icon} size="4xl" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{family.name}</h1>
              <p className="text-gray-500 text-sm">Selecciona un producto para ver sus presentaciones</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => { setForm({ name: '', brand: '', description: '' }); setModal('add'); }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-sm transition"
        >
          <Plus size={18} /> Nuevo Producto
        </button>
      </div>

      {/* Grid de Variantes */}
      {variants.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
          <Box size={64} className="mb-4 opacity-30" />
          <p className="font-medium">No hay productos en esta familia</p>
          <p className="text-sm">Haz clic en "Nuevo Producto" para agregar uno</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-4">
          {variants.map(v => (
            <div
              key={v.id}
              onClick={() => onSelectVariant(v)}
              className="bg-white border border-gray-200 hover:border-blue-300 hover:shadow-md rounded-2xl p-5 cursor-pointer transition group relative"
            >
              <div className="absolute top-2 right-2 hidden group-hover:flex gap-1">
                <button onClick={e => { e.stopPropagation(); openEdit(v); }} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                  <Edit2 size={14} />
                </button>
                <button onClick={e => { e.stopPropagation(); handleDelete(v); }} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                  <Trash2 size={14} />
                </button>
              </div>

              <div className="font-bold text-gray-800 text-lg">{v.name}</div>
              {v.brand && <div className="text-xs text-blue-600 font-medium mt-0.5">{v.brand}</div>}
              {v.description && <div className="text-sm text-gray-500 mt-1 line-clamp-2">{v.description}</div>}

              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><Tag size={11} /> {v.sku_count || 0} presentacion{v.sku_count !== 1 ? 'es' : ''}</span>
                  <span className="flex items-center gap-1"><Package size={11} /> Stock: {v.total_stock || 0}</span>
                </div>
                <ChevronRight size={16} className="text-blue-400 group-hover:text-blue-600 transition" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <Modal title={modal?.edit ? 'Editar Producto' : `Nuevo Producto en ${family.name}`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre del Producto *</label>
              <input autoFocus className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Ej: Agua Cristal, Clorox..." value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Marca (opcional)</label>
              <input className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Ej: Cristal, 3C, Fabuloso..." value={form.brand} onChange={e => setForm({ ...form, brand: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descripción (opcional)</label>
              <textarea className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                rows={2} placeholder="Descripción breve..." value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition">Cancelar</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-sm">
                {modal?.edit ? 'Guardar Cambios' : 'Crear Producto'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Nivel 3: SKUs / Presentaciones ──────────────────────────────────────────
function SkusView({ family, variant, onBack }) {
  const [skus, setSkus] = useState([]);
  const [modal, setModal] = useState(null);
  const [adjustModal, setAdjustModal] = useState(null); // { sku, delta }
  const [form, setForm] = useState({ name: '', barcode: '', price: '', cost: '', stock: '', minStock: '5', unit: 'UNI', qtyPerPack: '1' });

  const load = useCallback(async () => {
    if (!window.electronAPI) return;
    const data = await db.getSkus(variant.id);
    setSkus(data || []);
  }, [variant.id]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!form.name.trim()) return alert('El nombre de la presentación es requerido');
    const payload = {
      variantId: variant.id,
      variantName: variant.name,
      familyName: family.name,
      name: form.name,
      barcode: form.barcode || null,
      price: parseFloat(form.price) || 0,
      cost: parseFloat(form.cost) || 0,
      stock: parseFloat(form.stock) || 0,
      minStock: parseFloat(form.minStock) || 5,
      unit: form.unit,
      qtyPerPack: parseFloat(form.qtyPerPack) || 1,
    };
    if (modal?.edit) {
      await db.updateSku({ id: modal.edit.id, ...payload });
    } else {
      await db.addSku(payload);
    }
    setModal(null);
    load();
  };

  const handleDelete = async (sku) => {
    if (!confirm(`¿Eliminar la presentación "${sku.name}"?`)) return;
    await db.deleteSku(sku.id);
    load();
  };

  const handleAdjust = async () => {
    if (!adjustModal) return;
    const delta = parseFloat(adjustModal.delta) || 0;
    await db.adjustSkuStock({ id: adjustModal.sku.id, delta, barcode: adjustModal.sku.barcode });
    setAdjustModal(null);
    load();
  };

  const openEdit = (sku) => {
    setForm({
      name: sku.name, barcode: sku.barcode || '', price: String(sku.price), cost: String(sku.cost),
      stock: String(sku.stock), minStock: String(sku.min_stock), unit: sku.unit, qtyPerPack: String(sku.qty_per_pack)
    });
    setModal({ edit: sku });
  };

  const openAdd = () => {
    setForm({ name: '', barcode: '', price: '', cost: '', stock: '', minStock: '5', unit: 'UNI', qtyPerPack: '1' });
    setModal('add');
  };

  return (
    <div className="p-8 h-full flex flex-col">
      {/* Breadcrumb */}
      <button onClick={onBack} className="flex items-center gap-2 text-blue-600 hover:text-blue-800 font-medium text-sm mb-4 w-fit transition">
        <ArrowLeft size={16} /> <IconDisplay icon={family.icon} size="sm" className="inline-block" /> {family.name}
      </button>

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{variant.name}</h1>
          {variant.brand && <span className="text-sm text-blue-600 font-medium">{variant.brand}</span>}
          <p className="text-gray-500 text-sm mt-0.5">Presentaciones disponibles para venta</p>
        </div>
        <button onClick={openAdd} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 font-bold shadow-sm transition">
          <Plus size={18} /> Nueva Presentación
        </button>
      </div>

      {/* Tabla de SKUs */}
      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden flex-1 overflow-y-auto">
        {skus.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 py-16">
            <Tag size={56} className="mb-4 opacity-30" />
            <p className="font-medium">Sin presentaciones</p>
            <p className="text-sm">Agrega la primera presentación de {variant.name}</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="p-4 text-sm font-semibold text-gray-600">Presentación</th>
                <th className="p-4 text-sm font-semibold text-gray-600">Código de Barras</th>
                <th className="p-4 text-sm font-semibold text-gray-600 text-center">Stock</th>
                <th className="p-4 text-sm font-semibold text-gray-600 text-right">Precio Venta</th>
                <th className="p-4 text-sm font-semibold text-gray-600 text-right">Costo</th>
                <th className="p-4 text-sm font-semibold text-gray-600 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {skus.map(sku => (
                <tr key={sku.id} className="hover:bg-gray-50 transition">
                  <td className="p-4">
                    <div className="font-medium text-gray-800">{sku.name}</div>
                    <div className="text-xs text-gray-500">{sku.unit} · x{sku.qty_per_pack}</div>
                  </td>
                  <td className="p-4">
                    {sku.barcode ? (
                      <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded text-gray-700 flex items-center gap-1 w-fit">
                        <Barcode size={12} /> {sku.barcode}
                      </span>
                    ) : (
                      <span className="text-gray-400 text-sm">— Sin código</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <StockBadge stock={sku.stock} minStock={sku.min_stock} />
                      <button
                        onClick={() => setAdjustModal({ sku, delta: '' })}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium hover:underline"
                      >
                        Ajustar
                      </button>
                    </div>
                  </td>
                  <td className="p-4 text-right font-bold text-gray-800">RD${sku.price?.toLocaleString()}</td>
                  <td className="p-4 text-right text-gray-500 text-sm">RD${sku.cost?.toLocaleString()}</td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button onClick={() => openEdit(sku)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition">
                        <Edit2 size={16} />
                      </button>
                      <button onClick={() => handleDelete(sku)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal Presentación */}
      {modal && (
        <Modal title={modal?.edit ? 'Editar Presentación' : `Nueva Presentación de ${variant.name}`} onClose={() => setModal(null)}>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre de la Presentación *</label>
              <input autoFocus className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Ej: Unidad 500ml, Fardo x24, Galón..." value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Código de Barras</label>
              <div className="relative">
                <input id="barcode-field" className="w-full border border-gray-300 rounded-xl px-4 py-2.5 pr-10 font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Escanea o escribe el código..." value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} />
                <button type="button" onClick={() => document.getElementById('barcode-field').focus()}
                  className="absolute right-3 top-3 text-gray-400 hover:text-blue-600 transition">
                  <Barcode size={18} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unidad</label>
                <select className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                  {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unid. por Paquete</label>
                <input type="number" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="24" value={form.qtyPerPack} onChange={e => setForm({ ...form, qtyPerPack: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Precio Venta (RD$)</label>
                <input type="number" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                  placeholder="0.00" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Costo (RD$)</label>
                <input type="number" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="0.00" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Inicial</label>
                <input type="number" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="0" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Stock Mínimo</label>
                <input type="number" className="w-full border border-gray-300 rounded-xl px-3 py-2.5 focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="5" value={form.minStock} onChange={e => setForm({ ...form, minStock: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setModal(null)} className="flex-1 py-2.5 font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition">Cancelar</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-sm">
                {modal?.edit ? 'Guardar Cambios' : 'Crear Presentación'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Ajuste de Stock */}
      {adjustModal && (
        <Modal title={`Ajustar Stock — ${adjustModal.sku.name}`} onClose={() => setAdjustModal(null)}>
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <div className="text-sm text-gray-500">Stock Actual</div>
              <div className="text-4xl font-bold text-gray-800">{adjustModal.sku.stock}</div>
              <div className="text-sm text-gray-400">{adjustModal.sku.unit}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad a Agregar / Quitar</label>
              <p className="text-xs text-gray-500 mb-2">Usa número positivo para agregar (+50) o negativo para restar (-10)</p>
              <input type="number" autoFocus className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-center text-xl font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="+50 ó -10" value={adjustModal.delta} onChange={e => setAdjustModal({ ...adjustModal, delta: e.target.value })} />
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setAdjustModal(null)} className="flex-1 py-2.5 font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition">Cancelar</button>
              <button onClick={handleAdjust} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition shadow-sm">Aplicar Ajuste</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Página Principal (Controlador de Navegación) ────────────────────────────
export default function InventoryPage() {
  const [view, setView] = useState('families'); // 'families' | 'variants' | 'skus'
  const [selectedFamily, setSelectedFamily] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(null);

  const goToVariants = (family) => {
    setSelectedFamily(family);
    setView('variants');
  };

  const goToSkus = (variant) => {
    setSelectedVariant(variant);
    setView('skus');
  };

  if (view === 'skus' && selectedFamily && selectedVariant) {
    return <SkusView family={selectedFamily} variant={selectedVariant} onBack={() => setView('variants')} />;
  }

  if (view === 'variants' && selectedFamily) {
    return <VariantsView family={selectedFamily} onBack={() => setView('families')} onSelectVariant={goToSkus} />;
  }

  return <FamiliesView onSelectFamily={goToVariants} />;
}
