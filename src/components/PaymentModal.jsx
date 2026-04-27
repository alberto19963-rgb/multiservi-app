import React, { useState, useEffect } from 'react';
import { DollarSign, CreditCard, Landmark, FileCheck, X, Check, Calculator } from 'lucide-react';

export default function PaymentModal({ total, isOpen, onClose, onConfirm, showTypeSelector = true }) {
    const [method, setMethod] = useState('CASH'); // CASH, CARD, TRANSFER, CHECK
    const [invoiceType, setInvoiceType] = useState('FINAL'); // FINAL (B02), FISCAL (B01)
    const [received, setReceived] = useState('');
    const [change, setChange] = useState(0);

    useEffect(() => {
        if (method === 'CASH') {
            const r = parseFloat(received) || 0;
            setChange(Math.max(0, r - total));
        } else {
            setChange(0);
            setReceived(total.toString());
        }
    }, [received, method, total]);

    if (!isOpen) return null;

    const methods = [
        { id: 'CASH', label: 'Efectivo', icon: DollarSign, color: 'bg-green-600' },
        { id: 'CARD', label: 'Tarjeta', icon: CreditCard, color: 'bg-blue-600' },
        { id: 'TRANSFER', label: 'Transferencia', icon: Landmark, color: 'bg-purple-600' },
        { id: 'CHECK', label: 'Cheque', icon: FileCheck, color: 'bg-orange-600' },
    ];

    const currentMethod = methods.find(m => m.id === method);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
                
                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <div>
                        <h2 className="text-2xl font-black text-gray-800">Procesar Pago</h2>
                        <p className="text-gray-500 font-medium">Seleccione el método y confirme el monto</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex flex-col md:flex-row min-h-[450px]">
                    
                    {/* Left: Methods Selection */}
                    <div className="w-full md:w-64 bg-gray-50 p-6 space-y-3 border-r border-gray-100">
                        {methods.map(m => (
                            <button
                                key={m.id}
                                onClick={() => setMethod(m.id)}
                                className={`w-full p-4 rounded-2xl flex items-center gap-3 transition-all font-bold ${
                                    method === m.id 
                                    ? `${m.color} text-white shadow-lg scale-105` 
                                    : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-100'
                                }`}
                            >
                                <m.icon size={20} />
                                {m.label}
                            </button>
                        ))}
                    </div>

                    {/* Right: Payment Details */}
                    <div className="flex-1 p-8 flex flex-col justify-between">
                        <div>
                            {/* Invoice Type Selection */}
                            {showTypeSelector && (
                                <div className="mb-6 bg-gray-50 p-2 rounded-2xl flex gap-2">
                                    <button 
                                        onClick={() => setInvoiceType('FINAL')}
                                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${invoiceType === 'FINAL' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
                                    >
                                        Consumo (B02)
                                    </button>
                                    <button 
                                        onClick={() => setInvoiceType('FISCAL')}
                                        className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${invoiceType === 'FISCAL' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400'}`}
                                    >
                                        Crédito Fiscal (B01)
                                    </button>
                                </div>
                            )}

                            <div className="mb-6">
                                <label className="text-gray-400 font-bold text-xs uppercase tracking-wider mb-2 block">Total a Cobrar</label>
                                <div className="text-5xl font-black text-gray-900">
                                    ${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </div>
                            </div>

                            {method === 'CASH' ? (
                                <div className="space-y-6">
                                    <div>
                                        <label className="text-blue-600 font-bold text-xs uppercase tracking-wider mb-2 block">Monto Recibido</label>
                                        <div className="relative">
                                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-400">$</span>
                                            <input 
                                                autoFocus
                                                type="number"
                                                className="w-full bg-gray-100 border-none rounded-2xl p-5 pl-10 text-3xl font-black text-gray-800 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                                                placeholder="0.00"
                                                value={received}
                                                onChange={e => setReceived(e.target.value)}
                                                onKeyDown={e => e.key === 'Enter' && onConfirm({ method, received: parseFloat(received), change, type: invoiceType })}
                                            />
                                        </div>
                                    </div>

                                    {parseFloat(received) >= total && (
                                        <div className="bg-green-50 p-6 rounded-2xl border border-green-100 animate-in slide-in-from-top-2 duration-300">
                                            <div className="text-green-600 font-bold text-xs uppercase tracking-wider mb-1">Devuelta al Cliente</div>
                                            <div className="text-4xl font-black text-green-700">
                                                ${change.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="bg-blue-50 p-8 rounded-3xl border border-blue-100 flex flex-col items-center justify-center text-center">
                                    <div className={`p-4 rounded-2xl ${currentMethod.color} text-white mb-4 shadow-lg`}>
                                        <currentMethod.icon size={48} />
                                    </div>
                                    <h4 className="text-blue-900 font-black text-xl mb-1">Pago con {currentMethod.label}</h4>
                                    <p className="text-blue-600 font-medium">Procese el cobro en su terminal externa y confirme aquí.</p>
                                </div>
                            )}
                        </div>

                        <div className="flex-1"></div>

                        <button
                            disabled={method === 'CASH' && (parseFloat(received) < total || !received)}
                            onClick={() => onConfirm({ method, received: parseFloat(received), change, type: invoiceType })}
                            className={`w-full py-5 rounded-2xl font-black text-xl flex items-center justify-center gap-3 transition-all shadow-xl ${
                                method === 'CASH' && (parseFloat(received) < total || !received)
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                                : `${currentMethod.color} text-white hover:brightness-110 active:scale-95`
                            }`}
                        >
                            <Check size={24} />
                            CONFIRMAR COBRO
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
