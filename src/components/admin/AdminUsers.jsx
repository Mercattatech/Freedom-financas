import React, { useState } from 'react';
import { apiClient } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Trash2, Pencil, Check, X, Loader2, Users, Search,
  UserCheck, UserX, Clock, ExternalLink, Mail, AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  ATIVO: { label: 'Ativo', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  TRIAL: { label: 'Trial', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  SUSPENSO: { label: 'Suspenso', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  CANCELADO: { label: 'Cancelado', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

const ORIGEM_CONFIG = {
  STRIPE: { label: 'Stripe', icon: '💳' },
  MANUAL: { label: 'Manual', icon: '✋' },
  TRIAL: { label: 'Trial', icon: '⏱' },
  CORTESIA: { label: 'Cortesia', icon: '🎁' },
};

const emptyForm = () => ({
  user_email: '', user_name: '', plan_id: '', plan_nome: '',
  status: 'ATIVO', data_inicio: new Date().toISOString().split('T')[0],
  data_expiracao: '', limite_familias: 1, observacoes: '', origem: 'MANUAL',
  stripe_subscription_id: '', stripe_customer_id: '',
});

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const { data: accesses = [], isLoading } = useQuery({
    queryKey: ['user-accesses'],
    queryFn: () => apiClient.entities.UserAccess.list('-created_date', 200),
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['plans-admin'],
    queryFn: () => apiClient.entities.Plan.list(),
  });

  const { data: appUsers = [] } = useQuery({
    queryKey: ['app-users'],
    queryFn: () => apiClient.entities.User.list(),
  });

  const saveMutation = useMutation({
    mutationFn: ({ data, id }) => (id && id !== 'new') ? apiClient.entities.UserAccess.update(id, data) : apiClient.entities.UserAccess.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-accesses'] });
      toast.success(editing ? 'Acesso atualizado!' : 'Acesso criado!');
      cancelEdit();
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.entities.UserAccess.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['user-accesses'] }); toast.success('Acesso removido'); },
  });

  const cancelEdit = () => { setEditing(null); setForm(emptyForm()); };
  const startEdit = (a) => {
    setEditing(a.id);
    setForm({
      user_email: a.user_email || '', user_name: a.user_name || '',
      plan_id: a.plan_id || '', plan_nome: a.plan_nome || '',
      status: a.status || 'ATIVO', data_inicio: a.data_inicio || '',
      data_expiracao: a.data_expiracao || '', limite_familias: a.limite_familias || 1,
      observacoes: a.observacoes || '', origem: a.origem || 'MANUAL',
      stripe_subscription_id: a.stripe_subscription_id || '',
      stripe_customer_id: a.stripe_customer_id || '',
    });
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.user_email) { toast.error('Email é obrigatório'); return; }
    const planSel = plans.find(p => p.id === form.plan_id);
    saveMutation.mutate({
      data: {
        ...form,
        plan_nome: planSel?.nome || form.plan_nome,
        limite_familias: parseInt(form.limite_familias) || 1,
      },
      id: editing,
    });
  };

  const f = (v) => setForm(prev => ({ ...prev, ...v }));

  const filtered = accesses.filter(a => {
    const matchSearch = !search || a.user_email?.toLowerCase().includes(search.toLowerCase()) || a.user_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // Stats
  const stats = {
    total: accesses.length,
    ativos: accesses.filter(a => a.status === 'ATIVO').length,
    trial: accesses.filter(a => a.status === 'TRIAL').length,
    suspensos: accesses.filter(a => a.status === 'SUSPENSO' || a.status === 'CANCELADO').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">Usuários & Acessos</h2>
          <p className="text-slate-400 text-sm mt-1">Gerencie quem tem acesso ao sistema e qual plano cada um possui</p>
        </div>
        <Button
          className="bg-emerald-600 hover:bg-emerald-500 text-white"
          onClick={() => { cancelEdit(); setEditing('new'); }}
        >
          <Plus className="w-4 h-4 mr-2" /> Conceder Acesso
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: Users, color: 'text-slate-300' },
          { label: 'Ativos', value: stats.ativos, icon: UserCheck, color: 'text-emerald-400' },
          { label: 'Trial', value: stats.trial, icon: Clock, color: 'text-blue-400' },
          { label: 'Inativos', value: stats.suspensos, icon: UserX, color: 'text-red-400' },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${s.color}`} />
                <span className="text-slate-400 text-xs font-medium">{s.label}</span>
              </div>
              <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
            </div>
          );
        })}
      </div>

      {/* Formulário */}
      {editing && (
        <form onSubmit={handleSave} className="bg-slate-900 border border-emerald-500/40 rounded-2xl p-6 shadow-xl shadow-emerald-500/5">
          <h3 className="text-lg font-bold text-white mb-5">
            {editing === 'new' ? '✨ Conceder novo acesso' : '✏️ Editar acesso'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Email do Usuário *</label>
              <Input
                placeholder="email@exemplo.com"
                value={form.user_email}
                onChange={e => f({ user_email: e.target.value })}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
                required
              />
              {appUsers.length > 0 && (
                <p className="text-xs text-slate-500 mt-1">
                  Usuários cadastrados: {appUsers.map(u => u.email).join(', ')}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Nome</label>
              <Input placeholder="Nome completo" value={form.user_name} onChange={e => f({ user_name: e.target.value })} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500" />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Plano</label>
              <Select value={form.plan_id} onValueChange={v => f({ plan_id: v })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                  <SelectValue placeholder="Selecione um plano..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Sem plano específico</SelectItem>
                  {plans.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nome} — R$ {p.preco}/{p.tipo === 'MENSAL' ? 'mês' : p.tipo === 'ANUAL' ? 'ano' : 'único'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Status</label>
              <Select value={form.status} onValueChange={v => f({ status: v })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ATIVO">✅ Ativo</SelectItem>
                  <SelectItem value="TRIAL">⏱ Trial</SelectItem>
                  <SelectItem value="SUSPENSO">⚠️ Suspenso</SelectItem>
                  <SelectItem value="CANCELADO">❌ Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Origem do Acesso</label>
              <Select value={form.origem} onValueChange={v => f({ origem: v })}>
                <SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="MANUAL">✋ Manual (admin)</SelectItem>
                  <SelectItem value="STRIPE">💳 Stripe (pagamento)</SelectItem>
                  <SelectItem value="TRIAL">⏱ Trial gratuito</SelectItem>
                  <SelectItem value="CORTESIA">🎁 Cortesia</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Limite de Famílias</label>
              <Input type="number" min="1" value={form.limite_familias} onChange={e => f({ limite_familias: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Data de Início</label>
              <Input type="date" value={form.data_inicio} onChange={e => f({ data_inicio: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Data de Expiração (vazio = sem expiração)</label>
              <Input type="date" value={form.data_expiracao} onChange={e => f({ data_expiracao: e.target.value })} className="bg-slate-800 border-slate-700 text-white" />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Stripe Subscription ID</label>
              <Input placeholder="sub_xxxxx" value={form.stripe_subscription_id} onChange={e => f({ stripe_subscription_id: e.target.value })} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 font-mono text-sm" />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Stripe Customer ID</label>
              <Input placeholder="cus_xxxxx" value={form.stripe_customer_id} onChange={e => f({ stripe_customer_id: e.target.value })} className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-600 font-mono text-sm" />
            </div>

            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Observações internas</label>
              <textarea
                value={form.observacoes}
                onChange={e => f({ observacoes: e.target.value })}
                placeholder="Notas sobre este usuário..."
                rows={2}
                className="w-full rounded-lg border border-slate-700 bg-slate-800 text-white placeholder:text-slate-500 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-5">
            <Button type="submit" disabled={saveMutation.isPending} className="bg-emerald-600 hover:bg-emerald-500 flex-1">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              {editing === 'new' ? 'Conceder Acesso' : 'Salvar'}
            </Button>
            <Button type="button" variant="outline" onClick={cancelEdit} className="border-slate-700 text-slate-300 hover:bg-slate-800">
              <X className="w-4 h-4 mr-2" /> Cancelar
            </Button>
          </div>
        </form>
      )}

      {/* Filtros */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Buscar por email ou nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-800 text-white placeholder:text-slate-500"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-44 bg-slate-900 border-slate-800 text-white">
            <SelectValue placeholder="Todos os status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>Todos</SelectItem>
            <SelectItem value="ATIVO">Ativos</SelectItem>
            <SelectItem value="TRIAL">Trial</SelectItem>
            <SelectItem value="SUSPENSO">Suspensos</SelectItem>
            <SelectItem value="CANCELADO">Cancelados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-slate-900 rounded-2xl border border-dashed border-slate-800">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{accesses.length === 0 ? 'Nenhum acesso concedido ainda.' : 'Nenhum resultado para este filtro.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(a => {
            const statusCfg = STATUS_CONFIG[a.status] || STATUS_CONFIG.ATIVO;
            const origemCfg = ORIGEM_CONFIG[a.origem] || ORIGEM_CONFIG.MANUAL;
            const plan = plans.find(p => p.id === a.plan_id);
            const isExpired = a.data_expiracao && new Date(a.data_expiracao) < new Date();

            return (
              <div key={a.id} className={`bg-slate-900 border rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4 transition-all ${isExpired ? 'border-red-500/30' : 'border-slate-800 hover:border-slate-700'}`}>
                {/* Avatar */}
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center font-bold text-white flex-shrink-0">
                  {(a.user_name || a.user_email || '?').charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-bold text-white">{a.user_name || a.user_email}</span>
                    <Badge className={`text-xs border ${statusCfg.color}`}>{statusCfg.label}</Badge>
                    {isExpired && <Badge className="text-xs bg-red-500/20 text-red-300 border-red-500/30">⚠ Expirado</Badge>}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {a.user_email}</span>
                    {plan && <span className="flex items-center gap-1 text-emerald-400">💎 {plan.nome}</span>}
                    <span>{origemCfg.icon} {origemCfg.label}</span>
                    <span>👨‍👩‍👧 {a.limite_familias || 1} família{(a.limite_familias || 1) > 1 ? 's' : ''}</span>
                    {a.data_inicio && <span>📅 Desde {a.data_inicio}</span>}
                    {a.data_expiracao && <span className={isExpired ? 'text-red-400' : ''}>⏰ Até {a.data_expiracao}</span>}
                  </div>
                  {a.observacoes && <p className="text-xs text-slate-500 mt-1 italic">"{a.observacoes}"</p>}
                  {a.stripe_subscription_id && (
                    <p className="text-xs text-slate-600 mt-1 font-mono">{a.stripe_subscription_id}</p>
                  )}
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {a.stripe_customer_id && (
                    <a
                      href={`https://dashboard.stripe.com/customers/${a.stripe_customer_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-blue-400 transition-colors"
                      title="Ver no Stripe"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  {appUsers.find(u => u.email === a.user_email) && (
                    <button
                      onClick={() => {
                         const u = appUsers.find(x => x.email === a.user_email);
                         if (confirm(`Deseja alterar as permissões de ${a.user_email}?`)) {
                             apiClient.entities.User.update(u.id, { role: u.role === 'admin' ? 'user' : 'admin' })
                              .then(() => { toast.success('Permissão alterada!'); queryClient.invalidateQueries({ queryKey: ['app-users'] }); })
                              .catch(err => toast.error(err.message));
                         }
                      }}
                      className={`p-2 rounded-lg transition-colors ${appUsers.find(u => u.email === a.user_email).role === 'admin' ? 'bg-indigo-500/20 text-indigo-400 hover:bg-red-500/20 hover:text-red-400' : 'text-slate-500 hover:bg-indigo-500/20 hover:text-indigo-400'}`}
                      title={appUsers.find(u => u.email === a.user_email).role === 'admin' ? 'Revogar acesso Admin' : 'Conceder acesso Admin (Dono)'}
                    >
                      <AlertCircle className="w-4 h-4" />
                    </button>
                  )}
                  <button onClick={() => startEdit(a)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-white transition-colors" title="Editar informações do acesso">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { if (confirm(`Remover acesso de ${a.user_email}?`)) deleteMutation.mutate(a.id); }}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-slate-600 hover:text-red-400 transition-colors"
                    title="Excluir Painel de Acesso"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info box */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-sm text-slate-400">
        <h4 className="font-bold text-slate-300 mb-2 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-blue-400" /> Como funciona o controle de acesso</h4>
        <ul className="space-y-1 text-slate-500 text-xs list-disc list-inside">
          <li>Cada linha representa um usuário com acesso ao sistema</li>
          <li>Você pode conceder acesso manual (cortesia) sem precisar de pagamento</li>
          <li>Acessos via Stripe são criados automaticamente após pagamento confirmado</li>
          <li>Defina o limite de famílias conforme o plano contratado</li>
          <li>Acessos expirados são marcados automaticamente em vermelho</li>
        </ul>
      </div>
    </div>
  );
}