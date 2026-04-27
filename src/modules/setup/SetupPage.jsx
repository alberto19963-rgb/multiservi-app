import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Activity, ShieldCheck, AlertCircle, Building2 } from 'lucide-react';

export default function SetupPage({ onSetupComplete }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successData, setSuccessData] = useState(null);

  const handleVerify = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const trimmedCode = code.trim().toUpperCase();
      if (!trimmedCode) throw new Error("Por favor, ingrese un código válido.");

      // IDENTIFICAR HARDWARE REAL (Hardware Lock)
      let machineId = "HW-GENERIC-" + (new Date().getTime());
      try {
        if (window.electronAPI?.system?.getMachineId) {
          machineId = await window.electronAPI.system.getMachineId();
        }
      } catch (e) {
        console.warn("No pude obtener Machine ID, usando fallback", e);
      }

      // Verificar en la Nube
      const { data: company, error: sbError } = await supabase
        .from('companies')
        .select('*')
        .eq('company_code', trimmedCode)
        .maybeSingle();

      if (sbError) {
        throw new Error(`Error de red/nube: ${sbError.message} (${sbError.code})`);
      }
      
      if (!company) {
        throw new Error("El código ingresado no existe en nuestra base de datos.");
      }

      if (company.status !== 'ACTIVE') {
        throw new Error("La licencia para esta empresa se encuentra Suspendida.");
      }

      // VALIDACIÓN DE HARDWARE LOCK (Solo para Demos)
      // Buscamos si este plan es tipo TRIAL
      const { data: plan } = await supabase
        .from('subscription_plans')
        .select('plan_type')
        .eq('id', company.plan_id)
        .maybeSingle();
      
      const isTrial = company.plan_type === 'TRIAL' || (plan && plan.plan_type === 'TRIAL');

      if (isTrial) {
        const { data: trialUsed } = await supabase
          .from('trial_history')
          .select('*')
          .eq('hardware_id', machineId)
          .maybeSingle();
        
        if (trialUsed) {
          throw new Error("⚠️ Esta computadora ya utilizó su periodo de prueba gratuito. Por favor, adquiera un plan premium para continuar activando este equipo.");
        }
      }

      // Validar Límite de Dispositivos
      const { count: devicesCount, error: countError } = await supabase
        .from('devices')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', company.id);

      if (devicesCount >= company.max_devices) {
        throw new Error(`Se ha alcanzado el límite de computadoras (${company.max_devices}) de su plan. Contacte soporte para ampliar su licencia.`);
      }

      // Registrar dispositivo en la nube
      const pcId = "PC-" + Math.random().toString(36).substr(2, 9).toUpperCase();
      let realHostname = 'Caja Nueva';
      
      try {
        if (window.electronAPI?.system?.getHostname) {
          const name = await window.electronAPI.system.getHostname();
          if (name) realHostname = name;
        }
      } catch (e) {
        console.warn("No pude obtener el hostname:", e);
      }
      
      const { error: insertError } = await supabase
        .from('devices')
        .insert([{
          company_id: company.id,
          device_uid: pcId,
          machine_id: machineId,
          pc_name: realHostname
        }]);

      if (insertError) {
         console.warn("No pudimos registrar la caja en la DB en vivo, ignorando por ahora", insertError);
      }

      // Si es Trial, registrar en el historial global para bloqueo futuro
      if (isTrial) {
         await supabase.from('trial_history').insert([{
            hardware_id: machineId,
            plan_id: company.plan_id,
            company_id: company.id
         }]);
      }

      // Guardar localmente
      if (window.electronAPI) {
        await window.electronAPI.invoke("db:save-setting", "company_code", trimmedCode);
        await window.electronAPI.invoke("db:save-setting", "company_name", company.name);
        await window.electronAPI.invoke("db:save-setting", "device_uid", pcId);
        await window.electronAPI.invoke("db:save-setting", "machine_id", machineId);
        await window.electronAPI.invoke("db:save-setting", "pc_name", realHostname);
      } else {
        localStorage.setItem("company_code", trimmedCode);
        localStorage.setItem("company_name", company.name);
        localStorage.setItem("device_uid", pcId);
        localStorage.setItem("machine_id", machineId);
        localStorage.setItem("pc_name", realHostname);
      }

      setSuccessData({ pcId, hostname: realHostname });
      // Remove automatic onSetupComplete() to show the success message

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4">
      {/* Decorative Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md bg-neutral-900/80 backdrop-blur-xl border border-neutral-800 p-8 rounded-3xl shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-gradient-to-tr from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center p-0.5">
             <div className="w-full h-full bg-neutral-950 rounded-[14px] flex items-center justify-center">
                <Building2 className="w-8 h-8 text-neutral-200" />
             </div>
          </div>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white tracking-tight">Bienvenido a Gestion Empresarial POS</h1>
          <p className="text-neutral-400 mt-2 text-sm">
            Para configurar esta computadora en su red de empresa, ingrese su código de licencia.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {successData ? (
          <div className="text-center space-y-6 py-4 animate-in fade-in zoom-in duration-500">
            <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-green-500/30">
              <ShieldCheck className="w-10 h-10 text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">¡Activación Exitosa!</h2>
              <p className="text-neutral-400 text-sm mt-1">Esta computadora ha sido vinculada correctamente.</p>
            </div>
            
            <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-4 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-500">NOMBRE DEL EQUIPO</span>
                <span className="text-white font-bold">{successData.hostname}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-neutral-500">CÓDIGO DE IDENTIDAD</span>
                <span className="text-blue-400 font-mono font-bold">{successData.pcId}</span>
              </div>
            </div>

            <button
              onClick={() => onSetupComplete()}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl px-4 py-3 transition-colors"
            >
              Entrar al Sistema
            </button>
            <p className="text-[10px] text-neutral-500">Guarde este código para futuras consultas de soporte.</p>
          </div>
        ) : (
          <form onSubmit={handleVerify} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-neutral-400 mb-2">
                Código Único de Empresa
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Ej: MININEGOCIO-01"
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-white placeholder-neutral-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all uppercase text-center tracking-widest font-mono text-lg"
                autoFocus
              />
            </div>

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="w-full relative group overflow-hidden bg-white text-black font-semibold rounded-xl px-4 py-3 "
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-center justify-center space-x-2 group-hover:text-white transition-colors">
                {loading ? (
                  <>
                    <Activity className="w-5 h-5 animate-spin" />
                    <span>Verificando Licencia...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-5 h-5" />
                    <span>Activar Computadora</span>
                  </>
                )}
              </div>
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-neutral-800 text-center">
          <p className="text-xs text-neutral-500">
            Seguridad Cloud Sync verificada.<br/>
            Contacte a su administrador si olvidó el código.
          </p>
        </div>
      </div>
    </div>
  );
}
