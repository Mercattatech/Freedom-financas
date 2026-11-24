import React, { useEffect, useMemo, useState } from 'react';
import {
  PiggyBank, Plus, ArrowUpCircle, ArrowDownCircle, Pencil, Trash2, TrendingUp, ShieldCheck,
  AlertTriangle, Landmark, Calculator, Sparkles,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts';
import { biz } from '../api';
import { useBiz, useBizQuery, useBizMutation } from '../BizContext';
import { PageHeader, Panel, Kpi, InfoTip, Button, Field, Input, Select, Textarea, MoneyInput, Modal, Money, Empty, Loading, ErrorBox, cx } from '../components/ui';
import { useLookups } from '../components/lookups';
import { money, pct, date, todayYmd } from '../format';

const COLORS = ['#10B981', '#3B82F6', '#6366F1', '#F59E0B', '#EC4899', '#14B8A6', '#8B5CF6'];

const SAUDE_CFG = {
  EXCELENTE: { label: 'Saúde Excelente (6+ meses)', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800', icon: ShieldCheck },
  SAUDAVEL: { label: 'Saúde Boa (3 a 6 meses)', cls: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800', icon: ShieldCheck },
  ATENCAO: { label: 'Atenção (1 a 3 meses)', cls: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800', icon: AlertTriangle },
  CRITICO: { label: 'Reserva Crítica (< 1 mês)', cls: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800', icon: AlertTriangle },
  EM_CONSTRUCAO: { label: 'Em construção', cls: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700', icon: PiggyBank },
};

// Simulação de juros compostos mês a mês
function simulateCompound({ inicial, aporteMensal, taxaPercent, modoTaxa, meses, meta }) {
  const n = Math.max(1, Math.min(360, Number(meses) || 12));
  const v0 = Math.max(0, Number(inicial) || 0);
  const pmt = Math.max(0, Number(aporteMensal) || 0);
  const rawRate = Math.max(0, Number(taxaPercent) || 0) / 100;
  // Se o usuário informar % ao ano, converte para taxa mensal equivalente: (1 + r_anual)^(1/12) - 1
  const rMes = modoTaxa === 'ANUAL' ? Math.pow(1 + rawRate, 1 / 12) - 1 : rawRate;
  const taxaAnualEq = (Math.pow(1 + rMes, 12) - 1) * 100;

  let saldo = v0;
  let investido = v0;
  let mesBateMeta = meta > 0 && saldo >= meta ? 0 : null;
  const serie = [{ mes: 0, label: 'Hoje', saldo: Math.round(saldo * 100) / 100, investido: Math.round(investido * 100) / 100, juros: 0 }];

  for (let m = 1; m <= n; m++) {
    saldo = saldo * (1 + rMes) + pmt;
    investido += pmt;
    if (mesBateMeta === null && meta > 0 && saldo >= meta) mesBateMeta = m;
    serie.push({
      mes: m,
      label: m % 12 === 0 ? `${m / 12}a` : `${m}m`,
      saldo: Math.round(saldo * 100) / 100,
      investido: Math.round(investido * 100) / 100,
      juros: Math.round((saldo - investido) * 100) / 100,
    });
  }

  return {
    serie,
    saldoFinal: Math.round(saldo * 100) / 100,
    totalInvestido: Math.round(investido * 100) / 100,
    totalJuros: Math.round((saldo - investido) * 100) / 100,
    taxaMensalEq: Math.round(rMes * 10000) / 100,
    taxaAnualEq: Math.round(taxaAnualEq * 100) / 100,
    mesBateMeta,
  };
}

export default function CashGoals() {
  const { can } = useBiz();
  const write = can('financeiro:write');
  const q = useBizQuery('/cash-goals');
  const [goalModal, setGoalModal] = useState(null); // null | {} | goal
  const [entryModal, setEntryModal] = useState(null); // null | { goal, tipo }
  const [selectedId, setSelectedId] = useState('ALL');

  const delGoal = useBizMutation((id) => biz(`/cash-goals/${id}`, { method: 'DELETE' }), { success: 'Caixa/meta removido' });
  const delEntry = useBizMutation((id) => biz(`/cash-goals/entries/${id}`, { method: 'DELETE' }), { success: 'Lançamento removido' });

  const items = q.data?.items || [];
  const resumo = q.data?.resumo;
  const selectedGoal = selectedId === 'ALL' ? null : items.find((g) => g.id === selectedId) || null;

  // Estado do simulador de juros compostos
  const [sim, setSim] = useState({ inicial: 0, aporteMensal: 0, taxaPercent: 0.95, modoTaxa: 'MENSAL', meses: 24, meta: 0 });

  useEffect(() => {
    if (!q.data) return;
    if (selectedGoal) {
      setSim((prev) => ({
        ...prev,
        inicial: selectedGoal.saldo,
        aporteMensal: selectedGoal.aporte_mensal,
        taxaPercent: selectedGoal.taxa_mensal_percent ?? 0.95,
        modoTaxa: 'MENSAL',
        meses: selectedGoal.prazo_meses || 24,
        meta: selectedGoal.valor_meta,
      }));
    } else {
      const avgTaxa = items.length ? Math.round((items.reduce((s, g) => s + Number(g.taxa_mensal_percent || 0), 0) / items.length) * 100) / 100 : 0.95;
      setSim((prev) => ({
        ...prev,
        inicial: resumo?.total_acumulado || 0,
        aporteMensal: resumo?.total_aporte_mensal || 0,
        taxaPercent: avgTaxa || 0.95,
        modoTaxa: 'MENSAL',
        meses: 24,
        meta: resumo?.total_metas || 0,
      }));
    }
  }, [q.data, selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const proj = useMemo(() => simulateCompound(sim), [sim]);

  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;

  const saudeCfg = SAUDE_CFG[resumo.saude] || SAUDE_CFG.EM_CONSTRUCAO;
  const SaudeIcon = saudeCfg.icon;
  const allEntries = (selectedGoal ? selectedGoal.lancamentos.map((e) => ({ ...e, goal_nome: selectedGoal.nome, goal_cor: selectedGoal.cor })) : items.flatMap((g) => g.lancamentos.map((e) => ({ ...e, goal_nome: g.nome, goal_cor: g.cor }))))
    .sort((a, b) => new Date(b.data) - new Date(a.data));

  return (
    <>
      <PageHeader
        title="Meta de Caixa & Reservas"
        subtitle="Defina a meta de caixa da empresa, direcione aportes para cada reserva, acompanhe a saúde financeira e simule juros compostos."
        actions={write && <Button icon={Plus} onClick={() => setGoalModal({})}>Nova meta de caixa</Button>}
      >
        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className={cx('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border', saudeCfg.cls)}>
            <SaudeIcon className="w-3.5 h-3.5" />
            {saudeCfg.label}
          </span>
          {resumo.meses_folego != null && (
            <span className="text-xs text-[var(--muted)] inline-flex items-center gap-1">
              Fôlego estimado: <b className="text-[var(--ink)] num">{resumo.meses_folego} meses</b> de operação (despesa média {money(resumo.despesa_mensal_media)}/mês)
              <InfoTip title="Fôlego de caixa (Runway)" text="Quantos meses a empresa consegue se manter usando apenas o valor acumulado nas metas de caixa." formula="Total acumulado nas reservas ÷ Despesa mensal média dos últimos 90 dias." />
            </span>
          )}
        </div>
      </PageHeader>

      {/* KPIs Consolidados */}
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] grid grid-cols-2 lg:grid-cols-4 divide-x divide-y lg:divide-y-0 divide-[var(--line-2)] mb-6">
        {[
          <Kpi key="ac" label="Total acumulado em caixa" value={money(resumo.total_acumulado)} tone="in" detail={`${pct(resumo.progresso_percent)} da meta geral`} help={{ title: 'Total acumulado em caixa', text: 'Soma de todos os aportes menos resgates direcionados para os caixas/reservas da empresa.', formula: 'Σ Aportes − Σ Resgates de todos os caixas ativos.' }} />,
          <Kpi key="mt" label="Meta total de caixa" value={money(resumo.total_metas)} detail={resumo.total_metas > resumo.total_acumulado ? `Faltam ${money(resumo.total_metas - resumo.total_acumulado)}` : 'Meta atingida!'} help={{ title: 'Meta total de caixa', text: 'Soma das metas definidas em todos os caixas de reserva da empresa.', formula: 'Σ Valor da meta de cada caixa.' }} />,
          <Kpi key="ap" label="Aporte mensal planejado" value={money(resumo.total_aporte_mensal)} detail={`${items.length} caixa(s) cadastrado(s)`} help={{ title: 'Aporte mensal planejado', text: 'Valor que a empresa planeja direcionar todo mês para construir suas reservas.', formula: 'Σ Aporte mensal configurado em cada caixa.' }} />,
          <Kpi key="fl" label="Saúde / Fôlego de caixa" value={resumo.meses_folego != null ? `${resumo.meses_folego} meses` : pct(resumo.progresso_percent)} tone={resumo.saude === 'CRITICO' ? 'bad' : resumo.saude === 'EXCELENTE' ? 'in' : undefined} detail={resumo.despesa_mensal_media > 0 ? `Base: ${money(resumo.despesa_mensal_media)}/mês` : 'Evolução das metas'} help={{ title: 'Saúde / Fôlego de caixa', text: 'Indica quantos meses de despesas fixas e operacionais a reserva atual cobre sem depender de novas entradas.', formula: 'Total acumulado ÷ Média mensal de despesas dos últimos 90 dias.' }} />,
        ].map((k, i) => <div key={i} className="px-5 py-4">{k}</div>)}
      </div>

      {/* Lista de Caixas / Metas */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[16px] font-bold">Caixas e Metas da Empresa</h2>
          {items.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedId('ALL')}
              className={cx('text-xs font-semibold px-2.5 py-1 rounded-lg border transition', selectedId === 'ALL' ? 'bg-[var(--ink)] text-[var(--surface)] border-[var(--ink)]' : 'border-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]')}
            >
              Simular consolidado (todos)
            </button>
          )}
        </div>

        {!items.length ? (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)]">
            <Empty
              icon={PiggyBank}
              title="Nenhuma meta de caixa cadastrada"
              text="Crie seu primeiro caixa (ex.: Reserva de Emergência, Caixa de Expansão ou CDB) para acompanhar a evolução e simular juros compostos."
              action={write && <Button icon={Plus} onClick={() => setGoalModal({})}>Criar primeira meta de caixa</Button>}
            />
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {items.map((g) => {
              const barPct = Math.min(100, Math.max(0, g.progresso_percent));
              const isSelected = selectedId === g.id;
              return (
                <div
                  key={g.id}
                  onClick={() => setSelectedId(g.id)}
                  className={cx(
                    'rounded-xl border bg-[var(--surface)] p-5 cursor-pointer transition space-y-4',
                    isSelected ? 'border-[var(--result)] ring-2 ring-[var(--result-soft)]' : 'border-[var(--line)] hover:border-slate-400',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: g.cor }} />
                      <div className="min-w-0">
                        <h3 className="font-bold text-[15px] truncate">{g.nome}</h3>
                        {g.bank_name && <p className="text-xs text-[var(--muted)] inline-flex items-center gap-1"><Landmark className="w-3 h-3" /> {g.bank_name}</p>}
                      </div>
                    </div>
                    {write && (
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => setGoalModal(g)} className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--paper)]" title="Editar meta"><Pencil className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => window.confirm(`Excluir o caixa "${g.nome}" e seus lançamentos?`) && delGoal.mutate(g.id)} className="p-1.5 rounded-lg text-[var(--muted)] hover:text-[var(--bad)] hover:bg-[var(--bad-soft)]" title="Excluir"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="num text-2xl font-extrabold text-[var(--in)]">{money(g.saldo)}</span>
                      <span className="text-xs text-[var(--muted)] num">meta {money(g.valor_meta)}</span>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-[var(--line-2)] overflow-hidden mt-2">
                      <div className="h-full rounded-full transition-all" style={{ width: `${barPct}%`, background: g.cor }} />
                    </div>
                    <div className="flex justify-between text-xs text-[var(--muted)] mt-1.5">
                      <span className="font-semibold text-[var(--ink-2)] num">{pct(g.progresso_percent)} atingido</span>
                      <span>{g.faltante > 0 ? `Falta ${money(g.faltante)}` : 'Meta batida!'}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)] pt-2 border-t border-[var(--line-2)]">
                    <span>Aporte: <b className="text-[var(--ink)] num">{money(g.aporte_mensal)}/mês</b></span>
                    <span>Taxa: <b className="text-[var(--ink)] num">{String(g.taxa_mensal_percent).replace('.', ',')}% a.m.</b></span>
                  </div>

                  {write && (
                    <div className="grid grid-cols-2 gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="success" icon={ArrowUpCircle} onClick={() => setEntryModal({ goal: g, tipo: 'APORTE' })}>Direcionar</Button>
                      <Button size="sm" variant="secondary" icon={ArrowDownCircle} onClick={() => setEntryModal({ goal: g, tipo: 'RESGATE' })}>Resgatar</Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Simulador de Juros Compostos */}
      <Panel
        title={
          <span className="inline-flex items-center gap-2">
            <Calculator className="w-4 h-4 text-[var(--result)]" />
            Simulador de Investimento com Juros Compostos
            <span className="text-xs font-normal text-[var(--muted)]">
              ({selectedGoal ? selectedGoal.nome : 'Consolidado da empresa'})
            </span>
            <InfoTip
              title="Simulador de Juros Compostos"
              text="Projeta o crescimento do caixa da empresa somando aportes mensais regulares com rendimento composto."
              formula="Saldo(mês) = Saldo(mês anterior) × (1 + taxa mensal) + Aporte mensal."
            />
          </span>
        }
        className="mb-6"
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-5 pt-2">
          <Field label="Valor inicial no caixa (R$)">
            <MoneyInput value={sim.inicial} onChange={(v) => setSim({ ...sim, inicial: v })} />
          </Field>
          <Field label="Aporte mensal (R$)">
            <MoneyInput value={sim.aporteMensal} onChange={(v) => setSim({ ...sim, aporteMensal: v })} />
          </Field>
          <Field label="Rendimento (%)" hint={sim.modoTaxa === 'MENSAL' ? `Equivale a ${pct(proj.taxaAnualEq)} ao ano` : `Equivale a ${pct(proj.taxaMensalEq)} ao mês`}>
            <div className="flex gap-1.5">
              <Input type="number" step="0.01" min="0" value={sim.taxaPercent} onChange={(e) => setSim({ ...sim, taxaPercent: e.target.value })} className="num" />
              <Select value={sim.modoTaxa} onChange={(e) => setSim({ ...sim, modoTaxa: e.target.value })} className="w-[88px] shrink-0 px-2">
                <option value="MENSAL">% a.m.</option>
                <option value="ANUAL">% a.a.</option>
              </Select>
            </div>
          </Field>
          <Field label="Prazo (meses)">
            <Input type="number" min="1" max="360" value={sim.meses} onChange={(e) => setSim({ ...sim, meses: e.target.value })} className="num" />
          </Field>
          <Field label="Meta alvo (R$)">
            <MoneyInput value={sim.meta} onChange={(v) => setSim({ ...sim, meta: v })} />
          </Field>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3.5">
            <p className="text-xs text-[var(--muted)] font-semibold">Total aportado (do bolso)</p>
            <p className="num text-lg font-extrabold mt-0.5">{money(proj.totalInvestido)}</p>
          </div>
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/30 p-3.5">
            <p className="text-xs text-emerald-800 dark:text-emerald-300 font-semibold">Juros compostos ganhos</p>
            <p className="num text-lg font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">+{money(proj.totalJuros)}</p>
          </div>
          <div className="rounded-xl border border-[var(--result)]/40 bg-[var(--result-soft)] p-3.5">
            <p className="text-xs text-[var(--result)] font-semibold">Saldo final em {sim.meses} meses</p>
            <p className="num text-xl font-extrabold text-[var(--result)] mt-0.5">{money(proj.saldoFinal)}</p>
          </div>
          <div className="rounded-xl border border-[var(--line)] bg-[var(--paper)] p-3.5">
            <p className="text-xs text-[var(--muted)] font-semibold">Previsão para bater a meta</p>
            <p className="num text-lg font-extrabold mt-0.5">
              {!(Number(sim.meta) > 0) ? '—' : proj.mesBateMeta === 0 ? 'Já atingida!' : proj.mesBateMeta ? `Em ${proj.mesBateMeta} meses` : `> ${sim.meses} meses`}
            </p>
          </div>
        </div>

        <div className="h-[290px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={proj.serie} margin={{ top: 10, right: 16, left: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="gradSaldo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradInv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366F1" stopOpacity={0.22} />
                  <stop offset="95%" stopColor="#6366F1" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--line-2)" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--muted)' }} />
              <YAxis tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : v)} tick={{ fontSize: 11, fill: 'var(--muted)' }} width={56} />
              <Tooltip
                formatter={(val, name) => [money(val), name === 'saldo' ? 'Saldo com juros compostos' : 'Total aportado']}
                labelFormatter={(l, p) => `Mês ${p?.[0]?.payload?.mes ?? l}`}
                contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 10, fontSize: 12 }}
              />
              {Number(sim.meta) > 0 && <ReferenceLine y={Number(sim.meta)} stroke="#F59E0B" strokeDasharray="5 5" label={{ value: `Meta ${money(sim.meta)}`, position: 'insideTopRight', fill: '#D97706', fontSize: 11 }} />}
              <Area type="monotone" dataKey="investido" stroke="#6366F1" strokeWidth={2} fill="url(#gradInv)" />
              <Area type="monotone" dataKey="saldo" stroke="#10B981" strokeWidth={2.5} fill="url(#gradSaldo)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* Histórico de Lançamentos */}
      <Panel title={`Histórico de direcionamentos ${selectedGoal ? `— ${selectedGoal.nome}` : '(todos os caixas)'}`} pad={false}>
        {!allEntries.length ? (
          <p className="text-sm text-[var(--muted)] px-5 pb-5">Nenhum aporte ou resgate registrado ainda. Clique em "Direcionar" em um caixa para começar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Caixa</th>
                  <th>Tipo</th>
                  <th>Conta / Banco</th>
                  <th>Observações</th>
                  <th className="r">Valor</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {allEntries.map((e) => (
                  <tr key={e.id}>
                    <td className="num whitespace-nowrap">{date(e.data)}</td>
                    <td>
                      <span className="inline-flex items-center gap-2 font-semibold">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: e.goal_cor }} />
                        {e.goal_nome}
                      </span>
                    </td>
                    <td>
                      <span className={cx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold', e.tipo === 'APORTE' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300' : 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300')}>
                        {e.tipo === 'APORTE' ? 'Aporte' : 'Resgate'}
                      </span>
                    </td>
                    <td className="text-sm text-[var(--muted)]">{e.bank_name || '—'}</td>
                    <td className="text-sm text-[var(--ink-2)]">{e.observacoes || '—'}</td>
                    <td className="r font-bold"><Money value={e.tipo === 'APORTE' ? e.valor : -e.valor} colored sign /></td>
                    <td className="r">
                      {write && (
                        <button type="button" onClick={() => window.confirm('Excluir este lançamento?') && delEntry.mutate(e.id)} className="p-1 text-[var(--muted)] hover:text-[var(--bad)]" title="Excluir">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {goalModal && <GoalModal initial={goalModal} onClose={() => setGoalModal(null)} />}
      {entryModal && <EntryModal goal={entryModal.goal} tipoInicial={entryModal.tipo} onClose={() => setEntryModal(null)} />}
    </>
  );
}

function GoalModal({ initial, onClose }) {
  const L = useLookups();
  const isNew = !initial.id;
  const [f, setF] = useState({
    nome: initial.nome || '',
    descricao: initial.descricao || '',
    valor_meta: initial.valor_meta ?? '',
    aporte_mensal: initial.aporte_mensal ?? '',
    saldo_inicial: '',
    taxa_mensal_percent: initial.taxa_mensal_percent ?? 0.95,
    prazo_meses: initial.prazo_meses || 24,
    bank_account_id: initial.bank_account_id || '',
    cor: initial.cor || COLORS[0],
  });
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? e.target.value : e });
  const save = useBizMutation(
    (body) => (isNew ? biz('/cash-goals', { method: 'POST', body }) : biz(`/cash-goals/${initial.id}`, { method: 'PUT', body })),
    { success: isNew ? 'Meta de caixa criada' : 'Meta atualizada', onSuccess: onClose },
  );
  return (
    <Modal
      open
      onClose={onClose}
      title={isNew ? 'Nova meta de caixa' : 'Editar meta de caixa'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" form="cgform" loading={save.isPending}>Salvar</Button></>}
    >
      <form id="cgform" onSubmit={(e) => { e.preventDefault(); save.mutate(f); }} className="grid sm:grid-cols-2 gap-4">
        <Field label="Nome do caixa / reserva" className="sm:col-span-2">
          <Input required value={f.nome} onChange={set('nome')} placeholder="Ex.: Reserva de Emergência (6 meses), Caixa CDB, Expansão…" />
        </Field>
        <Field label="Valor da meta (R$)"><MoneyInput required value={f.valor_meta} onChange={set('valor_meta')} /></Field>
        <Field label="Aporte mensal planejado (R$)"><MoneyInput value={f.aporte_mensal} onChange={set('aporte_mensal')} /></Field>
        <Field label="Rendimento estimado (% ao mês)" hint="Usado na simulação de juros compostos"><Input type="number" step="0.01" min="0" value={f.taxa_mensal_percent} onChange={set('taxa_mensal_percent')} /></Field>
        <Field label="Horizonte (meses)"><Input type="number" min="1" max="360" value={f.prazo_meses} onChange={set('prazo_meses')} /></Field>
        {isNew && <Field label="Saldo já existente nesse caixa (opcional)"><MoneyInput value={f.saldo_inicial} onChange={set('saldo_inicial')} placeholder="0,00" /></Field>}
        <Field label="Conta / banco de destino (opcional)" className={isNew ? '' : 'sm:col-span-2'}>
          <Select value={f.bank_account_id} onChange={set('bank_account_id')}>
            <option value="">Nenhum banco específico</option>
            {L.banks.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
          </Select>
        </Field>
        <Field label="Cor do caixa" className="sm:col-span-2">
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setF({ ...f, cor: c })} className={cx('w-7 h-7 rounded-full transition', f.cor === c && 'ring-2 ring-offset-2 ring-[var(--ink)]')} style={{ background: c }} />
            ))}
          </div>
        </Field>
        <Field label="Descrição / objetivo (opcional)" className="sm:col-span-2">
          <Textarea rows={2} value={f.descricao} onChange={set('descricao')} placeholder="Ex.: Cobrir 6 meses de custos fixos em CDB liquidez diária." />
        </Field>
      </form>
    </Modal>
  );
}

function EntryModal({ goal, tipoInicial = 'APORTE', onClose }) {
  const L = useLookups();
  const [f, setF] = useState({
    tipo: tipoInicial,
    valor: tipoInicial === 'APORTE' && goal.aporte_mensal > 0 ? goal.aporte_mensal : '',
    data: todayYmd(),
    bank_account_id: goal.bank_account_id || '',
    observacoes: '',
  });
  const save = useBizMutation((body) => biz(`/cash-goals/${goal.id}/entries`, { method: 'POST', body }), {
    success: f.tipo === 'APORTE' ? 'Valor direcionado para o caixa!' : 'Resgate registrado!',
    onSuccess: onClose,
  });
  return (
    <Modal
      open
      onClose={onClose}
      title={f.tipo === 'APORTE' ? `Direcionar valor — ${goal.nome}` : `Resgatar valor — ${goal.nome}`}
      description={`Saldo atual neste caixa: ${money(goal.saldo)} · Meta: ${money(goal.valor_meta)}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" form="cgeform" variant={f.tipo === 'APORTE' ? 'success' : 'primary'} loading={save.isPending}>{f.tipo === 'APORTE' ? 'Confirmar aporte' : 'Confirmar resgate'}</Button></>}
    >
      <form id="cgeform" onSubmit={(e) => { e.preventDefault(); save.mutate(f); }} className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 inline-flex rounded-lg border border-[var(--line)] p-0.5 w-fit">
          {[['APORTE', 'Aporte (direcionar)'], ['RESGATE', 'Resgate (retirar)']].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setF({ ...f, tipo: k })} className={cx('px-4 h-9 rounded-md text-sm font-semibold', f.tipo === k ? 'bg-[var(--ink)] text-[var(--surface)]' : 'text-[var(--ink-2)]')}>{l}</button>
          ))}
        </div>
        <Field label="Valor (R$)"><MoneyInput required value={f.valor} onChange={(v) => setF({ ...f, valor: v })} /></Field>
        <Field label="Data"><Input type="date" required value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Field>
        <Field label="Conta / banco" className="sm:col-span-2">
          <Select value={f.bank_account_id} onChange={(e) => setF({ ...f, bank_account_id: e.target.value })}>
            <option value="">Não informado</option>
            {L.banks.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
          </Select>
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <Input value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} placeholder="Ex.: Lucro líquido do mês, transferência para CDB 100% CDI…" />
        </Field>
      </form>
    </Modal>
  );
}
