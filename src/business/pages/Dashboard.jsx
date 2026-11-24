import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, TrendingUp, Package, CalendarClock, FileSignature, Wallet, RefreshCw, Settings, Trophy, Eye, EyeOff } from 'lucide-react';
import { useBizQuery } from '../BizContext';
import { PageHeader, Panel, MonthPicker, Kpi, InfoTip, Loading, ErrorBox, MarginRuler, Money, cx } from '../components/ui';
import { TrendChart, Waterfall } from '../components/Charts';
import SituacaoCobrancas from '../components/SituacaoCobrancas';
import { money, pct, currentYm, monthLong, date } from '../format';

export default function Dashboard() {
  const [mes, setMes] = useState(currentYm());
  const dash = useBizQuery('/reports/dashboard', { ref: mes });
  const ag = useBizQuery('/reports/agency-margin', { from: mes });
  const asaasBal = useBizQuery('/company/asaas/balance', {}, { staleTime: 30_000 });
  if (dash.isLoading || ag.isLoading) return <Loading />;
  if (dash.error) return <ErrorBox error={dash.error} />;
  const d = dash.data;
  const a = ag.data;
  const r = d.resultado_mes;
  const s = d.assinaturas;
  const cx2 = d.caixa;
  const asaas = d.asaas || {};
  const balData = asaasBal.data || {};
  const temAsaas = balData.conectado || asaas.conectado || d.situacao_cobrancas?.asaas_conectado;
  const asaasConfigurado = balData.configurado ?? temAsaas;
  const asaasAmbiente = balData.ambiente || asaas.ambiente;
  const saldoAsaas = balData.saldo ?? cx2.saldo_asaas ?? d.situacao_cobrancas?.asaas_saldo;

  return (
    <>
      <PageHeader title="Visão geral" subtitle={`Resultado por competência de ${monthLong(mes).toLowerCase()}. Caixa e vencimentos são de hoje.`} actions={<MonthPicker value={mes} onChange={setMes} />} />

      {/* Saldo atual da conta Asaas em destaque */}
      <section className="mb-5 rounded-2xl border border-emerald-500/30 bg-gradient-to-r from-emerald-50/90 via-white to-teal-50/70 dark:from-emerald-950/40 dark:via-[var(--surface)] dark:to-teal-950/30 p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-800 dark:text-emerald-300">Saldo atual da conta Asaas</span>
              {temAsaas && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  {asaasAmbiente === 'PRODUCAO' ? 'Produção' : 'Sandbox'}
                </span>
              )}
            </div>
            {asaasBal.isLoading && saldoAsaas == null ? (
              <p className="text-sm text-[var(--muted)] mt-0.5">Consultando saldo no Asaas…</p>
            ) : temAsaas ? (
              <p className="num text-2xl sm:text-3xl font-extrabold text-emerald-700 dark:text-emerald-300 leading-tight mt-0.5">
                {saldoAsaas != null ? money(saldoAsaas) : 'R$ 0,00'}
              </p>
            ) : asaasConfigurado && balData.erro ? (
              <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">Falha ao consultar Asaas: {balData.erro}</p>
            ) : (
              <p className="text-sm text-[var(--muted)] mt-0.5">Conta Asaas ainda não conectada nesta empresa.</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {asaasConfigurado && (
            <button
              type="button"
              onClick={() => { asaasBal.refetch(); dash.refetch(); }}
              disabled={asaasBal.isFetching}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-[var(--surface)] text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition disabled:opacity-50"
            >
              <RefreshCw className={cx('w-3.5 h-3.5', asaasBal.isFetching && 'animate-spin')} />
              Atualizar saldo
            </button>
          )}
          <Link
            to="/empresas/configuracoes?aba=asaas"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border border-[var(--line)] bg-white dark:bg-[var(--surface)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:border-emerald-400 transition"
          >
            <Settings className="w-3.5 h-3.5" />
            {temAsaas ? 'Configurar Asaas' : 'Conectar Asaas'}
          </Link>
        </div>
      </section>

      {/* Situação das cobranças (Visão Asaas) */}
      <SituacaoCobrancas initialData={d.situacao_cobrancas} mes={mes} onRefresh={() => { asaasBal.refetch(); dash.refetch(); }} />

      <div className="grid xl:grid-cols-[1fr_340px] gap-5 mb-5">
        <Panel title="Do faturamento ao lucro" action={<Link to="/empresas/relatorios" className="text-sm font-semibold text-[var(--result)]">Ver DRE completa</Link>}>
          {a?.cascata && r.receita_bruta ? <Waterfall steps={a.cascata} height={330} /> : <p className="text-sm text-[var(--muted)] py-16 text-center">Sem receitas lançadas na competência deste mês.</p>}
        </Panel>
        <section className="rounded-xl bg-[var(--side)] text-white p-6 flex flex-col border border-white/5">
          <p className="text-sm text-[#AEB6C7] font-semibold inline-flex items-center gap-1.5">Lucro líquido do mês <InfoTip help="lucro_liquido" dark /></p>
          <p className={cx('num text-[38px] font-extrabold leading-tight mt-1', r.lucro_liquido < 0 && 'text-[#F59E8B]')}>{money(r.lucro_liquido)}</p>
          <dl className="mt-5 space-y-3 text-[14px]">
            {[
              ['Receita bruta', money(r.receita_bruta), 'receita_bruta'],
              ['Margem bruta', pct(r.margem_bruta), 'margem_bruta'],
              ['Margem EBITDA', pct(r.margem_ebitda), 'margem_ebitda'],
              ['Margem líquida da agência', pct(r.margem_liquida), 'margem_liquida'],
              ['Margem de contribuição dos contratos', pct(d.margens.margem_contribuicao_percent), 'margem_contribuicao'],
            ].map(([k, v, h]) => <div key={k} className="flex justify-between gap-4 border-b border-white/10 pb-2"><dt className="text-[#C9CFDB] inline-flex items-center gap-1">{k} <InfoTip help={h} dark /></dt><dd className="num font-bold">{v}</dd></div>)}
          </dl>
          {a?.ponto_equilibrio?.receita_minima_mensal && (
            <p className="text-[13px] text-[#AEB6C7] mt-auto pt-4 inline-flex items-center gap-1 flex-wrap">Ponto de equilíbrio <InfoTip help="ponto_equilibrio" dark />: <b className="text-white num">{money(a.ponto_equilibrio.receita_minima_mensal)}</b>/mês de receita.</p>
          )}
        </section>
      </div>

      <div className={cx(
        "rounded-xl border border-[var(--line)] bg-[var(--surface)] grid grid-cols-2 md:grid-cols-3 divide-x divide-y xl:divide-y-0 divide-[var(--line-2)] mb-5",
        temAsaas ? "xl:grid-cols-7" : "xl:grid-cols-6"
      )}>
        {[
          <Kpi key="mrr" label="Receita recorrente (MRR)" help="mrr" value={money(s.mrr)} detail={`ARR ${money(s.arr)} · ${s.contratos_ativos} contratos`} />,
          <Kpi key="nm" label="Novo MRR no mês" help="novo_mrr" value={money(s.crescimento_liquido_mrr)} tone={s.crescimento_liquido_mrr < 0 ? 'bad' : 'in'} detail={`+${money(s.novo_mrr)} novos, −${money(s.churn_mrr)} churn (${pct(s.churn_percent)})`} />,
          <Kpi key="cx" label="Caixa hoje" help="caixa" value={money(cx2.saldo_atual)} tone={cx2.saldo_atual < 0 ? 'bad' : undefined} detail={`${cx2.contas.length} contas financeiras`} />,
          ...(temAsaas ? [
            <Kpi
              key="asaas"
              label="Saldo Asaas"
              help="saldo_asaas"
              value={saldoAsaas != null ? money(saldoAsaas) : 'R$ 0,00'}
              tone="in"
              detail={asaasAmbiente === 'PRODUCAO' ? 'Disponível em conta (Prod)' : 'Disponível em conta (Sandbox)'}
            />
          ] : []),
          <Kpi key="rec" label="A receber em 30 dias" help="receber_30d" value={money(cx2.a_receber_30d)} tone="in" />,
          <Kpi key="pag" label="A pagar em 30 dias" help="pagar_30d" value={money(cx2.a_pagar_30d)} tone="out" />,
          <Kpi key="inad" label="Em atraso a receber" help="inadimplencia" value={money(cx2.vencido_receber)} tone={cx2.vencido_receber > 0 ? 'bad' : undefined} detail={`Inadimplência ${pct(cx2.inadimplencia_percent)} dos últimos 90 dias`} />,
        ].map((k, i) => <div key={i} className="px-5 py-4">{k}</div>)}
      </div>

      <div className="grid xl:grid-cols-[1fr_380px] gap-5 mb-5">
        <Panel title="Últimos 12 meses">
          <TrendChart data={d.serie_12m} />
        </Panel>
        <Panel title="Pontos de atenção">
          <ul className="space-y-3 text-[14px]">
            {cx2.vencido_receber > 0 && <Alert icon={AlertTriangle} tone="bad" to="/empresas/receber?situacao=VENCIDO">{money(cx2.vencido_receber)} em contas a receber vencidas</Alert>}
            {cx2.vencido_pagar > 0 && <Alert icon={AlertTriangle} tone="warn" to="/empresas/pagar?situacao=VENCIDO">{money(cx2.vencido_pagar)} em contas a pagar vencidas</Alert>}
            {d.alertas.contratos_abaixo_meta.length > 0 && <Alert icon={TrendingUp} tone="warn" to="/empresas/relatorios?aba=contratos">{d.alertas.contratos_abaixo_meta.length} contrato(s) abaixo da meta de {pct(d.margens.meta_contrato)} de margem</Alert>}
            {d.alertas.reajustes_proximos.map((c) => <Alert key={c.id} icon={CalendarClock} tone="result" to={`/empresas/contratos/${c.id}`}>Reajuste do contrato #{c.numero} em {date(c.data_reajuste)}</Alert>)}
            {d.alertas.estoque_baixo.length > 0 && <Alert icon={Package} tone="warn" to="/empresas/produtos">Estoque baixo: {d.alertas.estoque_baixo.join(', ')}</Alert>}
            {d.pipeline.propostas_abertas > 0 && <Alert icon={FileSignature} tone="result" to="/empresas/propostas">{d.pipeline.propostas_abertas} proposta(s) em aberto: {money(d.pipeline.recorrente)}/mês e {money(d.pipeline.unico)} em projetos</Alert>}
            {a?.capacidade?.horas_disponiveis > 0 && <li className="text-[var(--muted)] pt-2 border-t border-[var(--line-2)]">Equipe produtiva usou <b className="text-[var(--ink)]">{pct(a.capacidade.utilizacao_percent)}</b> das horas em contratos. Custo de horas não alocadas: <b className="text-[var(--ink)] num">{money(a.capacidade.custo_ocioso)}</b>.</li>}
          </ul>
        </Panel>
      </div>

      <Panel title="Margem por contrato no mês" action={<Link to="/empresas/relatorios?aba=contratos" className="text-sm font-semibold text-[var(--result)]">Detalhar</Link>} pad={false}>
        <ContractMarginTable rows={[...d.margens.top_contratos, ...d.margens.piores_contratos.filter((p) => !d.margens.top_contratos.some((t) => t.contract_id === p.contract_id))]} meta={d.margens.meta_contrato} />
      </Panel>

      <div className="mt-5">
        <TopClientsRankingCard />
      </div>
    </>
  );
}

function formatTempoCasa(meses) {
  if (!meses || meses < 1) return '< 1 mês';
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  if (anos === 0) return `${meses} ${meses === 1 ? 'mês' : 'meses'}`;
  if (resto === 0) return `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
  return `${anos}a ${resto}m`;
}

const TIER_STYLE = {
  OURO: {
    label: 'Ouro',
    medal: '🥇',
    cls: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700/60',
  },
  PRATA: {
    label: 'Prata',
    medal: '🥈',
    cls: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600',
  },
  BRONZE: {
    label: 'Bronze',
    medal: '🥉',
    cls: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-700/60',
  },
};

function TopClientsRankingCard() {
  const [visible, setVisible] = useState(false);
  const q = useBizQuery('/reports/clients-ranking', { limit: 15 }, { enabled: visible, staleTime: 60_000 });
  const data = q.data;

  return (
    <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-[var(--line-2)]">
        <div className="flex items-center gap-2.5">
          <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
          <div>
            <h2 className="text-[16px] font-bold text-[var(--ink)]">Ranking dos melhores clientes</h2>
            <p className="text-xs text-[var(--muted)]">Ouro, Prata e Bronze · critério: maior LTV (50%), pontualidade (30%) e tempo de casa (20%)</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          title={visible ? 'Ocultar ranking de clientes' : 'Mostrar ranking de clientes'}
          aria-label={visible ? 'Ocultar ranking de clientes' : 'Mostrar ranking de clientes'}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--line)] bg-[var(--paper)] text-[var(--ink-2)] hover:text-[var(--ink)] hover:border-amber-400 transition"
        >
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          {visible ? 'Ocultar' : 'Mostrar ranking'}
        </button>
      </div>

      {!visible ? (
        <div className="px-5 py-6 flex items-center justify-between gap-4 text-sm text-[var(--muted)]">
          <div className="flex items-center gap-2.5">
            <EyeOff className="w-4 h-4 opacity-60 shrink-0" />
            <span>Ranking e LTV ocultos por privacidade. Clique no olho para visualizar.</span>
          </div>
          <span className="num font-bold tracking-widest opacity-50 hidden sm:inline">LTV médio: R$ ••••••</span>
        </div>
      ) : q.isLoading ? (
        <div className="p-6"><Loading label="Calculando ranking e LTV…" /></div>
      ) : q.error ? (
        <div className="p-5"><ErrorBox error={q.error} /></div>
      ) : !data?.ranking?.length ? (
        <p className="text-sm text-[var(--muted)] p-5">Nenhum cliente com pagamentos ou contratos ativos ainda.</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-[var(--line-2)] bg-[var(--paper)]/60 border-b border-[var(--line-2)]">
            <div className="px-5 py-3.5">
              <p className="text-xs text-[var(--muted)] font-medium inline-flex items-center gap-1">LTV médio da empresa <InfoTip help="ltv_medio" /></p>
              <p className="num text-xl font-extrabold text-[var(--in)] mt-0.5">{money(data.ltv_medio)}</p>
            </div>
            <div className="px-5 py-3.5">
              <p className="text-xs text-[var(--muted)] font-medium inline-flex items-center gap-1">Tempo médio de casa <InfoTip help="tempo_casa" /></p>
              <p className="num text-xl font-extrabold text-[var(--ink)] mt-0.5">{formatTempoCasa(Math.round(data.tempo_medio_meses))}</p>
            </div>
            <div className="px-5 py-3.5">
              <p className="text-xs text-[var(--muted)] font-medium">Clientes com LTV calculado</p>
              <p className="num text-xl font-extrabold text-[var(--ink)] mt-0.5">{data.total_clientes}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nível</th>
                  <th>Cliente</th>
                  <th className="r"><span className="inline-flex items-center gap-1">LTV (Total pago) <InfoTip help="ltv" /></span></th>
                  <th className="r"><span className="inline-flex items-center gap-1">Pontualidade <InfoTip help="pontualidade" /></span></th>
                  <th className="r"><span className="inline-flex items-center gap-1">Tempo de casa <InfoTip help="tempo_casa" /></span></th>
                  <th className="r">Nota</th>
                </tr>
              </thead>
              <tbody>
                {data.ranking.map((c) => {
                  const t = TIER_STYLE[c.tier] || TIER_STYLE.BRONZE;
                  return (
                    <tr key={c.client_id}>
                      <td className="num text-[var(--muted)] font-semibold">{c.posicao}º</td>
                      <td>
                        <span className={cx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold border', t.cls)}>
                          <span>{t.medal}</span>
                          {t.label}
                        </span>
                      </td>
                      <td className="min-w-[200px]">
                        <span className="font-semibold text-[var(--ink)]">{c.nome}</span>
                        {c.mrr > 0 && <div className="text-xs text-[var(--muted)]">MRR atual: {money(c.mrr)}/mês</div>}
                      </td>
                      <td className="r font-bold"><Money value={c.ltv} colored /></td>
                      <td className="r num">
                        <span className={cx('font-semibold', c.pontualidade_percent >= 90 ? 'text-[var(--in)]' : c.pontualidade_percent < 70 ? 'text-[var(--bad)]' : 'text-amber-600 dark:text-amber-400')}>
                          {pct(c.pontualidade_percent)}
                        </span>
                        <div className="text-[11px] text-[var(--muted)]">{c.pagos_em_dia}/{c.pagos + c.vencidos_aberto} em dia</div>
                      </td>
                      <td className="r num whitespace-nowrap">{formatTempoCasa(c.meses_casa)}</td>
                      <td className="r num font-bold text-[var(--ink)]">{c.score} pts</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}

function Alert({ icon: Icon, tone, to, children }) {
  const c = { bad: 'text-[var(--bad)]', warn: 'text-[var(--warn)]', result: 'text-[var(--result)]' }[tone];
  return <li><Link to={to} className="flex gap-2.5 hover:underline"><Icon className={cx('w-4 h-4 mt-0.5 shrink-0', c)} /><span>{children}</span></Link></li>;
}

export function ContractMarginTable({ rows, meta, full }) {
  if (!rows.length) return <p className="text-sm text-[var(--muted)] px-5 pb-5">Nenhum contrato com receita no período.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="tbl">
        <thead><tr>
          <th>Contrato</th><th className="r">Receita</th>{full && <><th className="r">Impostos</th><th className="r">Custos</th><th className="r">Equipe</th><th className="r">Horas</th></>}
          <th className="r"><span className="inline-flex items-center gap-1">{full ? 'Contribuição' : 'Margem de contribuição'} <InfoTip help="margem_contribuicao" /></span></th><th className="r">Margem %</th>{full && <><th className="r"><span className="inline-flex items-center gap-1">Overhead <InfoTip help="overhead" /></span></th><th className="r"><span className="inline-flex items-center gap-1">Margem líquida <InfoTip help="margem_liquida" /></span></th></>}
        </tr></thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.contract_id}>
              <td className={full ? 'min-w-[190px]' : 'min-w-[220px]'}><Link to={`/empresas/contratos/${c.contract_id}`} className="font-semibold hover:underline">#{c.numero} {c.titulo}</Link><div className="text-xs text-[var(--muted)]">{c.cliente} · {c.tipo === 'RECORRENTE' ? 'Recorrente' : 'Pontual'}{c.horas_estouradas ? ' · horas acima do previsto' : ''}</div></td>
              <td className="r"><Money value={c.receita} /></td>
              {full && <><td className="r"><Money value={-(c.impostos + c.comissao)} /></td><td className="r"><Money value={-(c.custos_diretos + c.produtos + c.taxas)} /></td><td className="r"><Money value={-c.mao_obra} /></td><td className="r num">{c.horas}h</td></>}
              <td className="r font-semibold"><Money value={c.margem_contribuicao} /></td>
              <td className="r"><MarginRuler value={c.margem_contribuicao_percent} meta={meta} width={full ? 80 : 140} /></td>
              {full && <><td className="r"><Money value={-c.rateio_overhead} /></td><td className="r font-semibold"><Money value={c.margem_liquida} colored /><div className="text-xs text-[var(--muted)] num">{pct(c.margem_liquida_percent)}</div></td></>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
