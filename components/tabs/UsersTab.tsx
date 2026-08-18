import React, { useState, useEffect } from 'react';
import { Users, Plus, Trash2, Mail, Lock, Shield, LayoutDashboard, Search, Loader2 } from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  workspace: string;
  role: string;
  created_at: string;
}

export const UsersTab: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Form states
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newName, setNewName] = useState('');
  const [newWorkspace, setNewWorkspace] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const token = sessionStorage.getItem('sf_session_token');
      const res = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Falha ao carregar usuários');
      const data = await res.json();
      setUsers(data);
    } catch (err) {
      setError('Erro ao buscar usuários.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword || !newName || !newWorkspace) {
      alert('Preencha todos os campos!');
      return;
    }
    
    setIsSubmitting(true);
    try {
      const token = sessionStorage.getItem('sf_session_token');
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          name: newName,
          workspace: newWorkspace,
          role: 'user' // default
        })
      });

      if (!res.ok) throw new Error('Erro ao criar usuário');
      
      setNewEmail('');
      setNewPassword('');
      setNewName('');
      setNewWorkspace('');
      setIsAddingUser(false);
      fetchUsers();
    } catch (err) {
      alert('Erro ao adicionar usuário. Talvez o email ou workspace já existam.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este usuário? Ele perderá o acesso.')) return;
    
    try {
      const token = sessionStorage.getItem('sf_session_token');
      const res = await fetch(`/api/users/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Falha ao deletar');
      fetchUsers();
    } catch (err) {
      alert('Erro ao remover usuário.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 rounded-xl">
              <Users className="w-6 h-6 text-indigo-500" />
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              Gestão de Usuários
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 max-w-2xl text-sm">
            Adicione e gerencie o acesso das pessoas à plataforma. Cada usuário criado recebe um "Workspace" isolado.
          </p>
        </div>

        <button 
          onClick={() => setIsAddingUser(!isAddingUser)}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-500/30 transition-all active:scale-95 shrink-0"
        >
          {isAddingUser ? 'Cancelar' : (
            <>
              <Plus size={18} />
              Novo Usuário
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-xl font-medium">
          {error}
        </div>
      )}

      {/* Add User Form */}
      {isAddingUser && (
        <form onSubmit={handleAddUser} className="bg-white dark:bg-[#0d1117] rounded-3xl border border-slate-200 dark:border-slate-800 p-6 md:p-8 shadow-xl animate-in slide-in-from-top-4 fade-in duration-300">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6">Criar Novo Acesso</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Nome</label>
              <div className="relative">
                <Users className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="Ex: Ilana"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">E-mail</label>
              <div className="relative">
                <Mail className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                <input 
                  type="email" 
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="ilana@socialflow.com"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Senha Inicial</label>
              <div className="relative">
                <Lock className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="ilana2026"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all dark:text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500 ml-1">Workspace ID</label>
              <div className="relative">
                <LayoutDashboard className="absolute left-4 top-3.5 w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  value={newWorkspace}
                  onChange={e => setNewWorkspace(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                  placeholder="ex: amiga_ilana"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-xl text-sm focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all dark:text-white"
                />
              </div>
              <p className="text-[10px] text-slate-400 ml-1">Identificador único (sem espaços).</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button 
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/30 transition-all flex items-center gap-2"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar e Criar Usuário'}
            </button>
          </div>
        </form>
      )}

      {/* Users List */}
      <div className="bg-white dark:bg-[#0d1117] rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <Shield className="w-5 h-5 text-indigo-500" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Usuários Ativos</h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-[#161b22]/50">
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Usuário</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">E-mail</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Workspace</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Cargo</th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-[#161b22]/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900 dark:text-white">{user.name}</div>
                  </td>
                  <td className="px-6 py-4 text-slate-600 dark:text-slate-300">
                    {user.email}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-lg uppercase tracking-wider">
                      {user.workspace}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {user.role === 'admin' ? (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-sm">
                        <Shield className="w-4 h-4" /> Admin
                      </span>
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                        Usuário Comum
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {user.role !== 'admin' && (
                      <button 
                        onClick={() => handleDeleteUser(user.id)}
                        className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                        title="Remover Usuário"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              
              {users.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
