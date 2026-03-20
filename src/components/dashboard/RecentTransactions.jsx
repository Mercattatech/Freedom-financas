import React from 'react';
import { Card } from "@/components/ui/card";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export default function RecentTransactions({ expenses, incomes, categories }) {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getCategoryName = (categoryId) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat?.nome || 'Sem categoria';
  };

  const getCategoryColor = (categoryId) => {
    const cat = categories.find(c => c.id === categoryId);
    return cat?.cor || '#6B7280';
  };

  const allTransactions = [
    ...expenses.map(e => ({ ...e, type: 'expense', date: e.data })),
    ...incomes.map(i => ({ ...i, type: 'income', date: i.data_recebimento }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8);

  return (
    <Card className="p-6 border-0 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-800 mb-6">Transações Recentes</h3>
      <div className="space-y-4">
        {allTransactions.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">Nenhuma transação registrada</p>
        ) : (
          allTransactions.map((transaction, idx) => (
            <div key={idx} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center",
                  transaction.type === 'income' ? "bg-emerald-50" : "bg-slate-100"
                )}>
                  {transaction.type === 'income' ? (
                    <ArrowDownLeft className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <div
                      className="w-5 h-5 rounded-full"
                      style={{ backgroundColor: getCategoryColor(transaction.category_id) }}
                    />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {transaction.descricao || transaction.tipo?.replace(/_/g, ' ')}
                  </p>
                  <p className="text-xs text-slate-500">
                    {transaction.type === 'expense' ? getCategoryName(transaction.category_id) : 'Renda'} • {transaction.date && format(new Date(transaction.date), "dd MMM", { locale: ptBR })}
                  </p>
                </div>
              </div>
              <span className={cn(
                "text-sm font-semibold",
                transaction.type === 'income' ? "text-emerald-600" : "text-slate-800"
              )}>
                {transaction.type === 'income' ? '+' : '-'} {formatCurrency(transaction.valor)}
              </span>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}