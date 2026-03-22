import React, { useState } from 'react';
import { apiClient } from '@/api/apiClient';
import { useQuery } from '@tanstack/react-query';
import { format, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Area, AreaChart } from 'recharts';
import { Target, ArrowUpRight, ArrowDownRight, Award, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/utils/formatCurrency';

export default function Evolution() {
  const [months, setMonths] = useState(6);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => apiClient.auth.me()
  });

  const { data: families = [] } = useQuery({
    queryKey: ['families', user?.email],
    queryFn: () => apiClient.entities.Family.filter({ created_by: user.email }),
    enabled: !!user
  });

  const selectedFamilyId = localStorage.getItem('selectedFamilyId');
  const family = selectedFamilyId ? families.find(f => f.id === selectedFamilyId) : families[0];

  // Fetch all months for the range
  const monthRange = Array.from({ length: months }, (_, i) => {
    const date = subMonths(new Date(), months - 1 - i);
    return format(date, 'yyyy-MM');
  });

  const { data: allMonths = [] } = useQuery({
    queryKey: ['all-months', family?.id],
    queryFn: () => apiClient.entities.FinancialMonth.filter({ family_id: family.id }),
    enabled: !!family
  });

  const { data: allIncomes = [] } = useQuery({
    queryKey: ['all-incomes', family?.id, months],
    queryFn: async () => {
      const relevantMonths = allMonths.filter(m => monthRange.includes(m.competencia));
      if (relevantMonths.length === 0) return [];
      const results = await Promise.all(
        relevantMonths.map(m => apiClient.entities.Income.filter({ month_id: m.id }))
      );
      return results.flat().map((inc, _, __, monthIdx) => ({
        ...inc,
        competencia: relevantMonths.find(rm => rm.id === inc.month_id)?.competencia
      }));
    },
    enabled: allMonths.length > 0
  });

  const { data: allExpenses = [] } = useQuery({
    queryKey: ['all-expenses', family?.id, months],
    queryFn: async () => {
      const relevantMonths = allMonths.filter(m => monthRange.includes(m.competencia));
      if (relevantMonths.length === 0) return [];
      const results = await Promise.all(
        relevantMonths.map(m => apiClient.entities.Expense.filter({ month_id: m.id }))
      );
      return results.flat().map(exp => ({
        ...exp,
        competencia: relevantMonths.find(rm => rm.id === exp.month_id)?.competencia
      }));
    },
    enabled: allMonths.length > 0
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', family?.id],
    queryFn: () => apiClient.entities.Category.filter({ family_id: family.id }),
    enabled: !!family
  });

  // Build chart data
  const chartData = monthRange.map(comp => {
    const monthIncomes = allIncomes.filter(i => i.competencia === comp);
    const monthExpenses = allExpenses.filter(e => e.competencia === comp);
    const totalIncome = monthIncomes.reduce((s, i) => s + (i.valor || 0), 0);
    const totalExpense = monthExpenses.reduce((s, e) => s + (e.valor || 0), 0);
    const balance = totalIncome - totalExpense;
    const savingsRate = totalIncome > 0 ? ((balance / totalIncome) * 100) : 0;

    const date = new Date(comp + '-01');
    return {
      name: format(date, 'MMM/yy', { locale: ptBR }),
      competencia: comp,
      receitas: totalIncome,
      despesas: totalExpense,
      saldo: balance,
      taxaPoupanca: Math.round(savingsRate * 10) / 10,
    };
  });

  // Category breakdown over time
  const categoryTrend = categories.slice(0, 6).map(cat => {
    return {
      nome: cat.nome,
      cor: cat.cor || '#10B981',
      dados: monthRange.map(comp => {
        const monthExpenses = allExpenses.filter(e => e.competencia === comp && e.category_id === cat.id);
        return monthExpenses.reduce((s, e) => s + (e.valor || 0), 0);
      })
    };
  });

  // Insights
  const currentMonth = chartData[chartData.length - 1] || {};
  const previousMonth = chartData[chartData.length - 2] || {};
  const expenseChange = previousMonth.despesas > 0
    ? ((currentMonth.despesas - previousMonth.despesas) / previousMonth.despesas * 100)
    : 0;
  const incomeChange = previousMonth.receitas > 0
    ? ((currentMonth.receitas - previousMonth.receitas) / previousMonth.receitas * 100)
    : 0;

  const bestMonth = chartData.reduce((best, m) => m.saldo > (best?.saldo || -Infinity) ? m : best, null);
  const worstMonth = chartData.reduce((worst, m) => m.saldo < (worst?.saldo || Infinity) ? m : worst, null);
  const avgSavingsRate = chartData.length > 0
    ? chartData.reduce((s, m) => s + m.taxaPoupanca, 0) / chartData.length
    : 0;

  // Most expensive category
  const categoryTotals = categories.map(cat => ({
    nome: cat.nome,
    cor: cat.cor,
    total: allExpenses.filter(e => e.category_id === cat.id).reduce((s, e) => s + (e.valor || 0), 0)
  })).sort((a, b) => b.total - a.total);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload) return null;
    return (
      <div className="bg-white p-4 rounded-xl shadow-xl border border-slate-200">
        <p className="font-bold text-slate-800 mb-2">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="text-sm" style={{ color: p.color }}>
            {p.name}: {p.name === 'taxaPoupanca' ? `${p.value}%` : formatCurrency(p.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Evolução Financeira</h1>
            <p className="text-slate-500 mt-1">Acompanhe o progresso da sua família ao longo do tempo</p>
          </div>
          <Select value={String(months)} onValueChange={v => setMonths(parseInt(v))}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">3 meses</SelectItem>
              <SelectItem value="6">6 meses</SelectItem>
              <SelectItem value="12">12 meses</SelectItem>
            </SelectContent>
          </Select>
        </motion.div>

        {/* Insight Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          <Card className="p-5 border-0 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              {incomeChange >= 0 ? (
                <ArrowUpRight className="w-5 h-5 text-emerald-600" />
              ) : (
                <ArrowDownRight className="w-5 h-5 text-red-600" />
              )}
              <p className="text-xs font-medium text-slate-500 uppercase">Receitas vs mês anterior</p>
            </div>
            <p className={`text-2xl font-bold ${incomeChange >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {incomeChange >= 0 ? '+' : ''}{incomeChange.toFixed(1)}%
            </p>
          </Card>

          <Card className="p-5 border-0 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              {expenseChange <= 0 ? (
                <ArrowDownRight className="w-5 h-5 text-emerald-600" />
              ) : (
                <ArrowUpRight className="w-5 h-5 text-red-600" />
              )}
              <p className="text-xs font-medium text-slate-500 uppercase">Despesas vs mês anterior</p>
            </div>
            <p className={`text-2xl font-bold ${expenseChange <= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
              {expenseChange >= 0 ? '+' : ''}{expenseChange.toFixed(1)}%
            </p>
          </Card>

          <Card className="p-5 border-0 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-indigo-600" />
              <p className="text-xs font-medium text-slate-500 uppercase">Taxa de Poupança Média</p>
            </div>
            <p className={`text-2xl font-bold ${avgSavingsRate >= 20 ? 'text-emerald-600' : avgSavingsRate >= 0 ? 'text-amber-600' : 'text-red-600'}`}>
              {avgSavingsRate.toFixed(1)}%
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {avgSavingsRate >= 20 ? '🎯 Excelente!' : avgSavingsRate >= 10 ? '👍 Bom caminho' : '⚠️ Precisa melhorar'}
            </p>
          </Card>

          <Card className="p-5 border-0 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Award className="w-5 h-5 text-yellow-600" />
              <p className="text-xs font-medium text-slate-500 uppercase">Melhor Mês</p>
            </div>
            <p className="text-2xl font-bold text-slate-800">{bestMonth?.name || '—'}</p>
            <p className="text-xs text-emerald-600 mt-1">Saldo: {formatCurrency(bestMonth?.saldo || 0)}</p>
          </Card>
        </motion.div>

        {/* Receitas vs Despesas Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6"
        >
          <Card className="p-6 border-0 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Receitas vs Despesas</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#94A3B8" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#94A3B8" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar dataKey="receitas" name="Receitas" fill="#10B981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="despesas" name="Despesas" fill="#EF4444" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card className="p-6 border-0 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">Saldo Mensal</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="saldoGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#94A3B8" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#94A3B8" tickFormatter={v => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="saldo" name="Saldo" stroke="#10B981" fill="url(#saldoGradient)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </motion.div>

        {/* Taxa de Poupança + Top Categorias */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          <Card className="p-6 border-0 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              Taxa de Poupança (% que sobra da renda)
            </h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="name" stroke="#94A3B8" tick={{ fontSize: 12 }} />
                  <YAxis stroke="#94A3B8" tickFormatter={v => `${v}%`} tick={{ fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="taxaPoupanca"
                    name="Taxa de Poupança"
                    stroke="#6366F1"
                    strokeWidth={3}
                    dot={{ fill: '#6366F1', r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                  {/* Reference line at 20% (ideal) */}
                  <Line
                    type="monotone"
                    dataKey={() => 20}
                    name="Meta (20%)"
                    stroke="#94A3B8"
                    strokeDasharray="5 5"
                    strokeWidth={1}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-500 mt-2 text-center">
              A linha tracejada indica a meta de 20% (Regra 50/30/20)
            </p>
          </Card>

          <Card className="p-6 border-0 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800 mb-4">
              Top Categorias de Gasto (período)
            </h2>
            <div className="space-y-3">
              {categoryTotals.slice(0, 8).map((cat, i) => {
                const maxTotal = categoryTotals[0]?.total || 1;
                const percent = (cat.total / maxTotal) * 100;
                return (
                  <div key={i} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.cor || '#6B7280' }} />
                        <span className="text-sm text-slate-700">{cat.nome}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-800">
                        {formatCurrency(cat.total)}
                      </span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${percent}%`, backgroundColor: cat.cor || '#6B7280' }}
                      />
                    </div>
                  </div>
                );
              })}
              {categoryTotals.length === 0 && (
                <div className="text-center text-slate-400 py-8">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Nenhuma despesa neste período</p>
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
