import React from 'react';
import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);

const DRERow = ({ label, value, level = 0, bold = false, color, sublabel }) => {
  const isPositive = value > 0;
  const isNegative = value < 0;

  return (
    <div className={cn(
      "flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors",
      level === 0 && "bg-slate-50",
      level === 1 && "pl-6",
      level === 2 && "pl-10 text-sm",
      bold && "font-semibold"
    )}>
      <div className="flex items-center gap-2">
        {level > 0 && <ChevronRight className="w-3 h-3 text-slate-300" />}
        <div>
          <span className={cn("text-slate-700", bold && "text-slate-900")}>{label}</span>
          {sublabel && <p className="text-xs text-slate-400">{sublabel}</p>}
        </div>
      </div>
      <span className={cn(
        "font-mono",
        color === 'green' && "text-emerald-600",
        color === 'red' && "text-red-500",
        color === 'blue' && "text-blue-600",
        color === 'purple' && "text-purple-600",
        !color && (bold ? "text-slate-900" : "text-slate-700")
      )}>
        {formatCurrency(value)}
      </span>
    </div>
  );
};

const DRESectionHeader = ({ label, value, color }) => (
  <div className={cn(
    "flex items-center justify-between py-3 px-3 rounded-xl font-bold text-sm",
    color === 'green' && "bg-emerald-50 text-emerald-800",
    color === 'red' && "bg-red-50 text-red-800",
    color === 'blue' && "bg-blue-50 text-blue-800",
    color === 'purple' && "bg-purple-50 text-purple-800",
    color === 'teal' && "bg-teal-50 text-teal-800",
    color === 'amber' && "bg-amber-50 text-amber-800",
  )}>
    <span>{label}</span>
    <span className="font-mono">{formatCurrency(value)}</span>
  </div>
);

export default function DRE({ incomes, expenses, debts, categories, investmentBoxes, stockInvestments }) {
  const totalReceitas = incomes.reduce((s, i) => s + (i.valor || 0), 0);

  // Group expenses by category
  const expenseByCategory = {};
  expenses.forEach(e => {
    if (!expenseByCategory[e.category_id]) expenseByCategory[e.category_id] = 0;
    expenseByCategory[e.category_id] += (e.valor || 0);
  });
  const totalDespesas = expenses.reduce((s, e) => s + (e.valor || 0), 0);

  const resultadoOperacional = totalReceitas - totalDespesas;

  // Debts
  const totalDividas = debts.reduce((s, d) => s + (d.saldo_atual || 0), 0);

  // Investments
  const totalCaixinhas = (investmentBoxes || []).reduce((s, b) => s + (b.saldo_atual || 0), 0);
  const totalAcoes = (stockInvestments || []).reduce((s, s2) => s + ((s2.quantidade || 0) * (s2.preco_atual || s2.preco_medio || 0)), 0);
  const totalPatrimonioInvestido = totalCaixinhas + totalAcoes;

  const patrimonioLiquido = totalPatrimonioInvestido - totalDividas;

  return (
    <Card className="p-6 border-0 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900">DRE — Demonstrativo de Resultado</h2>
          <p className="text-xs text-slate-400 mt-0.5">Acompanhamento mensal em tempo real</p>
        </div>
        <div className={cn(
          "px-3 py-1.5 rounded-full text-sm font-semibold",
          resultadoOperacional >= 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
        )}>
          {resultadoOperacional >= 0 ? <TrendingUp className="w-4 h-4 inline mr-1" /> : <TrendingDown className="w-4 h-4 inline mr-1" />}
          {resultadoOperacional >= 0 ? 'Superávit' : 'Déficit'}
        </div>
      </div>

      <div className="space-y-3">
        {/* RECEITAS */}
        <DRESectionHeader label="(+) RECEITAS TOTAIS" value={totalReceitas} color="green" />
        <div className="space-y-0.5 mb-2">
          {incomes.map(inc => (
            <DRERow key={inc.id} label={inc.descricao || inc.tipo} value={inc.valor} level={2} color="green" />
          ))}
          {incomes.length === 0 && (
            <p className="text-xs text-slate-400 pl-10 py-1">Nenhuma renda registrada</p>
          )}
        </div>

        {/* DESPESAS */}
        <DRESectionHeader label="(-) DESPESAS TOTAIS" value={-totalDespesas} color="red" />
        <div className="space-y-0.5 mb-2">
          {categories.map(cat => {
            const val = expenseByCategory[cat.id] || 0;
            if (val === 0) return null;
            return (
              <DRERow key={cat.id} label={cat.nome} value={-val} level={2} color="red" />
            );
          })}
          {totalDespesas === 0 && (
            <p className="text-xs text-slate-400 pl-10 py-1">Nenhuma despesa registrada</p>
          )}
        </div>

        {/* RESULTADO OPERACIONAL */}
        <div className={cn(
          "flex items-center justify-between py-3 px-4 rounded-xl font-bold border-2",
          resultadoOperacional >= 0 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
        )}>
          <span>= RESULTADO DO MÊS</span>
          <span className="font-mono text-lg">{formatCurrency(resultadoOperacional)}</span>
        </div>

        <div className="border-t border-slate-100 pt-3 space-y-3">
          {/* DÍVIDAS */}
          <DRESectionHeader label="⚠ DÍVIDAS ATIVAS (passivo)" value={-totalDividas} color="amber" />
          <div className="space-y-0.5 mb-2">
            {debts.map(debt => (
              <DRERow key={debt.id} label={debt.nome_divida} value={-debt.saldo_atual} level={2} sublabel={debt.credor} />
            ))}
            {debts.length === 0 && (
              <p className="text-xs text-slate-400 pl-10 py-1">Sem dívidas ativas 🎉</p>
            )}
          </div>

          {/* PATRIMÔNIO INVESTIDO */}
          <DRESectionHeader label="▲ PATRIMÔNIO INVESTIDO (ativo)" value={totalPatrimonioInvestido} color="teal" />
          {totalCaixinhas > 0 && (
            <DRERow label="Caixinhas de Investimento" value={totalCaixinhas} level={2} color="blue" />
          )}
          {totalAcoes > 0 && (
            <DRERow label="Carteira de Ações" value={totalAcoes} level={2} color="blue" />
          )}
          {totalPatrimonioInvestido === 0 && (
            <p className="text-xs text-slate-400 pl-10 py-1">Nenhum investimento registrado</p>
          )}
        </div>

        {/* PATRIMÔNIO LÍQUIDO */}
        <div className={cn(
          "flex items-center justify-between py-4 px-4 rounded-xl border-2 mt-2",
          patrimonioLiquido >= 0 ? "border-blue-200 bg-blue-50" : "border-red-200 bg-red-50"
        )}>
          <div>
            <p className={cn("font-bold text-base", patrimonioLiquido >= 0 ? "text-blue-800" : "text-red-800")}>
              = PATRIMÔNIO LÍQUIDO
            </p>
            <p className="text-xs text-slate-400">Investimentos − Dívidas</p>
          </div>
          <span className={cn("font-mono text-xl font-bold", patrimonioLiquido >= 0 ? "text-blue-700" : "text-red-700")}>
            {formatCurrency(patrimonioLiquido)}
          </span>
        </div>
      </div>
    </Card>
  );
}