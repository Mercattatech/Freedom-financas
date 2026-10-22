import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronRight, Download, Printer } from 'lucide-react';
import { useBiz, useBizQuery } from '../BizContext';
import { PageHeader, Tabs, RangePicker, Loading, ErrorBox, Panel, Money, Kpi, Button, MarginRuler, Select, cx } from '../components/ui';
import { CashflowChart, Waterfall } from '../components/Charts';
import { ContractMarginTable } from './Dashboard';
import { money, pct, monthLabel, currentYm, shiftYm, num, date } from '../format';

const TABS = [['dre', 'DRE'], ['contratos', 'Margem por contrato'], ['clientes', 'Margem por cliente'], ['agencia', 'Margem da empresa'], ['caixa', 'Fluxo de caixa'], ['aging', 'Inadimplência']];

function downloadCsv(name, rows) {
  const csv = rows.map((r) => r.map((c) => (typeof c === 'number' ? String(c).replace('.', ',') : `"${String(c ?? '').replace(/"/g, '""')}"`)).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  a.download = name;
  a.click();
}

export default function Reports() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('aba') || 'dre';
  const [range, setRange] = useState({ from: shiftYm(currentYm(), -5), to: currentYm() });
  const [mRange, setMRange] = useState({ from: currentYm(), to: currentYm() });
  const usesRange = ['dre', 'contratos', 'clientes', 'agencia'].includes(tab);
  const r = tab === 'dre' ? range : mRange;
  const setR = tab === 'dre' ? setRange : setMRange;
  return (
    <>
      <PageHeader title="DRE e margens" subtitle="Resultado gerencial por competência, rentabilidade de cada contrato e da empresa."
        actions={<>{usesRange && <RangePicker from={r.from} to={r.to} onChange={setR} />}<Button variant="secondary" icon={Printer} onClick={() => window.print()}>Imprimir</Button></>} />
      <Tabs tabs={TABS} value={tab} onChange={(k) => setSp({ aba: k })} />
      {tab === 'dre' && <DreTab {...range} />}
      {tab === 'contratos' && <ContractsTab {...mRange} />}
      {tab === 'clientes' && <ClientsTab {...mRange} />}
      {tab === 'agencia' && <AgencyTab {...mRange} />}
      {tab === 'caixa' && <CashTab />}
      {tab === 'aging' && <AgingTab />}
    </>
  );
}

function DreTab({ from, to }) {
  const [regime, setRegime] = useState('competencia');
  const [open, setOpen] = useState({});
  const q = useBizQuery('/reports/dre', { from, to, regime });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const d = q.data;
  const exportCsv = () => downloadCsv(`dre_${from}_${to}.csv`, [['Linha', ...d.meses, 'Total', 'AV %'], ...d.linhas.map((l) => [l.label, ...d.meses.map((m) => l.valores[m] || 0), l.total, l.av])]);
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Select value={regime} onChange={(e) => setRegime(e.target.value)} className="w-[240px]"><option value="competencia">Regime de competência</option><option value="caixa">Regime de caixa (pagos)</option></Select>
        <Button variant="secondary" size="sm" icon={Download} onClick={exportCsv}>Exportar CSV</Button>
        <div className="flex gap-6 ml-auto text-sm">
          {[['Margem bruta', d.indicadores.margem_bruta], ['Margem EBITDA', d.indicadores.margem_ebitda], ['Margem líquida', d.indicadores.margem_liquida]].map(([l, v]) => <span key={l}>{l} <b className="num">{pct(v)}</b></span>)}
        </div>
      </div>
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-x-auto">
        <table className="tbl">
          <thead><tr><th className="min-w-[280px]">Demonstração do resultado</th>{d.meses.map((m) => <th key={m} className="r">{monthLabel(m)}</th>)}<th className="r">Total</th><th className="r">AV %</th></tr></thead>
          <tbody>
            {d.linhas.map((l) => {
              if (l.tipo === 'conta' && !open[l.grupo]) return null;
              const hasChildren = l.tipo === 'grupo' && d.linhas.some((x) => x.grupo === l.key);
              const isSub = l.tipo === 'subtotal';
              const strong = ['LUCRO_LIQUIDO', 'EBITDA'].includes(l.key);
              return (
                <tr key={l.key} className={cx(isSub && 'bg-[var(--paper)]', strong && 'bg-[var(--result-soft)]')}>
                  <td className={cx(l.tipo === 'conta' ? 'pl-9 text-[var(--ink-2)]' : 'font-semibold', isSub && 'font-extrabold')}>
                    {hasChildren ? <button className="inline-flex items-center gap-1 text-left" onClick={() => setOpen({ ...open, [l.key]: !open[l.key] })} aria-expanded={!!open[l.key]}><ChevronRight className={cx('w-4 h-4 transition', open[l.key] && 'rotate-90')} />{l.label}</button> : <span className={l.tipo === 'grupo' ? 'pl-5' : ''}>{l.label}</span>}
                  </td>
                  {d.meses.map((m) => <td key={m} className={cx('r num', isSub && 'font-bold', (l.valores[m] || 0) < 0 && isSub && 'text-[var(--bad)]')}>{l.valores[m] ? money(l.valores[m]) : <span className="text-[var(--muted)]">—</span>}</td>)}
                  <td className={cx('r num font-semibold', isSub && 'font-extrabold', l.total < 0 && isSub && 'text-[var(--bad)]')}>{money(l.total)}</td>
                  <td className="r num text-[var(--muted)]">{pct(l.av)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <p className="text-xs text-[var(--muted)] mt-3">Tarifas do Asaas entram automaticamente em despesas financeiras. Lançamentos sem conta aparecem como "Sem classificação" para você corrigir.</p>
    </>
  );
}

function ContractsTab({ from, to }) {
  const q = useBizQuery('/reports/contracts-margin', { from, to });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const d = q.data;
  const T = d.totais;
  const exportCsv = () => downloadCsv(`margem_contratos_${from}_${to}.csv`, [['Contrato', 'Cliente', 'Tipo', 'Receita', 'Impostos', 'Comissão', 'Custos diretos', 'Produtos', 'Tarifas', 'Horas', 'Equipe', 'Margem contribuição', 'MC %', 'Overhead', 'Margem líquida', 'ML %'],
    ...d.contratos.map((c) => [`#${c.numero} ${c.titulo}`, c.cliente, c.tipo, c.receita, c.impostos, c.comissao, c.custos_diretos, c.produtos, c.taxas, c.horas, c.mao_obra, c.margem_contribuicao, c.margem_contribuicao_percent, c.rateio_overhead, c.margem_liquida, c.margem_liquida_percent])]);
  return (
    <>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] grid grid-cols-2 md:grid-cols-5 divide-x divide-[var(--line-2)] mb-5">
        {[
          <Kpi key="1" label="Receita dos contratos" value={money(T.receita)} />,
          <Kpi key="2" label="Margem de contribuição" value={money(T.margem_contribuicao)} detail={pct(T.margem_contribuicao_percent)} tone={T.margem_contribuicao < 0 ? 'bad' : 'in'} />,
          <Kpi key="3" label="Overhead não alocado" value={money(d.overhead.nao_alocado)} detail={`Rateado por ${({ RECEITA: 'receita', HORAS: 'horas', NENHUM: 'nenhum critério' })[d.rateio]}`} />,
          <Kpi key="4" label="Margem líquida" value={money(T.margem_liquida)} detail={pct(T.margem_liquida_percent)} tone={T.margem_liquida < 0 ? 'bad' : undefined} />,
          <Kpi key="5" label="Horas em contratos" value={`${num(T.horas)}h`} detail={T.horas ? `${money(T.receita / T.horas)} de receita/hora` : undefined} />,
        ].map((k, i) => <div key={i} className="px-5 py-4">{k}</div>)}
      </div>
      <Panel title={`Contratos (meta de margem: ${pct(d.meta_margem)})`} pad={false} action={<Button size="sm" variant="secondary" icon={Download} onClick={exportCsv}>CSV</Button>}>
        <ContractMarginTable rows={d.contratos} meta={d.meta_margem} full />
      </Panel>
      <p className="text-xs text-[var(--muted)] mt-3 max-w-[100ch]">Margem de contribuição = receita − impostos estimados − comissão − custos lançados no contrato − produtos do estoque − tarifas − horas apontadas × custo/hora. O overhead é a estrutura que não foi apropriada a contratos (despesas sem contrato menos o custo de equipe e produtos já alocados).</p>
    </>
  );
}

function ClientsTab({ from, to }) {
  const q = useBizQuery('/reports/clients-margin', { from, to });
  const { company } = useBiz();
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const d = q.data;
  return (
    <>
      <p className="text-sm mb-4">Os 5 maiores clientes representam <b className="num">{pct(d.concentracao_top5)}</b> da receita do período{d.concentracao_top5 > 60 ? '. Concentração alta: perder um deles pesa no caixa.' : '.'}</p>
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-x-auto">
        <table className="tbl">
          <thead><tr><th>Cliente</th><th className="r">Contratos</th><th className="r">Receita</th><th className="r">Participação</th><th className="r">Custos</th><th className="r">Margem de contribuição</th><th className="r">Margem líquida</th></tr></thead>
          <tbody>{d.clientes.map((c) => (
            <tr key={c.client_id}>
              <td className="font-semibold">{c.cliente}</td><td className="r num">{c.contratos}</td><td className="r"><Money value={c.receita} /></td>
              <td className="r"><div className="flex items-center justify-end gap-2"><span className="num w-12 text-right">{pct(c.participacao_receita)}</span><span className="h-2 rounded-full bg-[var(--result)]" style={{ width: Math.max(2, c.participacao_receita) }} /></div></td>
              <td className="r"><Money value={-c.custo_total} /></td>
              <td className="r"><MarginRuler value={c.margem_contribuicao_percent} meta={Number(company?.meta_margem_contrato || 40)} width={100} /></td>
              <td className="r"><Money value={c.margem_liquida} colored /><div className="text-xs text-[var(--muted)] num">{pct(c.margem_liquida_percent)}</div></td>
            </tr>
          ))}</tbody>
        </table>
      </section>
    </>
  );
}

function AgencyTab({ from, to }) {
  const q = useBizQuery('/reports/agency-margin', { from, to });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const a = q.data;
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--line-2)]">
        {[
          <Kpi key="1" label="Margem bruta" value={pct(a.dre.margem_bruta)} detail={money(a.dre.lucro_bruto)} />,
          <Kpi key="2" label="Margem EBITDA" value={pct(a.dre.margem_ebitda)} detail={money(a.dre.ebitda)} />,
          <Kpi key="3" label="Margem líquida" value={pct(a.dre.margem_liquida)} detail={money(a.dre.lucro_liquido)} tone={a.dre.lucro_liquido < 0 ? 'bad' : 'in'} />,
          <Kpi key="4" label="Receita recorrente" value={pct(a.mix_receita.recorrente_percent)} detail={`${money(a.mix_receita.recorrente)} recorrente, ${money(a.mix_receita.pontual)} pontual`} />,
        ].map((k, i) => <div key={i} className="px-5 py-4">{k}</div>)}
      </div>
      <Panel title="Cascata do resultado">{a.dre.receita_bruta ? <Waterfall steps={a.cascata} height={300} /> : <p className="text-sm text-[var(--muted)]">Sem receitas no período.</p>}</Panel>
      <div className="grid lg:grid-cols-3 gap-5">
        <Panel title="Contratos × estrutura">
          <dl className="text-[14px] space-y-2">
            <Row l="Margem de contribuição dos contratos" v={<Money value={a.margem_contratos.margem_contribuicao} />} />
            <Row l="Estrutura não alocada (overhead)" v={<Money value={-a.margem_contratos.overhead_nao_alocado} />} />
            <Row l="Contratos abaixo da meta" v={`${a.margem_contratos.contratos_abaixo_meta} de meta ${pct(a.margem_contratos.meta)}`} />
          </dl>
        </Panel>
        <Panel title="Capacidade da equipe">
          <dl className="text-[14px] space-y-2">
            <Row l="Horas disponíveis (produtivos)" v={`${num(a.capacidade.horas_disponiveis)}h`} />
            <Row l="Horas em contratos" v={`${num(a.capacidade.horas_em_contratos)}h`} />
            <Row l="Utilização" v={<b>{pct(a.capacidade.utilizacao_percent)}</b>} />
            <Row l="Custo da equipe produtiva" v={<Money value={a.capacidade.custo_equipe_produtiva} />} />
            <Row l="Custo de horas não alocadas" v={<Money value={a.capacidade.custo_ocioso} className="text-[var(--out)]" />} />
          </dl>
        </Panel>
        <Panel title="Ponto de equilíbrio">
          <dl className="text-[14px] space-y-2">
            <Row l="Despesas fixas por mês" v={<Money value={a.ponto_equilibrio.despesas_fixas_mensais} />} />
            <Row l="Índice de margem de contribuição" v={pct(a.ponto_equilibrio.indice_margem_contribuicao)} />
            <Row l="Receita mínima mensal" v={<b>{a.ponto_equilibrio.receita_minima_mensal ? money(a.ponto_equilibrio.receita_minima_mensal) : '—'}</b>} />
            {a.ponto_equilibrio.folga_percent !== null && <Row l="Folga sobre o equilíbrio" v={<span className={a.ponto_equilibrio.folga_percent < 0 ? 'text-[var(--bad)] font-bold' : 'font-bold'}>{pct(a.ponto_equilibrio.folga_percent)}</span>} />}
          </dl>
        </Panel>
      </div>
    </div>
  );
}
const Row = ({ l, v }) => <div className="flex justify-between gap-4 border-b border-[var(--line-2)] pb-2 last:border-0"><dt className="text-[var(--ink-2)]">{l}</dt><dd className="num text-right">{v}</dd></div>;

function CashTab() {
  const [days, setDays] = useState(90);
  const [inc, setInc] = useState(false);
  const [gran, setGran] = useState('semana');
  const q = useBizQuery('/reports/cashflow', { days, incluir_vencidos: inc, granularidade: gran });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const d = q.data;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-[190px]">{[30, 60, 90, 180, 365].map((n) => <option key={n} value={n}>Próximos {n} dias</option>)}</Select>
        <Select value={gran} onChange={(e) => setGran(e.target.value)} className="w-[160px]"><option value="dia">Por dia</option><option value="semana">Por semana</option><option value="mes">Por mês</option></Select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={inc} onChange={(e) => setInc(e.target.checked)} className="w-4 h-4" />Considerar vencidos como recebidos/pagos hoje</label>
      </div>
      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--line-2)]">
        {[
          <Kpi key="1" label="Saldo hoje" value={money(d.saldo_inicial)} />,
          <Kpi key="2" label={`Saldo em ${d.dias} dias`} value={money(d.saldo_final)} tone={d.saldo_final < 0 ? 'bad' : undefined} />,
          <Kpi key="3" label="Menor saldo projetado" value={money(d.menor_saldo.saldo)} detail={`em ${date(d.menor_saldo.periodo)}`} tone={d.menor_saldo.saldo < 0 ? 'bad' : undefined} />,
          <Kpi key="4" label="Previsto de assinaturas" value={money(d.receita_prevista_contratos)} detail="Ainda não emitido no Asaas" />,
        ].map((k, i) => <div key={i} className="px-5 py-4">{k}</div>)}
      </div>
      <Panel title="Entradas, saídas e saldo projetado"><CashflowChart data={d.serie} height={320} /></Panel>
      {!inc && (d.vencidos.a_receber > 0 || d.vencidos.a_pagar > 0) && <p className="text-sm text-[var(--muted)]">Fora da projeção: {money(d.vencidos.a_receber)} vencidos a receber e {money(d.vencidos.a_pagar)} vencidos a pagar.</p>}
      <Panel title="Saldos por conta" pad={false}>
        <table className="tbl"><tbody>{d.contas.map((c) => <tr key={c.id}><td>{c.nome}</td><td className="text-[var(--muted)]">{c.tipo}</td><td className="r"><Money value={c.saldo} colored /></td></tr>)}</tbody></table>
      </Panel>
    </div>
  );
}

function AgingTab() {
  const [tipo, setTipo] = useState('RECEITA');
  const q = useBizQuery('/reports/aging', { tipo });
  if (q.isLoading) return <Loading />;
  const d = q.data;
  const max = Math.max(1, ...d.faixas.map((f) => f.valor));
  return (
    <div className="space-y-5">
      <Select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-[200px]"><option value="RECEITA">Contas a receber</option><option value="DESPESA">Contas a pagar</option></Select>
      <Panel title={`Em aberto: ${money(d.total)}, sendo ${money(d.vencido)} vencido`}>
        <div className="space-y-3">
          {d.faixas.map((f, i) => (
            <div key={f.faixa} className="grid grid-cols-[110px_1fr_150px] items-center gap-3 text-sm">
              <span className="font-semibold">{f.faixa}</span>
              <div className="h-3 rounded-full bg-[var(--line-2)]"><div className="h-3 rounded-full" style={{ width: `${(f.valor / max) * 100}%`, background: i === 0 ? 'var(--in)' : 'var(--out)', opacity: i === 0 ? 1 : 0.55 + i * 0.11 }} /></div>
              <span className="num text-right">{money(f.valor)} <span className="text-[var(--muted)]">({f.quantidade})</span></span>
            </div>
          ))}
        </div>
      </Panel>
      {d.devedores.length > 0 && (
        <Panel title={tipo === 'RECEITA' ? 'Quem está devendo' : 'A quem estamos devendo'} pad={false}>
          <table className="tbl"><thead><tr><th>Nome</th><th className="r">Títulos</th><th className="r">Maior atraso</th><th className="r">Vencido</th></tr></thead>
            <tbody>{d.devedores.map((p) => <tr key={p.id}><td className="font-semibold">{p.nome}</td><td className="r num">{p.titulos}</td><td className="r num">{p.maior_atraso} dias</td><td className="r"><Money value={p.vencido} className="text-[var(--bad)] font-semibold" /></td></tr>)}</tbody>
          </table>
        </Panel>
      )}
    </div>
  );
}
