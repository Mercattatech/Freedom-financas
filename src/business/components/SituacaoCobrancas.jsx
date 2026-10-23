import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Info, Users, FileText, ChevronRight, Calendar, SlidersHorizontal, RefreshCw, BarChart2, CheckCircle2 } from 'lucide-react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { toast } from 'sonner';
import { biz } from '../api';
import { useBiz, useBizQuery, useBizMutation } from '../BizContext';
import { money, pct, monthLong } from '../format';
import { cx } from './ui';

const STATUS_CONFIG = {
  recebidas: {
    key: 'recebidas',
    label: 'Recebidas',
    info: 'Cobranças com pagamento recebido e compensado na conta.',
    colorText: 'text-[#0E9F6E] dark:text-[#31C48D]',
    colorHex: '#0E9F6E',
    bgBar: 'bg-[#0E9F6E]',
    bgTrack: 'bg-emerald-100 dark:bg-emerald-950/40',
    linkSituacao: 'PAGO',
  },
  confirmadas: {
    key: 'confirmadas',
    label: 'Confirmadas',
    info: 'Cobranças confirmadas (cartão ou saldo), aguardando repasse/compensação.',
    colorText: 'text-[#1A56DB] dark:text-[#3F83F8]',
    colorHex: '#1A56DB',
    bgBar: 'bg-[#1A56DB]',
    bgTrack: 'bg-blue-100 dark:bg-blue-950/40',
    linkSituacao: 'CONFIRMADO',
  },
  aguardando: {
    key: 'aguardando',
    label: 'Aguardando pagamento',
    info: 'Cobranças emitidas com vencimento em aberto dentro do prazo.',
    colorText: 'text-[#D97706] dark:text-[#FBBF24]',
    colorHex: '#D97706',
    bgBar: 'bg-[#D97706]',
    bgTrack: 'bg-amber-100 dark:bg-amber-950/40',
    linkSituacao: 'A_VENCER',
  },
  vencidas: {
    key: 'vencidas',
    label: 'Vencidas',
    info: 'Cobranças cujo prazo de vencimento já expirou e ainda não foram pagas.',
    colorText: 'text-[#E02424] dark:text-[#F98080]',
    colorHex: '#E02424',
    bgBar: 'bg-[#E02424]',
    bgTrack: 'bg-rose-100 dark:bg-rose-950/40',
    linkSituacao: 'VENCIDO',
  },
};

export default function SituacaoCobrancas({ initialData, mes }) {
  const [versaoGrafico, setVersaoGrafico] = useState(false);
  const [periodo, setPeriodo] = useState('mes');
  const [forma, setForma] = useState('');
  const [filtroOpen, setFiltroOpen] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState(null);

  const { can } = useBiz();
  const write = can('financeiro:write');

  // Consulta atualizada quando filtros mudam
  const isDefaultQuery = periodo === 'mes' && !forma;
  const situacaoQ = useBizQuery('/reports/cobrancas-situacao', {
    ref: mes,
    periodo,
    forma_pagamento: forma || undefined,
  }, {
    enabled: !isDefaultQuery,
  });

  const data = (!isDefaultQuery && situacaoQ.data) ? situacaoQ.data : (initialData || {});

  // Mutação para sincronizar com Asaas
  const sync = useBizMutation(() => biz('/company/asaas/sync', { method: 'POST' }), {
    onSuccess: (res) => {
      toast.success('Cobranças do Asaas sincronizadas com sucesso!');
      situacaoQ.refetch();
    },
    onError: (err) => {
      toast.error(err.message || 'Erro ao sincronizar com Asaas');
    },
  });

  const r = data.recebidas || { valor: 0, liquido: 0, clientes: 0, cobrancas: 0, percentual: 0 };
  const c = data.confirmadas || { valor: 0, liquido: 0, clientes: 0, cobrancas: 0, percentual: 0 };
  const a = data.aguardando || { valor: 0, liquido: 0, clientes: 0, cobrancas: 0, percentual: 0 };
  const v = data.vencidas || { valor: 0, liquido: 0, clientes: 0, cobrancas: 0, percentual: 0 };
  const total = data.total || { valor: 0, liquido: 0, clientes: 0, cobrancas: 0 };

  const cards = [
    { config: STATUS_CONFIG.recebidas, ...r },
    { config: STATUS_CONFIG.confirmadas, ...c },
    { config: STATUS_CONFIG.aguardando, ...a },
    { config: STATUS_CONFIG.vencidas, ...v },
  ];

  // Dados para o gráfico em Donut
  const chartData = [
    { name: 'Recebidas', value: r.valor, liquido: r.liquido, color: STATUS_CONFIG.recebidas.colorHex, cobrancas: r.cobrancas },
    { name: 'Confirmadas', value: c.valor, liquido: c.liquido, color: STATUS_CONFIG.confirmadas.colorHex, cobrancas: c.cobrancas },
    { name: 'Aguardando', value: a.valor, liquido: a.liquido, color: STATUS_CONFIG.aguardando.colorHex, cobrancas: a.cobrancas },
    { name: 'Vencidas', value: v.valor, liquido: v.liquido, color: STATUS_CONFIG.vencidas.colorHex, cobrancas: v.cobrancas },
  ].filter((item) => item.value > 0);

  const periodoLabel = {
    mes: 'Este mês',
    mes_anterior: 'Mês anterior',
    '30d': 'Últimos 30 dias',
    ano: 'Este ano',
    todos: 'Todo o período',
  }[periodo] || 'Este mês';

  return (
    <section className="mb-6 rounded-2xl border border-[var(--line)] bg-[var(--surface)] p-5 shadow-sm transition-all">
      {/* Cabeçalho da Situação das Cobranças */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--line-2)]">
        <div className="flex items-center gap-3">
          <h2 className="text-lg xl:text-xl font-bold tracking-tight text-[var(--ink)]">
            Situação das cobranças
          </h2>
          {data.asaas_conectado && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Asaas Ativo
            </span>
          )}
        </div>

        {/* Controles: Versão gráfico, Filtro de Período, Filtros e Sincronização */}
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {/* Toggle Versão Gráfico */}
          <label className="flex items-center gap-2 cursor-pointer select-none font-medium text-[var(--ink-2)] hover:text-[var(--ink)]">
            <span className="text-xs sm:text-sm">Versão gráfico</span>
            <div className="relative inline-flex items-center">
              <input
                type="checkbox"
                checked={versaoGrafico}
                onChange={(e) => setVersaoGrafico(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600" />
            </div>
          </label>

          {/* Seletor de Período */}
          <div className="relative">
            <select
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              className="appearance-none h-9 pl-8 pr-7 text-xs sm:text-sm font-semibold rounded-lg border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] hover:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="mes">Este mês ({monthLong(mes)})</option>
              <option value="mes_anterior">Mês anterior</option>
              <option value="30d">Últimos 30 dias</option>
              <option value="ano">Este ano</option>
              <option value="todos">Todo o período</option>
            </select>
            <Calendar className="w-3.5 h-3.5 text-[var(--muted)] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <ChevronRight className="w-3.5 h-3.5 text-[var(--muted)] rotate-90 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Botão de Filtros Adicionais */}
          <div className="relative">
            <button
              onClick={() => setFiltroOpen(!filtroOpen)}
              className={cx(
                'h-9 px-3 text-xs sm:text-sm font-semibold rounded-lg border border-[var(--line)] bg-[var(--paper)] text-[var(--ink)] inline-flex items-center gap-1.5 transition hover:bg-[var(--line-2)]',
                forma && 'border-blue-500 text-blue-600 bg-blue-50/50'
              )}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{forma ? `Filtro: ${forma}` : 'Filtros'}</span>
            </button>

            {filtroOpen && (
              <div className="absolute right-0 mt-1 w-56 p-3 bg-[var(--surface)] border border-[var(--line)] rounded-xl shadow-xl z-20">
                <p className="text-xs font-bold text-[var(--muted)] uppercase tracking-wider mb-2">Forma de Pagamento</p>
                <div className="space-y-1">
                  {[
                    ['', 'Todas as formas'],
                    ['PIX', 'PIX'],
                    ['BOLETO', 'Boleto Bancário'],
                    ['CARTAO', 'Cartão de Crédito'],
                  ].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => { setForma(val); setFiltroOpen(false); }}
                      className={cx(
                        'w-full text-left px-2.5 py-1.5 text-xs rounded-md font-medium transition',
                        forma === val ? 'bg-blue-600 text-white' : 'hover:bg-[var(--paper)] text-[var(--ink)]'
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sincronizar Asaas com 1 clique */}
          {write && data.asaas_conectado && (
            <button
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
              title="Sincronizar cobranças com o Asaas agora"
              className="h-9 px-3 text-xs sm:text-sm font-semibold rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 inline-flex items-center gap-1.5 hover:bg-blue-100 transition disabled:opacity-50"
            >
              <RefreshCw className={cx('w-3.5 h-3.5', sync.isPending && 'animate-spin')} />
              <span className="hidden sm:inline">{sync.isPending ? 'Sincronizando…' : 'Sincronizar'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Painel Gráfico Opcional (Versão Gráfico) */}
      {versaoGrafico && (
        <div className="my-5 p-5 rounded-xl border border-[var(--line-2)] bg-[var(--paper)]">
          <div className="grid lg:grid-cols-[280px_1fr] items-center gap-6">
            {/* Gráfico Donut */}
            <div className="relative flex flex-col items-center justify-center">
              <div className="w-[220px] h-[200px]">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const p = payload[0];
                          return (
                            <div className="rounded-lg bg-[var(--surface)] border border-[var(--line)] p-2.5 shadow-lg text-xs">
                              <p className="font-bold flex items-center gap-1.5" style={{ color: p.payload.color }}>
                                <span className="w-2 h-2 rounded-full" style={{ background: p.payload.color }} />
                                {p.name}
                              </p>
                              <p className="font-semibold text-sm mt-1">{money(p.value)}</p>
                              <p className="text-[var(--muted)]">{money(p.payload.liquido)} líquido</p>
                              <p className="text-[var(--muted)] mt-0.5">{p.payload.cobrancas} cobrança(s)</p>
                            </div>
                          );
                        }}
                      />
                      <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={88}
                        paddingAngle={3}
                        stroke="none"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-[var(--muted)]">
                    Sem movimentações no período
                  </div>
                )}
              </div>
              {/* Centro do Donut */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--muted)]">Total</span>
                <span className="text-base font-extrabold num text-[var(--ink)]">{money(total.valor)}</span>
                <span className="text-[10px] text-[var(--muted)]">{money(total.liquido)} líq.</span>
              </div>
            </div>

            {/* Barras e Percentuais Comparativos */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1 border-b border-[var(--line-2)] text-xs text-[var(--muted)] font-semibold">
                <span>Status da Cobrança</span>
                <span>Participação / Valor Líquido</span>
              </div>
              {cards.map((card) => {
                const perc = total.valor > 0 ? (card.valor / total.valor) * 100 : 0;
                return (
                  <div key={card.config.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: card.config.colorHex }} />
                        {card.config.label}
                        <span className="text-[var(--muted)] font-normal">({card.cobrancas} cobranças)</span>
                      </span>
                      <span className="font-extrabold num">
                        {money(card.valor)} <span className="text-[var(--muted)] font-normal">({pct(perc)})</span>
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(perc, card.valor > 0 ? 3 : 0))}%`, background: card.config.colorHex }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Grid com os 4 Cards principais idênticos ao Asaas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4">
        {cards.map((card) => {
          const perc = total.valor > 0 ? (card.valor / total.valor) * 100 : 0;
          const isTooltipActive = activeTooltip === card.config.key;

          return (
            <div
              key={card.config.key}
              className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-5 relative flex flex-col justify-between hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-200"
            >
              <div>
                {/* Linha superior: Título e Ícone de Informação */}
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-[var(--ink-2)]">
                    {card.config.label}
                  </h3>
                  <div className="relative">
                    <button
                      type="button"
                      onMouseEnter={() => setActiveTooltip(card.config.key)}
                      onMouseLeave={() => setActiveTooltip(null)}
                      onClick={() => setActiveTooltip(isTooltipActive ? null : card.config.key)}
                      className="p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                      aria-label={`Informações sobre ${card.config.label}`}
                    >
                      <Info className="w-4 h-4" />
                    </button>
                    {isTooltipActive && (
                      <div className="absolute right-0 bottom-full mb-1.5 w-48 p-2.5 bg-slate-900 text-white text-[11px] rounded-lg shadow-xl z-30 leading-snug animate-in fade-in-0">
                        {card.config.info}
                      </div>
                    )}
                  </div>
                </div>

                {/* Valor Principal (Grande e em destaque na cor específica) */}
                <p className={cx('num text-[26px] xl:text-[28px] font-extrabold leading-tight mt-1.5', card.config.colorText)}>
                  {money(card.valor)}
                </p>

                {/* Subvalor: Valor Líquido */}
                <p className="text-xs text-[var(--muted)] font-medium mt-0.5">
                  <span className="num">{money(card.liquido)}</span> líquido
                </p>

                {/* Barra de Progresso com cor temática */}
                <div className={cx('w-full h-2 rounded-full overflow-hidden mt-3.5 mb-4', card.config.bgTrack)}>
                  <div
                    className={cx('h-full rounded-full transition-all duration-500 ease-out', card.config.bgBar)}
                    style={{ width: `${Math.min(100, Math.max(perc, card.valor > 0 ? 4 : 0))}%` }}
                    title={`${pct(perc)} do total faturado`}
                  />
                </div>
              </div>

              {/* Links e Métricas Inferiores com Chevron */}
              <div className="pt-2 border-t border-[var(--line-2)] space-y-1.5 text-xs">
                {/* Linha Clientes */}
                <Link
                  to={`/empresas/receber?situacao=${card.config.linkSituacao}`}
                  className="group flex items-center justify-between py-1 text-[var(--ink-2)] hover:text-blue-600 transition"
                >
                  <span className="flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-[var(--muted)] group-hover:text-blue-600 transition" />
                    <span className="font-semibold num group-hover:underline">
                      {card.clientes} {card.clientes === 1 ? 'cliente' : 'clientes'}
                    </span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--muted)] group-hover:text-blue-600 transition-transform group-hover:translate-x-0.5" />
                </Link>

                {/* Linha Cobranças */}
                <Link
                  to={`/empresas/receber?situacao=${card.config.linkSituacao}`}
                  className="group flex items-center justify-between py-1 text-[var(--ink-2)] hover:text-blue-600 transition"
                >
                  <span className="flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[var(--muted)] group-hover:text-blue-600 transition" />
                    <span className="font-semibold num group-hover:underline">
                      {card.cobrancas} {card.cobrancas === 1 ? 'cobrança' : 'cobranças'}
                    </span>
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--muted)] group-hover:text-blue-600 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dica/Aviso quando não há cobranças cadastradas */}
      {total.cobrancas === 0 && (
        <div className="mt-4 p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-blue-800 dark:text-blue-300">
          <p>
            <b>Nenhuma cobrança registrada neste período.</b> Você pode emitir cobranças em <b>Contas a receber</b> ou conectar sua conta do Asaas em <b>Configurações › Asaas</b>.
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              to="/empresas/receber"
              className="font-semibold underline hover:text-blue-900 dark:hover:text-blue-100"
            >
              Criar cobrança
            </Link>
            <span>·</span>
            <Link
              to="/empresas/configuracoes"
              className="font-semibold underline hover:text-blue-900 dark:hover:text-blue-100"
            >
              Configurar Asaas
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}
