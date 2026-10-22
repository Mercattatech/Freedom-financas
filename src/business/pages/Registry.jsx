import React, { useState } from 'react';
import { Plus, Users, Trash2 } from 'lucide-react';
import { biz } from '../api';
import { useBiz, useBizQuery, useBizMutation } from '../BizContext';
import { PageHeader, Button, Field, Input, Select, Textarea, MoneyInput, Modal, StatusPill, Empty, Loading, SearchInput, useDebounced } from '../components/ui';
import { docMask, money } from '../format';

// Página genérica de cadastro (clientes, fornecedores, centros de custo...)
export default function Registry({ config }) {
  const { can } = useBiz();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const dq = useDebounced(q);
  const list = useBizQuery(`/${config.entity}`, { q: dq });
  const write = can(config.perm);
  const items = list.data || [];
  return (
    <>
      <PageHeader title={config.title} subtitle={config.subtitle} actions={<>{config.search !== false && <SearchInput value={q} onChange={setQ} />}{write && <Button icon={Plus} onClick={() => setEditing({})}>{config.newLabel}</Button>}</>} />
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden">
        {list.isLoading ? <Loading /> : !items.length ? (
          <Empty icon={config.icon || Users} title={q ? 'Nenhum resultado' : config.emptyTitle} text={config.emptyText} action={write && !q && <Button icon={Plus} onClick={() => setEditing({})}>{config.newLabel}</Button>} />
        ) : (
          <div className="overflow-x-auto">
            <table className="tbl">
              <thead><tr>{config.columns.map(([, label, cls]) => <th key={label} className={cls}>{label}</th>)}</tr></thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} onClick={() => write && setEditing(it)} className={write ? 'cursor-pointer' : ''}>
                    {config.columns.map(([render, label, cls]) => <td key={label} className={cls}>{render(it)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {editing && <RegistryForm config={config} initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

export function RegistryForm({ config, initial, onClose, onSaved }) {
  const isNew = !initial.id;
  const [f, setF] = useState(() => Object.fromEntries(config.fields.map((fd) => [fd.k, initial[fd.k] ?? fd.def ?? ''])));
  const save = useBizMutation((body) => (isNew ? biz(`/${config.entity}`, { method: 'POST', body }) : biz(`/${config.entity}/${initial.id}`, { method: 'PUT', body })), {
    success: isNew ? `${config.singular} cadastrado` : 'Alterações salvas', onSuccess: (d) => { onSaved?.(d); onClose(); },
  });
  const del = useBizMutation(() => biz(`/${config.entity}/${initial.id}`, { method: 'DELETE' }), { success: (d) => (d?.inativado ? `${config.singular} inativado (tem lançamentos vinculados)` : `${config.singular} excluído`), onSuccess: onClose });
  const submit = (e) => {
    e.preventDefault();
    const body = {};
    for (const fd of config.fields) {
      let v = f[fd.k];
      if (fd.type === 'number' || fd.type === 'money') v = v === '' ? null : Number(v);
      if (fd.type === 'bool') v = !!v;
      if (fd.type === 'tags') v = typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : v;
      body[fd.k] = v === '' ? null : v;
    }
    save.mutate(body);
  };
  return (
    <Modal open onClose={onClose} width={640} title={isNew ? config.newLabel : `Editar ${config.singular.toLowerCase()}`}
      footer={<>{!isNew && <Button variant="danger" icon={Trash2} className="mr-auto" loading={del.isPending} onClick={() => window.confirm('Excluir este cadastro? Se houver vínculos, ele será apenas inativado.') && del.mutate()}>Excluir</Button>}<Button variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" form="regform" loading={save.isPending}>Salvar</Button></>}>
      <form id="regform" onSubmit={submit} className="grid sm:grid-cols-2 gap-4">
        {config.fields.map((fd) => (
          <Field key={fd.k} label={fd.label} hint={fd.hint} className={fd.wide ? 'sm:col-span-2' : ''}>
            {fd.type === 'select' ? (
              <Select value={f[fd.k] ?? ''} onChange={(e) => setF({ ...f, [fd.k]: e.target.value })}>{fd.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Select>
            ) : fd.type === 'textarea' ? (
              <Textarea value={f[fd.k] ?? ''} onChange={(e) => setF({ ...f, [fd.k]: e.target.value })} rows={3} />
            ) : fd.type === 'bool' ? (
              <label className="flex items-center gap-2 h-10 text-sm"><input type="checkbox" checked={!!f[fd.k]} onChange={(e) => setF({ ...f, [fd.k]: e.target.checked })} className="w-4 h-4" />{fd.checkLabel || 'Sim'}</label>
            ) : fd.type === 'money' ? (
              <MoneyInput value={f[fd.k]} onChange={(v) => setF({ ...f, [fd.k]: v })} />
            ) : (
              <Input type={fd.type === 'number' ? 'number' : fd.type === 'date' ? 'date' : fd.type === 'email' ? 'email' : 'text'} step={fd.type === 'number' ? 'any' : undefined} required={fd.required}
                value={fd.type === 'tags' && Array.isArray(f[fd.k]) ? f[fd.k].join(', ') : fd.type === 'date' ? String(f[fd.k] || '').slice(0, 10) : f[fd.k] ?? ''} onChange={(e) => setF({ ...f, [fd.k]: e.target.value })} placeholder={fd.placeholder} />
            )}
          </Field>
        ))}
      </form>
    </Modal>
  );
}

export const CLIENTS = {
  entity: 'clients', perm: 'clientes:write', title: 'Clientes', singular: 'Cliente', newLabel: 'Novo cliente',
  subtitle: 'Cadastre CPF/CNPJ para emitir cobranças no Asaas.', emptyTitle: 'Nenhum cliente ainda', emptyText: 'Clientes também são criados automaticamente quando uma proposta é aceita.',
  columns: [
    [(c) => <><b>{c.nome_fantasia || c.nome}</b>{c.nome_fantasia && <div className="text-xs text-[var(--muted)]">{c.nome}</div>}</>, 'Cliente'],
    [(c) => <span className="num">{docMask(c.documento) || '—'}</span>, 'CPF/CNPJ'],
    [(c) => <>{c.contato_nome || ''}<div className="text-xs text-[var(--muted)]">{c.email || ''} {c.telefone || ''}</div></>, 'Contato'],
    [(c) => c.segmento || '—', 'Segmento'],
    [(c) => <StatusPill status={c.status} />, 'Status'],
  ],
  fields: [
    { k: 'nome', label: 'Razão social ou nome', required: true, wide: true }, { k: 'nome_fantasia', label: 'Nome fantasia' },
    { k: 'tipo_pessoa', label: 'Tipo', type: 'select', options: [['PJ', 'Pessoa jurídica'], ['PF', 'Pessoa física']], def: 'PJ' },
    { k: 'documento', label: 'CPF/CNPJ' }, { k: 'email', label: 'E-mail', type: 'email' }, { k: 'telefone', label: 'Telefone/WhatsApp' }, { k: 'contato_nome', label: 'Pessoa de contato' },
    { k: 'segmento', label: 'Segmento', placeholder: 'Locação de veículos' }, { k: 'origem', label: 'Origem', placeholder: 'Indicação, tráfego, outbound…' },
    { k: 'status', label: 'Status', type: 'select', options: [['ATIVO', 'Ativo'], ['LEAD', 'Lead'], ['INATIVO', 'Inativo'], ['CHURN', 'Churn']], def: 'ATIVO' },
    { k: 'tags', label: 'Tags', type: 'tags', placeholder: 'franquia, premium' }, { k: 'observacoes', label: 'Observações', type: 'textarea', wide: true },
  ],
};

export const SUPPLIERS = {
  entity: 'suppliers', perm: 'cadastros:write', title: 'Fornecedores', singular: 'Fornecedor', newLabel: 'Novo fornecedor',
  subtitle: 'Freelancers, veículos de mídia, ferramentas e prestadores.', emptyTitle: 'Nenhum fornecedor ainda',
  columns: [
    [(c) => <b>{c.nome}</b>, 'Fornecedor'], [(c) => c.categoria || '—', 'Categoria'], [(c) => <span className="num">{docMask(c.documento) || '—'}</span>, 'CPF/CNPJ'],
    [(c) => <>{c.email || ''}<div className="text-xs text-[var(--muted)]">{c.telefone || ''}</div></>, 'Contato'], [(c) => c.chave_pix || '—', 'Chave PIX'],
    [(c) => <StatusPill status={c.ativo ? 'ATIVO' : 'INATIVO'} />, 'Status'],
  ],
  fields: [
    { k: 'nome', label: 'Nome', required: true, wide: true }, { k: 'tipo_pessoa', label: 'Tipo', type: 'select', options: [['PJ', 'Pessoa jurídica'], ['PF', 'Pessoa física']], def: 'PJ' },
    { k: 'documento', label: 'CPF/CNPJ' }, { k: 'categoria', label: 'Categoria', placeholder: 'Freelancer, mídia, software…' }, { k: 'chave_pix', label: 'Chave PIX' },
    { k: 'email', label: 'E-mail', type: 'email' }, { k: 'telefone', label: 'Telefone' }, { k: 'ativo', label: 'Situação', type: 'bool', checkLabel: 'Ativo', def: true },
    { k: 'observacoes', label: 'Observações', type: 'textarea', wide: true },
  ],
};

export const COST_CENTERS = {
  entity: 'cost-centers', perm: 'cadastros:write', title: 'Centros de custo', singular: 'Centro de custo', newLabel: 'Novo centro de custo', search: false,
  columns: [[(c) => <b>{c.nome}</b>, 'Nome'], [(c) => c.codigo || '—', 'Código'], [(c) => c.tipo, 'Tipo'], [(c) => (c.orcamento_mensal ? money(c.orcamento_mensal) : '—'), 'Orçamento mensal', 'r'], [(c) => <StatusPill status={c.ativo ? 'ATIVO' : 'INATIVO'} />, 'Status']],
  fields: [
    { k: 'nome', label: 'Nome', required: true }, { k: 'codigo', label: 'Código' },
    { k: 'tipo', label: 'Tipo', type: 'select', options: [['OPERACIONAL', 'Operacional'], ['ADMINISTRATIVO', 'Administrativo'], ['COMERCIAL', 'Comercial'], ['PROJETO', 'Projeto']], def: 'OPERACIONAL' },
    { k: 'orcamento_mensal', label: 'Orçamento mensal', type: 'money' }, { k: 'ativo', label: 'Situação', type: 'bool', checkLabel: 'Ativo', def: true },
  ],
};

export const BANKS = {
  entity: 'bank-accounts', perm: 'config:write', title: 'Contas financeiras', singular: 'Conta', newLabel: 'Nova conta financeira', search: false,
  columns: [[(c) => <b>{c.nome}</b>, 'Conta'], [(c) => c.tipo, 'Tipo'], [(c) => c.banco || '—', 'Banco'], [(c) => money(c.saldo_inicial), 'Saldo inicial', 'r']],
  fields: [
    { k: 'nome', label: 'Nome', required: true }, { k: 'tipo', label: 'Tipo', type: 'select', options: [['CORRENTE', 'Conta corrente'], ['ASAAS', 'Asaas'], ['CAIXA', 'Caixa'], ['INVESTIMENTO', 'Investimento'], ['CARTAO', 'Cartão']], def: 'CORRENTE' },
    { k: 'banco', label: 'Banco' }, { k: 'saldo_inicial', label: 'Saldo inicial', type: 'money', def: 0 },
    { k: 'data_saldo_inicial', label: 'Saldo na data de', type: 'date', hint: 'Movimentos anteriores a esta data não entram no saldo' }, { k: 'ativo', label: 'Situação', type: 'bool', checkLabel: 'Ativa', def: true },
  ],
};
