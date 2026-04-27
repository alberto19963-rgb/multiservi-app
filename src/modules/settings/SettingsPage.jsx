import React, { useState, useEffect, useRef } from 'react';
import { Settings, Save, Printer, Database, Cloud, RefreshCw, Download, Plus, Eye, EyeOff, Shield, ShieldCheck, Mail, ArrowRight } from 'lucide-react';
import { db, system } from '../../api/electron';
import { supabase } from '../../lib/supabase';

export default function SettingsPage({ hasProAccess }) {
  // State for System Updates
  const [updateStatus, setUpdateStatus] = useState('Sistema actualizado');
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(null); // { percent, bytesPerSecond }
  const [showPassword, setShowPassword] = useState(false);
  const [appVersion, setAppVersion] = useState('...');

  // DGII State
  const [dgiiStatus, setDgiiStatus] = useState('...');
  const [dgiiProgress, setDgiiProgress] = useState(null);

  // State for Company Info
  const [licenseInfo, setLicenseInfo] = useState({
      code: 'Cargando...',
      companyName: '...',
      maxDevices: 0,
      activeDevices: 0,
      status: '...'
  });
  const [companySettings, setCompanySettings] = useState({
      name: 'Gestion Empresarial, srl',
      rnc: '',
      address: '',
      phone: '',
      recruitmentFormUrl: '',
      recruitmentSheetUrl: ''
  });

  const [printerSettings, setPrinterSettings] = useState({
      defaultPrinter: '',
      paperSize: '80mm',
      autoPrint: false
  });

  // Experimental Mail Engine State
  const [mailLinkEmail, setMailLinkEmail] = useState('');
  const [mailLinkData, setMailLinkData] = useState(null); // { auditAccessKey, status }
  const [isLinking, setIsLinking] = useState(false);

  useEffect(() => {
    if (!window.electronAPI) return;

    // Load Printer Settings
    (async () => {
        try {
            const name = await db.getSetting('company_name');
            const rnc = await db.getSetting('company_rnc');
            const address = await db.getSetting('company_address');
            const phone = await db.getSetting('company_phone');
            const recForm = await db.getSetting('recruitment_form_url');
            const recEdit = await db.getSetting('recruitment_edit_url');
            const recSheet = await db.getSetting('recruitment_sheet_url');

            setCompanySettings(prev => ({
                ...prev,
                name: name || prev.name,
                rnc: rnc || prev.rnc,
                address: address || prev.address,
                phone: phone || prev.phone,
                recruitmentFormUrl: recForm || '',
                recruitmentEditUrl: recEdit || '',
                recruitmentSheetUrl: recSheet || ''
            }));

            // Load Experimental Mail Link
            const linkedEmail = await db.getSetting('mail_link_email');
            if (linkedEmail) {
                setMailLinkEmail(linkedEmail);
                const status = await db.getMailLinkStatus(linkedEmail);
                if (status) setMailLinkData(status);
            }

            // Fetch License Info from Cloud
            const savedCode = await db.getSetting('company_code');
            if (savedCode) {
               const { data: comp } = await supabase.from('companies').select('*').eq('company_code', savedCode).maybeSingle();
               if (comp) {
                   const dUid = await db.getSetting("device_uid");
                   const pName = await db.getSetting("pc_name");

                   // 1. Verificar si esta terminal específica existe en la nube
                   let myDevice = null;
                   if (dUid) {
                       const { data: dev } = await supabase.from('devices')
                           .select('*')
                           .eq('company_id', comp.id)
                           .eq('device_uid', dUid)
                           .maybeSingle();
                       myDevice = dev;
                   }

                   // 2. Si no existe localmente o no está en la nube, registrar/re-registrar
                   if (!dUid || !myDevice) {
                       const pcId = dUid || ("PC-" + Math.random().toString(36).substr(2, 6).toUpperCase());
                       let realHostname = pName || 'Caja Registradora';
                       
                       try {
                           const name = await window.electronAPI.invoke("app:get-hostname");
                           if (name) realHostname = name;
                       } catch (e) {}

                       if (!dUid) await db.saveSetting("device_uid", pcId);
                       if (!pName) await db.saveSetting("pc_name", realHostname);

                       // Upsert en la nube para asegurar vinculación
                       await supabase.from('devices').upsert([{
                           company_id: comp.id,
                           device_uid: pcId,
                           pc_name: realHostname
                       }], { onConflict: 'company_id, device_uid' });
                       
                       console.log(`[License] Terminal ${pcId} vinculada con éxito a la empresa.`);
                   }

                   // 3. Obtener el conteo real y actualizado de dispositivos
                   const { count } = await supabase.from('devices').select('id', { count: 'exact' }).eq('company_id', comp.id);

                   setLicenseInfo({
                       code: savedCode,
                       companyName: comp.name,
                       maxDevices: comp.max_devices,
                       activeDevices: count || 0,
                       status: comp.status,
                       deviceUid: dUid || 'PC-GENERANDO...',
                       pcName: pName || 'Cargando...'
                   });
               }
            }

        } catch (e) { console.error(e); }
    })();

    // Load real app version
    window.electronAPI?.invoke('app:get-version').then(v => {
      if (v) setAppVersion(v);
    }).catch(() => setAppVersion('dev'));

    const loadDgii = async () => {
       const status = await db.getDGIIStatus();
       setDgiiStatus(status ? new Date(status).toLocaleDateString() : 'Nunca (No instalado)');
    };
    loadDgii();

    const removeDgii = db.onDGIIProgress((progress) => {
       setDgiiProgress(progress);
       if (progress.step === 'done') {
           loadDgii();
           setTimeout(() => setDgiiProgress(null), 5000);
       }
       if (progress.step === 'error') {
           setTimeout(() => setDgiiProgress(null), 8000);
       }
    });

    const removeAvailable = db.onUpdateAvailable(() => {
        setUpdateStatus('Nueva versión disponible. Descargando...');
        setDownloadProgress({ percent: 0 });
    });

    const removeDownloaded = db.onUpdateDownloaded(() => {
        setUpdateStatus('Actualización lista para instalar.');
        setUpdateAvailable(true);
        setDownloadProgress(null);
    });

    // Listen to download progress for the UI progress bar
    const removeProgress = window.electronAPI?.on
      ? window.electronAPI.on('download-progress', (progressObj) => {
          setDownloadProgress(progressObj);
          setUpdateStatus(`Descargando actualización... ${Math.round(progressObj.percent)}%`);
        })
      : null;
    
    return () => {
        if (typeof removeAvailable === 'function') removeAvailable();
        if (typeof removeDownloaded === 'function') removeDownloaded();
        if (typeof removeDgii === 'function') removeDgii();
        if (typeof removeProgress === 'function') removeProgress();
    };
  }, []);

  // Polling for Mail Link Status
  useEffect(() => {
    if (!mailLinkEmail || (mailLinkData && mailLinkData.auditAccessKey)) return;

    const interval = setInterval(async () => {
        const status = await db.getMailLinkStatus(mailLinkEmail);
        if (status && status.auditAccessKey) {
            setMailLinkData(status);
            // Save permanently in local DB
            await db.saveSetting('mail_link_email', mailLinkEmail);
            await db.saveSetting('mail_link_active', 'true');
            clearInterval(interval);
        }
    }, 3000);

    return () => clearInterval(interval);
  }, [mailLinkEmail, mailLinkData]);

  const handleSave = async (e) => {
      e.preventDefault();
      try {
          // Save Company Info
          await db.saveSetting('company_name', companySettings.name || '');
          await db.saveSetting('company_rnc', companySettings.rnc || '');
          await db.saveSetting('company_address', companySettings.address || '');
          await db.saveSetting('company_phone', companySettings.phone || '');
          
          // Save Recruitment Config
          await db.saveSetting('recruitment_form_url', companySettings.recruitmentFormUrl || '');
          await db.saveSetting('recruitment_edit_url', companySettings.recruitmentEditUrl || '');
          await db.saveSetting('recruitment_sheet_url', companySettings.recruitmentSheetUrl || '');
          
          // Save Printer Settings (Example)
          // await db.savePrinterSettings(printerSettings);

          alert('✅ Configuración guardada correctamente');
      } catch (err) {
          console.error(err);
          alert('Error al guardar configuración');
      }
  };

  return (
    <div className="p-8 h-full flex flex-col">
      <h1 className="text-3xl font-bold text-gray-800 mb-6 flex items-center">
        <Settings className="mr-3 text-gray-600" size={32} />
        Configuración del Sistema
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Company Info */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
              <h2 className="text-xl font-bold mb-4 flex items-center text-gray-800">
                  <Database className="mr-2 text-blue-600" size={24} />
                  Datos de la Empresa
              </h2>
              <form onSubmit={handleSave} className="space-y-4">
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Comercial</label>
                      <input 
                        type="text" 
                        className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:border-blue-500"
                        value={companySettings.name}
                        onChange={e => setCompanySettings({...companySettings, name: e.target.value})}
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">RNC / Cédula</label>
                      <input 
                        type="text" 
                        className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:border-blue-500"
                        value={companySettings.rnc}
                        onChange={e => setCompanySettings({...companySettings, rnc: e.target.value})}
                      />
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                      <input 
                        type="text" 
                        className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:border-blue-500"
                        value={companySettings.address}
                        onChange={e => setCompanySettings({...companySettings, address: e.target.value})}
                      />
                  </div>
                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono</label>
                      <input 
                        type="text" 
                        className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:border-blue-500"
                        value={companySettings.phone}
                        onChange={e => setCompanySettings({...companySettings, phone: e.target.value})}
                      />
                  </div>




                  {/* Módulo de Reclutamiento - Siempre Visible */}
                  <div className="pt-4 border-t border-gray-200 mt-4">
                      <h3 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <span>📋</span> Módulo de Reclutamiento
                      </h3>
                      <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Link del Formulario (Para enviar)</label>
                            <input 
                                className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:border-blue-500 text-sm"
                                placeholder="https://docs.google.com/forms/..."
                                value={companySettings.recruitmentFormUrl || ''}
                                onChange={e => setCompanySettings({...companySettings, recruitmentFormUrl: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1 text-purple-600">Link de Edición (Dueño)</label>
                            <input 
                                className="w-full border border-purple-200 bg-purple-50/30 rounded-lg p-2 outline-none focus:border-purple-500 text-sm"
                                placeholder="https://docs.google.com/forms/d/.../edit"
                                value={companySettings.recruitmentEditUrl || ''}
                                onChange={e => setCompanySettings({...companySettings, recruitmentEditUrl: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Link de Respuestas (Google Sheets / Excel)</label>
                            <input 
                                className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:border-blue-500 text-sm"
                                placeholder="https://docs.google.com/spreadsheets/..."
                                value={companySettings.recruitmentSheetUrl || ''}
                                onChange={e => setCompanySettings({...companySettings, recruitmentSheetUrl: e.target.value})}
                            />
                            <p className="text-[10px] text-gray-400 mt-1">Crea una hoja de cálculo desde la pestaña "Respuestas" de tu formulario.</p>
                        </div>
                      </div>
                  </div>
                  
                  <button 
                    type="submit"
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex items-center justify-center transition"
                  >
                      <Save className="mr-2" size={20} />
                      Guardar Datos
                  </button>
              </form>
          </div>



          {/* Printer Settings */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
               <h2 className="text-xl font-bold mb-4 flex items-center text-gray-800">
                  <Printer className="mr-2 text-purple-600" size={24} />
                  Impresora de Tickets
              </h2>
              <div className="space-y-4">
                   <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Impresora Predeterminada</label>
                      <select 
                        className="w-full border border-gray-300 rounded-lg p-2 outline-none bg-white"
                        value={printerSettings.defaultPrinter}
                        onChange={e => setPrinterSettings({...printerSettings, defaultPrinter: e.target.value})}
                      >
                          <option value="">Seleccionar Impresora...</option>
                          <option value="POS-80">POS-80</option>
                          <option value="PDF">Microsoft Print to PDF</option>
                      </select>
                  </div>
                  <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tamaño de Papel</label>
                      <div className="flex space-x-4">
                          <label className="flex items-center space-x-2 cursor-pointer">
                              <input 
                                type="radio" 
                                name="paper" 
                                value="80mm" 
                                checked={printerSettings.paperSize === '80mm'}
                                onChange={() => setPrinterSettings({...printerSettings, paperSize: '80mm'})}
                              />
                              <span>80mm (Estándar)</span>
                          </label>
                           <label className="flex items-center space-x-2 cursor-pointer">
                              <input 
                                type="radio" 
                                name="paper" 
                                value="58mm" 
                                checked={printerSettings.paperSize === '58mm'}
                                onChange={() => setPrinterSettings({...printerSettings, paperSize: '58mm'})}
                              />
                              <span>58mm (Pequeño)</span>
                          </label>
                      </div>
                  </div>
                   <div className="flex items-center space-x-3 pt-2">
                      <input 
                        type="checkbox" 
                        id="autoprint"
                        className="w-5 h-5 text-blue-600 rounded"
                        checked={printerSettings.autoPrint}
                        onChange={e => setPrinterSettings({...printerSettings, autoPrint: e.target.checked})}
                      />
                      <label htmlFor="autoprint" className="text-gray-700 cursor-pointer select-none">Imprimir automáticamente al finalizar venta</label>
                  </div>
              </div>
          </div>

          {/* SaaS License Settings */}
          <div className="bg-gradient-to-br from-neutral-900 to-black p-8 rounded-3xl shadow-2xl border border-neutral-800 md:col-span-2 relative overflow-hidden">
             {/* Decorative */}
             <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-[80px] pointer-events-none" />
              
             <h2 className="text-2xl font-bold mb-6 flex items-center text-white">
                  <ShieldCheck className="mr-3 text-blue-400" size={28} />
                  Licencia y Suscripción (Nube)
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                 {/* ID Panel */}
                 <div className="bg-neutral-800/50 backdrop-blur-sm border border-neutral-700/50 p-6 rounded-2xl flex flex-col justify-center items-center text-center">
                    <p className="text-neutral-400 text-sm font-medium mb-1 tracking-widest uppercase">Código de tu Empresa</p>
                    <p className="text-3xl font-mono text-white font-bold tracking-widest bg-black/50 py-3 px-6 rounded-xl border border-neutral-700 w-full mb-3 shadow-inner">
                        {licenseInfo.code}
                    </p>
                    <p className="text-blue-400 font-semibold mb-4">{licenseInfo.companyName}</p>
                    
                    <button 
                        onClick={async () => {
                            const res = await window.electronAPI.invoke("db:sync-all-cloud");
                            if (res && res.success) {
                                alert(`¡Sincronización Exitosa! Se enviaron ${res.pushed} productos a la nube.`);
                            } else {
                                alert(`Error en sincronización masiva: ${res?.msg || 'Desconocido'}`);
                            }
                        }}
                        className="w-full bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 font-bold py-2 rounded-lg border border-blue-500/30 transition-all flex justify-center items-center gap-2 text-sm"
                    >
                        <Cloud size={16} />
                        Forzar Sync Inventario Viejo
                    </button>
                 </div>

                 {/* Stats Panel */}
                 <div className="space-y-4">
                    <div className="flex justify-between items-center bg-neutral-800/50 p-4 rounded-xl border border-neutral-700/50">
                        <span className="text-neutral-400 font-medium tracking-wide">Estado de Suscripción</span>
                        <span className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full border border-blue-500/20">
                            {licenseInfo.status === 'ACTIVE' ? 'LICENCIA ACTIVA' : 'SUSPENDIDA'}
                         </span>
                      </div>
                      
                      {/* INFORMACIÓN DEL DISPOSITIVO (EN LA ESQUINA) */}
                      <div className="mt-6 pt-6 border-t border-neutral-800 flex justify-between items-end">
                         <div className="space-y-1">
                            <p className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold">Identidad de esta Terminal</p>
                            <div className="flex items-center space-x-2">
                               <span className="text-xs bg-blue-500/10 text-blue-400 px-3 py-1 rounded-lg font-mono font-bold tracking-widest border border-blue-500/20">
                                  {licenseInfo.deviceUid || 'PC-ID NO ASIGNADO'}
                               </span>
                            </div>
                         </div>
                         <p className="text-[9px] text-neutral-600 italic">
                            Este código identifica este equipo ante su administrador.
                         </p>
                      </div>

                    <div className="flex flex-col bg-neutral-800/50 p-4 rounded-xl border border-neutral-700/50">
                        <div className="flex justify-between items-center mb-2">
                             <span className="text-neutral-400 font-medium tracking-wide">Límites de Computadoras</span>
                             <span className="text-white font-bold">{licenseInfo.activeDevices} / {licenseInfo.maxDevices} PCs</span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full bg-neutral-900 rounded-full h-2.5 overflow-hidden border border-neutral-700">
                             <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-2.5 rounded-full" style={{ width: `${Math.min((licenseInfo.activeDevices / (licenseInfo.maxDevices || 1)) * 100, 100)}%` }}></div>
                        </div>
                        <p className="text-xs text-neutral-500 mt-2 text-right">
                           Cajas registradas online en tu red.
                        </p>
                    </div>
                 </div>
              </div>
          </div>

           {/* Motor DGII */}
           <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 md:col-span-2">
              <h2 className="text-xl font-bold mb-4 flex items-center text-gray-800">
                   <Database className="mr-2 text-indigo-600" size={24} />
                   Motor Local DGII (RNCs)
               </h2>
               <div className="flex flex-col space-y-4">
                   <div className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100">
                       <span className="text-gray-600 font-medium">Última Descarga:</span>
                       <span className="font-bold text-indigo-900">{dgiiStatus}</span>
                   </div>
                   
                   {dgiiProgress ? (
                       <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 shadow-inner">
                           <p className={`font-bold mb-2 flex items-center ${dgiiProgress.step === 'error' ? 'text-red-600' : 'text-indigo-800'}`}>
                              <RefreshCw className={`mr-2 ${dgiiProgress.step === 'error' || dgiiProgress.step === 'done' ? '' : 'animate-spin'}`} size={18} />
                              {dgiiProgress.step === 'error' ? 'Error' : dgiiProgress.step === 'done' ? '¡Éxito!' : 'Trabajando...'}
                           </p>
                           <p className="text-sm text-indigo-600 font-mono">{dgiiProgress.msg}</p>
                       </div>
                   ) : (
                       <button 
                         type="button"
                         onClick={async () => {
                             try {
                               setDgiiProgress({ step: 'init', msg: 'Iniciando conexión a la DGII...' });
                               await db.syncDGII();
                             } catch (e) {
                               setDgiiProgress({ step: 'error', msg: e.message });
                             }
                         }}
                         className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 transition shadow-sm flex justify-center items-center gap-2"
                       >
                          <Download size={20} />
                          Actualizar Padrón General (20MB)
                       </button>
                   )}
                   <p className="text-xs text-gray-400 text-center leading-relaxed max-w-2xl mx-auto">
                     Esta herramienta descarga el listado completo de la DGII en tu computadora. <br/>
                     Te permite buscar RNCs al instante en el Punto de Venta <b>sin internet</b> y <b>totalmente gratis</b>. <br/>
                     Es recomendable presionarlo al menos una vez al mes para obtener las empresas recientes.
                   </p>
               </div>
           </div>

          {/* System Updates */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 md:col-span-2">
             <h2 className="text-xl font-bold mb-4 flex items-center text-gray-800">
                  <RefreshCw className="mr-2 text-green-600" size={24} />
                  Actualizaciones del Sistema
              </h2>
              <div className="flex items-center justify-between">
                  <div>
                      <p className="font-medium text-gray-900">Versión Actual: <span className="text-indigo-600 font-bold">v{appVersion}</span></p>
                      <p className="text-sm text-gray-500">{updateStatus}</p>
                  </div>
                  {updateAvailable ? (
                      <button 
                        onClick={() => db.restartInstall()}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 animate-pulse font-bold flex items-center"
                      >
                          <Download size={18} className="mr-2" />
                          Instalar y Reiniciar
                      </button>
                  ) : downloadProgress ? (
                      <div className="flex items-center gap-3 text-indigo-600">
                          <RefreshCw size={18} className="animate-spin" />
                          <span className="font-bold text-sm">{Math.round(downloadProgress.percent || 0)}%</span>
                      </div>
                  ) : (
                      <button
                        onClick={async () => {
                          setUpdateStatus('Buscando actualizaciones en internet...');
                          try {
                            await window.electronAPI.invoke('app:check-updates');
                            setTimeout(() => setUpdateStatus('Verificación completa. Se avisará si hay algo nuevo.'), 3000);
                          } catch(e) {
                            setUpdateStatus('Error al buscar actualizaciones.');
                          }
                        }}
                        className="bg-blue-600 text-white px-5 py-2 rounded-xl hover:bg-blue-700 transition font-bold flex items-center gap-2 shadow"
                      >
                        <RefreshCw size={16} />
                        Buscar Actualizaciones
                      </button>
                  )}
              </div>
              {/* Download Progress Bar */}
              {downloadProgress && !updateAvailable && (
                  <div className="mt-4">
                      <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden border border-gray-200">
                          <div
                              className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500"
                              style={{ width: `${Math.min(downloadProgress.percent || 0, 100)}%` }}
                          />
                      </div>
                      <p className="text-xs text-gray-400 mt-1 text-right">
                          {downloadProgress.bytesPerSecond
                              ? `${(downloadProgress.bytesPerSecond / 1024).toFixed(0)} KB/s`
                              : 'Calculando velocidad...'}
                      </p>
                  </div>
              )}
          </div>


      </div>

      {/* GESTIÓN DE CORREO CENTRALIZADO (MAILENGINE OAUTH2) */}
      {hasProAccess && (
        <div className="mt-8 bg-white p-8 rounded-[2rem] shadow-xl border-2 border-dashed border-blue-200">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
                        <Mail size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-slate-900 tracking-tight">Gestión de Correo Centralizado</h2>
                      <p className="text-slate-500 font-medium">Conectado mediante MailEngine (OAuth2 Seguro).</p>
                  </div>
              </div>
              <div className="px-4 py-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase tracking-widest rounded-full">BETA</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
              <div className="space-y-6">
                  <div>
                      <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-[0.2em]">Correo de Gmail Central</label>
                      <div className="flex gap-2">
                        <input 
                            type="email" 
                            className="flex-1 border-2 border-slate-100 rounded-2xl p-4 outline-none focus:border-blue-600 font-bold text-slate-800 bg-slate-50"
                            placeholder="ejemplo@gmail.com"
                            value={mailLinkEmail}
                            onChange={e => setMailLinkEmail(e.target.value)}
                        />
                        <button 
                            onClick={async () => {
                                if (!mailLinkEmail) return alert('Pon un correo válido');
                                setIsLinking(true);
                                try {
                                    const res = await db.requestMailLink({ 
                                        email: mailLinkEmail, 
                                        companyName: companySettings.name 
                                    });
                                    if (res && !res.success) alert(res.message);
                                } catch (err) {
                                    alert('Error de conexión: ' + err.message);
                                } finally {
                                    setIsLinking(false);
                                }
                            }}
                            disabled={isLinking || (mailLinkData && mailLinkData.auditAccessKey)}
                            className={`px-8 py-4 rounded-2xl font-black text-white transition-all shadow-lg ${
                                (mailLinkData && mailLinkData.auditAccessKey) 
                                ? 'bg-emerald-500 shadow-emerald-500/20' 
                                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20 active:scale-95'
                            }`}
                        >
                            {isLinking ? 'Conectando...' : (mailLinkData && mailLinkData.auditAccessKey) ? '¡Enlazado!' : 'Enlazar con Google'}
                        </button>
                      </div>
                  </div>

                  {mailLinkData && mailLinkData.auditAccessKey && (
                    <div className="bg-slate-50 border-2 border-slate-100 p-6 rounded-[1.5rem] animate-in slide-in-from-top duration-500">
                        <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-[0.2em]">Contraseña Generada (Audit Key)</label>
                        <div className="flex items-center justify-between bg-white border border-slate-200 p-4 rounded-xl shadow-inner">
                            <span className="font-mono font-bold text-blue-600 tracking-widest">{mailLinkData.auditAccessKey}</span>
                            <ShieldCheck className="text-emerald-500" size={20} />
                        </div>
                        <p className="text-[10px] text-slate-400 mt-3 italic">Esta clave es única para tu empresa. No la compartas.</p>
                        
                        <div className="mt-6 pt-6 border-t border-slate-200">
                            <a 
                                href="https://mail.rosariogroupllc.com" 
                                target="_blank"
                                className="flex items-center justify-between group p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-400 transition-all shadow-sm"
                            >
                                <div className="flex items-center gap-3">
                                    <Cloud size={20} className="text-blue-500" />
                                    <span className="text-sm font-black text-slate-900">Ir al Portal de Auditoría</span>
                                </div>
                                <ArrowRight size={18} className="text-slate-300 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
                            </a>
                        </div>
                    </div>
                  )}
              </div>

              <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100">
                  <h3 className="font-black text-slate-900 text-sm mb-4 uppercase tracking-tighter">¿Cómo funciona este experimento?</h3>
                  <ul className="space-y-3">
                      {[
                          'Al darle a Enlazar, se abrirá tu navegador para autorizar a "MailEngine".',
                          'Una vez aceptes, Google nos dará un "Token" seguro para enviar correos.',
                          'El otro programa (Gestor de Mail) nos devolverá tu Clave Maestra.',
                          'Podrás ver todos los correos enviados desde el portal en tiempo real.',
                      ].map((item, i) => (
                          <li key={i} className="flex gap-3 text-xs text-slate-600 font-medium">
                              <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex-shrink-0 flex items-center justify-center font-black text-[10px]">{i+1}</div>
                              {item}
                          </li>
                      ))}
                  </ul>
              </div>
          </div>
        </div>
      )}

      <div className="mt-6 flex justify-end">
          <button 
            onClick={handleSave}
            className="bg-gray-900 text-white px-8 py-3 rounded-xl hover:bg-black transition-colors shadow-lg flex items-center space-x-2 font-bold"
          >
              <Save size={20} />
              <span>Guardar Cambios</span>
          </button>
      </div>

    </div>
  );
}
