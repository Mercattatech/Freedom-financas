import React, { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, Repeat, Play, Pause, XCircle, Percent, Clock3, Receipt, X, RefreshCw, Link2, Copy, ExternalLink, Share2, AlertTriangle, Check, Pencil, Target } from 'lucide-react';
import { toast } from 'sonner';
import { biz } from '../api';
import { useBiz, useBizQuery, useBizMutation } from '../BizContext';
import { PageHeader, Button, Field, Input, Select, Textarea, MoneyInput, Modal, StatusPill, Money, Empty, Loading, ErrorBox, SearchInput, useDebounced, Panel, MarginRuler, cx } from '../components/ui';
import { useLookups } from '../components/lookups';
import { TransactionForm } from './Transactions';
import { money, pct, date, todayYmd, num } from '../format';

const PERIODOS = [['MENSAL', 'Mensal'], ['BIMESTRAL', 'Bimestral'], ['TRIMESTRAL', 'Trimestral'], ['SEMESTRAL', 'Semestral'], ['ANUAL', 'Anual']];
const nextJanFirstYmd = () => `${new Date().getFullYear() + 1}-01-01`;

export function ContractList() {
  const { can } = useBiz();
  const nav = useNavigate();
  const [status, setStatus] = useState('ATIVO');
  const [tipo, setTipo] = useState('');
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const dq = useDebounced(q);
  const list = useBizQuery('/contracts', { status, tipo, q: dq });
  const items = list.data?.items || [];
  const r = list.data?.resumo;
  return (
    <>
      <PageHeader title="Contratos" subtitle="Assinaturas recorrentes e projetos pontuais. Ao ativar, o faturamento é gerado no Asaas ou como títulos a receber."
        actions={can('contratos:write') && <Button icon={Plus} onClick={() => setCreating(true)}>Novo contrato</Button>} />
      {r && (
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface)] grid grid-cols-2 md:grid-cols-4 divide-x divide-[var(--line-2)] mb-5">
          {[['MRR', money(r.mrr)], ['ARR', money(r.arr)], ['Contratos ativos', r.ativos], ['Ticket médio mensal', money(r.ticket_medio)]].map(([l, v]) => (
            <div key={l} className="px-5 py-4"><p className="text-[13px] font-semibold text-[var(--muted)]">{l}</p><p className="num text-[22px] font-extrabold">{v}</p></div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-[170px]"><option value="">Todos os status</option>{['ATIVO', 'RASCUNHO', 'PAUSADO', 'ENCERRADO', 'CANCELADO'].map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}</Select>
        <Select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-[170px]"><option value="">Todos os tipos</option><option value="RECORRENTE">Recorrentes</option><option value="PONTUAL">Pontuais</option></Select>
        <SearchInput value={q} onChange={setQ} placeholder="Buscar contrato ou cliente" />
      </div>
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden">
        {list.isLoading ? <Loading /> : !items.length ? (
          <Empty icon={Repeat} title="Nenhum contrato" text="Contratos nascem de propostas aceitas ou podem ser criados aqui." action={can('contratos:write') && <Button icon={Plus} onClick={() => setCreating(true)}>Novo contrato</Button>} />
        ) : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>Nº</th><th>Contrato</th><th>Tipo</th><th>Status</th><th className="r">Valor mensal</th><th className="r">Projeto</th><th className="r">Margem prevista</th><th>Início</th><th>Cobrança</th></tr></thead>
            <tbody>{items.map((c) => (
              <tr key={c.id} className="cursor-pointer" onClick={() => nav(`/empresas/contratos/${c.id}`)}>
                <td className="num text-[var(--muted)]">#{c.numero}</td>
                <td className="min-w-[240px]"><b>{c.titulo}</b><div className="text-xs text-[var(--muted)]">{c.client?.nome_fantasia || c.client?.nome}</div></td>
                <td>{c.tipo === 'RECORRENTE' ? `Recorrente ${c.periodicidade.toLowerCase()}` : 'Pontual'}</td>
                <td><StatusPill status={c.status} /></td>
                <td className="r"><Money value={c.valor_mensal} /></td>
                <td className="r"><Money value={c.valor_pontual} /></td>
                <td className="r num">{c.margem_prevista_percent !== null ? pct(c.margem_prevista_percent) : '—'}</td>
                <td className="num">{date(c.data_inicio)}</td>
                <td className="text-sm">{c.asaas_subscription_id ? 'Assinatura Asaas' : c.cobrar_via_asaas ? 'Asaas' : 'Manual'}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
      {creating && <ContractForm onClose={() => setCreating(false)} onSaved={(c) => nav(`/empresas/contratos/${c.id}`)} />}
    </>
  );
}

function ContractForm({ initial = {}, onClose, onSaved }) {
  const L = useLookups();
  const { company } = useBiz();
  const isNew = !initial.id;
  const [f, setF] = useState({
    client_id: initial.client_id || '', titulo: initial.titulo || '', tipo: initial.tipo || 'RECORRENTE', periodicidade: initial.periodicidade || 'MENSAL',
    valor_recorrente: initial.valor_recorrente ?? '', valor_pontual: initial.valor_pontual ?? '', parcelas_pontual: initial.parcelas_pontual || 1,
    data_inicio: initial.data_inicio ? String(initial.data_inicio).slice(0, 10) : todayYmd(), data_fim: initial.data_fim ? String(initial.data_fim).slice(0, 10) : '',
    dia_vencimento: initial.dia_vencimento || 10, forma_pagamento: initial.forma_pagamento || 'BOLETO', cobrar_via_asaas: initial.cobrar_via_asaas ?? !!company?.asaas_configurado,
    custo_previsto_mensal: initial.custo_previsto_mensal ?? '', horas_previstas_mensal: initial.horas_previstas_mensal ?? '', comissao_percent: initial.comissao_percent ?? '',
    aliquota_imposto: initial.aliquota_imposto ?? '', cost_center_id: initial.cost_center_id || '', responsavel: initial.responsavel || '', indice_reajuste: isNew ? 'IPCA' : (initial.indice_reajuste || 'NENHUM'),
    data_reajuste: initial.data_reajuste ? String(initial.data_reajuste).slice(0, 10) : (isNew ? nextJanFirstYmd() : ''), observacoes: initial.observacoes || '', ativar: true,
  });
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e });
  const save = useBizMutation((body) => (isNew ? biz('/contracts', { method: 'POST', body }) : biz(`/contracts/${initial.id}`, { method: 'PUT', body })), {
    success: isNew ? 'Contrato criado' : 'Contrato atualizado', onSuccess: (c) => { onSaved?.(c); onClose(); },
  });
  const submit = (e) => {
    e.preventDefault();
    const n = (v) => (v === '' || v === null ? null : Number(v));
    const body = {
      ...f, valor_recorrente: f.tipo === 'RECORRENTE' ? n(f.valor_recorrente) : 0, valor_pontual: n(f.valor_pontual) || 0, parcelas_pontual: Number(f.parcelas_pontual || 1),
      dia_vencimento: Number(f.dia_vencimento), custo_previsto_mensal: n(f.custo_previsto_mensal) || 0, horas_previstas_mensal: n(f.horas_previstas_mensal) || 0,
      comissao_percent: n(f.comissao_percent), aliquota_imposto: n(f.aliquota_imposto), data_fim: f.data_fim || null, data_reajuste: f.data_reajuste || null, cost_center_id: f.cost_center_id || null,
    };
    if (!isNew) { delete body.ativar; delete body.client_id; }
    save.mutate(body);
  };
  const mensal = f.tipo === 'RECORRENTE' ? Number(f.valor_recorrente || 0) / ({ MENSAL: 1, BIMESTRAL: 2, TRIMESTRAL: 3, SEMESTRAL: 6, ANUAL: 12 }[f.periodicidade]) : 0;
  return (
    <Modal open onClose={onClose} width={760} title={isNew ? 'Novo contrato' : 'Editar contrato'}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" form="ctform" loading={save.isPending}>{isNew ? (f.ativar ? 'Criar e ativar faturamento' : 'Criar como rascunho') : 'Salvar'}</Button></>}>
      <form id="ctform" onSubmit={submit} className="grid sm:grid-cols-2 gap-4">
        {isNew && (
          <Field label="Cliente">
            <Select required value={f.client_id} onChange={set('client_id')}>
              <option value="">Selecione…</option>
              {L.clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome_fantasia || c.nome}{c.documento ? ` (${c.documento})` : ' — sem CPF/CNPJ'}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Título" className={isNew ? '' : 'sm:col-span-2'}><Input value={f.titulo} onChange={set('titulo')} placeholder="Gestão de marketing — Locadora Alfa" /></Field>
        
        {f.client_id && !L.clients.find((c) => c.id === f.client_id)?.documento && f.cobrar_via_asaas && (
          <div className="sm:col-span-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Atenção: Cliente sem CPF/CNPJ</span>
              O Asaas exige que o cliente tenha CPF ou CNPJ cadastrado para gerar assinaturas e cobranças automáticas. Certifique-se de informar o CPF/CNPJ do cliente em Clientes.
            </div>
          </div>
        )}

        <div className="sm:col-span-2 inline-flex rounded-lg border border-[var(--line)] p-0.5 w-fit">
          {[['RECORRENTE', 'Recorrente (assinatura)'], ['PONTUAL', 'Pontual (projeto)']].map(([k, l]) => <button type="button" key={k} onClick={() => setF({ ...f, tipo: k })} className={cx('px-4 h-9 rounded-md text-sm font-semibold', f.tipo === k ? 'bg-[var(--ink)] text-[var(--surface)]' : 'text-[var(--ink-2)]')}>{l}</button>)}
        </div>
        {f.tipo === 'RECORRENTE' && <>
          <Field label="Valor por ciclo"><MoneyInput required value={f.valor_recorrente} onChange={set('valor_recorrente')} /></Field>
          <Field label="Periodicidade" hint={f.periodicidade !== 'MENSAL' && mensal ? `Equivale a ${money(mensal)}/mês no MRR` : undefined}><Select value={f.periodicidade} onChange={set('periodicidade')}>{PERIODOS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
        </>}
        <Field label={f.tipo === 'RECORRENTE' ? 'Taxa de setup (opcional)' : 'Valor do projeto'}><MoneyInput value={f.valor_pontual} onChange={set('valor_pontual')} required={f.tipo === 'PONTUAL'} /></Field>
        <Field label="Parcelas do valor pontual"><Input type="number" min={1} max={48} value={f.parcelas_pontual} onChange={set('parcelas_pontual')} /></Field>
        <Field label="Início"><Input type="date" value={f.data_inicio} onChange={set('data_inicio')} /></Field>
        <Field label="Término (opcional)"><Input type="date" value={f.data_fim} onChange={set('data_fim')} /></Field>
        <Field label="Dia de vencimento"><Input type="number" min={1} max={28} value={f.dia_vencimento} onChange={set('dia_vencimento')} /></Field>
        <Field label="Forma de pagamento">
          <Select value={f.forma_pagamento} onChange={set('forma_pagamento')}>
            <option value="UNDEFINED">Todas (Cliente escolhe PIX, Boleto ou Cartão no Asaas)</option>
            <option value="BOLETO">Boleto Bancário</option>
            <option value="PIX">PIX</option>
            <option value="CARTAO">Cartão de Crédito</option>
            <option value="MANUAL">Manual (fora do Asaas)</option>
          </Select>
        </Field>
        <div id="orcamento-margem" className="sm:col-span-2 rounded-lg border border-[var(--line)] p-4 grid sm:grid-cols-3 gap-4">
          <p className="sm:col-span-3 text-sm font-bold">Margem prevista <span className="font-normal text-[var(--muted)]">— informe a margem (%) ou o custo direto previsto; um calcula o outro</span></p>
          <Field label="Margem prevista (%)" hint={mensal > 0 ? `Sobre ${money(mensal)}/mês` : 'Informe o valor do contrato primeiro'}>
            <Input type="number" step="0.1" min="-100" max="100" disabled={!(mensal > 0)} value={mensal > 0 && f.custo_previsto_mensal !== '' && f.custo_previsto_mensal !== null ? Math.round(((mensal - Number(f.custo_previsto_mensal || 0)) / mensal) * 1000) / 10 : ''}
              placeholder="Ex.: 40"
              onChange={(e) => { const v = e.target.value; setF({ ...f, custo_previsto_mensal: v === '' ? '' : Math.round(mensal * (1 - Number(v) / 100) * 100) / 100 }); }} />
          </Field>
          <Field label="Custo direto previsto/mês"><MoneyInput value={f.custo_previsto_mensal} onChange={set('custo_previsto_mensal')} /></Field>
          <Field label="Horas previstas/mês"><Input type="number" step="0.5" value={f.horas_previstas_mensal} onChange={set('horas_previstas_mensal')} /></Field>
          <Field label="Comissão (%)" hint={`Padrão da empresa: ${pct(company?.aliquota_comissao)}`}><Input type="number" step="0.1" value={f.comissao_percent ?? ''} onChange={set('comissao_percent')} /></Field>
          <Field label="Imposto (%)" hint={`Padrão: ${pct(company?.aliquota_imposto)}`}><Input type="number" step="0.01" value={f.aliquota_imposto ?? ''} onChange={set('aliquota_imposto')} /></Field>
          <Field label="Centro de custo"><Select value={f.cost_center_id} onChange={set('cost_center_id')}><option value="">Nenhum</option>{L.costCenters.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</Select></Field>
          <Field label="Responsável"><Input value={f.responsavel} onChange={set('responsavel')} /></Field>
        </div>
        {f.tipo === 'RECORRENTE' && <>
          <Field label="Índice de reajuste anual" hint="Padrão: IPCA automático todo dia 01/01 (pode alterar manualmente)">
            <Select value={f.indice_reajuste} onChange={(e) => {
              const v = e.target.value;
              setF({ ...f, indice_reajuste: v, data_reajuste: v === 'NENHUM' ? '' : (f.data_reajuste || nextJanFirstYmd()) });
            }}>
              <option value="IPCA">IPCA (automático anual em 01/01)</option>
              <option value="IGPM">IGP-M</option>
              <option value="FIXO">Percentual fixo</option>
              <option value="NENHUM">Sem reajuste automático</option>
            </Select>
          </Field>
          <Field label="Próximo reajuste" hint={f.indice_reajuste === 'IPCA' ? 'Aplicado automaticamente nesta data' : 'Data prevista para reajuste'}>
            <Input type="date" value={f.data_reajuste} disabled={f.indice_reajuste === 'NENHUM'} onChange={set('data_reajuste')} />
          </Field>
        </>}
        <div className="sm:col-span-2 p-3 rounded-lg border border-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-950/20">
          <label className="flex items-start gap-2 text-sm font-medium cursor-pointer">
            <input type="checkbox" checked={f.cobrar_via_asaas} onChange={set('cobrar_via_asaas')} className="w-4 h-4 mt-0.5 accent-indigo-600" disabled={!company?.asaas_configurado} />
            <div>
              <span className="font-bold flex items-center gap-1.5 text-indigo-900 dark:text-indigo-300">
                <Repeat className="w-4 h-4 text-indigo-600" /> Cobrar pelo Asaas (Assinatura Automática)
              </span>
              {!company?.asaas_configurado ? (
                <span className="block text-xs text-[var(--muted)] font-normal mt-0.5">Configure a chave do Asaas em Configurações para habilitar a integração.</span>
              ) : (
                <span className="block text-xs text-[var(--muted)] font-normal mt-0.5">Cria a assinatura no Asaas automaticamente ao ativar; os pagamentos periódicos chegam aqui pelo webhook com baixa e tarifas automáticas.</span>
              )}
            </div>
          </label>
        </div>
        {isNew && <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2"><input type="checkbox" checked={f.ativar} onChange={set('ativar')} className="w-4 h-4" />Ativar agora e gerar o faturamento</label>}
        <Field label="Observações" className="sm:col-span-2"><Textarea value={f.observacoes} onChange={set('observacoes')} rows={2} /></Field>
      </form>
    </Modal>
  );
}

function MarginCard({ title, m, meta }) {
  if (!m) return <Panel title={title}><p className="text-sm text-[var(--muted)]">Sem movimentação no período.</p></Panel>;
  const rows = [
    ['Receita', m.receita, true], ['Impostos', -m.impostos], ['Comissão', -m.comissao], ['Custos diretos', -m.custos_diretos], ['Produtos do estoque', -m.produtos],
    ['Tarifas de cobrança', -m.taxas], [`Equipe (${num(m.horas)}h)`, -m.mao_obra],
  ].filter(([, v, keep]) => keep || v !== 0);
  return (
    <Panel title={title}>
      <dl className="text-[14px] space-y-1.5">
        {rows.map(([l, v]) => <div key={l} className="flex justify-between"><dt className="text-[var(--ink-2)]">{l}</dt><dd><Money value={v} /></dd></div>)}
        <div className="flex justify-between pt-2 mt-1 border-t border-[var(--line)] font-bold"><dt>Margem de contribuição</dt><dd><Money value={m.margem_contribuicao} colored /></dd></div>
        <div className="pt-1"><MarginRuler value={m.margem_contribuicao_percent} meta={meta} width={180} /></div>
        <div className="flex justify-between text-[var(--ink-2)] pt-2"><dt>Overhead rateado</dt><dd><Money value={-m.rateio_overhead} /></dd></div>
        <div className="flex justify-between font-bold"><dt>Margem líquida</dt><dd><Money value={m.margem_liquida} colored /> <span className="text-xs text-[var(--muted)] num">({pct(m.margem_liquida_percent)})</span></dd></div>
        {m.receita_por_hora && <p className="text-xs text-[var(--muted)] pt-2">Receita por hora trabalhada: <b className="num">{money(m.receita_por_hora)}</b></p>}
        {m.previsto?.meses_ativos > 0 && <p className="text-xs text-[var(--muted)]">Previsto no período: receita <b className="num">{money(m.previsto.receita)}</b>, custo direto <b className="num">{money(m.previsto.custo_direto)}</b>, {num(m.previsto.horas)}h.</p>}
      </dl>
    </Panel>
  );
}

export function ContractDetail() {
  const { id } = useParams();
  const { can, company } = useBiz();
  const L = useLookups();
  const q = useBizQuery(`/contracts/${id}`);
  const [edit, setEdit] = useState(false);
  const [readj, setReadj] = useState(false);
  const [cost, setCost] = useState(false);
  const [hours, setHours] = useState(false);
  const status = useBizMutation(({ s, motivo }) => biz(`/contracts/${id}/status`, { method: 'POST', body: { status: s, motivo } }), { success: (c) => `Contrato ${({ ATIVO: 'ativado', PAUSADO: 'pausado', CANCELADO: 'cancelado', ENCERRADO: 'encerrado' })[c.status] || 'atualizado'}` });
  const delEntry = useBizMutation((eid) => biz(`/time-entries/${eid}`, { method: 'DELETE' }), { success: 'Apontamento removido' });
  const syncAsaas = useBizMutation(() => biz(`/contracts/${id}/sync-asaas`, { method: 'POST' }), {
    success: 'Cobranças da assinatura sincronizadas com o Asaas!',
    onSuccess: () => q.refetch(),
  });
  if (q.isLoading) return <Loading />;
  if (q.error) return <ErrorBox error={q.error} />;
  const c = q.data;
  const meta = Number(company?.meta_margem_contrato || 40);
  const w = can('contratos:write');

  return (
    <>
      <PageHeader title={`#${c.numero} ${c.titulo}`} actions={w && <>
        {c.status === 'RASCUNHO' && <Button icon={Play} variant="success" loading={status.isPending} onClick={() => status.mutate({ s: 'ATIVO' })}>Ativar e faturar</Button>}
        {c.status === 'ATIVO' && c.tipo === 'RECORRENTE' && <Button variant="secondary" icon={Percent} onClick={() => setReadj(true)}>Reajustar</Button>}
        {c.tipo === 'RECORRENTE' && c.asaas_subscription_id && (
          <Button variant="secondary" icon={RefreshCw} loading={syncAsaas.isPending} onClick={() => syncAsaas.mutate()} title="Sincronizar pagamentos da assinatura no Asaas">
            Sincronizar Asaas
          </Button>
        )}
        {c.status === 'ATIVO' && <Button variant="secondary" icon={Pause} onClick={() => status.mutate({ s: 'PAUSADO' })}>Pausar</Button>}
        {c.status === 'PAUSADO' && <Button variant="secondary" icon={Play} onClick={() => status.mutate({ s: 'ATIVO' })}>Retomar</Button>}
        {['ATIVO', 'PAUSADO'].includes(c.status) && <Button variant="danger" icon={XCircle} onClick={() => { const m = window.prompt('Motivo do cancelamento (aparece no relatório de churn):'); if (m !== null) status.mutate({ s: 'CANCELADO', motivo: m }); }}>Cancelar</Button>}
        {!['CANCELADO', 'ENCERRADO'].includes(c.status) && <Button variant="secondary" icon={Pencil} onClick={() => setEdit(true)}>Editar</Button>}
      </>}>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
          <StatusPill status={c.status} />
          <Link to="/empresas/clientes" className="font-semibold hover:underline">{c.client?.nome_fantasia || c.client?.nome}</Link>
          <span className="text-[var(--muted)]">{c.tipo === 'RECORRENTE' ? `${money(c.valor_recorrente)} ${c.periodicidade.toLowerCase()}` : `Projeto de ${money(c.valor_pontual)}`}{c.tipo === 'RECORRENTE' && c.valor_pontual > 0 ? ` + ${money(c.valor_pontual)} de setup` : ''}</span>
          <span className="text-[var(--muted)]">Desde {date(c.data_inicio)}{c.data_fim ? ` até ${date(c.data_fim)}` : ''}</span>
          {c.tipo === 'RECORRENTE' && c.data_reajuste && <span className="text-[var(--muted)]">Reajuste {c.indice_reajuste || 'anual'} em {date(c.data_reajuste)}</span>}
          <span className="text-[var(--muted)]">{c.asaas_subscription_id ? `Assinatura Asaas ${c.asaas_subscription_id}` : c.cobrar_via_asaas ? 'Cobrança pelo Asaas' : 'Cobrança manual'}</span>
          {c.motivo_cancelamento && <span className="text-[var(--bad)]">Motivo: {c.motivo_cancelamento}</span>}
        </div>
      </PageHeader>

      {c.tipo === 'RECORRENTE' && c.asaas_subscription_id && (
        <div className="mb-5 p-4 rounded-xl border border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/20 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600/10 flex items-center justify-center">
                <Repeat className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <span className="text-xs text-[var(--muted)] block">Assinatura Asaas Integrada</span>
                <span className="font-bold text-sm text-[var(--ink)]">#{c.asaas_subscription_id}</span>
              </div>
              <span className="ml-2 px-2 py-0.5 rounded text-xs font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-900/60 dark:text-indigo-300">
                {c.status === 'ATIVO' ? 'Assinatura Ativa' : c.status}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" icon={RefreshCw} loading={syncAsaas.isPending} onClick={() => syncAsaas.mutate()}>
                Sincronizar com Asaas
              </Button>
            </div>
          </div>

          {(() => {
            const pendingTx = c.lancamentos?.find((l) => l.status === 'PENDENTE' && l.asaas_invoice_url);
            if (!pendingTx) return null;
            return (
              <div className="p-3 bg-[var(--surface)] rounded-lg border border-[var(--line)] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-[var(--muted)] block">Fatura atual com vencimento em {date(pendingTx.vencimento)}:</span>
                  <span className="font-bold text-sm num">{money(pendingTx.valor)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" icon={Copy} onClick={() => { navigator.clipboard.writeText(pendingTx.asaas_invoice_url); toast.success('Link de pagamento copiado!'); }}>
                    Copiar Link
                  </Button>
                  <Button size="sm" variant="secondary" icon={ExternalLink} onClick={() => window.open(pendingTx.asaas_invoice_url, '_blank')}>
                    Abrir Fatura
                  </Button>
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" icon={Share2} onClick={() => {
                    const text = encodeURIComponent(`Olá! Segue o link da sua fatura (${pendingTx.descricao}) no valor de R$ ${money(pendingTx.valor)}: ${pendingTx.asaas_invoice_url}`);
                    window.open(`https://wa.me/?text=${text}`, '_blank');
                  }}>
                    Enviar WhatsApp
                  </Button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {c.tipo === 'RECORRENTE' && (
        <div className="mb-5 p-4 rounded-xl border border-[var(--line)] bg-[var(--surface)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[var(--surface-2)] flex items-center justify-center"><Target className="w-4 h-4 text-[var(--result)]" /></div>
            <div>
              <span className="text-xs text-[var(--muted)] block">Margem prevista</span>
              <span className="font-bold text-lg num">{c.margem_prevista_percent !== null && c.margem_prevista_percent !== undefined ? pct(c.margem_prevista_percent) : '—'}</span>
              <span className="text-xs text-[var(--muted)] ml-2">custo direto previsto {money(c.custo_previsto_mensal || 0)}/mês · meta da empresa {pct(meta)}</span>
            </div>
          </div>
          {w && !['CANCELADO', 'ENCERRADO'].includes(c.status) && <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEdit(true)}>Ajustar margem prevista</Button>}
        </div>
      )}

      {c.margem_mes !== undefined && (
        <div className="grid lg:grid-cols-2 gap-5 mb-5">
          <MarginCard title="Margem neste mês" m={c.margem_mes} meta={meta} />
          <MarginCard title="Margem acumulada desde o início" m={c.margem_total} meta={meta} />
        </div>
      )}

      <div className="grid xl:grid-cols-[1fr_400px] gap-5">
        <Panel title="Lançamentos do contrato" pad={false} action={can('financeiro:write') && <Button size="sm" variant="secondary" icon={Receipt} onClick={() => setCost(true)}>Lançar custo</Button>}>
          {!c.lancamentos.length ? <p className="px-5 pb-5 text-sm text-[var(--muted)]">Nenhum lançamento ainda.</p> : (
            <div className="overflow-x-auto"><table className="tbl">
              <thead><tr><th>Vencimento</th><th>Descrição</th><th className="r">Valor</th><th>Situação</th></tr></thead>
              <tbody>{c.lancamentos.map((t) => (
                <tr key={t.id}>
                  <td className="num">{date(t.vencimento)}</td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <span>{t.descricao}</span>
                      {t.asaas_invoice_url && (
                        <button
                          type="button"
                          onClick={() => { navigator.clipboard.writeText(t.asaas_invoice_url); toast.success('Link da fatura copiado!'); }}
                          className="text-[var(--result)] hover:underline inline-flex items-center gap-0.5 text-xs font-semibold ml-1"
                          title="Copiar link da fatura"
                        >
                          <Link2 className="w-3 h-3" /> Link
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-[var(--muted)]">{t.account?.nome}</div>
                  </td>
                  <td className="r"><Money value={t.tipo === 'RECEITA' ? t.valor : -t.valor} colored /></td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <StatusPill status={t.situacao} />
                      {t.asaas_payment_id && <span className="text-[10px] text-[var(--muted)]">Asaas</span>}
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </Panel>
        <div className="space-y-5">
          <Panel title="Itens contratados" pad={false}>
            <table className="tbl"><tbody>{c.items.map((i) => (
              <tr key={i.id}><td>{i.descricao}<div className="text-xs text-[var(--muted)]">{i.cobranca === 'RECORRENTE' ? 'Recorrente' : 'Único'} · custo {money(i.custo_unitario)}</div></td><td className="r num">{num(i.quantidade)} × {money(i.preco_unitario)}</td></tr>
            ))}{!c.items.length && <tr><td className="text-[var(--muted)]">Contrato sem itens detalhados.</td></tr>}</tbody></table>
          </Panel>
          <Panel title="Horas da equipe" pad={false} action={can('operacional:write') && <Button size="sm" variant="secondary" icon={Clock3} onClick={() => setHours(true)}>Apontar horas</Button>}>
            {!c.apontamentos.length ? <p className="px-5 pb-5 text-sm text-[var(--muted)]">Aponte as horas para a margem refletir o custo real da equipe.</p> : (
              <table className="tbl"><tbody>{c.apontamentos.map((e) => (
                <tr key={e.id}><td className="num">{date(e.data)}</td><td>{e.teamMember?.nome}<div className="text-xs text-[var(--muted)]">{e.descricao}</div></td><td className="r num">{num(e.horas)}h<div className="text-xs text-[var(--muted)]">{money(e.custo_total)}</div></td>
                  <td>{can('operacional:write') && <button className="p-1 text-[var(--muted)] hover:text-[var(--bad)]" aria-label="Remover" onClick={() => delEntry.mutate(e.id)}><X className="w-4 h-4" /></button>}</td></tr>
              ))}</tbody></table>
            )}
          </Panel>
        </div>
      </div>

      {edit && <ContractForm initial={c} onClose={() => setEdit(false)} />}
      {readj && <ReadjustModal c={c} onClose={() => setReadj(false)} />}
      {cost && <TransactionForm tipo="DESPESA" initial={{ account_id: L.accounts.find((a) => a.codigo === '3.1.01')?.id }} presetContractId={c.id} onClose={() => setCost(false)} />}
      {hours && <HoursModal contractId={c.id} onClose={() => setHours(false)} />}
    </>
  );
}

function ReadjustModal({ c, onClose }) {
  const ipcaQ = useBizQuery('/indices/ipca', {}, { staleTime: 60 * 60 * 1000 });
  const [f, setF] = useState({ percentual: '', novo_valor: '', a_partir: todayYmd() });
  const novo = f.novo_valor !== '' ? Number(f.novo_valor) : Number(c.valor_recorrente) * (1 + Number(f.percentual || 0) / 100);
  const m = useBizMutation((body) => biz(`/contracts/${c.id}/readjust`, { method: 'POST', body }), { success: 'Reajuste aplicado', onSuccess: onClose });
  const ipca = ipcaQ.data;
  return (
    <Modal open onClose={onClose} title="Reajustar contrato" description={`Valor atual: ${money(c.valor_recorrente)} (${c.indice_reajuste || 'sem índice definido'})`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={m.isPending} onClick={() => m.mutate({ ...(f.novo_valor !== '' ? { novo_valor: Number(f.novo_valor) } : { percentual: Number(f.percentual) }), a_partir: f.a_partir })}>Aplicar {money(novo)}</Button></>}>
      <div className="grid grid-cols-2 gap-4">
        {ipca?.acumulado_12m != null && (
          <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 text-xs">
            <span>IPCA acumulado 12m (Banco Central · ref. {ipca.referencia}): <b className="num text-emerald-700 dark:text-emerald-300">{String(ipca.acumulado_12m).replace('.', ',')}%</b></span>
            <Button size="sm" variant="secondary" onClick={() => setF({ ...f, percentual: String(ipca.acumulado_12m), novo_valor: '' })}>Usar IPCA ({String(ipca.acumulado_12m).replace('.', ',')}%)</Button>
          </div>
        )}
        <Field label="Percentual (%)"><Input type="number" step="0.01" value={f.percentual} onChange={(e) => setF({ ...f, percentual: e.target.value, novo_valor: '' })} placeholder={ipca?.acumulado_12m ? String(ipca.acumulado_12m) : '4,5'} /></Field>
        <Field label="Ou novo valor"><MoneyInput value={f.novo_valor} onChange={(v) => setF({ ...f, novo_valor: v, percentual: '' })} /></Field>
        <Field label="A partir de" className="col-span-2" hint="Atualiza itens, assinatura no Asaas e títulos em aberto a partir desta data. Próximo reajuste é agendado automaticamente para 01/01."><Input type="date" value={f.a_partir} onChange={(e) => setF({ ...f, a_partir: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

export function HoursModal({ contractId, onClose }) {
  const L = useLookups();
  const [f, setF] = useState({ team_member_id: '', contract_id: contractId || '', horas: '', data: todayYmd(), descricao: '' });
  const m = useBizMutation((body) => biz('/time-entries', { method: 'POST', body }), { success: 'Horas apontadas', onSuccess: onClose });
  const member = L.team.find((t) => t.id === f.team_member_id);
  return (
    <Modal open onClose={onClose} title="Apontar horas" description="O custo é calculado pelo custo/hora do colaborador e entra na margem do contrato."
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={m.isPending} onClick={() => m.mutate({ ...f, horas: Number(f.horas), contract_id: f.contract_id || null })}>Apontar</Button></>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Colaborador" className="col-span-2"><Select value={f.team_member_id} onChange={(e) => setF({ ...f, team_member_id: e.target.value })}><option value="">Selecione…</option>{L.team.filter((t) => t.ativo).map((t) => <option key={t.id} value={t.id}>{t.nome} ({money(t.custo_hora)}/h)</option>)}</Select></Field>
        {!contractId && <Field label="Contrato" className="col-span-2"><Select value={f.contract_id} onChange={(e) => setF({ ...f, contract_id: e.target.value })}><option value="">Interno (sem contrato)</option>{L.contracts.filter((c) => c.status === 'ATIVO').map((c) => <option key={c.id} value={c.id}>#{c.numero} {c.titulo}</option>)}</Select></Field>}
        <Field label="Horas" hint={member && f.horas ? `Custo: ${money(member.custo_hora * Number(f.horas))}` : undefined}><Input type="number" step="0.25" value={f.horas} onChange={(e) => setF({ ...f, horas: e.target.value })} /></Field>
        <Field label="Data"><Input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Field>
        <Field label="O que foi feito" className="col-span-2"><Input value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}
