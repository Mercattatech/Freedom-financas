import React, { useState } from 'react';
import { apiClient } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Loader2, Search, ShieldCheck, User, Pencil, Save, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminAccounts() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [editForm, setEditForm] = useState({ role: 'user', disabled: false, newPassword: '' });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['app-users'],
    queryFn: () => apiClient.entities.User.list(),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      // Clean up the data, only send password if provided
      const payload = { role: data.role, disabled: data.disabled };
      if (data.newPassword.trim().length > 0) {
        payload.password = data.newPassword.trim();
      }
      return apiClient.entities.User.update(id, payload);
    },
    onSuccess: () => {
      toast.success('Usuário atualizado com sucesso!');
      queryClient.invalidateQueries({ queryKey: ['app-users'] });
      setEditingUser(null);
    },
    onError: (e) => {
      toast.error(e.message || 'Erro ao atualizar usuário');
    }
  });

  if (isLoading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;
  }

  const filtered = users.filter((u) => {
    return !search || 
      u.email.toLowerCase().includes(search.toLowerCase()) || 
      (u.full_name && u.full_name.toLowerCase().includes(search.toLowerCase()));
  });

  const handleEditClick = (user) => {
    setEditingUser(user);
    setEditForm({
      role: user.role,
      disabled: user.disabled || false,
      newPassword: ''
    });
  };

  const handleSaveEdit = () => {
    updateMutation.mutate({ id: editingUser.id, data: editForm });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Contas & Engajamento</h2>
          <p className="text-slate-400 text-sm mt-1">Gerencie os usuários do sistema, histórico de acessos, senhas e permissões (Dono).</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          placeholder="Buscar por email ou nome..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-slate-900 border-slate-800 text-white placeholder:text-slate-500 max-w-md"
        />
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left whitespace-nowrap">
            <thead className="text-xs text-slate-400 uppercase bg-slate-900/50 border-b border-slate-800">
              <tr>
                <th className="px-6 py-4 font-medium">Usuário</th>
                <th className="px-6 py-4 font-medium">Permissão</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Último Acesso</th>
                <th className="px-6 py-4 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((u) => {
                const lastLoginStr = u.last_login 
                  ? format(new Date(u.last_login), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) 
                  : 'Nunca acessou';

                return (
                  <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0">
                          {u.role === 'admin' ? <ShieldCheck className="w-4 h-4 text-indigo-400" /> : <User className="w-4 h-4 text-slate-400" />}
                        </div>
                        <div>
                          <p className="text-white font-medium">{u.full_name || 'Sem Nome'}</p>
                          <p className="text-slate-400 text-xs">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge className={u.role === 'admin' ? 'bg-indigo-500/20 text-indigo-400 border-0' : 'bg-slate-800 text-slate-300 border-0'}>
                        {u.role === 'admin' ? 'Administrador' : 'Usuário Padrão'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">
                      {u.disabled ? (
                        <Badge className="bg-red-500/20 text-red-500 border-0">Bloqueado</Badge>
                      ) : (
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-0">Ativo</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-slate-300 font-mono text-xs">
                      {lastLoginStr}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleEditClick(u)} className="text-slate-400 hover:text-white hover:bg-slate-800">
                        <Pencil className="w-4 h-4 mr-2" />
                        Editar
                      </Button>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Edição Rápida */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription className="text-slate-400">
              Gerencie permissões, senhas e bloqueie o acesso de <span className="text-white font-medium">{editingUser?.email}</span>.
            </DialogDescription>
          </DialogHeader>

          {editingUser && (
            <div className="space-y-4 py-3">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 mb-1 block">Permissão no Sistema</label>
                <Select value={editForm.role} onValueChange={(val) => setEditForm(prev => ({ ...prev, role: val }))}>
                  <SelectTrigger className="w-full bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Selecione o tipo de privilégio" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    <SelectItem value="user">Usuário Padrão</SelectItem>
                    <SelectItem value="admin">Administrador (Dono)</SelectItem>
                  </SelectContent>
                </Select>
                {editForm.role === 'admin' && (
                  <p className="text-xs text-indigo-400 flex items-center mt-1"><AlertCircle className="w-3 h-3 mr-1"/>Administradores acessam as finanças de TODAS as famílias.</p>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300 mb-1 block">Status de Acesso</label>
                <Select value={editForm.disabled ? 'bloqueado' : 'ativo'} onValueChange={(val) => setEditForm(prev => ({ ...prev, disabled: val === 'bloqueado' }))}>
                  <SelectTrigger className="w-full bg-slate-800 border-slate-700 text-white">
                    <SelectValue placeholder="Selecione o status" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    <SelectItem value="ativo">Conta Ativa (Login Permitido)</SelectItem>
                    <SelectItem value="bloqueado">Bloqueada (Proibido Logar)</SelectItem>
                  </SelectContent>
                </Select>
                {editForm.disabled && (
                  <p className="text-xs text-red-400 flex items-center mt-1"><AlertCircle className="w-3 h-3 mr-1"/>O usuário não conseguirá mais entrar na plataforma.</p>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800 space-y-2">
                <label className="text-sm font-medium text-slate-300 mb-1 block">Criar Nova Senha (Opcional)</label>
                <Input
                  type="text"
                  placeholder="Digite para forçar nova senha"
                  value={editForm.newPassword}
                  onChange={(e) => setEditForm(prev => ({ ...prev, newPassword: e.target.value }))}
                  className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                />
                <p className="text-xs text-slate-500">Deixe em branco para não alterar a senha atual do cliente.</p>
              </div>
            </div>
          )}

          <DialogFooter className="mt-4 gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setEditingUser(null)} className="text-slate-400 hover:text-white">
              Cancelar
            </Button>
            <Button 
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
              onClick={handleSaveEdit}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
