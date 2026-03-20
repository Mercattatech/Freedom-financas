import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { PiggyBank, TrendingUp, Church, Gift, Wallet, AlertCircle, Calculator, Tag } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

import MonthSelector from '@/components/dashboard/MonthSelector';

const PRESET_COLORS = [
  '#10B981', '#6366F1', '#F97316', '#A855F7', '#14B8A6',
  '#EF4444', '#F59E0B', '#3B82F6', '#EC4899', '#8B5CF6'
];

export default function Wealth() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [activeTab, setActiveTab] = useState('distribution');
  const [percentages, setPercentages] = useState({});

  const [calcInitial, setCalcInitial] = useState('1000');
  const [calcMonthly, setCalcMonthly] = useState('500');
  const [calcRate, setCalcRate] = useState('1');
  const [calcMonths, setCalcMonths] = useState('12');

  const competencia = format(currentDate, 'yyyy-MM');

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
  const family = selectedFamilyId
    ? families.find(f => f.id === selectedFamilyId)
    : families[0];

  const { data: months = [] } = useQuery({
    queryKey: ['months', family?.id, competencia],
    queryFn: () => apiClient.entities.FinancialMonth.filter({ family_id: family.id, competencia }),
    enabled: !!family
  });

  const month = months[0];

  const { data: incomes = [] } = useQuery({
    queryKey: ['incomes', month?.id],
    queryFn: () => apiClient.entities.Income.filter({ month_id: month.id }),
    enabled: !!month
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', family?.id],
    queryFn: () => apiClient.entities.Category.filter({ family_id: family.id, ativo: true }),
    enabled: !!family
  });

  const { data: wealthPlans = [] } = useQuery({
    queryKey: ['wealthPlans', month?.id],
    queryFn: () => apiClient.entities.WealthPlan.filter({ month_id: month.id }),
    enabled: !!month
  });

  const wealthPlan = wealthPlans[0];

  // Initialize percentages when categories or wealthPlan loads
  useEffect(() => {
    if (categories.length === 0) return;

    if (wealthPlan?.distribuicao) {
      try {
        const saved = JSON.parse(wealthPlan.distribuicao);
        const updated = {};
        categories.forEach(cat => {
          updated[cat.id] = saved[cat.id] ?? (100 / categories.length);
        });
        setPercentages(updated);
        return;
      } catch (e) {}
    }

    // Default: distribute equally
    const equalShare = parseFloat((100 / categories.length).toFixed(2));
    const defaults = {};
    categories.forEach((cat, i) => {
      defaults[cat.id] = i === categories.length - 1
        ? parseFloat((100 - equalShare * (categories.length - 1)).toFixed(2))
        : equalShare;
    });
    setPercentages(defaults);
  }, [categories, wealthPlan]);

  const saveWealthPlanMutation = useMutation({
    mutationFn: (data) => wealthPlan
      ? apiClient.entities.WealthPlan.update(wealthPlan.id, data)
      : apiClient.entities.WealthPlan.create({ ...data, month_id: month.id }),
    onSuccess: () => {
      queryClient.invalidateQueries(['wealthPlans']);
      toast.success('Distribuição salva!');
    }
  });

  const totalIncome = incomes.reduce((sum, i) => sum + (i.valor || 0), 0);
  const totalPercentage = Object.values(percentages).reduce((sum, p) => sum + (parseFloat(p) || 0), 0);
  const isValid = Math.abs(totalPercentage - 100) < 0.5;

  const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const handlePercentageChange = (catId, value) => {
    setPercentages(prev => ({ ...prev, [catId]: parseFloat(value) || 0 }));
  };

  const handleSave = () => {
    if (!month) return;
    saveWealthPlanMutation.mutate({
      distribuicao: JSON.stringify(percentages)
    });
  };

  const sortedCategories = [...categories].sort((a, b) => (a.ordem_exibicao || 0) - (b.ordem_exibicao || 0));

  const distributionData = sortedCategories.map((cat, i) => ({
    name: cat.nome,
    value: parseFloat(percentages[cat.id]) || 0,
    color: cat.cor || PRESET_COLORS[i % PRESET_COLORS.length]
  })).filter(d => d.value > 0);

  // Compound interest calculator
  const calculateCompoundInterest = () => {
    const P = parseFloat(calcInitial) || 0;
    const A = parseFloat(calcMonthly) || 0;
    const i = (parseFloat(calcRate) || 0) / 100;
    const n = parseInt(calcMonths) || 0;
    const data = [];
    let balance = P;
    for (let m = 0; m <= n; m++) {
      data.push({ month: m, saldo: Math.round(balance * 100) / 100, aportado: P + (A * m) });
      balance = balance * (1 + i) + A;
    }
    return data;
  };

  const projectionData = calculateCompoundInterest();
  const finalBalance = projectionData[projectionData.length - 1]?.saldo || 0;
  const totalInvested = parseFloat(calcInitial) + (parseFloat(calcMonthly) * parseInt(calcMonths));
  const totalReturn = finalBalance - totalInvested;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Patrimônio</h1>
            <p className="text-slate-500 mt-1">Distribua sua renda entre as categorias</p>
          </div>
          <MonthSelector currentDate={currentDate} onDateChange={setCurrentDate} />
        </motion.div>

        {/* Renda Total destaque */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Card className="p-5 border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm font-medium">Renda Total do Mês</p>
                <p className="text-4xl font-bold mt-1">{formatCurrency(totalIncome)}</p>
                {!month && <p className="text-emerald-200 text-xs mt-1">Nenhum mês aberto para {competencia}</p>}
              </div>
              <div className="p-4 bg-white/20 rounded-2xl">
                <Wallet className="w-8 h-8" />
              </div>
            </div>
          </Card>
        </motion.div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="distribution">Distribuição da Renda</TabsTrigger>
            <TabsTrigger value="calculator">Calculadora</TabsTrigger>
          </TabsList>

          <TabsContent value="distribution">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: category sliders */}
              <Card className="p-6 border-0 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-slate-800">Ajustar Percentuais</h2>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-sm font-medium",
                    totalPercentage > 100 ? "bg-red-100 text-red-700" : isValid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                  )}>
                    Total: {totalPercentage.toFixed(1)}%
                    {totalPercentage > 100 && (
                      <span className="ml-1 font-bold">(+{(totalPercentage - 100).toFixed(1)}% acima)</span>
                    )}
                  </div>
                </div>

                {!isValid && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 rounded-lg text-red-700 text-sm mb-4">
                    <AlertCircle className="w-4 h-4" />
                    A soma deve ser exatamente 100%
                  </div>
                )}

                {categories.length === 0 && (
                  <div className="p-6 text-center text-slate-500">
                    <Tag className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    <p>Nenhuma categoria cadastrada.</p>
                    <p className="text-sm">Crie categorias na página Categorias.</p>
                  </div>
                )}

                <div className="space-y-5 max-h-[480px] overflow-y-auto pr-1">
                  {sortedCategories.map((cat, i) => {
                    const pct = parseFloat(percentages[cat.id]) || 0;
                    const valorReal = totalIncome * pct / 100;
                    const color = cat.cor || PRESET_COLORS[i % PRESET_COLORS.length];
                    return (
                      <div key={cat.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{ backgroundColor: color + '20' }}
                            >
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                            </div>
                            <span className="font-medium text-slate-700 text-sm">{cat.nome}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-slate-800 min-w-[80px] text-right">
                              {formatCurrency(valorReal)}
                            </span>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              value={pct}
                              onChange={(e) => handlePercentageChange(cat.id, e.target.value)}
                              className="w-16 text-right text-sm h-8"
                            />
                            <span className="text-sm text-slate-400">%</span>
                          </div>
                        </div>
                        <Slider
                          value={[pct]}
                          onValueChange={([v]) => handlePercentageChange(cat.id, v)}
                          max={100}
                          step={0.5}
                          className="[&>span:first-child]:bg-slate-200"
                          style={{ '--slider-thumb-color': color }}
                        />
                      </div>
                    );
                  })}
                </div>

                {categories.length > 0 && (
                  <Button
                    onClick={handleSave}
                    disabled={!isValid || !month}
                    className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700"
                  >
                    Salvar Distribuição
                  </Button>
                )}
              </Card>

              {/* Right: chart + table */}
              <div className="space-y-6">
                <Card className="p-6 border-0 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-800 mb-4">Visão Geral</h2>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={distributionData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {distributionData.map((entry, index) => (
                            <Cell key={index} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value, name) => [`${value}%`, name]} />
                        <Legend
                          layout="vertical"
                          align="right"
                          verticalAlign="middle"
                          formatter={(value) => <span className="text-xs text-slate-600">{value}</span>}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                {/* Summary table */}
                <Card className="p-6 border-0 shadow-sm">
                  <h2 className="text-lg font-semibold text-slate-800 mb-4">Resumo em Reais</h2>
                  <div className="space-y-2">
                    {sortedCategories.map((cat, i) => {
                      const pct = parseFloat(percentages[cat.id]) || 0;
                      const valorReal = totalIncome * pct / 100;
                      const color = cat.cor || PRESET_COLORS[i % PRESET_COLORS.length];
                      return (
                        <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-50">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                            <span className="text-sm text-slate-700">{cat.nome}</span>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-slate-900 text-sm">{formatCurrency(valorReal)}</p>
                            <p className="text-xs text-slate-400">{pct.toFixed(1)}%</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="calculator">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6 border-0 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-teal-50 rounded-lg">
                    <Calculator className="w-5 h-5 text-teal-600" />
                  </div>
                  <h2 className="text-lg font-semibold text-slate-800">Calculadora de Juros Compostos</h2>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Valor Inicial (R$)</Label>
                    <Input type="number" value={calcInitial} onChange={(e) => setCalcInitial(e.target.value)} placeholder="1000" />
                  </div>
                  <div className="space-y-2">
                    <Label>Aporte Mensal (R$)</Label>
                    <Input type="number" value={calcMonthly} onChange={(e) => setCalcMonthly(e.target.value)} placeholder="500" />
                  </div>
                  <div className="space-y-2">
                    <Label>Taxa de Juros Mensal (%)</Label>
                    <Input type="number" step="0.01" value={calcRate} onChange={(e) => setCalcRate(e.target.value)} placeholder="1" />
                    <p className="text-xs text-slate-500">
                      Equivale a {((Math.pow(1 + (parseFloat(calcRate) || 0) / 100, 12) - 1) * 100).toFixed(2)}% ao ano
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Período (meses)</Label>
                    <Input type="number" value={calcMonths} onChange={(e) => setCalcMonths(e.target.value)} placeholder="12" />
                    <p className="text-xs text-slate-500">{(parseInt(calcMonths) / 12).toFixed(1)} anos</p>
                  </div>
                </div>
                <div className="mt-6 space-y-3">
                  <div className="p-4 bg-teal-50 rounded-lg">
                    <p className="text-sm text-teal-600">Montante Final</p>
                    <p className="text-2xl font-bold text-teal-700">{formatCurrency(finalBalance)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500">Total Investido</p>
                      <p className="font-semibold text-slate-800">{formatCurrency(totalInvested)}</p>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-lg">
                      <p className="text-xs text-emerald-600">Rendimento</p>
                      <p className="font-semibold text-emerald-700">{formatCurrency(totalReturn)}</p>
                    </div>
                  </div>
                </div>
              </Card>
              <Card className="p-6 border-0 shadow-sm">
                <h2 className="text-lg font-semibold text-slate-800 mb-4">Projeção de Crescimento</h2>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={projectionData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                      <XAxis dataKey="month" stroke="#94A3B8" tickFormatter={(v) => `${v}m`} />
                      <YAxis stroke="#94A3B8" tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(value, name) => [formatCurrency(value), name === 'saldo' ? 'Saldo' : 'Aportado']}
                        labelFormatter={(v) => `Mês ${v}`}
                        contentStyle={{ backgroundColor: 'white', border: '1px solid #E2E8F0', borderRadius: '8px' }}
                      />
                      <Line type="monotone" dataKey="aportado" stroke="#94A3B8" strokeWidth={2} dot={false} name="aportado" />
                      <Line type="monotone" dataKey="saldo" stroke="#14B8A6" strokeWidth={2} dot={false} name="saldo" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex justify-center gap-6 mt-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-slate-400" />
                    <span className="text-sm text-slate-600">Valor Aportado</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-teal-500" />
                    <span className="text-sm text-slate-600">Saldo com Juros</span>
                  </div>
                </div>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}