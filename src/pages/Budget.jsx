import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, CheckCircle2, Pencil, Sparkles, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

import MonthSelector from '@/components/dashboard/MonthSelector';

export default function Budget() {
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editingBudget, setEditingBudget] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    tipo_orcamento: 'VALOR_FIXO',
    valor_orcado: '',
    percentual_orcado: ''
  });

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

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', family?.id],
    queryFn: () => apiClient.entities.Category.filter({ family_id: family.id }),
    enabled: !!family
  });

  const { data: incomes = [] } = useQuery({
    queryKey: ['incomes', month?.id],
    queryFn: () => apiClient.entities.Income.filter({ month_id: month.id }),
    enabled: !!month
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', month?.id],
    queryFn: () => apiClient.entities.Expense.filter({ month_id: month.id }),
    enabled: !!month
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets', month?.id],
    queryFn: () => apiClient.entities.Budget.filter({ month_id: month.id }),
    enabled: !!month
  });

  const saveBudgetMutation = useMutation({
    mutationFn: ({ data, id }) => id ? apiClient.entities.Budget.update(id, data) : apiClient.entities.Budget.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['budgets']);
      setModalOpen(false);
    }
  });

  const deleteBudgetMutation = useMutation({
    mutationFn: (id) => apiClient.entities.Budget.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['budgets']);
      setModalOpen(false);
    }
  });

  const totalIncome = incomes.reduce((sum, i) => sum + (i.valor || 0), 0);

  const getCategorySpent = (categoryId) => {
    return expenses
      .filter(e => e.category_id === categoryId)
      .reduce((sum, e) => sum + (e.valor || 0), 0);
  };

  const getCategoryBudget = (categoryId) => {
    const budget = budgets.find(b => b.category_id === categoryId);
    if (!budget) return { budget: null, value: 0 };
    
    let value = 0;
    if (budget.tipo_orcamento === 'PERCENTUAL_RENDA') {
      value = totalIncome * (budget.percentual_orcado / 100);
    } else {
      value = budget.valor_orcado || 0;
    }
    
    return { budget, value };
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const handleEditBudget = (category) => {
    const { budget } = getCategoryBudget(category.id);
    setEditingBudget({ category, budget });
    setFormData({
      tipo_orcamento: budget?.tipo_orcamento || 'VALOR_FIXO',
      valor_orcado: budget?.valor_orcado?.toString() || '',
      percentual_orcado: budget?.percentual_orcado?.toString() || ''
    });
    setModalOpen(true);
  };

  const handleSaveBudget = () => {
    const data = {
      month_id: month.id,
      category_id: editingBudget.category.id,
      tipo_orcamento: formData.tipo_orcamento,
      valor_orcado: formData.tipo_orcamento === 'VALOR_FIXO' ? parseFloat(formData.valor_orcado) || 0 : null,
      percentual_orcado: formData.tipo_orcamento === 'PERCENTUAL_RENDA' ? parseFloat(formData.percentual_orcado) || 0 : null
    };

    saveBudgetMutation.mutate({ data, id: editingBudget.budget?.id });
  };

  const handleDeleteBudget = () => {
    if (editingBudget?.budget?.id) {
      deleteBudgetMutation.mutate(editingBudget.budget.id);
    }
  };

  const handleIASuggestion = async () => {
    if (!month) return;
    
    // Ignorar categorias de 'RECEITA' que não são orçamento de gastos.
    const expenseCategories = categories.filter(c => c.tipo !== 'RECEITA');
    if (expenseCategories.length === 0) return;

    // Regras simuladas para distribuição de orçamento baseados em IA.
    const suggestions = {
      'moradia': 30,
      'alimentação': 20,
      'alimentacao': 20,
      'transporte': 15,
      'saúde': 10,
      'saude': 10,
      'educação': 10,
      'educacao': 10,
      'lazer': 10,
      'imposto': 5,
    };

    let remainingPercent = 100;
    const updates = [];

    expenseCategories.forEach(cat => {
      const name = cat.nome.toLowerCase().trim();
      let percent = 0;

      const match = Object.keys(suggestions).find(k => name.includes(k));
      if (match && remainingPercent >= suggestions[match]) {
        percent = suggestions[match];
        remainingPercent -= percent;
      } else if (remainingPercent > 0) {
        percent = Math.min(5, remainingPercent);
        remainingPercent -= percent;
      }

      if (percent > 0) {
        updates.push({
          category_id: cat.id,
          tipo_orcamento: 'PERCENTUAL_RENDA',
          percentual_orcado: percent,
          valor_orcado: null
        });
      }
    });

    const promises = updates.map(updateObj => {
      const existing = budgets.find(b => b.category_id === updateObj.category_id);
      const data = {
        month_id: month.id,
        category_id: updateObj.category_id,
        tipo_orcamento: updateObj.tipo_orcamento,
        percentual_orcado: updateObj.percentual_orcado,
        valor_orcado: updateObj.valor_orcado
      };
      if (existing) {
        return apiClient.entities.Budget.update(existing.id, data);
      } else {
        return apiClient.entities.Budget.create(data);
      }
    });

    await Promise.all(promises);
    queryClient.invalidateQueries(['budgets']);
  };

  const totalBudgeted = categories.reduce((sum, cat) => {
    const { value } = getCategoryBudget(cat.id);
    return sum + value;
  }, 0);

  const totalSpent = expenses.reduce((sum, e) => sum + (e.valor || 0), 0);

  const sortedCategories = [...categories]
    .filter(c => c.tipo !== 'RECEITA')
    .sort((a, b) => (a.ordem_exibicao || 0) - (b.ordem_exibicao || 0));

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
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Orçamento</h1>
            <p className="text-slate-500 mt-1">Defina limites para cada categoria</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleIASuggestion}
              className="text-violet-600 border-violet-200 hover:bg-violet-50 hover:text-violet-700 transition"
              title="Organizar proporções automaticamente via IA"
            >
              <Sparkles className="w-4 h-4 mr-2" />
              IA Sugestão
            </Button>
            <MonthSelector currentDate={currentDate} onDateChange={setCurrentDate} />
          </div>
        </motion.div>

        {/* Summary Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8"
        >
          <Card className="p-6 border-0 shadow-sm">
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Renda Total</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">{formatCurrency(totalIncome)}</p>
          </Card>
          <Card className="p-6 border-0 shadow-sm relative overflow-hidden">
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Total Orçado</p>
            <p className={cn(
                  "text-2xl font-bold mt-2",
                  totalBudgeted > totalIncome ? "text-red-600" : "text-slate-900"
                )}>
              {formatCurrency(totalBudgeted)}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              {totalIncome > 0 ? ((totalBudgeted / totalIncome) * 100).toFixed(1) : 0}% da renda
            </p>
            {totalBudgeted > totalIncome && (
              <div className="absolute top-0 right-0 p-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
              </div>
            )}
          </Card>
          <Card className="p-6 border-0 shadow-sm">
            <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Total Gasto</p>
            <p className="text-2xl font-bold text-slate-900 mt-2">{formatCurrency(totalSpent)}</p>
            <p className="text-sm text-slate-500 mt-1">
              {totalBudgeted > 0 ? ((totalSpent / totalBudgeted) * 100).toFixed(1) : 0}% do orçado
            </p>
          </Card>
        </motion.div>

        {totalBudgeted > totalIncome && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-red-800">Atenção: Limite do Orçamento Excedido</h3>
              <p className="text-sm text-red-700 mt-1">
                A soma de todos os seus orçamentos ({formatCurrency(totalBudgeted)}) ultrapassou a sua Renda Total ({formatCurrency(totalIncome)}). Por favor, reajuste a distribuição.
              </p>
            </div>
          </motion.div>
        )}

        {/* Budget List */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {sortedCategories.map((category) => {
              const { budget, value: budgetValue } = getCategoryBudget(category.id);
              const spent = getCategorySpent(category.id);
              const rawPercentage = budgetValue > 0 ? (spent / budgetValue) * 100 : 0;
              const percentage = Math.min(rawPercentage, 100);
              const isOver = budgetValue > 0 && spent > budgetValue;
              const isNearLimit = budgetValue > 0 && percentage >= 80 && !isOver;

              return (
                <motion.div
                  key={category.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-4 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: (category.cor || '#10B981') + '20' }}
                      >
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: category.cor || '#10B981' }}
                        />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800 flex items-center gap-2">
                          {category.nome}
                          {isOver && <AlertCircle className="w-4 h-4 text-red-500" />}
                          {!isOver && percentage === 100 && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        </p>
                        <p className="text-sm text-slate-500">
                          {budget?.tipo_orcamento === 'PERCENTUAL_RENDA'
                            ? `${budget.percentual_orcado}% da renda`
                            : budgetValue > 0 ? 'Valor fixo' : 'Sem orçamento'
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <p className={cn(
                          "font-semibold",
                          isOver ? "text-red-600" : "text-slate-800"
                        )}>
                          {formatCurrency(spent)}
                        </p>
                        <p className="text-sm text-slate-500">
                          de {formatCurrency(budgetValue)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditBudget(category)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mt-3">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: isOver ? '#EF4444' : isNearLimit ? '#F59E0B' : (category.cor || '#10B981'),
                      }}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Edit Budget Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Orçamento: {editingBudget?.category.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
              <div>
                <p className="font-medium text-slate-800">Usar percentual da renda</p>
                <p className="text-sm text-slate-500">
                  Renda atual: {formatCurrency(totalIncome)}
                </p>
              </div>
              <Switch
                checked={formData.tipo_orcamento === 'PERCENTUAL_RENDA'}
                onCheckedChange={(v) => setFormData({
                  ...formData,
                  tipo_orcamento: v ? 'PERCENTUAL_RENDA' : 'VALOR_FIXO'
                })}
              />
            </div>

            {formData.tipo_orcamento === 'VALOR_FIXO' ? (
              <div className="space-y-2">
                <Label>Valor do Orçamento (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.valor_orcado}
                  onChange={(e) => setFormData({ ...formData, valor_orcado: e.target.value })}
                  placeholder="0,00"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Percentual da Renda (%)</Label>
                <Input
                  type="number"
                  step="0.1"
                  max="100"
                  value={formData.percentual_orcado}
                  onChange={(e) => setFormData({ ...formData, percentual_orcado: e.target.value })}
                  placeholder="10"
                />
                {formData.percentual_orcado && (
                  <p className="text-sm text-slate-500">
                    = {formatCurrency(totalIncome * (parseFloat(formData.percentual_orcado) || 0) / 100)}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              {editingBudget?.budget && (
                <Button 
                  variant="outline" 
                  className="flex-1 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" 
                  onClick={handleDeleteBudget}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Excluir
                </Button>
              )}
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSaveBudget}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}