
import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { User, ModeAccess, Role } from '../types';

interface Props {
  onClose: () => void;
}

const AdminPanel: React.FC<Props> = ({ onClose }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchUsers();
  }, [search]);

  const fetchUsers = async () => {
    setLoading(true);
    const data = await api.getUsers(search);
    setUsers(data);
    setLoading(false);
  };

  const toggleStatus = async (id: string, current: boolean) => {
    await api.updateUserStatus(id, !current);
    fetchUsers();
  };

  const changeMode = async (id: string, mode: ModeAccess) => {
    await api.updateUserMode(id, mode);
    fetchUsers();
  };

  const changeRole = async (id: string, role: Role) => {
    await api.updateUserRole(id, role);
    fetchUsers();
  };

  const deleteUser = async (id: string) => {
    if (confirm('Weet je zeker dat je deze gebruiker wilt verwijderen?')) {
      await api.deleteUser(id);
      fetchUsers();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 w-full max-w-5xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-[85vh] transition-colors border-8 border-white dark:border-slate-700">
        <div className="p-8 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <div>
            <h2 className="text-3xl font-black text-clever-dark dark:text-white">Centraal Beheer</h2>
            <p className="text-slate-400 font-medium">Beheer alle rollen en toegangsniveaus</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="relative">
              <i className="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
              <input 
                type="text" 
                placeholder="Zoek op e-mail..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-11 pr-4 py-3 bg-white dark:bg-slate-900 border-none rounded-xl text-sm focus:ring-2 focus:ring-clever-blue/20 w-64 dark:text-white"
              />
            </div>
            <button onClick={onClose} className="w-12 h-12 bg-white dark:bg-slate-700 rounded-2xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-600 transition-all shadow-sm">
              <i className="fa-solid fa-xmark text-xl text-slate-400"></i>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 no-scrollbar">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <i className="fa-solid fa-spinner fa-spin text-4xl text-clever-blue"></i>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-700">
                    <th className="pb-4 pl-4">Gebruiker</th>
                    <th className="pb-4">Rol</th>
                    <th className="pb-4">Status</th>
                    <th className="pb-4">Engine</th>
                    <th className="pb-4 text-right pr-4">Acties</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                  {users.map(user => (
                    <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors group">
                      <td className="py-4 pl-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black ${
                            user.role === Role.ADMIN ? 'bg-clever-magenta/10 text-clever-magenta' : 
                            user.role === Role.TEACHER ? 'bg-clever-yellow/10 text-clever-yellow-dark' : 
                            'bg-clever-blue/10 text-clever-blue'
                          }`}>
                            {user.email.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-clever-dark dark:text-slate-200">{user.email}</div>
                            <div className="text-[10px] text-slate-400 uppercase tracking-tighter">Sinds {new Date(user.createdAt).toLocaleDateString()}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4">
                        <select 
                          value={user.role}
                          onChange={(e) => changeRole(user.id, e.target.value as Role)}
                          className="bg-slate-100 dark:bg-slate-900 border-none rounded-xl text-xs font-bold p-2 focus:ring-0 dark:text-white"
                        >
                          <option value={Role.STUDENT}>STUDENT</option>
                          <option value={Role.TEACHER}>TEACHER</option>
                          <option value={Role.ADMIN}>ADMIN</option>
                        </select>
                      </td>
                      <td className="py-4">
                        <button 
                          onClick={() => toggleStatus(user.id, user.isActive)}
                          className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${user.isActive ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-red-100 dark:bg-red-900/30 text-red-600'}`}
                        >
                          {user.isActive ? 'Actief' : 'Geblokkeerd'}
                        </button>
                      </td>
                      <td className="py-4">
                        <select 
                          value={user.modeAccess}
                          onChange={(e) => changeMode(user.id, e.target.value as ModeAccess)}
                          className="bg-slate-100 dark:bg-slate-900 border-none rounded-xl text-xs font-bold p-2 focus:ring-0 dark:text-white"
                        >
                          <option value={ModeAccess.CLASSIC}>Classic</option>
                          <option value={ModeAccess.NATIVE}>Native Audio</option>
                        </select>
                      </td>
                      <td className="py-4 text-right pr-4">
                        <button 
                          onClick={() => deleteUser(user.id)}
                          className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/10 text-red-400 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100"
                        >
                          <i className="fa-solid fa-trash-can"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;

