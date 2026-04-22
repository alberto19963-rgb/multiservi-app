import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, Trash2, Save } from 'lucide-react';
import { db } from '../../api/electron';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', username: '', password: '', role: 'CASHIER' });
  const [error, setError] = useState('');

  const loadUsers = async () => {
    try {
      if (window.electronAPI) {
        const data = await db.getUsers();
        setUsers(data || []);
      }
    } catch (err) {
      console.error("Error loading users:", err);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!newUser.name || !newUser.username || !newUser.password) {
      setError('Todos los campos son obligatorios');
      return;
    }

    try {
      const result = await db.addUser(newUser);
      if (result) {
        setShowModal(false);
        setNewUser({ name: '', username: '', password: '', role: 'CASHIER' });
        loadUsers();
      } else {
        setError('Error al crear usuario (quizás el usuario ya existe)');
      }
    } catch (err) {
      setError('Error al crear usuario');
      console.error(err);
    }
  };

  return (
    <div className="p-8 h-full flex flex-col">
      <h1 className="text-3xl font-bold text-gray-800 mb-6 flex items-center">
        <Users className="mr-3 text-blue-600" size={32} />
        Gestion de Usuarios
      </h1>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg font-bold text-gray-800">Equipo de Trabajo</h3>
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
          >
            <UserPlus size={18} />
            <span>Nuevo Usuario</span>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-0">
          <table className="w-full">
            <thead className="bg-gray-50 text-gray-500 text-sm font-medium">
              <tr>
                <th className="px-6 py-4 text-left">Nombre</th>
                <th className="px-6 py-4 text-left">Usuario</th>
                <th className="px-6 py-4 text-left">Rol</th>
                <th className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4 font-medium text-gray-800">{user.name}</td>
                  <td className="px-6 py-4 text-gray-600">@{user.username}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                    }`}>
                      {user.role === 'ADMIN' ? 'Administrador' : 'Cajero'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {user.username !== 'admin' && (
                       <button className="text-gray-400 hover:text-red-500 transition-colors">
                         <Trash2 size={18} />
                       </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nuevo Usuario */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Crear Nuevo Usuario</h2>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleAddUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                <input 
                  autoFocus
                  type="text" 
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={newUser.name}
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Usuario</label>
                    <input 
                      type="text" 
                      className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      value={newUser.username}
                      onChange={e => setNewUser({...newUser, username: e.target.value})}
                    />
                </div>
                <div>
                     <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
                     <select 
                        className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none bg-white"
                        value={newUser.role}
                        onChange={e => setNewUser({...newUser, role: e.target.value})}
                     >
                         <option value="CASHIER">Cajero</option>
                         <option value="ADMIN">Administrador</option>
                     </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña</label>
                <input 
                  type="password" 
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  value={newUser.password}
                  onChange={e => setNewUser({...newUser, password: e.target.value})}
                />
              </div>

              <div className="flex gap-3 mt-6">
                <button 
                  type="button" 
                  onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center space-x-2"
                >
                  <Save size={18} />
                  <span>Guardar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
