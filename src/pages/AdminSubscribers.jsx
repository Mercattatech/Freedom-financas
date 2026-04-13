import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { apiClient } from '@/api/apiClient';
import {
  Users, TrendingUp, DollarSign, AlertTriangle, XCircle, CheckCircle,
  Search, MoreVertical, Lock, Unlock, Ban, CreditCard, FileText, RefreshCw,
  Loader2, Eye, ChevronLeft, ChevronRight, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const fmtDate = (d) => d ? format(new Date(d), 'dd/MM/yyyy', { locale: ptBR }) : '—';

const STATUS_CONFIG = {
  active:    { label: 'Ativo',      color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle },
  trialing:  { label: 'Trial',      color: 'bg-blue-100 text-blue-700',       icon: RefreshCw },
  past_due:  { label: 'Inadimplente', color: 'bg-amber-100 text-amber-700',   icon: AlertTriangle },
  blocked:   { label: 'Bloqueado',  color: 'bg-red-100 text-red-700',         icon: Lock },
  canceled:  { label: 'Cancelado',  color: 'bg-slate-100 text-slate-600',     icon: XCircle },
  canceling: { label: 'Cancelando', color: 'bg-orange-100 text-orange-700',   icon: XCircle },
  inactive:  { label: 'Inativo',    color: 'bg-slate-100 text-slate-500',     icon: XCircle }
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.inactive;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className="w-3 h-3" />{cfg.label}
    </span>
  );
}

async function adminFetch(path, opts = {}) {
  const token = localStorage.getItem('access_token');
  const res = await fetch(`/api/admin${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers }
  });
  return res.json();
}

export default function AdminSubscribers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [invoicesOpen, setInvoicesOpen] = useState(false);
  const [plansModalOpen, setPlansModalOpen] = useState(false);

  // Stats
  const { data: stats } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminFetch('/stats')
  });

  // Subscribers
  const { data: subsData, isLoading } = useQuery({
    queryKey: ['admin-subscribers', search, statusFilter, page],
    queryFn: () => adminFetch(`/subscribers?search=${search}&status=${statusFilter}&page=${page}&limit=15`),
    keepPreviousData: true
  });

  // Invoices
  const { data: invoicesData, isLoading: loadingInvoices } = useQuery({
    queryKey: ['admin-invoices', selectedUser?.id],
    queryFn: () => adminFetch(`/subscribers/${selectedUser.id}/invoices`),
    enabled: !!selectedUser && invoicesOpen
  });

  // Plans
  const { data: plansData } = useQuery({
    queryKey: ['admin-plans'],
    queryFn: () => adminFetch('/plans')
  });

  const blockMutation = useMutation({
    mutationFn: (id) => adminFetch(`/subscribers/${id}/block`, { method: 'POST', body: JSON.stringify({ reason: 'Manual pelo admin' }) }),
    onSuccess: (_, id) => { toast.success('Usuário bloqueado'); qc.invalidateQueries(['admin-subscribers']); qc.invalidateQueries(['admin-stats']); }
  });

  const unblockMutation = useMutation({
    mutationFn: (id) => adminFetch(`/subscribers/${id}/unblock`, { method: 'POST' }),
    onSuccess: () => { toast.success('Usuário desbloqueado'); qc.invalidateQueries(['admin-subscribers']); qc.invalidateQueries(['admin-stats']); }
  });

  const cancelMutation = useMutation({
    mutationFn: (id) => adminFetch(`/subscribers/${id}/cancel`, { method: 'POST' }),
    onSuccess: () => { toast.success('Assinatura cancelada'); qc.invalidateQueries(['admin-subscribers']); }
  });

  const changePlanMutation = useMutation({
    mutationFn: ({ id, plan_id }) => adminFetch(`/subscribers/${id}/change-plan`, { method: 'POST', body: JSON.stringify({ plan_id }) }),
    onSuccess: () => { toast.success('Plano alterado com sucesso'); qc.invalidateQueries(['admin-subscribers']); setPlansModalOpen(false); }
  });

  const subscribers = subsData?.data || [];
  const total = subsData?.total || 0;
  const totalPages = Math.ceil(total / 15);

  const statCards = [
    { label: 'Total Usuários', value: stats?.totalUsers || 0, icon: Users, color: 'text-slate-600', bg: 'bg-slate-50' },
    { label: 'Ativos', value: stats?.activeUsers || 0, icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Trial', value: stats?.trialingUsers || 0, icon: RefreshCw, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Inadimplentes', value: stats?.pastDueUsers || 0, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Bloqueados', value: stats?.blockedUsers || 0, icon: Lock, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'MRR', value: fmt(stats?.mrr), icon: DollarSign, color: 'text-violet-600', bg: 'bg-violet-50', isText: true }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 bg-violet-100 rounded-xl">
              <Shield className="w-5 h-5 text-violet-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Admin — Assinantes</h1>
          </div>
          <p className="text-slate-500 text-sm">Gerencie todos os clientes do Freedom</p>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
          {statCards.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label} className="p-4 border-0 shadow-sm">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${s.bg}`}>
                  <Icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <p className={`text-xl font-bold text-slate-900 ${s.isText ? 'text-base' : ''}`}>{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </Card>
            );
          })}
        </motion.div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Buscar por nome ou email..."
              className="pl-9"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {['all', 'active', 'trialing', 'past_due', 'blocked', 'canceled'].map(s => (
              <Button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(1); }}
                variant={statusFilter === s ? 'default' : 'outline'}
                size="sm"
                className={statusFilter === s ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
              >
                {STATUS_CONFIG[s]?.label || 'Todos'}
              </Button>
            ))}
          </div>
        </div>

        {/* Table */}
        <Card className="border-0 shadow-sm overflow-hidden mb-4">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  {['Usuário', 'Status', 'Plano', 'Vencimento', 'Trial até', 'Cadastro', 'Ações'].map(col => (
                    <th key={col} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide px-4 py-3">{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  <tr><td colSpan={7} className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin text-emerald-600 mx-auto" /></td></tr>
                ) : subscribers.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-slate-400">Nenhum assinante encontrado</td></tr>
                ) : subscribers.map(user => (
                  <tr key={user.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-slate-800 text-sm">{user.full_name || '—'}</p>
                        <p className="text-xs text-slate-500">{user.email}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={user.subscription_status || 'inactive'} />
                      {user.delinquent_since && (
                        <p className="text-xs text-red-500 mt-0.5">Desde {fmtDate(user.delinquent_since)}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">{user.plan?.nome || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{fmtDate(user.current_period_end)}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{fmtDate(user.trial_ends_at)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{fmtDate(user.created_date)}</td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem onClick={() => { setSelectedUser(user); setInvoicesOpen(true); }}>
                            <FileText className="w-4 h-4 mr-2" /> Ver Faturas
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSelectedUser(user); setPlansModalOpen(true); }}>
                            <CreditCard className="w-4 h-4 mr-2" /> Mudar Plano
                          </DropdownMenuItem>
                          {user.subscription_status === 'blocked' ? (
                            <DropdownMenuItem onClick={() => unblockMutation.mutate(user.id)}>
                              <Unlock className="w-4 h-4 mr-2 text-emerald-600" /> Desbloquear
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => blockMutation.mutate(user.id)} className="text-red-600">
                              <Lock className="w-4 h-4 mr-2" /> Bloquear
                            </DropdownMenuItem>
                          )}
                          {user.stripe_subscription_id && (
                            <DropdownMenuItem
                              onClick={() => { if (confirm(`Cancelar assinatura de ${user.email}?`)) cancelMutation.mutate(user.id); }}
                              className="text-red-600"
                            >
                              <Ban className="w-4 h-4 mr-2" /> Cancelar Assinatura
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Pagination */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">{total} assinantes encontrados</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <span className="text-sm text-slate-600 px-3 py-1">Pág {page}/{totalPages || 1}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Modal: Faturas */}
      <Dialog open={invoicesOpen} onOpenChange={setInvoicesOpen}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Faturas — {selectedUser?.full_name || selectedUser?.email}</DialogTitle>
          </DialogHeader>
          {loadingInvoices ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div>
          ) : (invoicesData?.data || []).length === 0 ? (
            <p className="text-center text-slate-400 py-8">Nenhuma fatura encontrada</p>
          ) : (
            <div className="space-y-3">
              {(invoicesData?.data || []).map(inv => (
                <div key={inv.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl">
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">{fmt(inv.amount)}</p>
                    <p className="text-xs text-slate-500">{fmtDate(inv.date)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={inv.paid ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}>
                      {inv.paid ? 'Pago' : inv.status}
                    </Badge>
                    {inv.pdf_url && (
                      <a href={inv.pdf_url} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline" className="h-7 text-xs">PDF</Button>
                      </a>
                    )}
                    {inv.hosted_url && (
                      <a href={inv.hosted_url} target="_blank" rel="noreferrer">
                        <Button size="sm" variant="outline" className="h-7 text-xs">Ver</Button>
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal: Mudar Plano */}
      <Dialog open={plansModalOpen} onOpenChange={setPlansModalOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mudar Plano — {selectedUser?.full_name || selectedUser?.email}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            {(plansData?.data || []).map(p => (
              <Button
                key={p.id}
                variant={selectedUser?.plan_id === p.id ? 'default' : 'outline'}
                className={`w-full justify-between ${selectedUser?.plan_id === p.id ? 'bg-emerald-600' : ''}`}
                disabled={changePlanMutation.isPending}
                onClick={() => changePlanMutation.mutate({ id: selectedUser.id, plan_id: p.id })}
              >
                <span>{p.nome}</span>
                <span className="text-xs opacity-70">{fmt(p.preco_mensal || p.preco)}/mês</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
