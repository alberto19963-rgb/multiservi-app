import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Clock, CheckCircle, XCircle, UserPlus, List, ChevronLeft, CreditCard, DollarSign, Calendar, Save, Download, Monitor, IdCard, Printer, Trash2, RefreshCw } from 'lucide-react';
import { db } from '../../api/electron';
import Barcode from 'react-barcode';


// Simple CSV Parser
const parseCSV = (text) => {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const nextChar = text[i + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentCell += '"';
                i++; 
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            currentRow.push(currentCell.trim());
            currentCell = '';
        } else if ((char === '\r' || char === '\n') && !inQuotes) {
            if (char === '\r' && nextChar === '\n') i++;
            currentRow.push(currentCell.trim());
            if (currentRow.some(c => c)) rows.push(currentRow);
            currentRow = [];
            currentCell = '';
        } else {
            currentCell += char;
        }
    }
    if (currentCell || currentRow.length) {
        currentRow.push(currentCell.trim());
        if (currentRow.some(c => c)) rows.push(currentRow);
    }
    return rows;
};

export default function TimeClockPage() {
    const [view, setView] = useState('ADMIN'); // Default to ADMIN
    const [adminTab, setAdminTab] = useState('EMPLOYEES'); // EMPLOYEES, LOGS, PAYROLL, CARNETS
    
    // Clock State
    const [pin, setPin] = useState('');
    const [message, setMessage] = useState(null); 

    // Data State
    const [employees, setEmployees] = useState([]);
    const [logs, setLogs] = useState([]);
    const [payrollPreview, setPayrollPreview] = useState([]);

    // Form State
    const [formData, setFormData] = useState({
        name: '', 
        pin: '', 
        nfcCode: '', 
        salary: '', 
        workMode: 'STANDARD',
        // Common RD Fields
        cedula: '',
        phone: '',
        address: '',
        email: '',
        startDate: '',
        jobTitle: '',
        department: '',
        emergencyContact: '',
        bloodType: ''
    });

    // Carnet State
    const [selectedEmployeeForCarnet, setSelectedEmployeeForCarnet] = useState(null);
    const carnetRef = useRef();

    // Recruitment State
    const [candidates, setCandidates] = useState([]);
    const [selectedCandidate, setSelectedCandidate] = useState(null);
    const [isHiringModalOpen, setIsHiringModalOpen] = useState(false);
    const [isInvitationModalOpen, setIsInvitationModalOpen] = useState(false);
    
    // Invitation Form
    const [invitationData, setInvitationData] = useState({ name: '', email: '', position: '' });
    
    const [hiringData, setHiringData] = useState({
        salary: '',
        startDate: new Date().toISOString().slice(0, 10),
        jobTitle: '',
        department: 'General'
    });

    // Recruitment CSV State & Logic (Merged from RecruitmentPage)
    const [csvCandidates, setCsvCandidates] = useState([]);
    const [loadingCsv, setLoadingCsv] = useState(false);
    const [selectedCsvCandidate, setSelectedCsvCandidate] = useState(null);
    const [hiddenCandidates, setHiddenCandidates] = useState([]); // IDs de candidatos ocultos
    const [isOfferModalOpen, setIsOfferModalOpen] = useState(false); // Modal de oferta laboral
    const [isFormConfigOpen, setIsFormConfigOpen] = useState(false); // Vista de gestión de formulario
    const [formUrl, setFormUrl] = useState('');
    const [editUrl, setEditUrl] = useState('');
    const DEMO_CSV = "https://docs.google.com/spreadsheets/d/e/2PACX-1vSLzkcMP5ASlxSOu8W3n9RLhiMhSktduKHeQJvR2fgyFxfT86qSe2_nZ-rE_FzcuMFwWoYzdTVIoZxC/pub?output=csv";



    const loadAdminData = async () => {
        try {
            const empData = await db.getEmployees();
            setEmployees(empData || []);
            const logData = await db.getTimeLogs();
            setLogs(logData || []);
            const payData = await db.getPayrollPreview();
            setPayrollPreview(payData || []);
            const candData = await db.getCandidates();
            setCandidates(candData || []);
            
            // Cargar URL del formulario desde ajustes
            const fUrl = await db.getSetting('recruitment_form_url');
            const eUrl = await db.getSetting('recruitment_edit_url');
            if (fUrl) setFormUrl(fUrl);
            if (eUrl) setEditUrl(eUrl);
        } catch (e) {
            console.error(e);
        }
    };

    // --- RECRUITMENT HANDLERS ---
    
    const handleSendInvitation = async () => {
        if (!invitationData.name || !invitationData.email) return alert('Datos incompletos');
        
        try {
            // 1. Create Candidate
            await db.addCandidate({ 
                name: invitationData.name, 
                email: invitationData.email,
                positionApplied: invitationData.position,
                status: 'INVITED', 
                createdAt: new Date().toISOString() 
            });
            
            // 2. Send Email
            const res = await db.sendInvitation({ name: invitationData.name, email: invitationData.email });
            if (res.success) {
                alert(`Invitación enviada a ${invitationData.email}`);
                setIsInvitationModalOpen(false);
                setInvitationData({ name: '', email: '', position: '' });
                loadAdminData();
            } else {
                alert('Error enviando correo: ' + res.message + '\nVerifica tu configuración en la pestaña de Ajustes.');
            }
        } catch (e) {
            console.error(e);
            alert('Error procesando invitación');
        }
    };

    const handleHireCandidate = async () => {
        if (!selectedCandidate) return;
        try {
            const res = await db.hireCandidate({
                candidateId: selectedCandidate.id,
                salary: hiringData.salary,
                startDate: hiringData.startDate,
                jobTitle: hiringData.jobTitle || selectedCandidate.positionApplied,
                department: hiringData.department,
                workMode: 'STANDARD' // Default
            });
            
            if (res.success) {
                alert(`¡${res.employee.name} ha sido contratado exitosamente!\nExpediente creado en: ${res.path}`);
                setIsHiringModalOpen(false);
                loadAdminData();
                setSelectedCandidate(null);
            }
        } catch (e) {
            console.error(e);
            alert('Error en contratación: ' + e.message);
        }
    };
    
    // Updated: DELETE CANDIDATE Handler
    const handleDeleteCandidate = async (id, e) => {
        e.stopPropagation(); // Prevent selection
        if (!confirm('¿Seguro que deseas eliminar este candidato? Esta acción no se puede deshacer.')) return;
        
        try {
            const res = await db.deleteCandidate(id);
            if (res.success) {
                // If selected was deleted, clear selection
                if (selectedCandidate?.id === id) setSelectedCandidate(null);
                loadAdminData();
            } else {
                alert('Error al eliminar: ' + res.message);
            }
        } catch (err) {
            console.error(err);
            alert('Error al procesar la eliminación');
        }
    };

    useEffect(() => {
        if (view === 'ADMIN') {
            loadAdminData();
        }
    }, [view, adminTab]);

    // --- CLOCK LOGIC ---
    const handleNumClick = (num) => { if (pin.length < 15) setPin(prev => prev + num); };
    const handleClear = () => setPin('');
    const handleBackspace = () => setPin(prev => prev.slice(0, -1));

    const handleClockAction = async (type) => {
        if (!pin) return;
        try {
            const res = await db.clockAction(pin, type); // Updated signature
            if (!res.success) throw new Error(res.message);
            
            setMessage({ 
                type: 'success', 
                text: `¡${type === 'IN' ? 'Entrada' : 'Salida'} registrada para ${res.employee}!` 
            });
            setPin('');
            setTimeout(() => setMessage(null), 3000);
        } catch (e) {
             const msg = e.message.replace('Error invoking remote method \'db:clock-action\': Error: ', '');
             setMessage({ type: 'error', text: msg });
             setTimeout(() => setMessage(null), 3000);
        }
    };

    // --- EMPLOYEE LOGIC ---
    const handleAddEmployee = async () => {
        if (!formData.name) return;
        try {
            await db.addEmployee(formData);
            alert("Empleado guardado");
            setFormData({ 
                name: '', pin: '', nfcCode: '', salary: '', workMode: 'STANDARD',
                cedula: '', phone: '', address: '', email: '', startDate: '', 
                jobTitle: '', department: '', emergencyContact: '', bloodType: ''
            });
            loadAdminData();
        } catch {
            alert("Error al guardar");
        }
    };

    const handlePrintCarnet = () => {
        const printContent = carnetRef.current;
        const windowUrl = 'about:blank';
        const uniqueName = new Date();
        const windowName = 'Print' + uniqueName.getTime();
        const printWindow = window.open(windowUrl, windowName, 'left=50000,top=50000,width=0,height=0');
        
        printWindow.document.write(`
            <html>
                <head>
                    <title>Imprimir Carnet</title>
                    <style>
                        body { margin: 0; padding: 20px; font-family: sans-serif; -webkit-print-color-adjust: exact; }
                        .carnet-container { display: flex; gap: 20px; }
                        .card { width: 320px; height: 200px; border: 1px solid #ccc; border-radius: 10px; overflow: hidden; position: relative; background: white; }
                        /* Add Tailwind-like styles here roughly or simpler inline styles */
                    </style>
                </head>
                <body>
                    ${printContent.innerHTML}
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
    };

    // --- PAYROLL LOGIC ---
    const handleGenerateTxt = () => {
        const content = payrollPreview.map(p => {
            const amount = p.amountToPay - (p.deduction || 0);
            return `${p.name},${p.bankAccount || 'NO_CUENTA'},${amount}`;
        }).join('\n');
        
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `NOMINA_BANRESERVAS_${new Date().toISOString().slice(0,10)}.txt`;
        a.click();
    };

    // --- CSV LOGIC ---
    const loadCsvData = async () => {
        setLoadingCsv(true);
        try {
            const response = await fetch(DEMO_CSV);
            const text = await response.text();
            
            const rawRows = parseCSV(text);
            if (rawRows.length < 2) return; 

            const headers = rawRows[0];
            const mapHeaders = (hList) => {
                const lowerHeaders = hList.map(h => h.toLowerCase());
                
                // Helper to find first matching index
                const find = (keywords) => lowerHeaders.findIndex(h => keywords.some(k => h.includes(k)));

                return {
                    date: find(['marca temporal', 'timestamp', 'fecha']),
                    name: find(['nombre completo', 'nombres y apellidos', 'nombre']),
                    cedula: find(['cédula', 'cedula', 'identidad']),
                    phone: find(['teléfono', 'celular', 'whatsapp', 'telefono']),
                    email: find(['email', 'correo']),
                    position: find(['puesto', 'vacante', 'cargo solicitado']),
                    // Fallbacks or extras
                    experience: find(['experiencia']),
                    birth: find(['nacimiento'])
                };
            };

            const indices = mapHeaders(headers);
            
            const data = rawRows.slice(1).map((row, idx) => ({
                id: idx,
                date: row[indices.date] || '',
                name: row[indices.name] || 'Sin Nombre',
                cedula: row[indices.cedula] || '',
                phone: row[indices.phone] || '',
                position: row[indices.position] || '',
                email: row[indices.email] || '',
                experience: row[indices.experience] || '',
                birth: row[indices.birth] || '',
                fullData: headers.map((h, i) => ({ label: h, value: row[i] }))
            }));

            setCsvCandidates(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingCsv(false);
        }
    };

    useEffect(() => {
        if (adminTab === 'RECRUITMENT') {
            loadCsvData();
        }
    }, [adminTab]);



    return (
        <div className="h-full bg-gray-50 flex flex-col relative">
            
            {/* Toggle View Button (Top Right) - Removed as per user request to move to Logs tab */}

            {view === 'CLOCK' ? (
                /* --- CLOCK VIEW --- */
                 <div className="flex-1 flex flex-col items-center justify-center p-8">
                     <div className="w-full max-w-md bg-gray-800 rounded-3xl p-8 shadow-2xl border border-gray-700">
                        <div className="text-center mb-8">
                            <Clock className="w-16 h-16 mx-auto text-blue-500 mb-4 animate-pulse" />
                            <h1 className="text-3xl font-bold bg-linear-to-r from-blue-400 to-purple-400 text-transparent bg-clip-text">
                                Control de Asistencia
                            </h1>
                            <p className="text-gray-400 mt-2 text-sm">Escanea tu Carnet o digita tu PIN</p>
                        </div>

                        <div className="mb-8">
                            <div className="h-16 bg-gray-900 rounded-2xl flex items-center justify-center text-xl font-mono tracking-widest border border-gray-700 shadow-inner text-blue-400 overflow-hidden px-4">
                                {pin ? pin : <span className="text-gray-700">...esperando...</span>}
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mb-8">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                                <button key={num} onClick={() => handleNumClick(num.toString())} className="h-14 bg-gray-700 hover:bg-gray-600 rounded-xl text-xl font-bold transition active:scale-95">{num}</button>
                            ))}
                            <button onClick={handleClear} className="h-14 bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded-xl font-bold">C</button>
                            <button onClick={() => handleNumClick('0')} className="h-14 bg-gray-700 hover:bg-gray-600 rounded-xl text-xl font-bold">0</button>
                            <button onClick={handleBackspace} className="h-14 bg-gray-700 hover:bg-gray-600 rounded-xl font-bold">←</button>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => handleClockAction('IN')} className="h-16 bg-green-600 hover:bg-green-500 rounded-xl font-bold text-lg flex items-center justify-center gap-2 active:scale-95 transition shadow-lg shadow-green-900/20">
                                <CheckCircle /> ENTRADA
                            </button>
                            <button onClick={() => handleClockAction('OUT')} className="h-16 bg-orange-600 hover:bg-orange-500 rounded-xl font-bold text-lg flex items-center justify-center gap-2 active:scale-95 transition shadow-lg shadow-orange-900/20">
                                <XCircle /> SALIDA
                            </button>
                        </div>
                        
                        {message && (
                            <div className={`mt-6 p-4 rounded-xl text-center font-bold animate-bounce ${
                                message.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                            }`}>
                                {message.text}
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                /* --- ADMIN VIEW --- */
                <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full p-6 overflow-y-auto">
                    <header className="flex items-center justify-between mb-8 pb-4 border-b border-gray-200">
                        <div>
                             <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                                <UserPlus className="text-purple-500" />
                                Recursos Humanos
                            </h1>
                            <p className="text-gray-500 text-sm mt-1">Gestion de Personal y Nómina</p>
                        </div>
                        
                        <div className="flex bg-white border border-gray-200 shadow-sm p-1 rounded-lg">
                            {['EMPLOYEES', 'LOGS', 'PAYROLL', 'CARNETS', 'RECRUITMENT'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setAdminTab(tab)}
                                    className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                                        adminTab === tab ? 'bg-blue-600 text-white shadow' : 'text-gray-500 hover:text-gray-800'
                                    }`}
                                >
                                    {tab === 'EMPLOYEES' && 'Empleados'}
                                    {tab === 'LOGS' && 'Asistencia'}
                                    {tab === 'PAYROLL' && 'Nómina'}
                                    {tab === 'CARNETS' && 'Carnets / ID'}
                                    {tab === 'RECRUITMENT' && 'Reclutamiento'}
                                </button>
                            ))}
                        </div>
                    </header>

                    <div className="flex-1 overflow-y-auto">
                        {/* EMPLOYEES TAB */}
                        {adminTab === 'EMPLOYEES' && (
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-6">
                                {/* Form Card */}
                                <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm overflow-y-auto max-h-[calc(100vh-180px)]">
                                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-blue-600">
                                        <UserPlus size={18} /> Nuevo / Editar
                                    </h2>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-xs text-gray-500 uppercase font-bold">Nombre Completo</label>
                                            <input 
                                                className="w-full bg-white border border-gray-300 p-3 rounded-lg text-gray-800 focus:border-blue-500 outline-none"
                                                value={formData.name}
                                                onChange={e => setFormData({...formData, name: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs text-gray-500 uppercase font-bold">Cédula</label>
                                            <input 
                                                className="w-full bg-white border border-gray-300 p-3 rounded-lg text-gray-800 focus:border-blue-500 outline-none"
                                                value={formData.cedula}
                                                onChange={e => setFormData({...formData, cedula: e.target.value})}
                                                placeholder="000-0000000-0"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs text-gray-500 uppercase font-bold">Cargo</label>
                                                <input 
                                                    className="w-full bg-white border border-gray-300 p-3 rounded-lg text-gray-800 focus:border-blue-500 outline-none"
                                                    value={formData.jobTitle}
                                                    onChange={e => setFormData({...formData, jobTitle: e.target.value})}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 uppercase font-bold">Departamento</label>
                                                <input 
                                                    className="w-full bg-white border border-gray-300 p-3 rounded-lg text-gray-800 focus:border-blue-500 outline-none"
                                                    value={formData.department}
                                                    onChange={e => setFormData({...formData, department: e.target.value})}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs text-gray-500 uppercase font-bold">Fecha Ingreso</label>
                                                <input 
                                                    type="date"
                                                    className="w-full bg-white border border-gray-300 p-3 rounded-lg text-gray-800 focus:border-blue-500 outline-none"
                                                    value={formData.startDate}
                                                    onChange={e => setFormData({...formData, startDate: e.target.value})}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 uppercase font-bold">Teléfono</label>
                                                <input 
                                                    className="w-full bg-white border border-gray-300 p-3 rounded-lg text-gray-800 focus:border-blue-500 outline-none"
                                                    value={formData.phone}
                                                    onChange={e => setFormData({...formData, phone: e.target.value})}
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs text-gray-500 uppercase font-bold">Tipo Sangre</label>
                                                <input 
                                                    className="w-full bg-white border border-gray-300 p-3 rounded-lg text-gray-800 focus:border-blue-500 outline-none"
                                                    value={formData.bloodType}
                                                    onChange={e => setFormData({...formData, bloodType: e.target.value})}
                                                    placeholder="O+"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 uppercase font-bold">PIN Ponche</label>
                                                <input 
                                                    className="w-full bg-white border border-gray-300 p-3 rounded-lg text-gray-800 focus:border-blue-500 outline-none"
                                                    value={formData.pin}
                                                    onChange={e => setFormData({...formData, pin: e.target.value})}
                                                    placeholder="1234"
                                                />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs text-gray-500 uppercase font-bold">Sueldo</label>
                                                <input 
                                                    type="number"
                                                    className="w-full bg-white border border-gray-300 p-3 rounded-lg text-gray-800 focus:border-blue-500 outline-none"
                                                    value={formData.salary}
                                                    onChange={e => setFormData({...formData, salary: e.target.value})}
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs text-gray-500 uppercase font-bold">Modalidad</label>
                                                <select 
                                                    className="w-full bg-white border border-gray-300 p-3 rounded-lg text-gray-800 focus:border-blue-500 outline-none"
                                                    value={formData.workMode}
                                                    onChange={e => setFormData({...formData, workMode: e.target.value})}
                                                >
                                                    <option value="STANDARD">Oficina</option>
                                                    <option value="FIELD">Visitador</option>
                                                </select>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={handleAddEmployee}
                                            className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-bold text-white shadow-sm transition active:scale-95"
                                        >
                                            Guardar Empleado
                                        </button>
                                    </div>
                                </div>
                                
                                {/* Employee List */}
                                <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-gray-200 shadow-sm overflow-y-auto">
                                    <h2 className="text-lg font-bold mb-4 text-gray-800">Directorio de Personal</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {employees.map(emp => (
                                            <div key={emp.id} className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex justify-between hover:border-blue-200 transition">
                                                <div>
                                                    <div className="font-bold text-gray-800">{emp.name}</div>
                                                    <div className="text-xs text-gray-500">{emp.jobTitle || 'Sin Cargo'}</div>
                                                    <div className="text-xs text-gray-400 mt-1">{emp.phone}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-1 rounded mb-1">{emp.department || 'General'}</div>
                                                    <div className="font-mono text-green-600 font-bold">${emp.salary?.toLocaleString() || '0'}</div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* CARNETS TAB (New) */}
                        {adminTab === 'CARNETS' && (
                            <div className="flex flex-col h-full gap-6">
                                <div className="flex gap-4 items-start h-full">
                                    {/* Selection List */}
                                    <div className="w-1/3 bg-white rounded-2xl p-6 border border-gray-200 shadow-sm overflow-y-auto max-h-[calc(100vh-180px)]">
                                        <h2 className="text-lg font-bold mb-4 text-gray-800">Seleccionar Empleado</h2>
                                        <div className="space-y-2">
                                            {employees.map(emp => (
                                                <button 
                                                    key={emp.id} 
                                                    onClick={() => setSelectedEmployeeForCarnet(emp)}
                                                    className={`w-full text-left p-3 rounded-xl transition flex justify-between items-center ${
                                                        selectedEmployeeForCarnet?.id === emp.id 
                                                            ? 'bg-blue-600 text-white' 
                                                            : 'bg-gray-50 text-gray-700 hover:bg-blue-50 hover:text-blue-700 border border-gray-200'
                                                    }`}
                                                >
                                                    <span>{emp.name}</span>
                                                    <span className="text-xs opacity-70">{emp.cedula || 'Sin Cédula'}</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Preview Area */}
                                    <div className="w-2/3 bg-white rounded-2xl p-8 border border-gray-200 shadow-sm max-h-[calc(100vh-180px)] flex flex-col items-center justify-center relative">
                                        {!selectedEmployeeForCarnet ? (
                                            <div className="text-gray-400 flex flex-col items-center">
                                                <IdCard size={64} className="mb-4 opacity-30"/>
                                                <p className="text-gray-500">Selecciona un empleado para generar su carnet</p>
                                            </div>
                                        ) : (
                                            <>
                                                <div ref={carnetRef} className="flex flex-col gap-8 items-center bg-gray-200 p-8 rounded-xl">
                                                    {/* Carnet Front */}
                                                    <div className="relative w-[320px] h-[200px] bg-white rounded-lg shadow-lg overflow-hidden border border-gray-300 text-black flex flex-col">
                                                        <div className="h-4 bg-blue-600 w-full"></div>
                                                        <div className="px-4 pt-4 flex gap-4">
                                                            <div className="w-24 h-28 bg-gray-300 rounded border border-gray-400 flex items-center justify-center text-gray-500 text-xs">
                                                                FOTO
                                                            </div>
                                                            <div className="flex-1">
                                                                <h2 className="font-bold text-lg leading-tight text-blue-900 uppercase">{selectedEmployeeForCarnet.name}</h2>
                                                                <p className="text-sm font-semibold text-gray-600 mt-1">{selectedEmployeeForCarnet.jobTitle || 'EMPLEADO'}</p>
                                                                <p className="text-xs text-gray-500 uppercase mt-0.5">{selectedEmployeeForCarnet.department || 'GENERAL'}</p>
                                                                
                                                                <div className="mt-4 text-xs">
                                                                    <div className="font-bold text-gray-800">CÉDULA</div>
                                                                    <div>{selectedEmployeeForCarnet.cedula || 'N/A'}</div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="mt-auto pb-2 flex justify-center">
                                                            {/* Barcode using PIN or Cedula */}
                                                            <Barcode 
                                                                value={selectedEmployeeForCarnet.pin || selectedEmployeeForCarnet.cedula || '0000'}
                                                                width={1.5}
                                                                height={30}
                                                                fontSize={10}
                                                                displayValue={false}
                                                            />
                                                        </div>
                                                        <div className="h-2 bg-blue-800 w-full absolute bottom-0"></div>
                                                    </div>

                                                    {/* Carnet Back */}
                                                    <div className="relative w-[320px] h-[200px] bg-white rounded-lg shadow-lg overflow-hidden border border-gray-300 text-black p-6 flex flex-col justify-center text-xs">
                                                        <div className="text-center font-bold text-gray-400 mb-4 text-[10px]">MULTISERVI CHAVON SRL</div>
                                                        
                                                        <div className="grid grid-cols-2 gap-4">
                                                            <div>
                                                                <span className="block font-bold text-gray-600">Tipo Sangre</span>
                                                                <span className="text-lg font-bold">{selectedEmployeeForCarnet.bloodType || 'N/A'}</span>
                                                            </div>
                                                            <div>
                                                                <span className="block font-bold text-gray-600">Fecha Ingreso</span>
                                                                <span>{selectedEmployeeForCarnet.startDate || 'N/A'}</span>
                                                            </div>
                                                        </div>

                                                        <div className="mt-4">
                                                            <span className="block font-bold text-gray-600">Emergencia</span>
                                                            <div className="text-sm">{selectedEmployeeForCarnet.emergencyContact || 'N/A'}</div>
                                                        </div>

                                                        <div className="mt-auto text-[8px] text-gray-400 text-center">
                                                            Esta tarjeta es personal e intransferible. Propiedad de Gestion Empresarial.
                                                        </div>
                                                    </div>
                                                </div>

                                                <button 
                                                    onClick={handlePrintCarnet}
                                                    className="mt-6 bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-3 shadow-lg active:scale-95 transition"
                                                >
                                                    <Printer size={20}/> Imprimir Carnet
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {adminTab === 'LOGS' && (
                             <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex-1 overflow-hidden flex flex-col">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-lg font-bold text-gray-800">Historial de Accesos</h2>
                                    <button 
                                        onClick={() => setView('CLOCK')}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition"
                                    >
                                        <Monitor size={18}/>
                                        <span>Ponchar</span>
                                    </button>
                                </div>
                                <div className="flex-1 overflow-auto">
                                    <table className="w-full text-left">
                                        <thead className="text-gray-500 border-b border-gray-200 text-xs uppercase sticky top-0 bg-white">
                                            <tr>
                                                <th className="p-3">Empleado</th>
                                                <th className="p-3">Evento</th>
                                                <th className="p-3">Fecha y Hora</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {logs.map(log => {
                                                 const empName = employees.find(e => e.id === log.employeeId)?.name || 'Desconocido';
                                                 return (
                                                    <tr key={log.id} className="hover:bg-gray-50 transition">
                                                        <td className="p-3 font-medium text-gray-800">{empName}</td>
                                                        <td className="p-3">
                                                            <span className={`px-2 py-1 rounded text-xs font-bold ${
                                                                log.type === 'IN' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                                            }`}>
                                                                {log.type === 'IN' ? 'ENTRADA' : 'SALIDA'}
                                                            </span>
                                                        </td>
                                                        <td className="p-3 text-gray-500 text-sm font-mono">
                                                            {new Date(log.timestamp).toLocaleString()}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}


                        {adminTab === 'PAYROLL' && (
                            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm flex-1 overflow-hidden flex flex-col">
                                <div className="flex justify-between items-center mb-6">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                            <CreditCard className="text-green-500" /> Nómina Banreservas
                                        </h2>
                                        <p className="text-gray-500 text-sm">Vista previa de pago (Sueldo / 2)</p>
                                    </div>
                                    <button 
                                        onClick={handleGenerateTxt}
                                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition"
                                    >
                                        <Download size={18} /> Generar Archivo TXT
                                    </button>
                                </div>
                                <div className="flex-1 overflow-auto rounded-xl border border-gray-200">
                                    <table className="w-full text-left">
                                        <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold sticky top-0 border-b border-gray-200">
                                            <tr>
                                                <th className="p-4">Empleado</th>
                                                <th className="p-4 text-right">Sueldo Base</th>
                                                <th className="p-4 text-right">A Pagar (Q)</th>
                                                <th className="p-4 text-center">Descuento Manual</th>
                                                <th className="p-4 text-right">Total Final</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {payrollPreview.map((p, idx) => (
                                                <tr key={p.id} className="hover:bg-gray-50 transition">
                                                    <td className="p-4 font-medium text-gray-800">{p.name}</td>
                                                    <td className="p-4 text-right text-gray-500">${p.salary?.toLocaleString()}</td>
                                                    <td className="p-4 text-right font-bold text-blue-600">
                                                        ${(p.amountToPay).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                    </td>
                                                    <td className="p-4 text-center">
                                                        <input 
                                                            type="number"
                                                            className="bg-white border border-gray-300 rounded px-2 py-1 text-right w-24 text-red-500 focus:border-red-400 outline-none"
                                                            placeholder="0.00"
                                                            onChange={(e) => {
                                                                const val = parseFloat(e.target.value) || 0;
                                                                const newPreview = [...payrollPreview];
                                                                newPreview[idx].deduction = val;
                                                                setPayrollPreview(newPreview);
                                                            }}
                                                        />
                                                    </td>
                                                    <td className="p-4 text-right font-bold text-green-600 text-lg">
                                                        ${((p.amountToPay) - (p.deduction || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {adminTab === 'RECRUITMENT' && (
                            <div className="flex flex-col flex-1 min-h-0 relative">
                                {/* Header / Controls */}
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-bold text-gray-800">Solicitudes Recibidas ({csvCandidates.length})</h2>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => setIsInvitationModalOpen(true)}
                                            className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition"
                                        >
                                            <UserPlus size={18}/> Invitar Nuevo
                                        </button>
                                        <button 
                                            onClick={() => setIsFormConfigOpen(true)}
                                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition"
                                        >
                                            <Monitor size={18}/> Gestionar Formulario
                                        </button>
                                        <button 
                                            onClick={loadCsvData}
                                            className="bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300 px-3 py-2 rounded-lg transition"
                                            title="Recargar de Google"
                                        >
                                            <RefreshCw size={18} className={loadingCsv ? 'animate-spin' : ''} />
                                        </button>
                                    </div>
                                </div>

                                {/* Main Content Area */}
                                <div className="flex-1 flex overflow-hidden gap-6">
                                    {/* List Grid (Left) */}
                                    <div className={`flex-1 overflow-y-auto pr-2 custom-scrollbar ${selectedCsvCandidate ? 'hidden md:block w-1/3' : 'w-full'}`}>
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
                                            {csvCandidates
                                                .filter(cand => !hiddenCandidates.includes(cand.id))
                                                .map(cand => (
                                                <div 
                                                    key={cand.id}
                                                    onClick={() => {
                                                        // Toggle: si ya está seleccionado, deseleccionar
                                                        if (selectedCsvCandidate?.id === cand.id) {
                                                            setSelectedCsvCandidate(null);
                                                        } else {
                                                            setSelectedCsvCandidate(cand);
                                                        }
                                                    }}
                                                    className={`p-4 rounded-xl border transition cursor-pointer flex flex-col gap-2 relative group ${
                                                        selectedCsvCandidate?.id === cand.id 
                                                            ? 'bg-blue-50 border-blue-400 ring-1 ring-blue-400' 
                                                            : 'bg-white border-gray-200 hover:border-blue-200 hover:bg-blue-50/30 shadow-sm'
                                                    }`}
                                                >
                                                    {/* Botón Eliminar */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (confirm('¿Ocultar esta solicitud?')) {
                                                                setHiddenCandidates(prev => [...prev, cand.id]);
                                                                if (selectedCsvCandidate?.id === cand.id) {
                                                                    setSelectedCsvCandidate(null);
                                                                }
                                                            }
                                                        }}
                                                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition bg-red-600 hover:bg-red-500 text-white p-1.5 rounded-full shadow-lg z-10"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                    
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                                            {cand.position || 'Candidato'}
                                                        </span>
                                                        <span className="text-[10px] text-gray-400">{cand.date.split(' ')[0]}</span>
                                                    </div>
                                                    <h3 className="font-bold text-gray-800 truncate">{cand.name}</h3>
                                                    <div className="text-sm text-gray-500 truncate">{cand.phone || '---'}</div>
                                                </div>
                                            ))}
                                    </div>
                                    </div>

                                    {/* Detail View (Right Panel) */}
                                    {selectedCsvCandidate && (
                                        <div 
                                            className="w-full md:w-2/3 bg-white rounded-2xl border border-gray-200 shadow-sm flex flex-col overflow-hidden relative"
                                            style={{ height: 'calc(100vh - 180px)' }}
                                        >
                                            <div className="p-6 border-b border-gray-200 flex justify-between items-start bg-gray-50">
                                                <div>
                                                    <h2 className="text-2xl font-bold text-gray-800">{selectedCsvCandidate.name}</h2>
                                                    <p className="text-blue-600">{selectedCsvCandidate.position}</p>
                                                </div>
                                                <div className="flex gap-2 print:hidden">
                                                    <button 
                                                        onClick={() => setSelectedCsvCandidate(null)}
                                                        className="md:hidden text-gray-400 p-2"
                                                    >
                                                        Cerrar
                                                    </button>
                                                    
                                                    {/* Botón Enviar Oferta Laboral */}
                                                    <button
                                                        onClick={() => setIsOfferModalOpen(true)}
                                                        className="bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition shadow-lg"
                                                    >
                                                        <UserPlus size={18} /> Enviar Oferta
                                                    </button>
                                                    
                                                    {/* Botón Descargar PDF de Solicitud */}
                                                    <button 
                                                        onClick={async () => {
                                                            const res = await db.downloadPDF({ 
                                                                filename: `${selectedCsvCandidate.name.replace(/[^a-z0-9]/gi, '_')}_solicitud.pdf` 
                                                            });
                                                            if(res.success) alert('PDF Descargado en: ' + res.filePath);
                                                            else alert('Error: ' + res.message);
                                                        }}
                                                        className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition shadow-lg"
                                                    >
                                                        <Download size={18} /> Descargar PDF
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="flex-1 overflow-y-auto p-8 pb-64 bg-white custom-scrollbar">
                                                 <div className="max-w-3xl mx-auto space-y-8 text-gray-700">
                                                     {/* Print Header (Hidden normally) */}
                                                    <div className="hidden text-center mb-8 border-b-2 border-black pb-4 text-black">
                                                        <h1 className="text-2xl font-bold uppercase">Solicitud de Empleo</h1>
                                                        <p className="text-gray-600">Gestion Empresarial S.R.L - RRHH</p>
                                                    </div>

                                                    <section>
                                                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">Datos Personales</h3>
                                                        <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                                                            <div><label className="text-xs text-gray-400 uppercase block">Cédula</label><div className="text-lg text-gray-800 font-medium">{selectedCsvCandidate.cedula}</div></div>
                                                            <div><label className="text-xs text-gray-400 uppercase block">Teléfono</label><div className="text-lg text-gray-800 font-medium">{selectedCsvCandidate.phone}</div></div>
                                                            <div><label className="text-xs text-gray-400 uppercase block">Email</label><div className="text-lg text-gray-800 font-medium">{selectedCsvCandidate.email}</div></div>
                                                            <div><label className="text-xs text-gray-400 uppercase block">Fecha Solicitud</label><div className="text-lg text-gray-800 font-medium">{selectedCsvCandidate.date}</div></div>
                                                        </div>
                                                    </section>

                                                    <section>
                                                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 border-b border-gray-200 pb-2">Respuestas del Formulario</h3>
                                                        <div className="space-y-6">
                                                            {selectedCsvCandidate.fullData
                                                                .filter(f => !['Nombre Completo', 'Marca temporal'].some(k => f.label.includes(k)))
                                                                .map((field, idx) => (
                                                                <div key={idx}>
                                                                    <label className="text-xs text-gray-500 uppercase block mb-1">{field.label}</label>
                                                                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-gray-800 whitespace-pre-wrap">
                                                                        {field.value || 'N/A'}
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </section>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* SPECIAL PRINT TEMPLATE (Portal to Body) */}
                    {selectedCsvCandidate && createPortal(
                        <div className="printable-content hidden print:block bg-white text-black p-0 m-0 w-full h-auto absolute top-0 left-0 hover:none z-[9999]">
                             {/* A4 Container */}
                             <div className="max-w-[210mm] mx-auto p-12 custom-print-container">
                                
                                <div className="text-center mb-8 border-b-4 border-gray-800 pb-6">
                                    <h1 className="text-4xl font-extrabold uppercase tracking-widest mb-2 text-black">Solicitud de Empleo</h1>
                                    <p className="text-gray-600 font-serif italic text-xl">Gestion Empresarial S.R.L - Recursos Humanos</p>
                                </div>

                                {/* ID Card Style Header */}
                                <div className="mb-10 p-6 bg-gray-50 border-l-8 border-blue-600 shadow-sm rounded-r-lg flex items-center gap-6 break-inside-avoid">
                                    <div className="bg-white p-2 rounded-full border-2 border-gray-200">
                                        <IdCard size={48} className="text-gray-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-3xl font-bold text-gray-900">{selectedCsvCandidate.name}</h2>
                                        <p className="text-blue-700 font-medium text-lg uppercase tracking-wide">{selectedCsvCandidate.position || 'Candidato General'}</p>
                                    </div>
                                </div>

                                {/* Personal Data Grid */}
                                <section className="mb-10 break-inside-avoid">
                                    <h3 className="text-sm font-bold bg-gray-900 text-white px-4 py-2 inline-block uppercase tracking-wider mb-6 rounded shadow-sm">Datos Personales</h3>
                                    <div className="grid grid-cols-2 gap-y-6 gap-x-12 px-2">
                                        <div className="border-b border-gray-300 pb-2">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1 tracking-wider">Cédula de Identidad</span>
                                            <div className="text-xl font-medium text-black font-mono">{selectedCsvCandidate.cedula}</div>
                                        </div>
                                        <div className="border-b border-gray-300 pb-2">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1 tracking-wider">Teléfono / Celular</span>
                                            <div className="text-xl font-medium text-black font-mono">{selectedCsvCandidate.phone}</div>
                                        </div>
                                        <div className="border-b border-gray-300 pb-2 col-span-2">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1 tracking-wider">Correo Electrónico</span>
                                            <div className="text-xl font-medium text-black">{selectedCsvCandidate.email}</div>
                                        </div>
                                        <div className="border-b border-gray-300 pb-2">
                                            <span className="text-[10px] font-bold text-gray-500 uppercase block mb-1 tracking-wider">Fecha de Solicitud</span>
                                            <div className="text-base text-black">{selectedCsvCandidate.date}</div>
                                        </div>
                                    </div>
                                </section>

                                {/* Form Answers - 2 Col Grid */}
                                <section>
                                    <h3 className="text-sm font-bold bg-gray-900 text-white px-4 py-2 inline-block uppercase tracking-wider mb-6 rounded shadow-sm">Detalles del Formulario</h3>
                                    <div className="grid grid-cols-2 gap-6">
                                        {selectedCsvCandidate.fullData
                                            .filter(f => !['Nombre Completo', 'Marca temporal', 'Email', 'Teléfono'].includes(f.label))
                                            .map((field, idx) => (
                                            <div key={idx} className={`break-inside-avoid mb-2 ${field.value?.length > 100 ? 'col-span-2' : ''}`}>
                                                <div className="text-[10px] font-bold text-gray-500 uppercase mb-2 tracking-wider flex items-center gap-2">
                                                    <span className="w-1 h-1 bg-blue-500 rounded-full"></span>
                                                    {field.label}
                                                </div>
                                                <div className="bg-gray-50 p-4 rounded-lg border border-gray-200 text-black text-sm whitespace-pre-wrap leading-relaxed shadow-sm">
                                                    {field.value || 'N/A'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <div className="mt-16 pt-8 border-t-2 border-gray-200 flex justify-between items-center text-[10px] text-gray-400 font-mono uppercase">
                                    <span>Sistema Integrado Gestion Empresarial</span>
                                    <span>ID Ref: {selectedCsvCandidate.id} • {new Date().toLocaleDateString()}</span>
                                </div>
                             </div>
                        </div>,
                        document.body
                    )}

                    {/* HIRING MODAL */}
                    {isHiringModalOpen && selectedCandidate && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <div className="bg-gray-800 rounded-3xl p-8 max-w-2xl w-full border border-gray-700 shadow-2xl relative">
                                <button 
                                    onClick={() => setIsHiringModalOpen(false)}
                                    className="absolute top-4 right-4 text-gray-400 hover:text-white"
                                >
                                    <XCircle size={24} />
                                </button>
                                
                                <h2 className="text-2xl font-bold text-white mb-2">Formalizar Contrato</h2>
                                <p className="text-gray-400 mb-6">Confirma los datos para generar el contrato y el expediente.</p>
                                
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold">Cargo</label>
                                        <input 
                                            className="w-full bg-gray-900 border border-gray-600 p-3 rounded-lg text-white"
                                            defaultValue={selectedCandidate.positionApplied || hiringData.jobTitle}
                                            onChange={e => setHiringData({...hiringData, jobTitle: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold">Salario Mensual</label>
                                        <input 
                                            type="number"
                                            className="w-full bg-gray-900 border border-gray-600 p-3 rounded-lg text-white font-mono text-green-400 font-bold"
                                            defaultValue={hiringData.salary}
                                            onChange={e => setHiringData({...hiringData, salary: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold">Fecha Inicio</label>
                                        <input 
                                            type="date"
                                            className="w-full bg-gray-900 border border-gray-600 p-3 rounded-lg text-white"
                                            defaultValue={hiringData.startDate}
                                            onChange={e => setHiringData({...hiringData, startDate: e.target.value})}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold">Departamento</label>
                                        <input 
                                            className="w-full bg-gray-900 border border-gray-600 p-3 rounded-lg text-white"
                                            defaultValue="General"
                                            onChange={e => setHiringData({...hiringData, department: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-xl mb-6 text-sm text-blue-300">
                                    <p className="font-bold flex items-center gap-2">ℹ️ Al confirmar:</p>
                                    <ul className="list-disc ml-5 mt-1 space-y-1">
                                        <li>Se creará el empleado en el sistema.</li>
                                        <li>Se generará el contrato PDF en <code>Documentos/Gestion Empresarial_RRHH</code>.</li>
                                        <li>El candidato pasará a estado ACTIVO.</li>
                                    </ul>
                                </div>

                                <div className="flex gap-4">
                                    <button 
                                        onClick={() => setIsHiringModalOpen(false)}
                                        className="flex-1 py-3 rounded-xl font-bold bg-gray-700 hover:bg-gray-600 text-gray-300"
                                    >
                                        Cancelar
                                    </button>
                                    <button 
                                        onClick={handleHireCandidate}
                                        className="flex-1 py-3 rounded-xl font-bold bg-green-600 hover:bg-green-500 text-white shadow-lg active:scale-95 transition"
                                    >
                                        ¡PROCEDER A CONTRATACIÓN!
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* INVITATION MODAL */}
                    {isInvitationModalOpen && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                            <div className="bg-gray-800 rounded-3xl p-8 max-w-md w-full border border-gray-700 shadow-2xl relative">
                                <button 
                                    onClick={() => setIsInvitationModalOpen(false)}
                                    className="absolute top-4 right-4 text-gray-400 hover:text-white"
                                >
                                    <XCircle size={24} />
                                </button>
                                
                                <h2 className="text-xl font-bold text-white mb-6">Invitar Candidato</h2>
                                
                                <div className="space-y-4 mb-6">
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold">Nombre Completo</label>
                                        <input 
                                            className="w-full bg-gray-900 border border-gray-600 p-3 rounded-lg text-white mb-2"
                                            value={invitationData.name}
                                            onChange={e => setInvitationData({...invitationData, name: e.target.value})}
                                            placeholder="Ej. Maria Lopez"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold">Correo Electrónico</label>
                                        <input 
                                            className="w-full bg-gray-900 border border-gray-600 p-3 rounded-lg text-white"
                                            value={invitationData.email}
                                            onChange={e => setInvitationData({...invitationData, email: e.target.value})}
                                            placeholder="ejemplo@correo.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500 uppercase font-bold">Puesto (Opcional)</label>
                                        <input 
                                            className="w-full bg-gray-900 border border-gray-600 p-3 rounded-lg text-white"
                                            value={invitationData.position}
                                            onChange={e => setInvitationData({...invitationData, position: e.target.value})}
                                            placeholder="Ej. Visitador Médico"
                                        />
                                    </div>
                                </div>

                                <button 
                                    onClick={handleSendInvitation}
                                    className="w-full py-3 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg active:scale-95 transition flex items-center justify-center gap-2"
                                >
                                    <UserPlus size={20} /> Enviar Invitación
                                </button>
                            </div>
                        </div>
                    )}

                    {/* FORM MANAGEMENT MODAL (PREVIEW/EDIT) */}
                    {isFormConfigOpen && (
                        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-[60] flex flex-col p-6">
                            <div className="flex justify-between items-center mb-6">
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg">
                                        <Monitor size={24} />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black text-white tracking-tight">Gestión del Formulario de Reclutamiento</h2>
                                        <p className="text-gray-400 text-sm font-medium">Previsualiza y edita tu formulario de captación de talento.</p>
                                    </div>
                                </div>
                                <div className="flex gap-4">
                                    <button 
                                        onClick={() => {
                                            if (editUrl) {
                                                window.electronAPI.invoke('app:open-external', editUrl);
                                            } else {
                                                alert('No has configurado el Link de Edición en Ajustes. Por favor, ve a Configuración y pégalo allí.');
                                            }
                                        }}
                                        className="bg-white hover:bg-gray-100 text-gray-900 px-6 py-3 rounded-2xl font-black flex items-center gap-2 transition shadow-xl"
                                    >
                                        ✏️ Abrir Editor en Navegador
                                    </button>
                                    <button 
                                        onClick={() => setIsFormConfigOpen(false)}
                                        className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-2xl font-black transition border border-gray-700"
                                    >
                                        Cerrar Vista
                                    </button>
                                </div>
                            </div>

                            <div className="flex-1 bg-white rounded-[2rem] overflow-hidden shadow-2xl relative">
                                {formUrl ? (
                                    <iframe 
                                        src={formUrl} 
                                        className="w-full h-full border-none"
                                        title="Vista Previa del Formulario"
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                                        <Monitor size={80} className="opacity-10" />
                                        <p className="text-xl font-bold">No hay URL configurada</p>
                                        <p className="max-w-md text-center">Debes ir a la pestaña de <span className="text-blue-500 font-bold">Configuración</span> y pegar el link de tu Google Form para verlo aquí.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
