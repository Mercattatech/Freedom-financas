import React, { useState } from 'react';
import { apiClient } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Plus, Trash2, Pencil, Check, X, Zap, RefreshCw, Star, Loader2,
  DollarSign, Tag, ToggleLeft, ToggleRight, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';

const TIPOS = [
  { value: 'MENSAL', label: '📅 Mensalidade' },
  { value: 'ANUAL', label: '📆 Assinatura Anual' },
  { value: 'UNICO', label: '💳 Pagamento Único' },
];

const CORES = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899'];

const emptyPlan = () => ({
  nome: '',
  descricao: '',
  tipo: 'MENSAL',
  preco: '',
  preco_original: '',
  features: '',
  destaque: false,
  badge: '',
  upsell_texto: '',
  upsell_price_id: '',
  limite_familias: 1,
  cor: '#10B981',
  ordem: 0,
  ativo: true,
});

export default function AdminPlans() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyPlan());
  const [syncingId, setSyncingId] = useState(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['plans-admin'],
    queryFn: () => apiClient.entities.Plan.list(),
  });

  const sorted = [...plans].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

  const saveMutation = useMutation({
    mutationFn: ({ data, id }) =>
      id ? apiClient.entities.Plan.update(id, data) : apiClient.entities.Plan.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans-admin'] });
      queryClient.invalidateQueries({ queryKey: ['plans-landing'] });
      toast.success(editing ? 'Plano atualizado!' : 'Plano criado!');
      cancelEdit();
    },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.entities.Plan.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans-admin'] });
      queryClient.invalidateQueries({ queryKey: ['plans-landing'] });
      toast.success('Plano removido');
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativo }) => apiClient.entities.Plan.update(id, { ativo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans-admin'] });
      queryClient.invalidateQueries({ queryKey: ['plans-landing'] });
    },
  });

  const cancelEdit = () => {
    setEditing(null);
    setForm(emptyPlan());
  };

  const startEdit = (plan) => {
    setEditing(plan.id);
    setForm({
      nome: plan.nome || '',
      descricao: plan.descricao || '',
      tipo: plan.tipo || 'MENSAL',
      preco: plan.preco || '',
      preco_original: plan.preco_original || '',
      features: plan.features || '',
      destaque: plan.destaque || false,
      badge: plan.badge || '',
      upsell_texto: plan.upsell_texto || '',
      upsell_price_id: plan.upsell_price_id || '',
      limite_familias: plan.limite_familias || 1,
      cor: plan.cor || '#10B981',
      ordem: plan.ordem || 0,
      ativo: plan.ativo !== false,
    });
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.nome || !form.preco) {
      toast.error('Nome e preço são obrigatórios');
      return;
    }
    saveMutation.mutate({
      data: {
        ...form,
        preco: parseFloat(form.preco) || 0,
        preco_original: parseFloat(form.preco_original) || null,
        ordem: parseInt(form.ordem) || 0,
        limite_familias: parseInt(form.limite_familias) || 1,
      },
      id: editing,
    });
  };

  const handleSyncStripe = async (plan) => {
    setSyncingId(plan.id);
    try {
      const res = await apiClient.functions.invoke('syncStripePlan', {
        plan_id: plan.id,
        nome: plan.nome,
        descricao: plan.descricao,
        preco: plan.preco,
        tipo: plan.tipo,
      });
      if (res.data?.success) {
        queryClient.invalidateQueries({ queryKey: ['plans-admin'] });
        toast.success('Sincronizado com Stripe! Price ID: ' + res.data.stripe_price_id);
      } else {
        toast.error(res.data?.error || 'Erro ao sincronizar');
      }
    } catch (e) {
      toast.error('Erro: ' + e.message);
    } finally {
      setSyncingId(null);
    }
  };

  const f = (v) => setForm((prev) => ({ ...prev, ...v }));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 pb-24">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Gerenciar Planos</h1>
          <p className="text-slate-500 text-sm mt-1">Configure preços, features e sincronize com o Stripe</p>
        </div>
        <Button
          className="bg-emerald-600 hover:bg-emerald-700"
          onClick={() => { cancelEdit(); setEditing('new'); }}
        >
          <Plus className="w-4 h-4 mr-2" /> Novo Plano
        </Button>
      </div>

      {/* Formulário */}
      {editing && (
        <form onSubmit={handleSave} className="bg-white border-2 border-emerald-200 rounded-2xl p-6 mb-8 shadow-lg">
          <h2 className="text-lg font-bold text-slate-800 mb-6">
            {editing === 'new' ? '✨ Novo Plano' : '✏️ Editar Plano'}
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nome */}
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Nome do Plano *</label>
              <Input placeholder="Ex: Plano Pro, Família Premium..." value={form.nome} onChange={e => f({ nome: e.target.value })} required />
            </div>

            {/* Descrição */}
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Descrição curta</label>
              <Input placeholder="Ex: Ideal para famílias que querem controle total" value={form.descricao} onChange={e => f({ descricao: e.target.value })} />
            </div>

            {/* Tipo */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Tipo de Cobrança *</label>
              <Select value={form.tipo} onValueChange={v => f({ tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Preço */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Preço (R$) *</label>
              <Input type="number" step="0.01" placeholder="Ex: 29.90" value={form.preco} onChange={e => f({ preco: e.target.value })} required />
            </div>

            {/* Preço original */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Preço Original (para tachado)</label>
              <Input type="number" step="0.01" placeholder="Ex: 49.90" value={form.preco_original} onChange={e => f({ preco_original: e.target.value })} />
            </div>

            {/* Limite famílias */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Limite de Famílias</label>
              <Input type="number" min="1" value={form.limite_familias} onChange={e => f({ limite_familias: e.target.value })} />
            </div>

            {/* Badge */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Badge do Card</label>
              <Input placeholder="Ex: Mais Popular, Melhor Valor" value={form.badge} onChange={e => f({ badge: e.target.value })} />
            </div>

            {/* Ordem */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Ordem de Exibição</label>
              <Input type="number" value={form.ordem} onChange={e => f({ ordem: e.target.value })} />
            </div>

            {/* Features */}
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Features (separadas por vírgula)</label>
              <Input
                placeholder="Ex: Dashboard completo, Controle de dívidas, Caixinhas de investimento"
                value={form.features}
                onChange={e => f({ features: e.target.value })}
              />
              <p className="text-xs text-slate-400 mt-1">Cada item separado por vírgula vira um tópico com ✓ na landing page</p>
            </div>

            {/* Upsell texto */}
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Texto de Upsell no Checkout</label>
              <Input placeholder="Ex: Adicione consultoria financeira por +R$9,90/mês" value={form.upsell_texto} onChange={e => f({ upsell_texto: e.target.value })} />
            </div>

            {/* Upsell Price ID */}
            <div className="md:col-span-2">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Stripe Price ID do Upsell</label>
              <Input placeholder="price_xxxxx (do Stripe)" value={form.upsell_price_id} onChange={e => f({ upsell_price_id: e.target.value })} />
            </div>

            {/* Cor */}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1 block">Cor do Plano</label>
              <div className="flex gap-2 mt-1">
                {CORES.map(c => (
                  <button
                    key={c}
                    type="button"
                    className={`w-8 h-8 rounded-full border-2 transition-transform ${form.cor === c ? 'border-slate-800 scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                    onClick={() => f({ cor: c })}
                  />
                ))}
              </div>
            </div>

            {/* Checkboxes */}
            <div className="flex gap-6 items-center">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.destaque} onChange={e => f({ destaque: e.target.checked })} className="w-4 h-4 accent-emerald-600" />
                <span className="text-sm font-medium text-slate-700">⭐ Plano em destaque</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.ativo} onChange={e => f({ ativo: e.target.checked })} className="w-4 h-4 accent-emerald-600" />
                <span className="text-sm font-medium text-slate-700">✓ Ativo na landing page</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <Button type="submit" disabled={saveMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 flex-1">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              {editing === 'new' ? 'Criar Plano' : 'Salvar Alterações'}
            </Button>
            <Button type="button" variant="outline" onClick={cancelEdit}>
              <X className="w-4 h-4 mr-2" /> Cancelar
            </Button>
          </div>
        </form>
      )}

      {/* Lista de planos */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">
          <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum plano criado ainda. Crie o primeiro!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map((plan) => {
            const features = plan.features ? plan.features.split(',').slice(0, 3) : [];
            const isSyncing = syncingId === plan.id;
            return (
              <div key={plan.id} className={`bg-white rounded-2xl border-2 p-5 flex flex-col md:flex-row md:items-center gap-4 transition-all ${plan.destaque ? 'border-emerald-300' : 'border-slate-200'}`}>
                {/* Cor indicator */}
                <div className="w-2 h-full min-h-[60px] rounded-full flex-shrink-0" style={{ backgroundColor: plan.cor || '#10B981' }} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-bold text-slate-900 text-lg">{plan.nome}</h3>
                    {plan.destaque && <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 text-xs">⭐ Destaque</Badge>}
                    {plan.badge && <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">{plan.badge}</Badge>}
                    <Badge variant="outline" className="text-xs">{TIPOS.find(t => t.value === plan.tipo)?.label}</Badge>
                    {plan.ativo ? (
                      <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">Ativo</Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-xs">Inativo</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-baseline gap-2 mb-2">
                    {plan.preco_original && <span className="text-slate-400 text-sm line-through">R$ {plan.preco_original}</span>}
                    <span className="text-2xl font-black text-slate-900">
                      R$ {plan.preco}
                      <span className="text-sm font-normal text-slate-400 ml-1">
                        {plan.tipo === 'MENSAL' ? '/mês' : plan.tipo === 'ANUAL' ? '/ano' : ''}
                      </span>
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 text-xs text-slate-500">
                    {features.map(f => <span key={f}>✓ {f.trim()}</span>)}
                    {plan.features && plan.features.split(',').length > 3 && (
                      <span className="text-slate-400">+{plan.features.split(',').length - 3} mais</span>
                    )}
                  </div>
                  {plan.stripe_price_id ? (
                    <p className="text-xs text-emerald-600 mt-1 font-mono">✓ Stripe: {plan.stripe_price_id}</p>
                  ) : (
                    <p className="text-xs text-amber-600 mt-1">⚠ Não sincronizado com Stripe</p>
                  )}
                </div>

                {/* Ações */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSyncStripe(plan)}
                    disabled={isSyncing}
                    title="Sincronizar preço com Stripe"
                    className="text-xs"
                  >
                    {isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span className="ml-1 hidden sm:inline">Sync Stripe</span>
                  </Button>

                  <button
                    onClick={() => toggleMutation.mutate({ id: plan.id, ativo: !plan.ativo })}
                    className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
                    title={plan.ativo ? 'Desativar' : 'Ativar'}
                  >
                    {plan.ativo ? (
                      <ToggleRight className="w-5 h-5 text-emerald-600" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-slate-400" />
                    )}
                  </button>

                  <button
                    onClick={() => startEdit(plan)}
                    className="p-2 rounded-lg hover:bg-slate-100 transition-colors text-slate-500"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => { if (confirm(`Excluir o plano "${plan.nome}"?`)) deleteMutation.mutate(plan.id); }}
                    className="p-2 rounded-lg hover:bg-red-50 transition-colors text-slate-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Instruções */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-2xl p-5 text-sm text-blue-800">
        <h4 className="font-bold mb-2 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Como configurar os planos:</h4>
        <ol className="list-decimal list-inside space-y-1 text-blue-700">
          <li>Crie o plano com nome, preço e features</li>
          <li>Clique em <strong>"Sync Stripe"</strong> para criar o produto e price no Stripe automaticamente</li>
          <li>O Stripe Price ID será salvo automaticamente no plano</li>
          <li>O plano aparecerá na <strong>Landing Page</strong> se estiver ativo</li>
          <li>Para upsell, crie um price manual no Stripe e cole o ID no campo "Stripe Price ID do Upsell"</li>
        </ol>
        <a
          href="https://dashboard.stripe.com/test/products"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-3 text-blue-600 hover:underline font-medium"
        >
          Abrir painel do Stripe <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}