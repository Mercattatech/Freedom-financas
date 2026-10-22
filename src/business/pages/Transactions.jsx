import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Wallet, Link2, Undo2, Ban, Trash2, Send, Receipt, Copy, Barcode, ExternalLink, Share2, Check, Tag, X, FileText, Download, RefreshCw, AlertTriangle, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { biz } from '../api';
import { useBiz, useBizQuery, useBizMutation } from '../BizContext';
import { PageHeader, Button, Field, Input, Select, Textarea, MoneyInput, Modal, StatusPill, Money, Empty, Loading, ErrorBox, SearchInput, useDebounced, cx } from '../components/ui';
import { useLookups, FORMAS, GRUPOS_DRE } from '../components/lookups';
import { money, date, todayYmd, ymd, currentYm } from '../format';

const SITUACOES = [['ABERTO', 'Em aberto'], ['VENCIDO', 'Vencidos'], ['A_VENCER', 'A vencer'], ['PAGO', 'Pagos'], ['', 'Todos']];

export default function Transactions({ tipo }) {
  const receita = tipo === 'RECEITA';
  const [sp, setSp] = useSearchParams();
  const [situacao, setSituacao] = useState(sp.get('situacao') ?? 'ABERTO');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [nfseFilter, setNfseFilter] = useState('');
  const [editing, setEditing] = useState(null);
  const [paying, setPaying] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const [linkModal, setLinkModal] = useState(false);
  const [billModal, setBillModal] = useState(false);
  const [invoiceModal, setInvoiceModal] = useState(null);
  const [batchInvoiceModal, setBatchInvoiceModal] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [batchPayModal, setBatchPayModal] = useState(false);
  const [batchUpdateModal, setBatchUpdateModal] = useState(false);
  const [batchCancelModal, setBatchCancelModal] = useState(false);
  const [batchDeleteModal, setBatchDeleteModal] = useState(false);

  const { can } = useBiz();
  const dq = useDebounced(q);
  const list = useBizQuery('/transactions', { tipo, situacao, q: dq, from, to, nfse_status: nfseFilter || undefined });
  const write = can('financeiro:write');

  const act = useBizMutation(({ id, action, body, method = 'POST' }) => biz(`/transactions/${id}${action ? `/${action}` : ''}`, { method, body }), {
    success: (_, v) => ({ cancel: 'Lançamento cancelado', reopen: 'Baixa estornada', charge: 'Cobrança emitida no Asaas', '': 'Lançamento excluído' })[v.action ?? ''] || 'Feito',
  });

  const items = list.data?.items || [];
  const r = list.data?.resumo;

  const toggleSelect = (id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === items.length && items.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((t) => t.id));
    }
  };

  const selectedItems = useMemo(() => items.filter((t) => selectedIds.includes(t.id)), [items, selectedIds]);
  const totalSelected = useMemo(() => selectedItems.reduce((acc, t) => acc + (Number(t.saldo ?? t.valor) || 0), 0), [selectedItems]);

  const onFilterSituacao = (k) => {
    setSelectedIds([]);
    setSituacao(k);
    setSp(k ? { situacao: k } : {});
  };

  return (
    <>
      <PageHeader
        title={receita ? 'Contas a receber' : 'Contas a pagar'}
        subtitle={receita ? 'Mensalidades, projetos e vendas. Emita cobranças no Asaas e acompanhe quem pagou.' : 'Fornecedores, folha, impostos e despesas fixas. Vincule ao contrato para entrar na margem dele.'}
        actions={
          write && (
            <div className="flex gap-2">
              {receita ? (
                <Button variant="secondary" icon={Link2} onClick={() => setLinkModal(true)}>Link Asaas</Button>
              ) : (
                <Button variant="secondary" icon={Barcode} onClick={() => setBillModal(true)}>Pagar boleto Asaas</Button>
              )}
              <Button icon={Plus} onClick={() => setEditing({})}>{receita ? 'Nova conta a receber' : 'Nova conta a pagar'}</Button>
            </div>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="inline-flex rounded-lg border border-[var(--line)] bg-[var(--surface)] p-0.5">
          {SITUACOES.map(([k, l]) => (
            <button key={k || 'all'} onClick={() => onFilterSituacao(k)} className={cx('px-3 h-9 rounded-md text-sm font-semibold', situacao === k ? 'bg-[var(--ink)] text-[var(--surface)]' : 'text-[var(--ink-2)] hover:bg-[var(--line-2)]')}>{l}</button>
          ))}
        </div>
        <Input type="date" value={from} onChange={(e) => { setSelectedIds([]); setFrom(e.target.value); }} className="w-[150px]" aria-label="Vencimento de" />
        <Input type="date" value={to} onChange={(e) => { setSelectedIds([]); setTo(e.target.value); }} className="w-[150px]" aria-label="Vencimento até" />
        {receita && (
          <Select
            value={nfseFilter}
            onChange={(e) => { setSelectedIds([]); setNfseFilter(e.target.value); }}
            className="w-[160px]"
            aria-label="Filtro de NFS-e"
          >
            <option value="">NFS-e: Todas</option>
            <option value="AUTHORIZED">NFS-e: Autorizada</option>
            <option value="SCHEDULED">NFS-e: Agendada</option>
            <option value="ERROR">NFS-e: Com erro</option>
          </Select>
        )}
        <SearchInput value={q} onChange={(val) => { setSelectedIds([]); setQ(val); }} placeholder={receita ? 'Buscar descrição ou cliente' : 'Buscar descrição ou fornecedor'} />
      </div>

      {r && (
        <div className="flex flex-wrap gap-x-8 gap-y-2 mb-4 text-sm">
          <span className="text-[var(--muted)]">{r.quantidade} lançamentos</span>
          <span>Total <b className="num">{money(r.total)}</b></span>
          <span>{receita ? 'Recebido' : 'Pago'} <b className="num">{money(r.pago)}</b></span>
          <span>Em aberto <b className="num">{money(r.em_aberto)}</b></span>
          {r.vencido > 0 && <span className="text-[var(--bad)]">Vencido <b className="num">{money(r.vencido)}</b></span>}
        </div>
      )}

      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden">
        {list.isLoading ? <Loading /> : list.error ? <div className="p-4"><ErrorBox error={list.error} /></div> : !items.length ? (
          <Empty icon={Receipt} title="Nada por aqui" text={situacao === 'VENCIDO' ? 'Nenhum lançamento vencido. Bom sinal.' : 'Nenhum lançamento com esses filtros.'} action={write && <Button icon={Plus} onClick={() => setEditing({})}>Lançar agora</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead>
                <tr>
                  {write && (
                    <th className="w-10 text-center px-2">
                      <input
                        type="checkbox"
                        checked={items.length > 0 && selectedIds.length === items.length}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-[var(--line)] cursor-pointer accent-[var(--result)]"
                        title="Selecionar todos"
                        aria-label="Selecionar todos"
                      />
                    </th>
                  )}
                  <th>Vencimento</th>
                  <th>Descrição</th>
                  <th>{receita ? 'Cliente' : 'Fornecedor'}</th>
                  <th>Classificação</th>
                  <th className="r">Valor</th>
                  <th className="r">Em aberto</th>
                  <th>Situação</th>
                  <th className="r"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {items.map((t) => {
                  const isSelected = selectedIds.includes(t.id);
                  return (
                    <tr key={t.id} className={cx(isSelected && 'bg-[var(--side-active)]/10')}>
                      {write && (
                        <td className="w-10 text-center px-2">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(t.id)}
                            className="w-4 h-4 rounded border-[var(--line)] cursor-pointer accent-[var(--result)]"
                            aria-label={`Selecionar ${t.descricao}`}
                          />
                        </td>
                      )}
                      <td className="num whitespace-nowrap">{date(t.vencimento)}{t.dias_atraso > 0 && <div className="text-xs text-[var(--bad)]">{t.dias_atraso} dias de atraso</div>}</td>
                      <td className="min-w-[220px]">
                        <button className="font-semibold text-left hover:underline" onClick={() => write && setEditing(t)}>{t.descricao}</button>
                        {t.contract && <div className="text-xs text-[var(--muted)]">Contrato #{t.contract.numero}</div>}
                      </td>
                      <td className="text-[var(--ink-2)] min-w-[170px]">
                        {t.client ? (
                          <div>
                            <div className="flex items-center gap-1.5 group">
                              <span className="font-semibold text-[var(--ink)] text-sm">{t.client.nome_fantasia || t.client.nome}</span>
                              {write && (
                                <button
                                  type="button"
                                  onClick={() => setEditingClient(t.client)}
                                  className="p-1 rounded hover:bg-[var(--line-2)] text-[var(--muted)] hover:text-[var(--ink)] transition-colors opacity-70 group-hover:opacity-100"
                                  title="Editar dados do cliente (CPF/CNPJ, endereço, etc.)"
                                  aria-label={`Editar ${t.client.nome}`}
                                >
                                  <Pencil className="w-3 h-3 text-[var(--result)]" />
                                </button>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-[var(--muted)] mt-0.5">
                              {t.client.documento ? (
                                <span>Doc: {t.client.documento}</span>
                              ) : (
                                <span className="text-[var(--bad)] font-semibold flex items-center gap-0.5">
                                  <AlertTriangle className="w-2.5 h-2.5" /> Sem CPF/CNPJ
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          t.supplier?.nome || '—'
                        )}
                      </td>
                      <td className="text-xs text-[var(--ink-2)] min-w-[140px]">{t.account ? t.account.nome : <span className="text-[var(--warn)] font-semibold">Sem classificação</span>}{t.costCenter && <div className="text-[var(--muted)]">{t.costCenter.nome}</div>}</td>
                      <td className="r"><Money value={t.valor} /></td>
                      <td className="r"><Money value={['PAGO', 'CANCELADO'].includes(t.status) ? 0 : t.saldo} /></td>
                      <td>
                        <StatusPill status={t.situacao} />
                        {t.asaas_payment_id && <div className="text-[11px] text-[var(--muted)] mt-0.5">Asaas</div>}
                        {receita && t.nfse_status && (
                          <div className="mt-1">
                            {t.nfse_status === 'AUTHORIZED' ? (
                              <button
                                onClick={() => setInvoiceModal(t)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--in)] bg-[var(--in)]/10 hover:bg-[var(--in)]/20 px-1.5 py-0.5 rounded transition-colors"
                                title="NFS-e Autorizada - clique para ver"
                              >
                                <FileText className="w-3 h-3" /> NFS-e #{t.nfse_numero || 'OK'}
                              </button>
                            ) : t.nfse_status === 'ERROR' ? (
                              <button
                                onClick={() => setInvoiceModal(t)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--bad)] bg-[var(--bad)]/10 hover:bg-[var(--bad)]/20 px-1.5 py-0.5 rounded transition-colors"
                                title={t.nfse_erro || 'Erro na emissão'}
                              >
                                <AlertTriangle className="w-3 h-3" /> Erro NFS-e
                              </button>
                            ) : (
                              <button
                                onClick={() => setInvoiceModal(t)}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--warn)] bg-[var(--warn)]/10 hover:bg-[var(--warn)]/20 px-1.5 py-0.5 rounded transition-colors"
                                title={`NFS-e: ${t.nfse_status}`}
                              >
                                <RefreshCw className="w-3 h-3 animate-spin" /> NFS-e
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="r whitespace-nowrap">
                        {write && (
                          <div className="inline-flex gap-1">
                            {!['PAGO', 'CANCELADO'].includes(t.status) && <Button size="sm" variant={receita ? 'success' : 'primary'} icon={Wallet} onClick={() => setPaying(t)}>{receita ? 'Receber' : 'Pagar'}</Button>}
                            {receita && t.status === 'PENDENTE' && !t.asaas_payment_id && t.client && <Button size="sm" variant="secondary" icon={Send} loading={act.isPending && act.variables?.id === t.id} onClick={() => act.mutate({ id: t.id, action: 'charge' })} title="Emitir cobrança no Asaas">Cobrar</Button>}
                            {receita && (
                              <Button
                                size="sm"
                                variant={t.nfse_status === 'AUTHORIZED' ? 'ghost' : 'secondary'}
                                icon={FileText}
                                onClick={() => setInvoiceModal(t)}
                                title={t.nfse_status === 'AUTHORIZED' ? `NFS-e Nº ${t.nfse_numero}` : 'Emitir Nota Fiscal (NFS-e)'}
                                aria-label="Nota Fiscal"
                              />
                            )}
                            {t.asaas_invoice_url && <Button size="sm" variant="ghost" icon={Link2} onClick={() => { navigator.clipboard.writeText(t.asaas_invoice_url); toast.success('Link de pagamento copiado'); }} title="Copiar link de pagamento" aria-label="Copiar link de pagamento" />}
                            {t.asaas_pix_payload && <Button size="sm" variant="ghost" icon={Copy} onClick={() => { navigator.clipboard.writeText(t.asaas_pix_payload); toast.success('PIX copia e cola copiado'); }} title="Copiar PIX copia e cola" aria-label="Copiar PIX" />}
                            {['PAGO', 'PARCIAL'].includes(t.status) && <Button size="sm" variant="ghost" icon={Undo2} onClick={() => window.confirm('Estornar a baixa deste lançamento?') && act.mutate({ id: t.id, action: 'reopen' })} title="Estornar baixa" aria-label="Estornar baixa" />}
                            {t.status === 'PENDENTE' && <Button size="sm" variant="ghost" icon={Ban} onClick={() => { const m = window.prompt('Motivo do cancelamento (opcional)'); if (m !== null) act.mutate({ id: t.id, action: 'cancel', body: { motivo: m } }); }} title="Cancelar" aria-label="Cancelar" />}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Barra flutuante de ações em massa */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-wrap items-center gap-2 sm:gap-4 px-4 py-3 bg-[var(--ink)] text-[var(--surface)] rounded-2xl shadow-2xl border border-white/10 animate-in fade-in slide-in-from-bottom-4 duration-200 max-w-[95vw]">
          <div className="flex items-center gap-2 pr-3 border-r border-white/20 shrink-0">
            <span className="font-extrabold text-sm">{selectedIds.length} selecionado{selectedIds.length > 1 ? 's' : ''}</span>
            <span className="text-xs text-[var(--muted)]">({money(totalSelected)})</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <Button size="sm" variant={receita ? 'success' : 'primary'} icon={Wallet} onClick={() => setBatchPayModal(true)}>
              {receita ? 'Baixar recebimentos' : 'Baixar pagamentos'}
            </Button>
            {receita && (
              <Button size="sm" variant="secondary" icon={FileText} onClick={() => setBatchInvoiceModal(true)}>
                Emitir NFS-e
              </Button>
            )}
            <Button size="sm" variant="secondary" icon={Tag} onClick={() => setBatchUpdateModal(true)}>
              Classificar
            </Button>
            <Button size="sm" variant="ghost" icon={Ban} onClick={() => setBatchCancelModal(true)} className="hover:bg-white/10 text-white">
              Cancelar
            </Button>
            <Button size="sm" variant="danger" icon={Trash2} onClick={() => setBatchDeleteModal(true)}>
              Excluir
            </Button>
          </div>

          <button onClick={() => setSelectedIds([])} className="p-1 rounded-lg hover:bg-white/10 text-[var(--muted)] hover:text-white ml-auto" title="Desmarcar todos" aria-label="Desmarcar todos">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {editing && <TransactionForm tipo={tipo} initial={editing} onClose={() => setEditing(null)} onDelete={(id) => act.mutate({ id, action: '', method: 'DELETE' }, { onSuccess: () => setEditing(null) })} />}
      {paying && <PayModal t={paying} onClose={() => setPaying(null)} />}
      {linkModal && <PaymentLinkModal onClose={() => setLinkModal(false)} />}
      {billModal && <PayBillModal onClose={() => setBillModal(false)} />}
      {invoiceModal && <InvoiceModal t={invoiceModal} onClose={() => setInvoiceModal(null)} onRefresh={() => list.refetch()} onEditClient={(cl) => setEditingClient(cl)} />}
      {batchInvoiceModal && <BatchInvoiceModal ids={selectedIds} count={selectedIds.length} total={totalSelected} onClose={() => setBatchInvoiceModal(false)} onSuccess={() => { setSelectedIds([]); list.refetch(); }} />}
      {batchPayModal && <BatchPayModal ids={selectedIds} count={selectedIds.length} total={totalSelected} tipo={tipo} onClose={() => setBatchPayModal(false)} onSuccess={() => setSelectedIds([])} />}
      {batchUpdateModal && <BatchUpdateModal ids={selectedIds} count={selectedIds.length} tipo={tipo} onClose={() => setBatchUpdateModal(false)} onSuccess={() => setSelectedIds([])} />}
      {batchCancelModal && <BatchCancelModal ids={selectedIds} count={selectedIds.length} onClose={() => setBatchCancelModal(false)} onSuccess={() => setSelectedIds([])} />}
      {batchDeleteModal && <BatchDeleteModal ids={selectedIds} count={selectedIds.length} onClose={() => setBatchDeleteModal(false)} onSuccess={() => setSelectedIds([])} />}
      {editingClient && <ClientQuickEditModal client={editingClient} onClose={() => setEditingClient(null)} onSaved={() => list.refetch()} />}
    </>
  );
}

export function TransactionForm({ tipo, initial, onClose, onDelete, presetContractId }) {
  const receita = tipo === 'RECEITA';
  const L = useLookups();
  const isNew = !initial.id;
  const [f, setF] = useState({
    descricao: initial.descricao || '', valor: initial.valor ?? '', vencimento: ymd(initial.vencimento) || todayYmd(),
    competencia: initial.competencia ? ymd(initial.competencia).slice(0, 7) : '', client_id: initial.client_id || '', supplier_id: initial.supplier_id || '',
    contract_id: initial.contract_id || presetContractId || '', account_id: initial.account_id || '', cost_center_id: initial.cost_center_id || '',
    bank_account_id: initial.bank_account_id || '', forma_pagamento: initial.forma_pagamento || '', documento: initial.documento || '', observacoes: initial.observacoes || '',
    modo: 'UNICA', n: 2, pago: false, cobrar_asaas: false, aplicar_proximas: false,
  });
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e });
  const accounts = useMemo(() => L.accounts.filter((a) => a.natureza === tipo), [L.accounts, tipo]);
  const grouped = useMemo(() => Object.entries(accounts.reduce((acc, a) => { (acc[a.grupo_dre] ||= []).push(a); return acc; }, {})), [accounts]);
  const save = useBizMutation((body) => (isNew ? biz('/transactions', { method: 'POST', body }) : biz(`/transactions/${initial.id}`, { method: 'PUT', body })), {
    success: isNew ? 'Lançamento criado' : 'Lançamento atualizado', onSuccess: onClose,
  });
  const submit = (e) => {
    e.preventDefault();
    const body = {
      tipo, descricao: f.descricao, valor: Number(f.valor), vencimento: f.vencimento, competencia: f.competencia || undefined,
      client_id: receita ? f.client_id || null : null, supplier_id: !receita ? f.supplier_id || null : null, contract_id: f.contract_id || null,
      account_id: f.account_id || null, cost_center_id: f.cost_center_id || null, forma_pagamento: f.forma_pagamento || null,
      documento: f.documento || null, observacoes: f.observacoes || null,
    };
    if (isNew) {
      if (f.modo === 'PARCELAS') body.parcelas = Number(f.n);
      if (f.modo === 'REPETIR') body.repetir = Number(f.n);
      if (f.pago) { body.pago = true; body.bank_account_id = f.bank_account_id || null; }
      if (f.cobrar_asaas) body.cobrar_asaas = true;
    } else body.aplicar_proximas = f.aplicar_proximas;
    save.mutate(body);
  };
  return (
    <Modal open onClose={onClose} width={680} title={isNew ? (receita ? 'Nova conta a receber' : 'Nova conta a pagar') : 'Editar lançamento'}
      footer={<>
        {!isNew && onDelete && initial.status !== 'PAGO' && <Button variant="danger" icon={Trash2} className="mr-auto" onClick={() => window.confirm('Excluir este lançamento?') && onDelete(initial.id)}>Excluir</Button>}
        <Button variant="secondary" onClick={onClose}>Cancelar</Button>
        <Button type="submit" form="txform" loading={save.isPending}>{isNew ? 'Lançar' : 'Salvar'}</Button>
      </>}>
      <form id="txform" onSubmit={submit} className="grid sm:grid-cols-2 gap-4">
        <Field label="Descrição" className="sm:col-span-2"><Input required value={f.descricao} onChange={set('descricao')} placeholder={receita ? 'Mensalidade outubro — Locadora Alfa' : 'Edição de vídeos — freelancer'} /></Field>
        <Field label={f.modo === 'PARCELAS' ? 'Valor total' : 'Valor'}><MoneyInput required value={f.valor} onChange={set('valor')} /></Field>
        <Field label={f.modo === 'UNICA' ? 'Vencimento' : '1º vencimento'}><Input type="date" required value={f.vencimento} onChange={set('vencimento')} /></Field>
        {receita ? (
          <Field label="Cliente"><Select value={f.client_id} onChange={set('client_id')}><option value="">Sem cliente</option>{L.clients.map((c) => <option key={c.id} value={c.id}>{c.nome_fantasia || c.nome}</option>)}</Select></Field>
        ) : (
          <Field label="Fornecedor"><Select value={f.supplier_id} onChange={set('supplier_id')}><option value="">Sem fornecedor</option>{L.suppliers.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</Select></Field>
        )}
        <Field label="Contrato" hint={receita ? undefined : 'Custos vinculados reduzem a margem do contrato'}>
          <Select value={f.contract_id} onChange={set('contract_id')}><option value="">Nenhum (estrutura da empresa)</option>{L.contracts.filter((c) => !['RASCUNHO'].includes(c.status)).map((c) => <option key={c.id} value={c.id}>#{c.numero} {c.titulo}</option>)}</Select>
        </Field>
        <Field label="Conta (DRE)">
          <Select value={f.account_id} onChange={set('account_id')}>
            <option value="">Selecione…</option>
            {grouped.map(([g, list]) => <optgroup key={g} label={GRUPOS_DRE[g]}>{list.map((a) => <option key={a.id} value={a.id}>{a.codigo} {a.nome}</option>)}</optgroup>)}
          </Select>
        </Field>
        <Field label="Centro de custo"><Select value={f.cost_center_id} onChange={set('cost_center_id')}><option value="">Nenhum</option>{L.costCenters.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</Select></Field>
        <Field label="Competência" hint="Mês do resultado na DRE. Padrão: mês do vencimento."><Input type="month" value={f.competencia} onChange={set('competencia')} placeholder={currentYm()} /></Field>
        <Field label="Forma de pagamento"><Select value={f.forma_pagamento} onChange={set('forma_pagamento')}><option value="">—</option>{FORMAS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
        <Field label="Documento / NF"><Input value={f.documento} onChange={set('documento')} /></Field>
        {isNew && (
          <div className="sm:col-span-2 rounded-lg border border-[var(--line)] p-3 grid sm:grid-cols-[1fr_120px] gap-3 items-end">
            <Field label="Repetição">
              <Select value={f.modo} onChange={set('modo')}>
                <option value="UNICA">Lançamento único</option><option value="PARCELAS">Parcelar o valor total</option><option value="REPETIR">Repetir todo mês (mesmo valor)</option>
              </Select>
            </Field>
            {f.modo !== 'UNICA' && <Field label={f.modo === 'PARCELAS' ? 'Parcelas' : 'Meses'}><Input type="number" min={2} max={120} value={f.n} onChange={set('n')} /></Field>}
          </div>
        )}
        {isNew && !receita && (
          <label className="flex items-center gap-2 text-sm font-medium sm:col-span-2"><input type="checkbox" checked={f.pago} onChange={set('pago')} className="w-4 h-4" />Já está pago{f.modo !== 'UNICA' && ' (somente o primeiro)'}</label>
        )}
        {isNew && f.pago && <Field label="Pago pela conta"><Select value={f.bank_account_id} onChange={set('bank_account_id')}><option value="">—</option>{L.banks.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}</Select></Field>}
        {isNew && receita && (
          <label className="flex items-start gap-2 text-sm font-medium sm:col-span-2"><input type="checkbox" checked={f.cobrar_asaas} onChange={set('cobrar_asaas')} className="w-4 h-4 mt-0.5" /><span>Emitir cobrança no Asaas<span className="block text-xs text-[var(--muted)] font-normal">Gera boleto/PIX com link de pagamento. O cliente precisa ter CPF/CNPJ.</span></span></label>
        )}
        {!isNew && initial.grupo_parcelas && <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={f.aplicar_proximas} onChange={set('aplicar_proximas')} className="w-4 h-4" />Aplicar classificação às próximas parcelas em aberto</label>}
        <Field label="Observações" className="sm:col-span-2"><Textarea value={f.observacoes} onChange={set('observacoes')} rows={2} /></Field>
      </form>
    </Modal>
  );
}

function PayModal({ t, onClose }) {
  const L = useLookups();
  const receita = t.tipo === 'RECEITA';
  const [f, setF] = useState({ valor: t.saldo, data_pagamento: todayYmd(), juros_multa: Number(t.juros_multa) || 0, desconto: Number(t.desconto) || 0, bank_account_id: t.bank_account_id || '' });
  const pay = useBizMutation((body) => biz(`/transactions/${t.id}/pay`, { method: 'POST', body }), { success: receita ? 'Recebimento registrado' : 'Pagamento registrado', onSuccess: onClose });
  const total = Number(t.valor) + Number(f.juros_multa || 0) - Number(f.desconto || 0) - Number(t.valor_pago || 0);
  return (
    <Modal open onClose={onClose} title={receita ? 'Registrar recebimento' : 'Registrar pagamento'} description={`${t.descricao} — vencimento ${date(t.vencimento)}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button variant={receita ? 'success' : 'primary'} loading={pay.isPending} onClick={() => pay.mutate({ ...f, valor: Number(f.valor), bank_account_id: f.bank_account_id || undefined })}>{receita ? 'Confirmar recebimento' : 'Confirmar pagamento'}</Button></>}>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Juros e multa"><MoneyInput value={f.juros_multa} onChange={(v) => setF({ ...f, juros_multa: v, valor: Number(t.valor) + Number(v || 0) - Number(f.desconto || 0) - Number(t.valor_pago || 0) })} /></Field>
        <Field label="Desconto"><MoneyInput value={f.desconto} onChange={(v) => setF({ ...f, desconto: v, valor: Number(t.valor) + Number(f.juros_multa || 0) - Number(v || 0) - Number(t.valor_pago || 0) })} /></Field>
        <Field label="Valor desta baixa" hint={Number(f.valor) < total - 0.009 ? 'Baixa parcial: o restante continua em aberto' : `Quita o lançamento (${money(total)})`}><MoneyInput value={f.valor} onChange={(v) => setF({ ...f, valor: v })} /></Field>
        <Field label="Data"><Input type="date" value={f.data_pagamento} onChange={(e) => setF({ ...f, data_pagamento: e.target.value })} /></Field>
        <Field label="Conta financeira" className="col-span-2"><Select value={f.bank_account_id} onChange={(e) => setF({ ...f, bank_account_id: e.target.value })}><option value="">Selecione…</option>{L.banks.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}</Select></Field>
      </div>
      {t.asaas_payment_id && receita && <p className="text-xs text-[var(--muted)] mt-3">Esta cobrança está no Asaas. Ao confirmar, avisamos o Asaas que ela foi recebida por fora para o cliente não ser cobrado de novo.</p>}
    </Modal>
  );
}

function PaymentLinkModal({ onClose }) {
  const [f, setF] = useState({
    name: '',
    description: '',
    value: '',
    billingType: 'UNDEFINED',
    dueDateLimitDays: 10,
    maxInstallmentCount: 1,
  });
  const [created, setCreated] = useState(null);
  const create = useBizMutation((body) => biz('/payment-links', { method: 'POST', body }), {
    onSuccess: (res) => {
      setCreated(res);
      toast.success('Link de pagamento criado no Asaas!');
    },
  });

  const copy = (url) => {
    navigator.clipboard.writeText(url);
    toast.success('Link copiado para a área de transferência!');
  };

  const shareWhatsapp = (url, name, value) => {
    const text = encodeURIComponent(`Olá! Segue o link seguro para pagamento de ${name || 'serviço'}${value ? ` (R$ ${money(value)})` : ''}:\n${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={created ? 'Link de pagamento criado!' : 'Gerar Link de Pagamento Asaas'}
      description={created ? 'Envie o link para o cliente pagar por PIX, Boleto ou Cartão.' : 'Crie um link de pagamento avulso ou parcelado direto no Asaas.'}
      footer={
        created ? (
          <Button variant="primary" onClick={onClose}>Concluir</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>Cancelar</Button>
            <Button
              variant="success"
              loading={create.isPending}
              disabled={!f.name || !f.value}
              onClick={() => create.mutate({ ...f, value: Number(f.value), dueDateLimitDays: Number(f.dueDateLimitDays), maxInstallmentCount: Number(f.maxInstallmentCount) })}
            >
              Criar no Asaas
            </Button>
          </>
        )
      }
    >
      {created ? (
        <div className="space-y-4">
          <div className="p-4 bg-[var(--surface-2)] rounded-xl border border-[var(--line)]">
            <span className="text-xs text-[var(--muted)] block">URL do link de pagamento</span>
            <div className="flex items-center gap-2 mt-1">
              <Input readOnly value={created.url} className="text-xs num font-semibold" />
              <Button size="sm" variant="secondary" icon={Copy} onClick={() => copy(created.url)} title="Copiar link" />
              <Button size="sm" variant="secondary" icon={ExternalLink} onClick={() => window.open(created.url, '_blank')} title="Abrir link" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button className="w-full" icon={Share2} onClick={() => shareWhatsapp(created.url, created.name, created.value)}>
              Enviar no WhatsApp
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Nome da cobrança / produto" className="sm:col-span-2">
            <Input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Ex.: Consultoria, Venda Avulsa..." />
          </Field>
          <Field label="Valor">
            <MoneyInput value={f.value} onChange={(v) => setF({ ...f, value: v })} placeholder="0,00" />
          </Field>
          <Field label="Formas aceitas">
            <Select value={f.billingType} onChange={(e) => setF({ ...f, billingType: e.target.value })}>
              <option value="UNDEFINED">Todas (PIX, Boleto e Cartão)</option>
              <option value="PIX">Somente PIX</option>
              <option value="BOLETO">Somente Boleto</option>
              <option value="CARTAO">Somente Cartão de Crédito</option>
            </Select>
          </Field>
          <Field label="Validade da fatura (dias)">
            <Input type="number" min={1} max={90} value={f.dueDateLimitDays} onChange={(e) => setF({ ...f, dueDateLimitDays: e.target.value })} />
          </Field>
          <Field label="Parcelamento máximo">
            <Select value={f.maxInstallmentCount} onChange={(e) => setF({ ...f, maxInstallmentCount: e.target.value })}>
              <option value={1}>À vista (1x)</option>
              <option value={2}>Até 2x</option>
              <option value={3}>Até 3x</option>
              <option value={6}>Até 6x</option>
              <option value={10}>Até 10x</option>
              <option value={12}>Até 12x</option>
            </Select>
          </Field>
          <Field label="Descrição detalhada (opcional)" className="sm:col-span-2">
            <Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Ex.: Referente aos serviços acordados..." />
          </Field>
        </div>
      )}
    </Modal>
  );
}

function PayBillModal({ onClose }) {
  const [f, setF] = useState({
    identificationField: '',
    value: '',
    dueDate: todayYmd(),
    scheduleDate: todayYmd(),
    description: '',
  });

  const payBill = useBizMutation((body) => biz('/transactions/pay-bill-asaas', { method: 'POST', body }), {
    success: 'Boleto agendado/pago pelo saldo Asaas!',
    onSuccess: onClose,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Pagar Boleto via Asaas"
      description="Pague ou agende contas e boletos de fornecedores debitando do saldo da sua Conta Asaas."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            variant="primary"
            loading={payBill.isPending}
            disabled={!f.identificationField || !f.value}
            onClick={() => payBill.mutate({ ...f, value: Number(f.value) })}
          >
            Pagar com saldo Asaas
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Linha digitável ou código de barras" hint="Cole os 47 ou 48 dígitos do boleto bancário">
          <Input required value={f.identificationField} onChange={(e) => setF({ ...f, identificationField: e.target.value })} placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000" />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Valor do boleto">
            <MoneyInput value={f.value} onChange={(v) => setF({ ...f, value: v })} placeholder="0,00" />
          </Field>
          <Field label="Vencimento do boleto">
            <Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} />
          </Field>
          <Field label="Data do débito / agendamento">
            <Input type="date" value={f.scheduleDate} onChange={(e) => setF({ ...f, scheduleDate: e.target.value })} />
          </Field>
          <Field label="Descrição / Fornecedor">
            <Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Ex.: Hospedagem, DAS, Aluguel..." />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function BatchPayModal({ ids, count, total, tipo, onClose, onSuccess }) {
  const receita = tipo === 'RECEITA';
  const L = useLookups();
  const [f, setF] = useState({
    data_pagamento: todayYmd(),
    bank_account_id: '',
    informar_asaas: true,
  });

  const act = useBizMutation((body) => biz('/transactions/batch/pay', { method: 'POST', body }), {
    success: (r) => `${r.count} lançamentos baixados com sucesso!`,
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={receita ? 'Baixar recebimentos em lote' : 'Baixar pagamentos em lote'}
      description={`Você está prestes a quitar ${count} lançamentos no valor total de ${money(total)}.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            variant={receita ? 'success' : 'primary'}
            loading={act.isPending}
            onClick={() => act.mutate({ ids, ...f, bank_account_id: f.bank_account_id || undefined })}
          >
            Confirmar baixa de {count} lançamentos
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="p-3 rounded-lg bg-[var(--surface-2)] border border-[var(--line)] text-xs text-[var(--ink-2)]">
          Todos os lançamentos selecionados em aberto serão marcados como <b>PAGO</b> e terão seus saldos quitados.
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Data da baixa / liquidação">
            <Input type="date" value={f.data_pagamento} onChange={(e) => setF({ ...f, data_pagamento: e.target.value })} />
          </Field>
          <Field label="Conta bancária / caixa">
            <Select value={f.bank_account_id} onChange={(e) => setF({ ...f, bank_account_id: e.target.value })}>
              <option value="">Manter conta padrão</option>
              {L.banks.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </Select>
          </Field>
        </div>
        {receita && (
          <label className="flex items-start gap-2 text-xs text-[var(--muted)]">
            <input type="checkbox" checked={f.informar_asaas} onChange={(e) => setF({ ...f, informar_asaas: e.target.checked })} className="mt-0.5 rounded" />
            <span>Informar recebimento em dinheiro ao Asaas para os títulos que foram gerados por lá (evita cobrança duplicada).</span>
          </label>
        )}
      </div>
    </Modal>
  );
}

function BatchUpdateModal({ ids, count, tipo, onClose, onSuccess }) {
  const L = useLookups();
  const accounts = (L.accounts || []).filter((a) => a.natureza === tipo);

  const [f, setF] = useState({
    account_id: '',
    cost_center_id: '',
    bank_account_id: '',
    forma_pagamento: '',
    vencimento: '',
  });

  const act = useBizMutation((body) => biz('/transactions/batch/update', { method: 'POST', body }), {
    success: (r) => `${r.count} lançamentos atualizados com sucesso!`,
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  const submit = () => {
    const patch = {};
    if (f.account_id) patch.account_id = f.account_id;
    if (f.cost_center_id) patch.cost_center_id = f.cost_center_id;
    if (f.bank_account_id) patch.bank_account_id = f.bank_account_id;
    if (f.forma_pagamento) patch.forma_pagamento = f.forma_pagamento;
    if (f.vencimento) patch.vencimento = f.vencimento;

    if (!Object.keys(patch).length) {
      toast.error('Selecione pelo menos um campo para alterar');
      return;
    }
    act.mutate({ ids, patch });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Classificar e alterar em lote"
      description={`Altere os dados de ${count} lançamentos selecionados. Preencha apenas os campos que deseja sobrescrever.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={act.isPending} onClick={submit}>
            Aplicar alterações
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Plano de contas (Categoria)" hint="Preencha apenas se quiser alterar de todos">
          <Select value={f.account_id} onChange={(e) => setF({ ...f, account_id: e.target.value })}>
            <option value="">Não alterar</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.codigo} — {a.nome}</option>)}
          </Select>
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Centro de custo">
            <Select value={f.cost_center_id} onChange={(e) => setF({ ...f, cost_center_id: e.target.value })}>
              <option value="">Não alterar</option>
              {L.costCenters.map((cc) => <option key={cc.id} value={cc.id}>{cc.nome}</option>)}
            </Select>
          </Field>
          <Field label="Conta bancária padrão">
            <Select value={f.bank_account_id} onChange={(e) => setF({ ...f, bank_account_id: e.target.value })}>
              <option value="">Não alterar</option>
              {L.banks.map((b) => <option key={b.id} value={b.id}>{b.nome}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Forma de pagamento">
            <Select value={f.forma_pagamento} onChange={(e) => setF({ ...f, forma_pagamento: e.target.value })}>
              <option value="">Não alterar</option>
              {Object.entries(FORMAS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </Field>
          <Field label="Nova data de vencimento">
            <Input type="date" value={f.vencimento} onChange={(e) => setF({ ...f, vencimento: e.target.value })} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function BatchCancelModal({ ids, count, onClose, onSuccess }) {
  const [motivo, setMotivo] = useState('');
  const [cancelarAsaas, setCancelarAsaas] = useState(true);

  const act = useBizMutation((body) => biz('/transactions/batch/cancel', { method: 'POST', body }), {
    success: (r) => `${r.count} lançamentos cancelados!`,
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Cancelar lançamentos em lote"
      description={`Deseja cancelar ${count} lançamentos selecionados?`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Voltar</Button>
          <Button
            variant="danger"
            loading={act.isPending}
            onClick={() => act.mutate({ ids, motivo, cancelar_asaas: cancelarAsaas })}
          >
            Confirmar cancelamento
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Motivo do cancelamento (opcional)">
          <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: Acordo comercial, cobrança indevida..." />
        </Field>
        <label className="flex items-start gap-2 text-xs text-[var(--muted)]">
          <input type="checkbox" checked={cancelarAsaas} onChange={(e) => setCancelarAsaas(e.target.checked)} className="mt-0.5 rounded" />
          <span>Cancelar também as cobranças pendentes vinculadas no Asaas.</span>
        </label>
      </div>
    </Modal>
  );
}

function BatchDeleteModal({ ids, count, onClose, onSuccess }) {
  const act = useBizMutation((body) => biz('/transactions/batch/delete', { method: 'POST', body }), {
    success: (r) => `${r.count} lançamentos excluídos!`,
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  return (
    <Modal
      open
      onClose={onClose}
      title="Excluir lançamentos em lote"
      description={`Tem certeza que deseja excluir ${count} lançamentos? Lançamentos com pagamentos já realizados serão preservados por segurança.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            variant="danger"
            loading={act.isPending}
            onClick={() => act.mutate({ ids })}
          >
            Excluir lançamentos
          </Button>
        </>
      }
    >
      <p className="text-sm text-[var(--bad)] font-semibold">Esta ação é irreversível.</p>
    </Modal>
  );
}

function InvoiceModal({ t, onClose, onRefresh, onEditClient }) {
  const compQ = useBizQuery('/company');
  const [f, setF] = useState(null);

  const issue = useBizMutation((body) => biz(`/transactions/${t.id}/invoice`, { method: 'POST', body }), {
    success: 'NFS-e solicitada com sucesso no Asaas!',
    onSuccess: () => {
      onRefresh?.();
      onClose();
    },
  });

  const sync = useBizMutation(() => biz(`/transactions/${t.id}/invoice`), {
    success: 'Status da NFS-e atualizado!',
    onSuccess: () => onRefresh?.(),
  });

  const cancelInv = useBizMutation((body) => biz(`/transactions/${t.id}/invoice/cancel`, { method: 'POST', body }), {
    success: 'Cancelamento da NFS-e solicitado!',
    onSuccess: () => {
      onRefresh?.();
      onClose();
    },
  });

  const comp = compQ.data || {};
  const data = f || {
    serviceDescription: t.nfse_descricao_padrao || comp.nfse_descricao_padrao || t.descricao || '',
    municipalServiceCode: comp.municipal_service_code || '',
    municipalServiceName: comp.municipal_service_name || '',
    iss: comp.nfse_aliquota_iss !== undefined && comp.nfse_aliquota_iss !== null ? comp.nfse_aliquota_iss : '',
    retainIss: !!comp.nfse_reter_iss,
    value: t.valor,
    observations: t.observacoes || '',
    authorizeNow: true,
  };

  const set = (k) => (e) => {
    const val = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    setF({ ...data, [k]: val });
  };

  const handleIssue = (e) => {
    e.preventDefault();
    issue.mutate({
      serviceDescription: data.serviceDescription,
      municipalServiceCode: data.municipalServiceCode || undefined,
      municipalServiceName: data.municipalServiceName || undefined,
      iss: data.iss !== '' ? Number(data.iss) : undefined,
      retainIss: !!data.retainIss,
      value: Number(data.value),
      observations: data.observations || undefined,
      authorizeNow: !!data.authorizeNow,
    });
  };

  const handleCancel = () => {
    const motivo = window.prompt('Informe o motivo do cancelamento da NFS-e:');
    if (motivo !== null) {
      cancelInv.mutate({ motivo });
    }
  };

  const isAuthorized = t.nfse_status === 'AUTHORIZED';
  const isPending = ['SCHEDULED', 'SYNCHRONIZED', 'PROCESSING_CANCELLATION'].includes(t.nfse_status);
  const clientEnd = typeof t.client?.endereco === 'object' && t.client?.endereco ? t.client.endereco : {};
  const hasClientAddress = !!(clientEnd.logradouro || clientEnd.rua);
  const hasClientDoc = !!t.client?.documento;

  return (
    <Modal
      open
      onClose={onClose}
      title="Nota Fiscal de Serviços (NFS-e) — Asaas"
      width={640}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Fechar</Button>
          {isAuthorized ? (
            <Button variant="danger" icon={Ban} loading={cancelInv.isPending} onClick={handleCancel}>
              Cancelar NFS-e
            </Button>
          ) : isPending ? (
            <Button variant="secondary" icon={RefreshCw} loading={sync.isPending} onClick={() => sync.mutate()}>
              Sincronizar status
            </Button>
          ) : (
            <Button type="submit" form="nfse-form" variant="primary" icon={FileText} loading={issue.isPending}>
              Emitir NFS-e no Asaas
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {/* Tomador do Serviço (Cliente) com botão de edição direta */}
        <div className="p-3.5 bg-[var(--surface-2)] rounded-xl border border-[var(--line)] text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-extrabold text-[var(--ink)] flex items-center gap-1.5">
              Tomador do Serviço (Cliente)
            </span>
            {t.client && onEditClient && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                icon={Pencil}
                onClick={() => onEditClient(t.client)}
              >
                Editar dados do cliente
              </Button>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-2.5 pt-1">
            <div>
              <span className="text-[var(--muted)] block">Nome / Razão Social:</span>
              <b className="text-[var(--ink)] text-sm">{t.client?.nome || '—'}</b>
            </div>
            <div>
              <span className="text-[var(--muted)] block">CPF / CNPJ:</span>
              {hasClientDoc ? (
                <span className="font-bold text-[var(--in)] text-sm">{t.client.documento}</span>
              ) : (
                <span className="text-[var(--bad)] font-bold flex items-center gap-1 text-xs">
                  <AlertTriangle className="w-3.5 h-3.5" /> Não cadastrado (Obrigatório)
                </span>
              )}
            </div>
            <div>
              <span className="text-[var(--muted)] block">E-mail:</span>
              <span>{t.client?.email || <span className="text-[var(--muted)] italic">Não informado</span>}</span>
            </div>
            <div>
              <span className="text-[var(--muted)] block">Endereço:</span>
              <span>
                {hasClientAddress ? (
                  `${clientEnd.logradouro || clientEnd.rua}, ${clientEnd.numero || 'S/N'}${clientEnd.cidade ? ` - ${clientEnd.cidade}/${clientEnd.uf || ''}` : ''}`
                ) : (
                  <span className="text-[var(--warn)] font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Endereço incompleto
                  </span>
                )}
              </span>
            </div>
          </div>

          {(!hasClientDoc || !hasClientAddress) && (
            <div className="p-2.5 rounded-lg bg-[var(--warn)]/10 border border-[var(--warn)]/30 text-[11px] text-[var(--warn)] font-medium flex items-start gap-2 mt-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <b>Atenção para evitar recusa da prefeitura:</b> CPF/CNPJ válido e endereço completo são exigidos para autorizar a nota. Clique em <b>"Editar dados do cliente"</b> acima para preencher antes de emitir.
              </div>
            </div>
          )}
        </div>

        {/* Resumo financeiro */}
        <div className="p-3 bg-[var(--surface)] rounded-xl border border-[var(--line)] text-xs flex justify-between items-center">
          <div>
            <span className="text-[var(--muted)] block">Lançamento</span>
            <b className="text-[var(--ink)]">{t.descricao}</b>
          </div>
          <div className="text-right">
            <span className="text-[var(--muted)] block">Valor do serviço</span>
            <b className="text-[var(--ink)] text-sm">{money(t.valor)}</b>
          </div>
        </div>

        {/* Status atual da NFS-e */}
        {t.nfse_status && (
          <div className={cx('p-3 rounded-xl border text-xs', isAuthorized ? 'bg-[var(--in)]/10 border-[var(--in)]/30' : t.nfse_status === 'ERROR' ? 'bg-[var(--bad)]/10 border-[var(--bad)]/30' : 'bg-[var(--warn)]/10 border-[var(--warn)]/30')}>
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-1.5">
                {isAuthorized ? <Check className="w-4 h-4 text-[var(--in)]" /> : t.nfse_status === 'ERROR' ? <AlertTriangle className="w-4 h-4 text-[var(--bad)]" /> : <RefreshCw className="w-4 h-4 animate-spin text-[var(--warn)]" />}
                Status da NFS-e: {t.nfse_status}
              </span>
              {t.nfse_numero && <span className="font-extrabold text-sm">Nota #{t.nfse_numero}</span>}
            </div>
            {t.nfse_rps_numero && <p className="mt-1 text-[var(--muted)]">RPS Nº: {t.nfse_rps_numero}</p>}
            {t.nfse_erro && <p className="mt-1.5 text-[var(--bad)] font-semibold">{t.nfse_erro}</p>}

            {/* Links para download */}
            {(t.nfse_pdf_url || t.nfse_xml_url) && (
              <div className="mt-3 flex gap-2 pt-2 border-t border-[var(--line)]">
                {t.nfse_pdf_url && (
                  <a
                    href={t.nfse_pdf_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-[var(--ink)] text-[var(--surface)] hover:opacity-90"
                  >
                    <Download className="w-3.5 h-3.5" /> Baixar PDF da Nota
                  </a>
                )}
                {t.nfse_xml_url && (
                  <a
                    href={t.nfse_xml_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[var(--surface)] border border-[var(--line)] hover:bg-[var(--line-2)]"
                  >
                    <Download className="w-3.5 h-3.5" /> Baixar XML
                  </a>
                )}
              </div>
            )}
          </div>
        )}

        {/* Formulário para emissão caso não esteja autorizada */}
        {!isAuthorized && (
          <form id="nfse-form" onSubmit={handleIssue} className="space-y-3">
            <Field label="Descrição dos Serviços prestados" hint="Aparecerá no corpo da nota fiscal impressa">
              <Textarea rows={3} required value={data.serviceDescription} onChange={set('serviceDescription')} />
            </Field>

            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Código do Serviço Municipal" hint="Ex: 1.07 ou código LC 116">
                <Input value={data.municipalServiceCode} onChange={set('municipalServiceCode')} placeholder="Ex: 1.07" />
              </Field>
              <Field label="Discriminação Municipal">
                <Input value={data.municipalServiceName} onChange={set('municipalServiceName')} placeholder="Ex: Serviços de TI" />
              </Field>
            </div>

            <div className="grid sm:grid-cols-2 gap-3 items-center">
              <Field label="Alíquota ISS (%)">
                <Input type="number" step="0.01" min="0" max="100" value={data.iss} onChange={set('iss')} placeholder="Ex: 2.00 ou 5.00" />
              </Field>
              <div className="pt-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
                  <input type="checkbox" checked={!!data.retainIss} onChange={set('retainIss')} className="w-4 h-4 rounded border-[var(--line)]" />
                  Reter ISS na fonte
                </label>
              </div>
            </div>

            <Field label="Observações complementares">
              <Input value={data.observations} onChange={set('observations')} placeholder="Informações adicionais para o tomador" />
            </Field>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-[var(--ink-2)] pt-1">
              <input type="checkbox" checked={!!data.authorizeNow} onChange={set('authorizeNow')} className="w-4 h-4 rounded border-[var(--line)]" />
              Transmitir e autorizar imediatamente junto à prefeitura
            </label>
          </form>
        )}
      </div>
    </Modal>
  );
}

function BatchInvoiceModal({ ids, count, total, onClose, onSuccess }) {
  const compQ = useBizQuery('/company');
  const comp = compQ.data || {};
  const [desc, setDesc] = useState('');
  const [code, setCode] = useState('');
  const [iss, setIss] = useState('');
  const [retain, setRetain] = useState(false);

  const act = useBizMutation((body) => biz('/transactions/batch/invoice', { method: 'POST', body }), {
    success: (r) => `${r.successCount} nota(s) fiscal(is) enviada(s) ao Asaas!${r.errorCount ? ` (${r.errorCount} falha(s))` : ''}`,
    onSuccess: () => {
      onSuccess();
      onClose();
    },
  });

  const municipalCode = code || comp.municipal_service_code || '';
  const serviceDesc = desc || comp.nfse_descricao_padrao || '';
  const issRate = iss !== '' ? iss : (comp.nfse_aliquota_iss !== undefined && comp.nfse_aliquota_iss !== null ? String(comp.nfse_aliquota_iss) : '');

  const handleSubmit = (e) => {
    e.preventDefault();
    act.mutate({
      ids,
      serviceDescription: serviceDesc || undefined,
      municipalServiceCode: municipalCode || undefined,
      iss: issRate !== '' ? Number(issRate) : undefined,
      retainIss: retain,
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Emitir NFS-e em lote via Asaas"
      description={`Será solicitada a emissão de Nota Fiscal de Serviços para ${count} contas a receber selecionadas (Total: ${money(total)}).`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button
            type="submit"
            form="batch-nfse-form"
            variant="primary"
            icon={FileText}
            loading={act.isPending}
          >
            Emitir notas fiscais ({count})
          </Button>
        </>
      }
    >
      <form id="batch-nfse-form" onSubmit={handleSubmit} className="space-y-4">
        <p className="text-xs text-[var(--ink-2)]">
          As notas serão criadas e vinculadas aos respectivos clientes cadastrados no Asaas. Certifique-se de que os clientes possuem CPF ou CNPJ preenchidos.
        </p>

        <Field label="Descrição dos Serviços (opcional)" hint="Se vazio, utiliza a descrição de cada lançamento ou padrão da empresa">
          <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={comp.nfse_descricao_padrao || 'Ex: Prestação de serviços...'} />
        </Field>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Código do Serviço Municipal" hint="Código municipal (ex: 1.07)">
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder={comp.municipal_service_code || '1.07'} />
          </Field>
          <Field label="Alíquota ISS (%)">
            <Input type="number" step="0.01" value={iss} onChange={(e) => setIss(e.target.value)} placeholder={String(comp.nfse_aliquota_iss ?? '2.00')} />
          </Field>
        </div>

        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold">
          <input type="checkbox" checked={retain} onChange={(e) => setRetain(e.target.checked)} className="w-4 h-4 rounded" />
          Reter ISS na fonte em todas as emissões
        </label>
      </form>
    </Modal>
  );
}

function ClientQuickEditModal({ client, onClose, onSaved }) {
  const [f, setF] = useState(() => {
    const end = typeof client.endereco === 'object' && client.endereco ? client.endereco : {};
    return {
      tipo_pessoa: client.tipo_pessoa || (client.documento && String(client.documento).length > 11 ? 'PJ' : 'PF'),
      nome: client.nome || '',
      nome_fantasia: client.nome_fantasia || '',
      documento: client.documento || '',
      email: client.email || '',
      telefone: client.telefone || '',
      cep: end.cep || '',
      logradouro: end.logradouro || end.rua || '',
      numero: end.numero || '',
      complemento: end.complemento || '',
      bairro: end.bairro || '',
      cidade: end.cidade || '',
      uf: end.uf || '',
    };
  });
  const [searchingCep, setSearchingCep] = useState(false);

  const save = useBizMutation((body) => biz(`/clients/${client.id}`, { method: 'PUT', body }), {
    success: 'Dados do cliente atualizados e sincronizados com o Asaas!',
    onSuccess: (updated) => {
      onSaved?.(updated);
      onClose();
    },
  });

  const set = (k) => (e) => setF((prev) => ({ ...prev, [k]: e.target.value }));

  const handleBuscarCep = async () => {
    const cleanCep = String(f.cep || '').replace(/\D/g, '');
    if (cleanCep.length !== 8) {
      toast.error('Informe um CEP válido com 8 dígitos');
      return;
    }
    setSearchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await res.json();
      if (data.erro) {
        toast.error('CEP não encontrado');
      } else {
        setF((prev) => ({
          ...prev,
          logradouro: data.logradouro || prev.logradouro,
          bairro: data.bairro || prev.bairro,
          cidade: data.localidade || prev.cidade,
          uf: data.uf || prev.uf,
        }));
        toast.success('Endereço preenchido!');
      }
    } catch {
      toast.error('Erro ao consultar CEP');
    } finally {
      setSearchingCep(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      tipo_pessoa: f.tipo_pessoa,
      nome: f.nome,
      nome_fantasia: f.nome_fantasia || null,
      documento: f.documento ? String(f.documento).replace(/\D/g, '') : null,
      email: f.email || null,
      telefone: f.telefone || null,
      endereco: {
        cep: f.cep ? String(f.cep).replace(/\D/g, '') : null,
        logradouro: f.logradouro || null,
        numero: f.numero || null,
        complemento: f.complemento || null,
        bairro: f.bairro || null,
        cidade: f.cidade || null,
        uf: f.uf ? f.uf.toUpperCase() : null,
      },
    };
    save.mutate(payload);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Editar dados do cliente: ${client.nome}`}
      description="Atualize CPF/CNPJ, e-mail e endereço completo do tomador para garantir a autorização da Nota Fiscal."
      width={640}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" form="client-quick-edit-form" variant="primary" loading={save.isPending}>
            Salvar e sincronizar
          </Button>
        </>
      }
    >
      <form id="client-quick-edit-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Tipo de pessoa">
            <Select value={f.tipo_pessoa} onChange={set('tipo_pessoa')}>
              <option value="PJ">Pessoa Jurídica (PJ)</option>
              <option value="PF">Pessoa Física (PF)</option>
            </Select>
          </Field>
          <Field label={f.tipo_pessoa === 'PJ' ? 'CNPJ' : 'CPF'} hint="Obrigatório para emissão de NFS-e" className="sm:col-span-2">
            <Input
              required
              value={f.documento}
              onChange={set('documento')}
              placeholder={f.tipo_pessoa === 'PJ' ? '00.000.000/0000-00' : '000.000.000-00'}
            />
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label={f.tipo_pessoa === 'PJ' ? 'Razão Social' : 'Nome completo'}>
            <Input required value={f.nome} onChange={set('nome')} />
          </Field>
          <Field label="Nome Fantasia">
            <Input value={f.nome_fantasia} onChange={set('nome_fantasia')} placeholder="Opcional" />
          </Field>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="E-mail" hint="Receberá a NFS-e e cobranças">
            <Input type="email" value={f.email} onChange={set('email')} placeholder="financeiro@cliente.com" />
          </Field>
          <Field label="Telefone / WhatsApp">
            <Input value={f.telefone} onChange={set('telefone')} placeholder="(11) 90000-0000" />
          </Field>
        </div>

        <div className="pt-2 border-t border-[var(--line)]">
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-xs text-[var(--ink)]">Endereço do Tomador (Exigido pela prefeitura)</span>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="CEP">
              <div className="flex gap-1.5">
                <Input value={f.cep} onChange={set('cep')} placeholder="00000-000" />
                <Button type="button" variant="secondary" loading={searchingCep} onClick={handleBuscarCep}>Buscar</Button>
              </div>
            </Field>
            <Field label="Logradouro / Rua" className="sm:col-span-2">
              <Input value={f.logradouro} onChange={set('logradouro')} placeholder="Rua, Av..." />
            </Field>
          </div>

          <div className="grid sm:grid-cols-4 gap-3 mt-3">
            <Field label="Número">
              <Input value={f.numero} onChange={set('numero')} placeholder="123" />
            </Field>
            <Field label="Complemento">
              <Input value={f.complemento} onChange={set('complemento')} placeholder="Sala 1" />
            </Field>
            <Field label="Bairro">
              <Input value={f.bairro} onChange={set('bairro')} placeholder="Centro" />
            </Field>
            <Field label="Cidade / UF">
              <div className="flex gap-1">
                <Input value={f.cidade} onChange={set('cidade')} placeholder="Cidade" className="flex-1" />
                <Input value={f.uf} onChange={set('uf')} placeholder="UF" maxLength={2} className="w-12 text-center uppercase" />
              </div>
            </Field>
          </div>
        </div>
      </form>
    </Modal>
  );
}


