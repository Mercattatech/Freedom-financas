import React from 'react';
import { ResponsiveContainer, ComposedChart, BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, Cell, Legend } from 'recharts';
import { money, moneyShort, monthLabel, date } from '../format';

const C = { in: 'var(--in)', out: 'var(--out)', result: 'var(--result)', grid: 'var(--line-2)', axis: 'var(--muted)' };
const axisProps = { tick: { fill: 'var(--muted)', fontSize: 12 }, axisLine: false, tickLine: false };

function Tip({ active, payload, label, labelFmt = (l) => l }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="biz rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 shadow-lg text-[13px]">
      <p className="font-bold mb-1">{labelFmt(label)}</p>
      {payload.filter((p) => p.value !== undefined && p.dataKey !== 'base').map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-6">
          <span className="flex items-center gap-1.5 text-[var(--ink-2)]"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />{p.name}</span>
          <span className="num font-semibold">{money(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

const legendFmt = (v) => <span style={{ color: 'var(--ink-2)', fontSize: 12.5 }}>{v}</span>;

export function TrendChart({ data, height = 280 }) {
  const rows = data.map((d) => ({ ...d, despesasNeg: d.despesas }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 4, bottom: 0 }} barGap={2}>
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="mes" tickFormatter={monthLabel} {...axisProps} />
        <YAxis tickFormatter={moneyShort} width={88} {...axisProps} />
        <Tooltip content={<Tip labelFmt={monthLabel} />} cursor={{ fill: 'var(--line-2)' }} />
        <Legend iconType="square" iconSize={10} formatter={legendFmt} />
        <ReferenceLine y={0} stroke="var(--line)" />
        <Bar dataKey="receita" name="Receita" fill={C.in} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Bar dataKey="despesas" name="Custos e despesas" fill={C.out} radius={[4, 4, 0, 0]} maxBarSize={22} />
        <Line dataKey="resultado" name="Resultado" stroke={C.result} strokeWidth={2} dot={{ r: 4, fill: C.result, stroke: 'var(--surface)', strokeWidth: 2 }} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function CashflowChart({ data, height = 280 }) {
  const rows = data.map((d) => ({ ...d, saidasNeg: -d.saidas }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 4, bottom: 0 }} stackOffset="sign">
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="periodo" tickFormatter={(v) => (v.length === 7 ? monthLabel(v) : date(v).slice(0, 5))} {...axisProps} />
        <YAxis tickFormatter={moneyShort} width={88} {...axisProps} />
        <Tooltip content={<Tip labelFmt={(v) => (v.length === 7 ? monthLabel(v) : `Semana de ${date(v)}`)} />} cursor={{ fill: 'var(--line-2)' }} />
        <Legend iconType="square" iconSize={10} formatter={legendFmt} />
        <ReferenceLine y={0} stroke="var(--ink-2)" strokeDasharray="3 3" />
        <Bar dataKey="entradas" name="Entradas" fill={C.in} radius={[4, 4, 0, 0]} maxBarSize={20} />
        <Bar dataKey="saidasNeg" name="Saídas" fill={C.out} radius={[0, 0, 4, 4]} maxBarSize={20} />
        <Line dataKey="saldo" name="Saldo projetado" stroke={C.result} strokeWidth={2} dot={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

// Cascata do resultado: da receita bruta ao lucro líquido
export function Waterfall({ steps, height = 260 }) {
  let acc = 0;
  const rows = steps.map((s) => {
    if (s.total) return { etapa: s.etapa, base: 0, valor: s.valor, tipo: s.valor >= 0 ? 'total' : 'neg' };
    const start = acc;
    acc += s.valor;
    return { etapa: s.etapa, base: Math.min(start, acc), valor: Math.abs(s.valor), real: s.valor, tipo: s.valor >= 0 ? 'pos' : 'neg' };
  }).filter((r, i) => i === 0 || r.valor !== 0 || steps[i].total);
  const color = { pos: C.in, neg: C.out, total: C.result };
  const narrow = typeof window !== 'undefined' && window.innerWidth < 760;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="etapa" {...axisProps} interval={0} tick={{ fill: 'var(--muted)', fontSize: 11.5 }} {...(narrow && { angle: -40, textAnchor: 'end', height: 72 })} />
        <YAxis tickFormatter={moneyShort} width={88} {...axisProps} />
        <Tooltip cursor={{ fill: 'var(--line-2)' }} content={({ active, payload }) => {
          if (!active || !payload?.length) return null;
          const r = payload[0].payload;
          return <div className="biz rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 shadow-lg text-[13px]"><p className="font-bold">{r.etapa}</p><p className="num">{money(r.real ?? r.valor)}</p></div>;
        }} />
        <Bar dataKey="base" stackId="w" fill="transparent" isAnimationActive={false} />
        <Bar dataKey="valor" stackId="w" radius={[4, 4, 4, 4]} maxBarSize={44}>
          {rows.map((r) => <Cell key={r.etapa} fill={color[r.tipo]} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
