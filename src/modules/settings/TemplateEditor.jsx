import React, { useState, useEffect } from 'react';
import { db } from '../../api/electron';
import { Palette, Image as ImageIcon, Layout, Save, RefreshCcw, Eye } from 'lucide-react';

export default function TemplateEditor() {
    const [config, setConfig] = useState({
        company_name: '',
        company_rnc: '',
        company_address: '',
        company_phone: '',
        company_logo: null,
        invoice_color: '#1e3a8a'
    });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        const data = await db.getConfig();
        const newConfig = { ...config };
        data.forEach(item => {
            if (newConfig.hasOwnProperty(item.key)) {
                newConfig[item.key] = item.value;
            }
        });
        setConfig(newConfig);
    };

    const handleLogoUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async () => {
            const base64 = reader.result;
            setConfig({ ...config, company_logo: base64 });
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const items = Object.entries(config).map(([key, value]) => ({ key, value }));
            const res = await db.saveConfig(items);
            if (res.success) {
                alert("Configuración guardada correctamente");
            }
        } catch (e) {
            alert("Error al guardar: " + e.message);
        } finally {
            setIsSaving(false);
        }
    };

    const [activeTab, setActiveTab] = useState('PDF'); // PDF or TICKET

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 italic tracking-tighter">Branding & Documentos</h1>
                    <p className="text-gray-500 font-medium">Personaliza la identidad visual de tus facturas y tickets</p>
                </div>
                <button 
                    onClick={handleSave}
                    disabled={isSaving}
                    className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black flex items-center hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-200 active:scale-95 disabled:opacity-50"
                >
                    {isSaving ? <RefreshCcw className="animate-spin mr-2" /> : <Save className="mr-2" />}
                    Guardar Identidad
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* CONFIGURATION PANEL */}
                <div className="lg:col-span-5 space-y-6">
                    <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-2xl space-y-8">
                        <section>
                            <h2 className="text-sm font-black flex items-center mb-4 text-gray-400 uppercase tracking-widest">
                                <ImageIcon className="mr-2 text-indigo-500" size={16} /> Logo Principal
                            </h2>
                            <div className="flex flex-col items-center gap-4 p-8 border-2 border-dashed border-gray-100 rounded-3xl bg-gray-50/50 hover:bg-gray-50 transition-colors">
                                {config.company_logo ? (
                                    <div className="relative group">
                                        <img src={config.company_logo} alt="Logo" className="h-24 w-auto object-contain bg-white p-4 rounded-2xl shadow-sm border border-gray-100" />
                                        <button 
                                            onClick={() => setConfig({...config, company_logo: null})}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <RefreshCcw size={12} />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="h-24 w-24 flex items-center justify-center bg-white rounded-3xl text-gray-300 border border-gray-100 shadow-inner">
                                        <ImageIcon size={40} />
                                    </div>
                                )}
                                <input 
                                    type="file" 
                                    accept="image/*" 
                                    onChange={handleLogoUpload}
                                    id="logo-upload"
                                    className="hidden"
                                />
                                <label 
                                    htmlFor="logo-upload"
                                    className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-50 cursor-pointer shadow-sm transition-all"
                                >
                                    {config.company_logo ? 'Cambiar Logo' : 'Seleccionar Imagen'}
                                </label>
                            </div>
                        </section>

                        <section>
                            <h2 className="text-sm font-black flex items-center mb-4 text-gray-400 uppercase tracking-widest">
                                <Palette className="mr-2 text-indigo-500" size={16} /> Color de Marca
                            </h2>
                            <div className="flex items-center gap-6 bg-gray-50 p-4 rounded-3xl border border-gray-100">
                                <input 
                                    type="color" 
                                    value={config.invoice_color}
                                    onChange={(e) => setConfig({ ...config, invoice_color: e.target.value })}
                                    className="h-16 w-16 rounded-2xl border-0 cursor-pointer p-1 bg-white shadow-sm"
                                />
                                <div className="flex-1">
                                    <p className="font-black text-gray-800 text-lg tracking-tighter">{config.invoice_color.toUpperCase()}</p>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Acento Visual</p>
                                </div>
                            </div>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-sm font-black flex items-center mb-2 text-gray-400 uppercase tracking-widest">
                                <Layout className="mr-2 text-indigo-500" size={16} /> Información Legal
                            </h2>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Nombre Comercial</label>
                                        <input 
                                            type="text" 
                                            value={config.company_name}
                                            onChange={(e) => setConfig({ ...config, company_name: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-gray-700"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase ml-1">RNC</label>
                                        <input 
                                            type="text" 
                                            value={config.company_rnc}
                                            onChange={(e) => setConfig({ ...config, company_rnc: e.target.value })}
                                            className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-gray-700"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Dirección Física</label>
                                    <input 
                                        type="text" 
                                        value={config.company_address}
                                        onChange={(e) => setConfig({ ...config, company_address: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-gray-700"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Teléfono</label>
                                    <input 
                                        type="text" 
                                        value={config.company_phone}
                                        onChange={(e) => setConfig({ ...config, company_phone: e.target.value })}
                                        className="w-full bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-gray-700"
                                    />
                                </div>
                            </div>
                        </section>
                    </div>
                </div>

                {/* PREVIEW PANEL */}
                <div className="lg:col-span-7 flex flex-col gap-4">
                    {/* FORMAT TABS */}
                    <div className="flex bg-gray-200/50 p-1 rounded-2xl w-fit">
                        <button 
                            onClick={() => setActiveTab('PDF')}
                            className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'PDF' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Formato Carta (PDF)
                        </button>
                        <button 
                            onClick={() => setActiveTab('TICKET')}
                            className={`px-6 py-2 rounded-xl text-xs font-black transition-all ${activeTab === 'TICKET' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Formato Ticket (80mm)
                        </button>
                    </div>

                    <div className="bg-gray-900 rounded-[3rem] p-1 shadow-2xl relative overflow-hidden flex-1 flex justify-center items-start pt-10 min-h-[700px]">
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-gray-900/80 backdrop-blur text-white text-[10px] px-3 py-1 rounded-full border border-gray-700 flex items-center uppercase tracking-widest font-black">
                            <Eye size={10} className="mr-2 text-indigo-400" /> Vista Previa Real
                        </div>
                        
                        {activeTab === 'PDF' ? (
                            <div className="bg-white h-[842px] w-[595px] rounded-sm p-12 overflow-hidden shadow-2xl scale-75 lg:scale-90 origin-top">
                                {/* HEADER PREVIEW */}
                                <div className="flex justify-between border-b-2 pb-6 mb-8" style={{ borderColor: config.invoice_color }}>
                                    <div>
                                        {config.company_logo && <img src={config.company_logo} alt="Logo" className="h-16 w-auto mb-3" />}
                                        <h1 className="text-3xl font-black m-0" style={{ color: config.invoice_color }}>{config.company_name || 'Multiservi Chavon'}</h1>
                                        <p className="text-xs text-gray-600 m-0 font-medium">RNC: {config.company_rnc || '131130429'}</p>
                                        <p className="text-xs text-gray-600 m-0 font-medium">{config.company_address || 'Dirección Principal'}</p>
                                        <p className="text-xs text-gray-600 m-0 font-medium">Tel: {config.company_phone || '809-556-4583'}</p>
                                    </div>
                                    <div className="text-right flex flex-col justify-end">
                                        <h2 className="text-sm font-black text-gray-400 uppercase tracking-[0.3em] mb-1">Cotización</h2>
                                        <div className="text-5xl font-black" style={{ color: config.invoice_color }}>#0001</div>
                                        <div className="text-xs text-gray-500 font-bold mt-2">Fecha: 22 de abril, 2026</div>
                                    </div>
                                </div>

                                {/* CLIENT PREVIEW */}
                                <div className="p-6 bg-gray-50 rounded-2xl mb-8 border-l-[6px]" style={{ borderLeftColor: config.invoice_color }}>
                                    <h3 className="text-[10px] text-gray-400 font-black uppercase mb-2 tracking-widest">Datos del Cliente</h3>
                                    <div className="text-lg font-black text-gray-900">Escuela Mercedes Laura Aguiar</div>
                                    <div className="text-sm font-bold text-gray-500 mt-1">RNC/Cédula: 430153036</div>
                                    <div className="text-sm font-bold text-gray-500">Teléfono: 809-951-1011</div>
                                </div>

                                {/* TABLE PREVIEW */}
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="bg-gray-100">
                                            <th className="p-4 text-left uppercase text-gray-500 font-black tracking-widest text-[10px]">Descripción del Artículo</th>
                                            <th className="p-4 text-center uppercase text-gray-500 font-black tracking-widest text-[10px]">Cant.</th>
                                            <th className="p-4 text-right uppercase text-gray-500 font-black tracking-widest text-[10px]">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="font-medium">
                                        <tr className="border-b border-gray-100">
                                            <td className="p-4">Cloro Chavon - Galon (Caja x 4)</td>
                                            <td className="p-4 text-center">5</td>
                                            <td className="p-4 text-right">$2,250.00</td>
                                        </tr>
                                        <tr className="border-b border-gray-100">
                                            <td className="p-4">Desinfectante Macier - Lavanda</td>
                                            <td className="p-4 text-center">10</td>
                                            <td className="p-4 text-right">$1,500.00</td>
                                        </tr>
                                    </tbody>
                                </table>

                                {/* TOTALS PREVIEW */}
                                <div className="mt-10 pt-6 border-t-2 border-gray-100 flex flex-col items-end gap-3">
                                    <div className="text-sm text-gray-500 font-bold">Subtotal: $3,750.00</div>
                                    <div className="text-sm text-gray-500 font-bold">ITBIS (18%): $675.00</div>
                                    <div className="text-4xl font-black pt-4 border-t-2 mt-2" style={{ color: config.invoice_color, borderColor: config.invoice_color }}>
                                        RD$ 4,425.00
                                    </div>
                                </div>

                                <div className="mt-20 text-center border-t pt-6 border-gray-50">
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">¡Gracias por su preferencia!</p>
                                    <p className="text-[9px] text-gray-400 mt-1">Este documento es una cotización informativa válida por 15 días.</p>
                                </div>
                            </div>
                        ) : (
                            /* TICKET PREVIEW */
                            <div className="bg-white w-[300px] p-6 shadow-2xl font-mono text-[11px] leading-tight text-gray-800 scale-110 origin-top">
                                <div className="text-center mb-4 space-y-1">
                                    {config.company_logo && <img src={config.company_logo} alt="Logo" className="h-10 w-auto mx-auto mb-2 grayscale" />}
                                    <div className="font-black text-lg leading-none">{config.company_name?.toUpperCase()}</div>
                                    <div>RNC: {config.company_rnc}</div>
                                    <div>{config.company_address}</div>
                                    <div>TEL: {config.company_phone}</div>
                                </div>
                                
                                <div className="border-y border-dashed py-2 my-2 text-center font-bold">
                                    FACTURA DE CONSUMO (B02)<br/>
                                    #0001 - 22/04/2026
                                </div>

                                <div className="space-y-1 mb-2">
                                    <div>CLIENTE: CONSUMIDOR FINAL</div>
                                    <div>ATENDIDO POR: ADMINISTRADOR</div>
                                </div>

                                <div className="border-b border-dashed mb-2"></div>
                                
                                <div className="space-y-2 mb-4">
                                    <div className="flex justify-between">
                                        <div className="flex-1">2.00 X CLORO CHAVON</div>
                                        <div className="ml-2">$90.00</div>
                                    </div>
                                    <div className="flex justify-between">
                                        <div className="flex-1">1.00 X DESINFECTANTE</div>
                                        <div className="ml-2">$150.00</div>
                                    </div>
                                </div>

                                <div className="border-t border-dashed pt-2 space-y-1 font-bold">
                                    <div className="flex justify-between">
                                        <div>SUBTOTAL:</div>
                                        <div>RD$ 240.00</div>
                                    </div>
                                    <div className="flex justify-between">
                                        <div>ITBIS (18%):</div>
                                        <div>RD$ 43.20</div>
                                    </div>
                                    <div className="flex justify-between text-base border-t border-black pt-1 mt-1">
                                        <div>TOTAL:</div>
                                        <div>RD$ 283.20</div>
                                    </div>
                                </div>

                                <div className="mt-6 text-center space-y-1">
                                    <div className="font-bold">*** GRACIAS POR SU COMPRA ***</div>
                                    <div>SU SATISFACCION ES NUESTRA META</div>
                                    <div className="pt-2 text-[8px]">Multiservi v0.1.1</div>
                                </div>
                                
                                <div className="h-10"></div> {/* Bottom margin to simulate paper tail */}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
