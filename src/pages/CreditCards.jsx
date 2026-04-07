import React, { useState } from 'react';
import { apiClient } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFinancialMonth } from '@/components/hooks/useFinancialMonth';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, Pencil, CreditCard as CreditCardIcon, Check, X, ChevronLeft, ChevronRight, Receipt, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const BANDEIRAS = [
  { value: 'VISA', label: 'Visa', color: '#1A1F71' },
  { value: 'MASTERCARD', label: 'Mastercard', color: '#EB001B' },
  { value: 'ELO', label: 'Elo', color: '#00A4E0' },
  { value: 'AMEX', label: 'American Express', color: '#006FCF' },
  { value: 'HIPERCARD', label: 'Hipercard', color: '#822124' },
  { value: 'OUTRO', label: 'Outro', color: '#6B7280' }
];

const CARD_COLORS = [
  '#6366F1', '#8B5CF6', '#EC4899', '#EF4444', '#F97316',
  '#EAB308', '#22C55E', '#14B8A6', '#06B6D4', '#3B82F6',
  '#1E293B', '#374151', '#0F172A', '#7C3AED', '#DB2777'
];

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

const emptyForm = () => ({
  nome: '', bandeira: 'VISA', ultimos_digitos: '', limite: '',
  dia_fechamento: '1', dia_vencimento: '10', cor: '#6366F1'
});

export default function CreditCards() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [selectedCardId, setSelectedCardId] = useState(null);
  const [statementDate, setStatementDate] = useState(new Date());

  const competencia = format(statementDate, 'yyyy-MM');

  // ── User & Family ──
  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => apiClient.auth.me() });
  const { data: families = [] } = useQuery({
    queryKey: ['families', user?.email],
    queryFn: () => apiClient.entities.Family.filter({ created_by: user.email }),
    enabled: !!user
  });
  const selectedFamilyId = localStorage.getItem('selectedFamilyId');
  const family = selectedFamilyId ? families.find(f => f.id === selectedFamilyId) : families[0];

  // ── Month ──
  const { month } = useFinancialMonth(family?.id, competencia);

  // ── Cards ──
  const { data: cards = [], isLoading } = useQuery({
    queryKey: ['creditcards', family?.id],
    queryFn: () => apiClient.entities.CreditCard.filter({ family_id: family.id, ativo: true }),
    enabled: !!family
  });

  // ── Categories (for statement) ──
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', family?.id],
    queryFn: () => apiClient.entities.Category.filter({ family_id: family.id }),
    enabled: !!family
  });

  // ── Expenses for selected card ──
  const { data: cardExpenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ['expenses', month?.id, 'card', selectedCardId],
    queryFn: () => apiClient.entities.Expense.filter({ month_id: month.id, credit_card_id: selectedCardId }),
    enabled: !!month?.id && !!selectedCardId
  });

  // ── Mutations ──
  const saveMutation = useMutation({
    mutationFn: ({ data, id }) => id
      ? apiClient.entities.CreditCard.update(id, data)
      : apiClient.entities.CreditCard.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditcards'] });
      toast.success(editing ? 'Cartão atualizado!' : 'Cartão cadastrado!');
      cancelForm();
    },
    onError: (e) => toast.error('Erro: ' + e.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.entities.CreditCard.update(id, { ativo: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['creditcards'] });
      toast.success('Cartão removido');
      if (selectedCardId) setSelectedCardId(null);
    }
  });

  // ── Handlers ──
  const cancelForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm()); };
  const startEdit = (card) => {
    setEditing(card);
    setForm({
      nome: card.nome, bandeira: card.bandeira || 'VISA',
      ultimos_digitos: card.ultimos_digitos || '', limite: String(card.limite || ''),
      dia_fechamento: String(card.dia_fechamento || 1), dia_vencimento: String(card.dia_vencimento || 10),
      cor: card.cor || '#6366F1'
    });
    setShowForm(true);
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!family?.id) { toast.error('Família não carregada'); return; }
    const data = {
      nome: form.nome, bandeira: form.bandeira,
      ultimos_digitos: form.ultimos_digitos || null,
      limite: parseFloat(form.limite) || 0,
      dia_fechamento: parseInt(form.dia_fechamento) || 1,
      dia_vencimento: parseInt(form.dia_vencimento) || 10,
      cor: form.cor, ativo: true, family_id: family.id
    };
    saveMutation.mutate({ data, id: editing?.id });
  };

  const changeStatementMonth = (delta) => {
    const d = new Date(statementDate);
    d.setMonth(d.getMonth() + delta);
    setStatementDate(d);
  };

  const selectedCard = cards.find(c => c.id === selectedCardId);
  const totalCardExpenses = cardExpenses.reduce((s, e) => s + (e.valor || 0), 0);
  const limiteUsado = selectedCard?.limite ? (totalCardExpenses / selectedCard.limite) * 100 : 0;

  // ── Render ──
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">💳 Cartões de Crédito</h1>
        <p className="text-slate-500 text-sm mt-1">Gerencie seus cartões e acompanhe seus gastos</p>
      </div>

      {/* ── FORM ── */}
      {showForm ? (
        <form onSubmit={handleSave} className="bg-white border border-slate-200 rounded-2xl p-5 mb-6 shadow-sm space-y-4">
          <h3 className="font-semibold text-slate-700 text-lg">{editing ? 'Editar Cartão' : 'Novo Cartão'}</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input placeholder="Nome do cartão *" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
            <Select value={form.bandeira} onValueChange={v => setForm(f => ({ ...f, bandeira: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BANDEIRAS.map(b => (
                  <SelectItem key={b.value} value={b.value}>
                    <span className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: b.color }} />
                      {b.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Input placeholder="4 últimos dígitos" maxLength={4} value={form.ultimos_digitos}
              onChange={e => setForm(f => ({ ...f, ultimos_digitos: e.target.value.replace(/\D/g, '').slice(0, 4) }))} />
            <Input type="number" step="0.01" placeholder="Limite R$" value={form.limite}
              onChange={e => setForm(f => ({ ...f, limite: e.target.value }))} />
            <Input type="number" min="1" max="31" placeholder="Dia fech." value={form.dia_fechamento}
              onChange={e => setForm(f => ({ ...f, dia_fechamento: e.target.value }))} />
            <Input type="number" min="1" max="31" placeholder="Dia venc." value={form.dia_vencimento}
              onChange={e => setForm(f => ({ ...f, dia_vencimento: e.target.value }))} />
          </div>

          {/* Color picker */}
          <div>
            <p className="text-xs text-slate-500 mb-2">Cor do cartão</p>
            <div className="flex flex-wrap gap-2">
              {CARD_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, cor: c }))}
                  className={`w-8 h-8 rounded-lg transition-all ${form.cor === c ? 'ring-2 ring-offset-2 ring-slate-400 scale-110' : 'hover:scale-105'}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={saveMutation.isPending} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
              {editing ? 'Atualizar' : 'Salvar'}
            </Button>
            <Button type="button" variant="outline" onClick={cancelForm} className="flex-1">
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Button onClick={() => { setShowForm(true); setEditing(null); setForm(emptyForm()); }}
          className="w-full mb-6 bg-indigo-600 hover:bg-indigo-700 text-white h-12 text-base">
          <Plus className="w-5 h-5 mr-2" /> Adicionar Cartão
        </Button>
      )}

      {/* ── CARDS GRID ── */}
      {cards.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <CreditCardIcon className="w-16 h-16 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Nenhum cartão cadastrado</p>
          <p className="text-sm">Adicione seu primeiro cartão de crédito</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          {cards.map(card => {
            const bandeira = BANDEIRAS.find(b => b.value === card.bandeira);
            const isSelected = selectedCardId === card.id;
            return (
              <div key={card.id}
                onClick={() => setSelectedCardId(isSelected ? null : card.id)}
                className={`relative group cursor-pointer rounded-2xl p-5 text-white shadow-lg transition-all duration-300 overflow-hidden ${
                  isSelected ? 'ring-4 ring-emerald-400 ring-offset-2 scale-[1.02]' : 'hover:scale-[1.01] hover:shadow-xl'
                }`}
                style={{ background: `linear-gradient(135deg, ${card.cor || '#6366F1'}, ${card.cor || '#6366F1'}dd)` }}
              >
                {/* Decorative circles */}
                <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/10 -translate-y-8 translate-x-8" />
                <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/5 translate-y-6 -translate-x-6" />

                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-xs font-semibold uppercase tracking-wider opacity-80">{bandeira?.label || card.bandeira}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); startEdit(card); }}
                        className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); if (confirm('Remover este cartão?')) deleteMutation.mutate(card.id); }}
                        className="p-1.5 rounded-lg bg-white/20 hover:bg-red-500/70 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  
                  <p className="text-lg font-bold tracking-wide mb-1">{card.nome}</p>
                  <p className="text-sm font-mono opacity-80 mb-4">
                    •••• •••• •••• {card.ultimos_digitos || '****'}
                  </p>

                  <div className="flex items-center justify-between text-xs opacity-70">
                    <span>Fecha dia {card.dia_fechamento || '—'}</span>
                    <span>Vence dia {card.dia_vencimento || '—'}</span>
                  </div>
                  {card.limite > 0 && (
                    <div className="mt-2 text-sm font-semibold">Limite: {fmt(card.limite)}</div>
                  )}
                </div>

                {isSelected && (
                  <div className="absolute top-2 right-2 z-20 w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Eye className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── STATEMENT / EXTRATO ── */}
      {selectedCardId && selectedCard && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {/* Header */}
          <div className="p-5 border-b border-slate-100" style={{ background: `linear-gradient(135deg, ${selectedCard.cor}15, ${selectedCard.cor}08)` }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: selectedCard.cor }}>
                  <CreditCardIcon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">Extrato: {selectedCard.nome}</h3>
                  <p className="text-xs text-slate-500">
                    •••• {selectedCard.ultimos_digitos || '****'} · {BANDEIRAS.find(b => b.value === selectedCard.bandeira)?.label}
                  </p>
                </div>
              </div>
              <button onClick={() => setSelectedCardId(null)} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            {/* Month navigator */}
            <div className="flex items-center justify-between">
              <button onClick={() => changeStatementMonth(-1)} className="p-1.5 rounded-lg hover:bg-white/60"><ChevronLeft className="w-4 h-4 text-slate-500" /></button>
              <span className="text-sm font-semibold text-slate-700 capitalize">{format(statementDate, 'MMMM yyyy', { locale: ptBR })}</span>
              <button onClick={() => changeStatementMonth(1)} className="p-1.5 rounded-lg hover:bg-white/60"><ChevronRight className="w-4 h-4 text-slate-500" /></button>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-5 border-b border-slate-100">
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-xs text-slate-500 mb-1">Total Fatura</p>
              <p className="text-lg font-bold text-slate-800">{fmt(totalCardExpenses)}</p>
            </div>
            {selectedCard.limite > 0 && (
              <>
                <div className="bg-slate-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-slate-500 mb-1">Limite Disponível</p>
                  <p className="text-lg font-bold text-emerald-600">{fmt(selectedCard.limite - totalCardExpenses)}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
                  <p className="text-xs text-slate-500 mb-1">Uso do Limite</p>
                  <div className="mt-2">
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(limiteUsado, 100)}%`,
                          backgroundColor: limiteUsado > 90 ? '#EF4444' : limiteUsado > 70 ? '#F97316' : '#22C55E'
                        }} />
                    </div>
                    <p className={`text-sm font-bold mt-1 ${limiteUsado > 90 ? 'text-red-600' : limiteUsado > 70 ? 'text-orange-600' : 'text-emerald-600'}`}>
                      {limiteUsado.toFixed(1)}%
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Expenses list */}
          <div className="divide-y divide-slate-50">
            {loadingExpenses ? (
              <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div>
            ) : cardExpenses.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Receipt className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p>Nenhum gasto neste cartão no mês</p>
              </div>
            ) : (
              cardExpenses
                .sort((a, b) => (b.data || '').localeCompare(a.data || ''))
                .map(exp => {
                  const cat = categories.find(c => c.id === exp.category_id);
                  return (
                    <div key={exp.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-lg flex-shrink-0 flex items-center justify-center"
                          style={{ backgroundColor: (cat?.cor || '#6B7280') + '20' }}>
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat?.cor || '#6B7280' }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{exp.descricao}</p>
                          <p className="text-xs text-slate-500">
                            {exp.data ? format(new Date(exp.data + 'T00:00:00'), "dd/MM/yyyy") : '—'} · {cat?.nome || '—'}
                          </p>
                        </div>
                      </div>
                      <span className="font-bold text-red-600 text-sm flex-shrink-0 ml-3">{fmt(exp.valor)}</span>
                    </div>
                  );
                })
            )}
          </div>

          {/* Category Summary */}
          {cardExpenses.length > 0 && (
            <div className="p-5 border-t border-slate-100 bg-slate-50/50">
              <h4 className="text-sm font-semibold text-slate-700 mb-3">Gastos por Categoria</h4>
              <div className="space-y-2">
                {Object.entries(
                  cardExpenses.reduce((acc, exp) => {
                    const catName = categories.find(c => c.id === exp.category_id)?.nome || 'Sem categoria';
                    const catCor = categories.find(c => c.id === exp.category_id)?.cor || '#6B7280';
                    if (!acc[catName]) acc[catName] = { total: 0, cor: catCor };
                    acc[catName].total += exp.valor || 0;
                    return acc;
                  }, {})
                )
                  .sort(([, a], [, b]) => b.total - a.total)
                  .map(([catName, { total, cor }]) => (
                    <div key={catName} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cor }} />
                        <span className="text-sm text-slate-700">{catName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{
                            width: `${(total / totalCardExpenses) * 100}%`,
                            backgroundColor: cor
                          }} />
                        </div>
                        <span className="text-sm font-semibold text-slate-800 w-24 text-right">{fmt(total)}</span>
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
