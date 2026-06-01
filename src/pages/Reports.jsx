import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Loader2, Calendar as CalendarIcon, TrendingUp, TrendingDown, Download, PieChart as PieChartIcon } from 'lucide-react';
import { motion } from 'framer-motion';

// Componentes Recharts para o gráfico
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

export default function Reports() {
  const [startDate, setStartDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  // Fetch current user and families
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
  const family = families.find(f => f.id === selectedFamilyId) || families[0];

  // Fetch report data
  const { data: reportData, isLoading, refetch } = useQuery({
    queryKey: ['analytical-report', family?.id, startDate, endDate],
    queryFn: async () => {
      const token = localStorage.getItem('freedom_access_token');
      const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
      const baseUrl = isLocal ? `http://${window.location.hostname}:3000/api` : '/api';
      
      const res = await fetch(`${baseUrl}/reports/analytical?family_id=${family.id}&startDate=${startDate}&endDate=${endDate}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Erro ao buscar relatório');
      return res.json();
    },
    enabled: !!family && !!startDate && !!endDate
  });

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handlePrint = () => {
    window.print();
  };

  // Process data for charts and tables
  const incomes = reportData?.incomes || [];
  const expenses = reportData?.expenses || [];

  const totalIncome = incomes.reduce((sum, i) => sum + i.valor, 0);
  const regularExpenses = expenses.filter(e => !e.credit_card_id || e.is_fatura_cartao);
  const totalRegularExpenses = regularExpenses.reduce((sum, e) => sum + e.valor, 0);
  const ccExpenses = expenses.filter(e => e.credit_card_id && !e.is_fatura_cartao);
  const totalCCExpenses = ccExpenses.reduce((sum, e) => sum + e.valor, 0);

  const balance = totalIncome - totalRegularExpenses;

  // Group expenses by category
  const expensesByCategory = expenses.reduce((acc, exp) => {
    const catName = exp.category?.nome || 'Sem Categoria';
    acc[catName] = (acc[catName] || 0) + exp.valor;
    return acc;
  }, {});

  const pieChartData = Object.entries(expensesByCategory).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  const COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#64748b'];

  if (!family) {
    return <div className="p-8 text-center">Carregando dados da família...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <PieChartIcon className="w-6 h-6 text-emerald-600" /> Relatórios Analíticos
            </h1>
            <p className="text-slate-500 text-sm mt-1">Análise detalhada por período personalizado</p>
          </div>
          <Button onClick={handlePrint} variant="outline" className="print:hidden bg-white text-slate-700 hover:bg-slate-100">
            <Download className="w-4 h-4 mr-2" /> Imprimir Relatório
          </Button>
        </div>

        {/* Filtros */}
        <Card className="p-4 flex flex-wrap items-end gap-4 print:hidden shadow-sm">
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase">Data Inicial</label>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input 
                type="date" 
                value={startDate} 
                onChange={e => setStartDate(e.target.value)}
                className="pl-9 pr-4 py-2 border rounded-md text-sm focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-500 uppercase">Data Final</label>
            <div className="relative">
              <CalendarIcon className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input 
                type="date" 
                value={endDate} 
                onChange={e => setEndDate(e.target.value)}
                className="pl-9 pr-4 py-2 border rounded-md text-sm focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>
          </div>
          <Button onClick={() => refetch()} className="bg-emerald-600 hover:bg-emerald-700">
            Filtrar Período
          </Button>
        </Card>

        {isLoading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
        ) : (
          <div className="space-y-6" id="printable-report">
            <div className="hidden print:block mb-6">
              <h2 className="text-xl font-bold">Relatório Analítico - {family.nome_familia}</h2>
              <p className="text-sm text-slate-600">Período: {format(new Date(startDate), 'dd/MM/yyyy')} a {format(new Date(endDate), 'dd/MM/yyyy')}</p>
            </div>

            {/* Resumo */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="p-5 shadow-sm border-emerald-100 bg-emerald-50/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-emerald-100 rounded-lg"><TrendingUp className="w-5 h-5 text-emerald-600" /></div>
                  <h3 className="font-semibold text-slate-700">Total Receitas</h3>
                </div>
                <p className="text-2xl font-bold text-emerald-700">{formatCurrency(totalIncome)}</p>
                <p className="text-xs text-emerald-600 mt-1">{incomes.length} lançamentos</p>
              </Card>

              <Card className="p-5 shadow-sm border-red-100 bg-red-50/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-red-100 rounded-lg"><TrendingDown className="w-5 h-5 text-red-600" /></div>
                  <h3 className="font-semibold text-slate-700">Despesas (PIX/Débito)</h3>
                </div>
                <p className="text-2xl font-bold text-red-700">{formatCurrency(totalRegularExpenses)}</p>
                <p className="text-xs text-red-600 mt-1">{regularExpenses.length} lançamentos</p>
              </Card>

              <Card className="p-5 shadow-sm border-amber-100 bg-amber-50/50">
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 bg-amber-100 rounded-lg"><PieChartIcon className="w-5 h-5 text-amber-600" /></div>
                  <h3 className="font-semibold text-slate-700">Gastos no Cartão</h3>
                </div>
                <p className="text-2xl font-bold text-amber-700">{formatCurrency(totalCCExpenses)}</p>
                <p className="text-xs text-amber-600 mt-1">{ccExpenses.length} lançamentos (não afeta saldo principal até pagar fatura)</p>
              </Card>

              <Card className={`p-5 shadow-sm ${balance >= 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-slate-700">Resultado do Período</h3>
                </div>
                <p className={`text-2xl font-bold ${balance >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {formatCurrency(balance)}
                </p>
                <p className="text-xs text-slate-500 mt-1">Receitas - Despesas Comuns</p>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Gráfico de Despesas por Categoria */}
              <Card className="p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-6 border-b pb-2">Despesas por Categoria</h3>
                {pieChartData.length > 0 ? (
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieChartData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {pieChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => formatCurrency(value)} />
                        <Legend layout="vertical" verticalAlign="middle" align="right" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center text-slate-400">Nenhum gasto no período.</div>
                )}
              </Card>

              {/* Tabela de Maiores Despesas */}
              <Card className="p-6 shadow-sm overflow-hidden flex flex-col">
                <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Top 10 Maiores Despesas</h3>
                <div className="overflow-auto flex-1">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3">Data</th>
                        <th className="px-4 py-3">Descrição</th>
                        <th className="px-4 py-3">Categoria</th>
                        <th className="px-4 py-3 text-right">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...expenses].sort((a, b) => b.valor - a.valor).slice(0, 10).map(exp => (
                        <tr key={exp.id} className="border-b last:border-0 hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-600">{format(new Date(exp.data), 'dd/MM/yyyy')}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">{exp.descricao}</td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-[10px] font-semibold">
                              {exp.category?.nome || 'Geral'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-red-600 font-medium">-{formatCurrency(exp.valor)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
