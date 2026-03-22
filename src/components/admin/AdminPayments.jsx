import React, { useState } from 'react';
import { apiClient } from '@/api/apiClient';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Search, CreditCard, TrendingUp, Users, ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STATUS_CONFIG = {
  ATIVO: { label: 'Ativo', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  TRIAL: { label: 'Trial', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  SUSPENSO: { label: 'Suspenso', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  CANCELADO: { label: 'Cancelado', color: 'bg-red-500/20 text-red-300 border-red-500/30' },
};

const ORIGEM_LABEL = { STRIPE: '💳 Stripe', MANUAL: '✋ Manual', TRIAL: '⏱ Trial', CORTESIA: '🎁 Cortesia' };

export default function AdminPayments() {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterOrigem, setFilterOrigem] = useState('');

  const { data: accesses = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['user-accesses-payments'],
    queryFn: () => apiClient.entities.UserAccess.list('-created_date', 500),
  });

  const { data: plans = [] } = useQuery({
    queryKey: ['plans-admin'],
    queryFn: () => apiClient.entities.Plan.list(),
  });

  const filtered = accesses.filter(a => {
    const matchSearch = !search || a.user_email?.toLowerCase().includes(search.toLowerCase()) || a.user_name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || a.status === filterStatus;
    const matchOrigem = !filterOrigem || a.origem === filterOrigem;
    return matchSearch && matchStatus && matchOrigem;
  });

  // Stats financeiras
  const stripeAccesses = accesses.filter(a => a.origem === 'STRIPE');
  const ativos = accesses.filter(a => a.status === 'ATIVO');
  const cancelados = accesses.filter(a => a.status === 'CANCELADO');

  // MRR estimado
  const mrr = stripeAccesses
    .filter(a => a.status === 'ATIVO' && a.plan_id)
    .reduce((sum, a) => {
      const plan = plans.find(p => p.id === a.plan_id);
      if (!plan) return sum;
      if (plan.tipo === 'MENSAL') return sum + (plan.preco || 0);
      if (plan.tipo === 'ANUAL') return sum + (plan.preco || 0) / 12;
      return sum;
    }, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">Pagamentos & Assinantes</h2>
          <p className="text-slate-400 text-sm mt-1">Todos os usuários com acesso ao sistema, incluindo pagamentos via Stripe</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="border-slate-700 text-slate-300 hover:bg-slate-800"
        >
          {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          <span className="ml-2">Atualizar</span>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1"><Users className="w-4 h-4 text-slate-400" /><span className="text-slate-400 text-xs">Total Assinantes</span></div>
          <p className="text-3xl font-black text-white">{accesses.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1"><CreditCard className="w-4 h-4 text-emerald-400" /><span className="text-slate-400 text-xs">Pagantes Stripe</span></div>
          <p className="text-3xl font-black text-emerald-400">{stripeAccesses.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1"><TrendingUp className="w-4 h-4 text-blue-400" /><span className="text-slate-400 text-xs">MRR Estimado</span></div>
          <p className="text-2xl font-black text-blue-400">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(mrr)}
          </p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1"><span className="text-red-400 text-xs">❌</span><span className="text-slate-400 text-xs">Cancelados</span></div>
          <p className="text-3xl font-black text-red-400">{cancelados.length}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            placeholder="Buscar por email ou nome..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 bg-slate-900 border-slate-800 text-white placeholder:text-slate-500"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 bg-slate-900 border-slate-800 text-white">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>Todos</SelectItem>
            <SelectItem value="ATIVO">Ativos</SelectItem>
            <SelectItem value="TRIAL">Trial</SelectItem>
            <SelectItem value="SUSPENSO">Suspensos</SelectItem>
            <SelectItem value="CANCELADO">Cancelados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterOrigem} onValueChange={setFilterOrigem}>
          <SelectTrigger className="w-44 bg-slate-900 border-slate-800 text-white">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>Todas as origens</SelectItem>
            <SelectItem value="STRIPE">💳 Stripe</SelectItem>
            <SelectItem value="MANUAL">✋ Manual</SelectItem>
            <SelectItem value="TRIAL">⏱ Trial</SelectItem>
            <SelectItem value="CORTESIA">🎁 Cortesia</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-slate-900 rounded-2xl border border-dashed border-slate-800">
          <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>{accesses.length === 0 ? 'Nenhum pagamento registrado ainda.' : 'Nenhum resultado para este filtro.'}</p>
          {accesses.length === 0 && <p className="text-xs mt-2 text-slate-600">Os pagamentos aparecem aqui automaticamente após um checkout via Stripe.</p>}
        </div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-500 uppercase tracking-wide">
                <th className="text-left p-4">Usuário</th>
                <th className="text-left p-4">Plano</th>
                <th className="text-left p-4">Status</th>
                <th className="text-left p-4">Origem</th>
                <th className="text-left p-4">Início</th>
                <th className="text-left p-4">Expiração</th>
                <th className="text-left p-4">Famílias</th>
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {filtered.map(a => {
                const statusCfg = STATUS_CONFIG[a.status] || STATUS_CONFIG.ATIVO;
                const isExpired = a.data_expiracao && new Date(a.data_expiracao) < new Date();
                const plan = plans.find(p => p.id === a.plan_id);

                return (
                  <tr key={a.id} className={`hover:bg-slate-800/50 transition-colors ${isExpired ? 'opacity-60' : ''}`}>
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center font-bold text-white text-xs flex-shrink-0">
                          {(a.user_name || a.user_email || '?').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-white text-sm">{a.user_name || '—'}</p>
                          <p className="text-slate-400 text-xs">{a.user_email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      {plan ? (
                        <div>
                          <p className="text-white text-sm font-medium">{plan.nome}</p>
                          <p className="text-slate-500 text-xs">
                            R$ {plan.preco}/{plan.tipo === 'MENSAL' ? 'mês' : plan.tipo === 'ANUAL' ? 'ano' : 'único'}
                          </p>
                        </div>
                      ) : (
                        <span className="text-slate-500">{a.plan_nome || '—'}</span>
                      )}
                    </td>
                    <td className="p-4">
                      <Badge className={`text-xs border ${statusCfg.color}`}>{statusCfg.label}</Badge>
                      {isExpired && <p className="text-red-400 text-xs mt-1">Expirado</p>}
                    </td>
                    <td className="p-4 text-slate-400 text-xs">{ORIGEM_LABEL[a.origem] || a.origem}</td>
                    <td className="p-4 text-slate-400 text-xs">{a.data_inicio || '—'}</td>
                    <td className="p-4 text-xs">
                      {a.data_expiracao ? (
                        <span className={isExpired ? 'text-red-400' : 'text-slate-400'}>{a.data_expiracao}</span>
                      ) : (
                        <span className="text-emerald-600 text-xs">Vitalício</span>
                      )}
                    </td>
                    <td className="p-4 text-slate-300 text-center">{a.limite_familias || 1}</td>
                    <td className="p-4">
                      {a.stripe_customer_id && (
                        <a
                          href={`https://dashboard.stripe.com/customers/${a.stripe_customer_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-blue-400 transition-colors inline-flex"
                          title="Ver no Stripe"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="p-3 border-t border-slate-800 text-xs text-slate-600 text-right">
            {filtered.length} de {accesses.length} registros
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4 text-xs text-blue-300">
        <p className="font-semibold mb-1">📡 Webhook Stripe ativo</p>
        <p className="text-blue-400/70">Pagamentos via Stripe criam automaticamente o acesso nesta lista. Eventos monitorados: checkout.session.completed, subscription.updated, subscription.deleted, payment_failed.</p>
      </div>
    </div>
  );
}