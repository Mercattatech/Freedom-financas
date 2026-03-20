import React from 'react';
import { Card } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

export default function ExpenseChart({ categories, expenses }) {
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getCategorySpent = (categoryId) => {
    return expenses
      .filter(e => e.category_id === categoryId)
      .reduce((sum, e) => sum + (e.valor || 0), 0);
  };

  const data = categories
    .map(cat => ({
      name: cat.nome,
      value: getCategorySpent(cat.id),
      color: cat.cor || '#10B981'
    }))
    .filter(d => d.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899'];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white px-4 py-2 shadow-lg rounded-lg border border-slate-100">
          <p className="text-sm font-medium text-slate-800">{payload[0].name}</p>
          <p className="text-sm text-slate-600">{formatCurrency(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  if (data.length === 0) {
    return (
      <Card className="p-6 border-0 shadow-sm">
        <h3 className="text-lg font-semibold text-slate-800 mb-6">Despesas por Categoria</h3>
        <div className="h-64 flex items-center justify-center">
          <p className="text-sm text-slate-500">Nenhuma despesa registrada</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6 border-0 shadow-sm">
      <h3 className="text-lg font-semibold text-slate-800 mb-6">Despesas por Categoria</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={4}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend
              layout="vertical"
              align="right"
              verticalAlign="middle"
              formatter={(value) => <span className="text-sm text-slate-600">{value}</span>}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}