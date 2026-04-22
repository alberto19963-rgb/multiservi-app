import React, { useState } from 'react';
import { User, Lock, ArrowRight } from 'lucide-react';
import { db } from '../../api/electron';

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      if (!window.electronAPI) {
          // Dev Mock
          if (username === 'admin' && password === 'admin') {
              onLogin({ name: 'Admin Mock', role: 'ADMIN' });
          } else {
              setError('Credenciales inválidas (Mock)');
          }
          setLoading(false);
          return;
      }

      const res = await db.login({ username, password });
      if (res.success) {
          onLogin(res.user);
      } else {
          setError(res.message);
      }
    } catch (err) {
      console.error(err);
      setError('Error de conexión');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 via-purple-700 to-pink-500 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-purple-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-yellow-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>
      <div className="absolute bottom-[-20%] left-[20%] w-96 h-96 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-4000"></div>

      <div className="bg-white/10 backdrop-blur-lg border border-white/20 p-8 rounded-2xl shadow-2xl w-full max-w-md z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Bienvenido</h1>
          <p className="text-white/70">Gestion Empresarial</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="relative">
             <User className="absolute left-3 top-3.5 text-white/50" size={20} />
             <input 
               type="text" 
               placeholder="Usuario" 
               className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all"
               value={username}
               onChange={(e) => setUsername(e.target.value)}
             />
          </div>

          <div className="relative">
             <Lock className="absolute left-3 top-3.5 text-white/50" size={20} />
             <input 
               type="password" 
               placeholder="Contraseña" 
               className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all"
               value={password}
               onChange={(e) => setPassword(e.target.value)}
             />
          </div>

          {error && (
              <div className="bg-red-500/20 border border-red-500/50 text-red-200 p-3 rounded-lg text-sm text-center">
                  {error}
              </div>
          )}

          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold py-3 rounded-xl shadow-lg transform transition-all active:scale-95 flex items-center justify-center group disabled:opacity-50"
          >
            {loading ? 'Ingresando...' : (
                <>
                Ingresar
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
                </>
            )}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
