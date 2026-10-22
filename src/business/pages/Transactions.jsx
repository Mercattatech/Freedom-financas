import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Plus, Wallet, Link2, Undo2, Ban, Trash2, Send, Receipt, Copy, Barcode, ExternalLink, Share2, Check } from 'lucide-react';
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
  const [editing, setEditing] = useState(null);
  const [paying, setPaying] = useState(null);
  const [linkModal, setLinkModal] = useState(false);
  const [billModal, setBillModal] = useState(false);
  const { can } = useBiz();
  const dq = useDebounced(q);
  const list = useBizQuery('/transactions', { tipo, situacao, q: dq, from, to });
  const write = can('financeiro:write');

  const act = useBizMutation(({ id, action, body, method = 'POST' }) => biz(`/transactions/${id}${action ? `/${action}` : ''}`, { method, body }), {
    success: (_, v) => ({ cancel: 'Lançamento cancelado', reopen: 'Baixa estornada', charge: 'Cobrança emitida no Asaas', '': 'Lançamento excluído' })[v.action ?? ''] || 'Feito',
  });

  const items = list.data?.items || [];
  const r = list.data?.resumo;

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
            <button key={k || 'all'} onClick={() => { setSituacao(k); setSp(k ? { situacao: k } : {}); }} className={cx('px-3 h-9 rounded-md text-sm font-semibold', situacao === k ? 'bg-[var(--ink)] text-[var(--surface)]' : 'text-[var(--ink-2)] hover:bg-[var(--line-2)]')}>{l}</button>
          ))}
        </div>
        <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[150px]" aria-label="Vencimento de" />
        <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[150px]" aria-label="Vencimento até" />
        <SearchInput value={q} onChange={setQ} placeholder={receita ? 'Buscar descrição ou cliente' : 'Buscar descrição ou fornecedor'} />
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
              <thead><tr><th>Vencimento</th><th>Descrição</th><th>{receita ? 'Cliente' : 'Fornecedor'}</th><th>Classificação</th><th className="r">Valor</th><th className="r">Em aberto</th><th>Situação</th><th className="r"><span className="sr-only">Ações</span></th></tr></thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id}>
                    <td className="num whitespace-nowrap">{date(t.vencimento)}{t.dias_atraso > 0 && <div className="text-xs text-[var(--bad)]">{t.dias_atraso} dias de atraso</div>}</td>
                    <td className="min-w-[220px]">
                      <button className="font-semibold text-left hover:underline" onClick={() => write && setEditing(t)}>{t.descricao}</button>
                      {t.contract && <div className="text-xs text-[var(--muted)]">Contrato #{t.contract.numero}</div>}
                    </td>
                    <td className="text-[var(--ink-2)]">{t.client?.nome_fantasia || t.client?.nome || t.supplier?.nome || '—'}</td>
                    <td className="text-xs text-[var(--ink-2)] min-w-[140px]">{t.account ? t.account.nome : <span className="text-[var(--warn)] font-semibold">Sem classificação</span>}{t.costCenter && <div className="text-[var(--muted)]">{t.costCenter.nome}</div>}</td>
                    <td className="r"><Money value={t.valor} /></td>
                    <td className="r"><Money value={['PAGO', 'CANCELADO'].includes(t.status) ? 0 : t.saldo} /></td>
                    <td><StatusPill status={t.situacao} />{t.asaas_payment_id && <div className="text-[11px] text-[var(--muted)] mt-0.5">Asaas</div>}</td>
                    <td className="r whitespace-nowrap">
                      {write && (
                        <div className="inline-flex gap-1">
                          {!['PAGO', 'CANCELADO'].includes(t.status) && <Button size="sm" variant={receita ? 'success' : 'primary'} icon={Wallet} onClick={() => setPaying(t)}>{receita ? 'Receber' : 'Pagar'}</Button>}
                          {receita && t.status === 'PENDENTE' && !t.asaas_payment_id && t.client && <Button size="sm" variant="secondary" icon={Send} loading={act.isPending && act.variables?.id === t.id} onClick={() => act.mutate({ id: t.id, action: 'charge' })} title="Emitir cobrança no Asaas">Cobrar</Button>}
                          {t.asaas_invoice_url && <Button size="sm" variant="ghost" icon={Link2} onClick={() => { navigator.clipboard.writeText(t.asaas_invoice_url); toast.success('Link de pagamento copiado'); }} title="Copiar link de pagamento" aria-label="Copiar link de pagamento" />}
                          {t.asaas_pix_payload && <Button size="sm" variant="ghost" icon={Copy} onClick={() => { navigator.clipboard.writeText(t.asaas_pix_payload); toast.success('PIX copia e cola copiado'); }} title="Copiar PIX copia e cola" aria-label="Copiar PIX" />}
                          {['PAGO', 'PARCIAL'].includes(t.status) && <Button size="sm" variant="ghost" icon={Undo2} onClick={() => window.confirm('Estornar a baixa deste lançamento?') && act.mutate({ id: t.id, action: 'reopen' })} title="Estornar baixa" aria-label="Estornar baixa" />}
                          {t.status === 'PENDENTE' && <Button size="sm" variant="ghost" icon={Ban} onClick={() => { const m = window.prompt('Motivo do cancelamento (opcional)'); if (m !== null) act.mutate({ id: t.id, action: 'cancel', body: { motivo: m } }); }} title="Cancelar" aria-label="Cancelar" />}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editing && <TransactionForm tipo={tipo} initial={editing} onClose={() => setEditing(null)} onDelete={(id) => act.mutate({ id, action: '', method: 'DELETE' }, { onSuccess: () => setEditing(null) })} />}
      {paying && <PayModal t={paying} onClose={() => setPaying(null)} />}
      {linkModal && <PaymentLinkModal onClose={() => setLinkModal(false)} />}
      {billModal && <PayBillModal onClose={() => setBillModal(false)} />}
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

