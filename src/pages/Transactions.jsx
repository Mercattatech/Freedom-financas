import React, { useState } from 'react';
import { useFinancialMonth } from '@/components/hooks/useFinancialMonth';
import { apiClient } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Pencil, Check, X, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

const INCOME_TYPES = [
  { value: 'SALARIO_MARIDO', label: 'Salário do Marido' },
  { value: 'SALARIO_ESPOSA', label: 'Salário da Esposa' },
  { value: 'PENSAO_ALIMENTICIA', label: 'Pensão Alimentícia' },
  { value: 'COMISSOES', label: 'Comissões' },
  { value: 'RESTITUICAO_IR', label: 'Restituição IR' },
  { value: 'RENDA_EXTRA', label: 'Renda Extra' },
  { value: 'OUTRAS', label: 'Outras' }
];

const PAYMENT_METHODS = [
  { value: 'PIX', label: 'PIX' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'DEBITO', label: 'Débito' },
  { value: 'CREDITO', label: 'Crédito' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'TRANSFERENCIA', label: 'Transferência' },
  { value: 'OUTRO', label: 'Outro' }
];

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const today = () => new Date().toISOString().split('T')[0];

const emptyIncomeForm = () => ({ tipo: 'SALARIO_MARIDO', descricao: '', valor: '', data_recebimento: today() });
const emptyExpenseForm = () => ({ 
  descricao: '', 
  valor: '', 
  data: today(), 
  category_id: '', 
  subcategory_id: '', 
  forma_pagamento: 'PIX',
  is_recurring: false,
  recurring_limit_date: ''
});

export default function Transactions() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tab, setTab] = useState('expenses');
  const [showIncomeForm, setShowIncomeForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingIncome, setEditingIncome] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [incomeForm, setIncomeForm] = useState(emptyIncomeForm());
  const [expenseForm, setExpenseForm] = useState(emptyExpenseForm());
  const [showFilters, setShowFilters] = useState(false);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterDesc, setFilterDesc] = useState('');
  const [filterMinVal, setFilterMinVal] = useState('');
  const [filterMaxVal, setFilterMaxVal] = useState('');

  const competencia = format(currentDate, 'yyyy-MM');

  // ── User & Family ──────────────────────────────────────────────
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => apiClient.auth.me()
  });

  const { data: families = [], isLoading: loadingFamily } = useQuery({
    queryKey: ['families', user?.email],
    queryFn: () => apiClient.entities.Family.filter({ created_by: user.email }),
    enabled: !!user
  });

  const selectedFamilyId = localStorage.getItem('selectedFamilyId');
  const family = selectedFamilyId ? families.find(f => f.id === selectedFamilyId) : families[0];

  // ── Categories ─────────────────────────────────────────────────
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', family?.id],
    queryFn: () => apiClient.entities.Category.filter({ family_id: family.id }),
    enabled: !!family
  });

  const { data: subcategories = [] } = useQuery({
    queryKey: ['subcategories'],
    queryFn: () => apiClient.entities.Subcategory.list(),
    enabled: !!family
  });

  // ── Month (sem duplicatas) ─────────────────────────────────────
  const { month } = useFinancialMonth(family?.id, competencia);

  // ── Incomes ────────────────────────────────────────────────────
  const { data: incomes = [], isLoading: loadingIncomes } = useQuery({
    queryKey: ['incomes', month?.id],
    queryFn: () => apiClient.entities.Income.filter({ month_id: month.id }),
    enabled: !!month?.id
  });

  // ── Expenses ───────────────────────────────────────────────────
  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ['expenses', month?.id],
    queryFn: () => apiClient.entities.Expense.filter({ month_id: month.id }),
    enabled: !!month?.id
  });

  // ── Mutations ──────────────────────────────────────────────────
  const saveIncomeMutation = useMutation({
    mutationFn: ({ data, id }) => id ? apiClient.entities.Income.update(id, data) : apiClient.entities.Income.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
      toast.success(editingIncome ? 'Receita atualizada!' : 'Receita salva!');
      cancelForm();
    },
    onError: (e) => toast.error('Erro: ' + e.message)
  });

  const saveExpenseMutation = useMutation({
    mutationFn: ({ data, id }) => id ? apiClient.entities.Expense.update(id, data) : apiClient.entities.Expense.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success(editingExpense ? 'Despesa atualizada!' : 'Despesa salva!');
      cancelForm();
    },
    onError: (e) => toast.error('Erro: ' + e.message)
  });

  const deleteIncomeMutation = useMutation({
    mutationFn: (id) => apiClient.entities.Income.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['incomes'] });
      toast.success('Receita removida');
    }
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id) => apiClient.entities.Expense.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast.success('Despesa removida');
    }
  });

  const saveRecurringExpenseMutation = useMutation({
    mutationFn: (data) => apiClient.entities.RecurringExpense.create(data),
    onError: (e) => toast.error('Erro ao salvar recorrência: ' + e.message)
  });

  // ── Handlers ───────────────────────────────────────────────────
  const cancelForm = () => {
    setShowIncomeForm(false);
    setShowExpenseForm(false);
    setEditingIncome(null);
    setEditingExpense(null);
    setIncomeForm(emptyIncomeForm());
    setExpenseForm(emptyExpenseForm());
  };

  const handleSaveIncome = (e) => {
    e.preventDefault();
    if (!month?.id) { toast.error('Mês não inicializado, aguarde'); return; }
    const data = {
      month_id: month.id,
      tipo: incomeForm.tipo,
      descricao: incomeForm.descricao,
      valor: parseFloat(incomeForm.valor) || 0,
      data_recebimento: incomeForm.data_recebimento,
      recorrente: false,
      ativo: true
    };
    saveIncomeMutation.mutate({ data, id: editingIncome?.id });
  };

  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!month?.id) { toast.error('Mês não inicializado, aguarde'); return; }
    if (!expenseForm.category_id) { toast.error('Selecione uma categoria'); return; }
    
    // Parse Date for recurring extraction
    const expDate = new Date(expenseForm.data);
    const day = expDate.getDate();

    const data = {
      month_id: month.id,
      descricao: expenseForm.descricao,
      valor: parseFloat(expenseForm.valor) || 0,
      data: expenseForm.data,
      category_id: expenseForm.category_id,
      subcategory_id: expenseForm.subcategory_id || undefined,
      forma_pagamento: expenseForm.forma_pagamento,
      recorrente: expenseForm.is_recurring
    };
    
    // Saves the expense itself
    saveExpenseMutation.mutate({ data, id: editingExpense?.id });

    // If it's a new expense AND marked as recurring, save to recurring templates
    if (expenseForm.is_recurring && !editingExpense) {
      saveRecurringExpenseMutation.mutate({
        descricao: expenseForm.descricao,
        valor: parseFloat(expenseForm.valor) || 0,
        category_id: expenseForm.category_id,
        subcategory_id: expenseForm.subcategory_id || undefined,
        forma_pagamento: expenseForm.forma_pagamento,
        dia_vencimento: day,
        ativo: true,
        family_id: family.id
      });
    }
  };

  const handleMakeRecurring = (exp) => {
    // 1. Update the local expense item as "recorrente"
    const expDate = new Date(exp.data);
    const day = expDate.getDate() || 10;
    
    const data = {
      month_id: exp.month_id,
      descricao: exp.descricao,
      valor: exp.valor,
      data: exp.data,
      category_id: exp.category_id,
      subcategory_id: exp.subcategory_id || undefined,
      forma_pagamento: exp.forma_pagamento,
      recorrente: true
    };
    
    saveExpenseMutation.mutate({ data, id: exp.id });

    // 2. Create the recurring expense "molde"
    saveRecurringExpenseMutation.mutate({
      descricao: exp.descricao,
      valor: exp.valor || 0,
      category_id: exp.category_id,
      subcategory_id: exp.subcategory_id || undefined,
      forma_pagamento: exp.forma_pagamento,
      dia_vencimento: day,
      ativo: true,
      family_id: family.id
    });
    
    toast.success('Despesa transformada em Conta Fixa (Recorrente)!');
  };

  const startEditIncome = (income) => {
    setEditingIncome(income);
    setIncomeForm({ tipo: income.tipo, descricao: income.descricao || '', valor: String(income.valor || ''), data_recebimento: income.data_recebimento || today() });
    setShowIncomeForm(true);
    setShowExpenseForm(false);
  };

  const startEditExpense = (expense) => {
    setEditingExpense(expense);
    setExpenseForm({ 
      descricao: expense.descricao || '', 
      valor: String(expense.valor || ''), 
      data: expense.data || today(), 
      category_id: expense.category_id || '', 
      subcategory_id: expense.subcategory_id || '', 
      forma_pagamento: expense.forma_pagamento || 'PIX',
      is_recurring: expense.recorrente || false
    });
    setShowExpenseForm(true);
    setShowIncomeForm(false);
  };

  const changeMonth = (delta) => {
    const d = new Date(currentDate);
    d.setMonth(d.getMonth() + delta);
    setCurrentDate(d);
    cancelForm();
  };

  // ── Derived values ─────────────────────────────────────────────
  const totalIncomes = incomes.reduce((s, i) => s + (i.valor || 0), 0);
  const totalExpenses = expenses.reduce((s, e) => s + (e.valor || 0), 0);
  const balance = totalIncomes - totalExpenses;
  const filteredSubs = subcategories.filter(s => s.category_id === expenseForm.category_id);

  const filteredExpenses = expenses.filter(exp => {
    if (filterCategory && exp.category_id !== filterCategory) return false;
    if (filterDesc && !exp.descricao?.toLowerCase().includes(filterDesc.toLowerCase())) return false;
    if (filterMinVal && (exp.valor || 0) < parseFloat(filterMinVal)) return false;
    if (filterMaxVal && (exp.valor || 0) > parseFloat(filterMaxVal)) return false;
    return true;
  });
  const hasActiveFilter = filterCategory || filterDesc || filterMinVal || filterMaxVal;
  const isLoading = loadingFamily || loadingIncomes || loadingExpenses;

  const groupTransactions = (items, dateField) => {
    const groups = {};
    items.forEach(item => {
      const gDate = item[dateField] || 'Sem data';
      if (!groups[gDate]) groups[gDate] = [];
      groups[gDate].push(item);
    });
    return Object.keys(groups).sort((a,b) => b.localeCompare(a)).map(date => ({
       date,
       items: groups[date],
       total: groups[date].reduce((sum, curr) => sum + (curr.valor || 0), 0)
    }));
  };

  const groupedExpenses = groupTransactions(filteredExpenses, 'data');
  const groupedIncomes = groupTransactions(incomes, 'data_recebimento');

  // ── Render ─────────────────────────────────────────────────────
  if (loadingFamily) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 pb-24">

      {/* Seletor de mês */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => changeMonth(-1)} className="p-2 rounded-lg hover:bg-slate-100">
          <ChevronLeft className="w-5 h-5 text-slate-600" />
        </button>
        <h2 className="text-xl font-bold text-slate-800 capitalize">
          {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <button onClick={() => changeMonth(1)} className="p-2 rounded-lg hover:bg-slate-100">
          <ChevronRight className="w-5 h-5 text-slate-600" />
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
          <p className="text-xs text-emerald-600 font-medium mb-1">Receitas</p>
          <p className="text-sm font-bold text-emerald-700">{fmt(totalIncomes)}</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-center">
          <p className="text-xs text-red-600 font-medium mb-1">Despesas</p>
          <p className="text-sm font-bold text-red-700">{fmt(totalExpenses)}</p>
        </div>
        <div className={`border rounded-xl p-3 text-center ${balance >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-orange-50 border-orange-100'}`}>
          <p className={`text-xs font-medium mb-1 ${balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>Saldo</p>
          <p className={`text-sm font-bold ${balance >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>{fmt(balance)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 bg-slate-100 p-1 rounded-xl">
        <button
          onClick={() => { setTab('expenses'); cancelForm(); }}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${tab === 'expenses' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
        >
          Despesas ({hasActiveFilter ? `${filteredExpenses.length}/` : ''}{expenses.length})
        </button>
        <button
          onClick={() => { setTab('incomes'); cancelForm(); }}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${tab === 'incomes' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}
        >
          Receitas ({incomes.length})
        </button>
      </div>

      {/* FORMULÁRIO INLINE - DESPESA */}
      {tab === 'expenses' && (showExpenseForm ? (
        <form onSubmit={handleSaveExpense} className="bg-white border border-slate-200 rounded-xl p-4 mb-4 shadow-sm space-y-3">
          <h3 className="font-semibold text-slate-700">{editingExpense ? 'Editar Despesa' : 'Nova Despesa'}</h3>
          <Input placeholder="Descrição *" value={expenseForm.descricao} onChange={e => setExpenseForm(f => ({ ...f, descricao: e.target.value }))} required />
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" step="0.01" placeholder="Valor R$ *" value={expenseForm.valor} onChange={e => setExpenseForm(f => ({ ...f, valor: e.target.value }))} required />
            <Input type="date" value={expenseForm.data} onChange={e => setExpenseForm(f => ({ ...f, data: e.target.value }))} required />
          </div>
          <Select value={expenseForm.category_id} onValueChange={v => setExpenseForm(f => ({ ...f, category_id: v, subcategory_id: '' }))}>
            <SelectTrigger><SelectValue placeholder="Categoria *" /></SelectTrigger>
            <SelectContent>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: c.cor || '#10B981' }} />
                    {c.nome}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {filteredSubs.length > 0 && (
            <Select value={expenseForm.subcategory_id} onValueChange={v => setExpenseForm(f => ({ ...f, subcategory_id: v }))}>
              <SelectTrigger><SelectValue placeholder="Subcategoria (opcional)" /></SelectTrigger>
              <SelectContent>
                {filteredSubs.map(s => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Select value={expenseForm.forma_pagamento} onValueChange={v => setExpenseForm(f => ({ ...f, forma_pagamento: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {!editingExpense && (
            <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-100 rounded-lg mt-2">
               <div>
                  <p className="text-sm font-medium text-slate-800">Despesa Recorrente (Conta Fixa)</p>
                  <p className="text-xs text-slate-500">Repetir automaticamente nos próximos meses</p>
               </div>
               <input 
                  type="checkbox" 
                  className="w-5 h-5 accent-emerald-600 rounded cursor-pointer" 
                  checked={expenseForm.is_recurring} 
                  onChange={e => setExpenseForm(f => ({ ...f, is_recurring: e.target.checked }))} 
               />
            </div>
          )}
          <div className="flex gap-2 pt-1 mt-2">
            <Button type="submit" disabled={saveExpenseMutation.isPending} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              {saveExpenseMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
              {editingExpense ? 'Atualizar' : 'Salvar'}
            </Button>
            <Button type="button" variant="outline" onClick={cancelForm} className="flex-1">
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Button onClick={() => { setShowExpenseForm(true); setShowIncomeForm(false); setEditingExpense(null); }} className="w-full mb-4 bg-red-500 hover:bg-red-600 text-white">
          <Plus className="w-4 h-4 mr-2" /> Adicionar Despesa
        </Button>
      ))}

      {/* FORMULÁRIO INLINE - RECEITA */}
      {tab === 'incomes' && (showIncomeForm ? (
        <form onSubmit={handleSaveIncome} className="bg-white border border-slate-200 rounded-xl p-4 mb-4 shadow-sm space-y-3">
          <h3 className="font-semibold text-slate-700">{editingIncome ? 'Editar Receita' : 'Nova Receita'}</h3>
          <Select value={incomeForm.tipo} onValueChange={v => setIncomeForm(f => ({ ...f, tipo: v }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {INCOME_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input placeholder="Descrição (opcional)" value={incomeForm.descricao} onChange={e => setIncomeForm(f => ({ ...f, descricao: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input type="number" step="0.01" placeholder="Valor R$ *" value={incomeForm.valor} onChange={e => setIncomeForm(f => ({ ...f, valor: e.target.value }))} required />
            <Input type="date" value={incomeForm.data_recebimento} onChange={e => setIncomeForm(f => ({ ...f, data_recebimento: e.target.value }))} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={saveIncomeMutation.isPending} className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              {saveIncomeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
              {editingIncome ? 'Atualizar' : 'Salvar'}
            </Button>
            <Button type="button" variant="outline" onClick={cancelForm} className="flex-1">
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
          </div>
        </form>
      ) : (
        <Button onClick={() => { setShowIncomeForm(true); setShowExpenseForm(false); setEditingIncome(null); }} className="w-full mb-4 bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" /> Adicionar Receita
        </Button>
      ))}

      {/* FILTROS DE DESPESAS */}
      {tab === 'expenses' && (
        <div className="mb-3">
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition-all ${hasActiveFilter ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filtros
            {hasActiveFilter && <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />}
          </button>
          {showFilters && (
            <div className="mt-2 p-3 bg-white border border-slate-200 rounded-xl shadow-sm space-y-3">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Todas as categorias" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>Todas as categorias</SelectItem>
                  {categories.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: c.cor || '#10B981' }} />
                        {c.nome}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Buscar por descrição..."
                value={filterDesc}
                onChange={e => setFilterDesc(e.target.value)}
                className="h-8 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="Valor mín." value={filterMinVal} onChange={e => setFilterMinVal(e.target.value)} className="h-8 text-sm" />
                <Input type="number" placeholder="Valor máx." value={filterMaxVal} onChange={e => setFilterMaxVal(e.target.value)} className="h-8 text-sm" />
              </div>
              {hasActiveFilter && (
                <button
                  onClick={() => { setFilterCategory(''); setFilterDesc(''); setFilterMinVal(''); setFilterMaxVal(''); }}
                  className="text-xs text-red-500 hover:underline"
                >
                  Limpar filtros
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* LISTA DE DESPESAS */}
      {tab === 'expenses' && (
        <div className="space-y-6 mt-4">
          {loadingExpenses ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div>
          ) : groupedExpenses.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <TrendingDown className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Nenhuma despesa este mês</p>
            </div>
          ) : groupedExpenses.map(group => (
            <div key={group.date} className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-100 px-4 py-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-700 capitalize">
                  {group.date !== 'Sem data' ? format(new Date(group.date + 'T00:00:00'), "dd 'de' MMMM", { locale: ptBR }) : 'Sem data'}
                </h4>
                <span className="text-xs font-semibold text-slate-500">
                  {group.items.length} {group.items.length === 1 ? 'item' : 'itens'} · {fmt(group.total)}
                </span>
              </div>
              <div className="divide-y divide-slate-50">
                {group.items.map(exp => {
                  const cat = categories.find(c => c.id === exp.category_id);
                  return (
                    <div key={exp.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: (cat?.cor || '#6B7280') + '20' }}>
                          <div className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: cat?.cor || '#6B7280' }} />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 text-sm truncate flex items-center gap-2">
                            {exp.descricao}
                            {exp.recorrente && <Badge className="bg-emerald-100/50 text-emerald-700 text-[10px] px-1.5 py-0 h-4 border border-emerald-200">Recorrente</Badge>}
                          </p>
                          <div className="flex items-center gap-2 text-xs mt-0.5">
                            <span className="text-slate-500">
                              {cat?.nome || '—'} · {exp.forma_pagamento}
                            </span>
                            {!exp.recorrente && (
                              <>
                                <span className="text-slate-300">|</span>
                                <label className="flex items-center gap-1 cursor-pointer text-[10px] text-slate-400 hover:text-emerald-600 transition-colors">
                                  <input 
                                    type="checkbox" 
                                    className="w-3 h-3 accent-emerald-600 rounded cursor-pointer" 
                                    onChange={(e) => {
                                      e.preventDefault();
                                      handleMakeRecurring(exp);
                                    }} 
                                  />
                                  <span>Tornar recorrente</span>
                                </label>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-bold text-red-600 text-[15px]">{fmt(exp.valor)}</span>
                        <div className="flex items-center">
                          <button onClick={() => startEditExpense(exp)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 transition-colors"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => { if (confirm('Excluir esta despesa?')) deleteExpenseMutation.mutate(exp.id); }} className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LISTA DE RECEITAS */}
      {tab === 'incomes' && (
        <div className="space-y-6 mt-4">
          {loadingIncomes ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-600" /></div>
          ) : groupedIncomes.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <TrendingUp className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>Nenhuma receita este mês</p>
            </div>
          ) : groupedIncomes.map(group => (
            <div key={group.date} className="bg-white border border-slate-100 rounded-xl shadow-sm overflow-hidden">
              <div className="bg-slate-50 border-b border-slate-100 px-4 py-2 flex items-center justify-between">
                <h4 className="text-sm font-semibold text-slate-700 capitalize">
                  {group.date !== 'Sem data' ? format(new Date(group.date + 'T00:00:00'), "dd 'de' MMMM", { locale: ptBR }) : 'Sem data'}
                </h4>
                <span className="text-xs font-semibold text-slate-500">
                  {group.items.length} {group.items.length === 1 ? 'item' : 'itens'} · {fmt(group.total)}
                </span>
              </div>
              <div className="divide-y divide-slate-50">
                {group.items.map(inc => {
                  const label = INCOME_TYPES.find(t => t.value === inc.tipo)?.label || inc.tipo;
                  return (
                    <div key={inc.id} className="p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 flex-shrink-0 flex items-center justify-center">
                          <TrendingUp className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-800 text-sm truncate">{inc.descricao || label}</p>
                          <p className="text-xs text-slate-500">{label}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-bold text-emerald-600 text-[15px]">{fmt(inc.valor)}</span>
                        <div className="flex items-center">
                          <button onClick={() => startEditIncome(inc)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 transition-colors"><Pencil className="w-4 h-4" /></button>
                          <button onClick={() => { if (confirm('Excluir esta receita?')) deleteIncomeMutation.mutate(inc.id); }} className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}