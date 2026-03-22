import React from 'react';
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AlertTriangle, CheckCircle2 } from "lucide-react";

export default function BudgetProgress({ categories, expenses, budgets, totalIncome }) {
  const getCategorySpent = (categoryId) => {
    return expenses
      .filter(e => e.category_id === categoryId)
      .reduce((sum, e) => sum + (e.valor || 0), 0);
  };

  const getCategoryBudget = (categoryId) => {
    const budget = budgets.find(b => b.category_id === categoryId);
    if (!budget) return 0;
    if (budget.tipo_orcamento === 'PERCENTUAL_RENDA') {
      return totalIncome * (budget.percentual_orcado / 100);
    }
    return budget.valor_orcado || 0;
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const sortedCategories = [...categories].sort((a, b) => {
    const spentA = getCategorySpent(a.id);
    const budgetA = getCategoryBudget(a.id);
    const spentB = getCategorySpent(b.id);
    const budgetB = getCategoryBudget(b.id);
    const percentA = budgetA > 0 ? (spentA / budgetA) * 100 : 0;
    const percentB = budgetB > 0 ? (spentB / budgetB) * 100 : 0;
    return percentB - percentA;
  });

  return (
    <Card className="p-6 border-0 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-800 mb-6">Orçamento por Categoria</h3>
      <div className="space-y-5">
        {sortedCategories.slice(0, 6).map((category) => {
          const spent = getCategorySpent(category.id);
          const budget = getCategoryBudget(category.id);
          const rawPercentage = budget > 0 ? (spent / budget) * 100 : 0;
          const percentage = Math.min(rawPercentage, 100);
          const isOver = budget > 0 && spent > budget;
          const isNearLimit = budget > 0 && percentage >= 80 && !isOver;

          return (
            <div key={category.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: category.cor || '#10B981' }}
                  />
                  <span className="text-sm font-medium text-slate-700">{category.nome}</span>
                  {isOver && <AlertTriangle className="w-4 h-4 text-red-500" />}
                  {!isOver && percentage === 100 && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                </div>
                <div className="text-right">
                  <span className={cn(
                    "text-sm font-semibold",
                    isOver ? "text-red-600" : "text-slate-700"
                  )}>
                    {formatCurrency(spent)}
                  </span>
                  <span className="text-sm text-slate-400"> / {formatCurrency(budget)}</span>
                </div>
              </div>
              <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: isOver ? '#EF4444' : isNearLimit ? '#F59E0B' : (category.cor || '#10B981'),
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}