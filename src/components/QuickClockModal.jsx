import React, { useState, useEffect, useRef } from 'react';
import { Clock, CheckCircle, XCircle, X } from 'lucide-react';
import { db } from '../api/electron';

export default function QuickClockModal({ isOpen, onClose }) {
    const [pin, setPin] = useState('');
    const [message, setMessage] = useState(null);
    const inputRef = useRef(null);

    // Auto-focus logic for NFC readers (they emulate keyboard)
    useEffect(() => {
        if (isOpen) {
            setPin('');
            setMessage(null);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleNumClick = (num) => {
        if (pin.length < 15) setPin(prev => prev + num);
        inputRef.current?.focus();
    };

    const handleClear = () => { setPin(''); inputRef.current?.focus(); };
    const handleBackspace = () => { setPin(prev => prev.slice(0, -1)); inputRef.current?.focus(); };

    const handleClockAction = async (type) => {
        if (!pin) return;
        try {
            const res = await db.clockAction(pin, type);
            if (!res.success) throw new Error(res.message);
            
            setMessage({ 
                type: 'success', 
                text: `¡${type === 'IN' ? 'Entrada' : 'Salida'} para ${res.employee}!` 
            });
            setPin('');
            
            // Auto close on success after short delay?
            setTimeout(() => {
                setMessage(null);
                onClose(); // Optional: Close modal on success
            }, 1500);

        } catch (e) {
             const msg = e.message.replace('Error invoking remote method \'db:clock-action\': Error: ', '');
             setMessage({ type: 'error', text: msg });
             setTimeout(() => setMessage(null), 3000);
        }
    };

    // Handle Physical Keyboard (NFC Reader sends Enter)
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            // Default to Check IN if Enter pressed? Or just wait for user to click In/Out?
            // Usually NFC readers just dump text. We can't know intent (In/Out) from just the card.
            // Requirement usually: Scan -> Click In/Out. 
            // OR: If user scans, maybe we check previous state? 
            // For now, let's just let them type/scan and then click button.
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-800 w-full max-w-sm rounded-3xl p-6 shadow-2xl border border-gray-700 relative">
                
                {/* Close Button */}
                <button 
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                    <X size={24} />
                </button>

                <div className="text-center mb-6">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <span className="text-2xl font-bold text-blue-400">A</span>
                    </div>
                    <h2 className="text-2xl font-bold text-white">Asistencia Rápida</h2>
                    <p className="text-gray-400 text-xs mt-1">Digita PIN o Escanea Carnet</p>
                </div>

                {/* Hidden Input for Keyboard/NFC Focus */}
                <input 
                    ref={inputRef}
                    className="opacity-0 absolute w-0 h-0" 
                    value={pin}
                    onChange={e => setPin(e.target.value)}
                    onKeyDown={handleKeyDown}
                    autoFocus
                />

                {/* Display */}
                <div className="mb-6">
                    <div className="h-14 bg-gray-900 rounded-xl flex items-center justify-center text-xl font-mono tracking-widest border border-gray-700 shadow-inner text-blue-400 overflow-hidden px-4" onClick={() => inputRef.current?.focus()}>
                        {pin ? pin : <span className="text-gray-700">...</span>}
                    </div>
                </div>

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-2 mb-6">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <button key={num} onClick={() => handleNumClick(num.toString())} className="h-12 bg-gray-700 hover:bg-gray-600 rounded-lg text-lg font-bold transition active:scale-95">{num}</button>
                    ))}
                    <button onClick={handleClear} className="h-12 bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded-lg font-bold">C</button>
                    <button onClick={() => handleNumClick('0')} className="h-12 bg-gray-700 hover:bg-gray-600 rounded-lg text-lg font-bold">0</button>
                    <button onClick={handleBackspace} className="h-12 bg-gray-700 hover:bg-gray-600 rounded-lg font-bold">←</button>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => handleClockAction('IN')} className="h-14 bg-green-600 hover:bg-green-500 rounded-xl font-bold text-md flex items-center justify-center gap-2 active:scale-95 transition shadow-lg shadow-green-900/20">
                        <CheckCircle size={20} /> ENTRADA
                    </button>
                    <button onClick={() => handleClockAction('OUT')} className="h-14 bg-orange-600 hover:bg-orange-500 rounded-xl font-bold text-md flex items-center justify-center gap-2 active:scale-95 transition shadow-lg shadow-orange-900/20">
                        <XCircle size={20} /> SALIDA
                    </button>
                </div>

                {message && (
                    <div className={`mt-4 p-3 rounded-lg text-center font-bold text-sm animate-bounce ${
                        message.type === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                        {message.text}
                    </div>
                )}
            </div>
        </div>
    );
}
