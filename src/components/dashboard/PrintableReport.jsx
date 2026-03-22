import React from 'react';
import { formatCurrency } from '@/utils/formatCurrency';

export default function PrintableReport({ family, month, incomes, expenses, debts, balance }) {
  const totalIncomes = incomes.reduce((a, b) => a + (b.valor || 0), 0);
  const totalExpenses = expenses.reduce((a, b) => a + (b.valor || 0), 0);

  return (
    <div 
      id="printable-report" 
      className="absolute top-[-9999px] left-[-9999px] w-[800px] bg-white text-slate-900 p-10 font-sans"
    >
       {/* Beautiful Header */}
       <div className="border-b-4 border-emerald-600 pb-6 mb-8 flex justify-between items-end">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <span className="text-white font-bold text-2xl">F</span>
              </div>
              <h1 className="text-3xl font-black text-slate-800">Freedom</h1>
            </div>
            <p className="text-sm text-slate-500 font-medium">Relatório Financeiro Executivo</p>
          </div>
          <div className="text-right">
             <h2 className="text-xl font-bold">{family?.nome_familia}</h2>
             <p className="text-slate-500">Competência: {month?.month_year}</p>
          </div>
       </div>

       {/* Resumo do Mês */}
       <div className="mb-8">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4">Resumo do Mês</h3>
          <div className="grid grid-cols-3 gap-6">
             <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-sm text-slate-500 mb-1">Total de Entradas</p>
                <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalIncomes)}</p>
             </div>
             <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-sm text-slate-500 mb-1">Total de Saídas</p>
                <p className="text-2xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
             </div>
             <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-sm text-slate-500 mb-1">Resultado Líquido</p>
                <p className={`text-2xl font-bold ${balance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                   {formatCurrency(balance)}
                </p>
             </div>
          </div>
       </div>

       {/* Detalhamento de Entradas */}
       <div className="mb-8">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4">Detalhamento de Entradas</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2.5 font-semibold">Fonte</th>
                <th className="py-2.5 font-semibold text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
               {incomes.map(inc => (
                 <tr key={inc.id} className="border-b border-slate-100">
                    <td className="py-2.5">{inc.descricao}</td>
                    <td className="py-2.5 text-right font-medium">{formatCurrency(inc.valor)}</td>
                 </tr>
               ))}
               {incomes.length === 0 && <tr><td colSpan="2" className="py-4 text-center text-slate-400">Nenhuma entrada no período</td></tr>}
            </tbody>
          </table>
       </div>

       {/* Detalhamento de Saídas */}
       <div className="mb-8">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4">Detalhamento de Saídas (Principais)</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2.5 font-semibold">Despesa</th>
                <th className="py-2.5 font-semibold text-right">Valor</th>
              </tr>
            </thead>
            <tbody>
               {expenses.sort((a,b) => b.valor - a.valor).slice(0, 15).map(exp => (
                 <tr key={exp.id} className="border-b border-slate-100">
                    <td className="py-2.5">{exp.descricao}</td>
                    <td className="py-2.5 text-right font-medium">{formatCurrency(exp.valor)}</td>
                 </tr>
               ))}
               {expenses.length === 0 && <tr><td colSpan="2" className="py-4 text-center text-slate-400">Nenhuma saída no período</td></tr>}
            </tbody>
          </table>
          {expenses.length > 15 && <p className="text-xs text-slate-400 mt-2 text-right">+ {expenses.length - 15} outras despesas ocultadas.</p>}
       </div>

       {/* Resumo de Dívidas */}
       <div className="mb-8">
          <h3 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4">Posição de Dívidas Ativas</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-2.5 font-semibold">Dívida / Credor</th>
                <th className="py-2.5 font-semibold text-right">Saldo Atual</th>
              </tr>
            </thead>
            <tbody>
               {debts.map(d => (
                 <tr key={d.id} className="border-b border-slate-100">
                    <td className="py-2.5">{d.nome_divida}</td>
                    <td className="py-2.5 text-right font-medium">{formatCurrency(d.saldo_atual)}</td>
                 </tr>
               ))}
               {debts.length === 0 && <tr><td colSpan="2" className="py-4 text-center text-slate-400">Sua família não possui dívidas pendentes. Parabéns!</td></tr>}
            </tbody>
          </table>
       </div>

       {/* Footer */}
       <div className="mt-12 pt-6 border-t border-slate-200 text-center text-slate-400 text-xs">
          <p>Relatório confidencial gerado automaticamente pelo sistema Freedom Gestão Financeira.</p>
          <p className="mt-1">Gerado em: {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p>
       </div>
    </div>
  );
}
