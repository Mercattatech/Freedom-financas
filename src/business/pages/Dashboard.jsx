import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, TrendingUp, Package, CalendarClock, FileSignature } from 'lucide-react';
import { useBizQuery } from '../BizContext';
import { PageHeader, Panel, MonthPicker, Kpi, Loading, ErrorBox, MarginRuler, Money, cx } from '../components/ui';
import { TrendChart, Waterfall } from '../components/Charts';
import { money, pct, currentYm, monthLong, date } from '../format';

export default function Dashboard() {
  const [mes, setMes] = useState(currentYm());
  const dash = useBizQuery('/reports/dashboard', { ref: mes });
  const ag = useBizQuery('/reports/agency-margin', { from: mes });
  if (dash.isLoading || ag.isLoading) return <Loading />;
  if (dash.error) return <ErrorBox error={dash.error} />;
  const d = dash.data;
  const a = ag.data;
  const r = d.resultado_mes;
  const s = d.assinaturas;
  const cx2 = d.caixa;

  return (
    <>
      <PageHeader title="Visão geral" subtitle={`Resultado por competência de ${monthLong(mes).toLowerCase()}. Caixa e vencimentos são de hoje.`} actions={<MonthPicker value={mes} onChange={setMes} />} />

      <div className="grid xl:grid-cols-[1fr_340px] gap-5 mb-5">
        <Panel title="Do faturamento ao lucro" action={<Link to="/empresas/relatorios" className="text-sm font-semibold text-[var(--result)]">Ver DRE completa</Link>}>
          {a?.cascata && r.receita_bruta ? <Waterfall steps={a.cascata} height={330} /> : <p className="text-sm text-[var(--muted)] py-16 text-center">Sem receitas lançadas na competência deste mês.</p>}
        </Panel>
        <section className="rounded-xl bg-[var(--side)] text-white p-6 flex flex-col border border-white/5">
          <p className="text-sm text-[#AEB6C7] font-semibold">Lucro líquido do mês</p>
          <p className={cx('num text-[38px] font-extrabold leading-tight mt-1', r.lucro_liquido < 0 && 'text-[#F59E8B]')}>{money(r.lucro_liquido)}</p>
          <dl className="mt-5 space-y-3 text-[14px]">
            {[
              ['Receita bruta', money(r.receita_bruta)],
              ['Margem bruta', pct(r.margem_bruta)],
              ['Margem EBITDA', pct(r.margem_ebitda)],
              ['Margem líquida da agência', pct(r.margem_liquida)],
              ['Margem de contribuição dos contratos', pct(d.margens.margem_contribuicao_percent)],
            ].map(([k, v]) => <div key={k} className="flex justify-between gap-4 border-b border-white/10 pb-2"><dt className="text-[#C9CFDB]">{k}</dt><dd className="num font-bold">{v}</dd></div>)}
          </dl>
          {a?.ponto_equilibrio?.receita_minima_mensal && (
            <p className="text-[13px] text-[#AEB6C7] mt-auto pt-4">Ponto de equilíbrio: <b className="text-white num">{money(a.ponto_equilibrio.receita_minima_mensal)}</b>/mês de receita.</p>
          )}
        </section>
      </div>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 divide-x divide-y xl:divide-y-0 divide-[var(--line-2)] mb-5">
        {[
          <Kpi key="mrr" label="Receita recorrente (MRR)" value={money(s.mrr)} detail={`ARR ${money(s.arr)} · ${s.contratos_ativos} contratos`} />,
          <Kpi key="nm" label="Novo MRR no mês" value={money(s.crescimento_liquido_mrr)} tone={s.crescimento_liquido_mrr < 0 ? 'bad' : 'in'} detail={`+${money(s.novo_mrr)} novos, −${money(s.churn_mrr)} churn (${pct(s.churn_percent)})`} />,
          <Kpi key="cx" label="Caixa hoje" value={money(cx2.saldo_atual)} tone={cx2.saldo_atual < 0 ? 'bad' : undefined} detail={`${cx2.contas.length} contas financeiras`} />,
          <Kpi key="rec" label="A receber em 30 dias" value={money(cx2.a_receber_30d)} tone="in" />,
          <Kpi key="pag" label="A pagar em 30 dias" value={money(cx2.a_pagar_30d)} tone="out" />,
          <Kpi key="inad" label="Em atraso a receber" value={money(cx2.vencido_receber)} tone={cx2.vencido_receber > 0 ? 'bad' : undefined} detail={`Inadimplência ${pct(cx2.inadimplencia_percent)} dos últimos 90 dias`} />,
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
    </>
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
          <th className="r">{full ? 'Contribuição' : 'Margem de contribuição'}</th><th className="r">Margem %</th>{full && <><th className="r">Overhead</th><th className="r">Margem líquida</th></>}
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
