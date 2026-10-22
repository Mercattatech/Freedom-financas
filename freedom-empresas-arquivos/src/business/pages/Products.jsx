import React, { useState } from 'react';
import { Plus, Package, ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, Trash2 } from 'lucide-react';
import { biz } from '../api';
import { useBiz, useBizQuery, useBizMutation } from '../BizContext';
import { PageHeader, Button, Field, Input, Select, Textarea, MoneyInput, Modal, StatusPill, Money, Empty, Loading, SearchInput, useDebounced, Tabs, cx } from '../components/ui';
import { useLookups } from '../components/lookups';
import { money, pct, num, date, todayYmd } from '../format';

export default function Products() {
  const { can } = useBiz();
  const [tab, setTab] = useState('catalogo');
  const [tipo, setTipo] = useState('');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState(null);
  const [moving, setMoving] = useState(null);
  const dq = useDebounced(q);
  const list = useBizQuery('/products', { q: dq, tipo });
  const moves = useBizQuery('/stock-movements', { limit: 200 }, { enabled: tab === 'estoque' });
  const items = list.data || [];
  const write = can('cadastros:write');
  const stockVal = items.reduce((a, p) => a + (p.valor_em_estoque || 0), 0);

  return (
    <>
      <PageHeader title="Produtos e serviços" subtitle="Preço, custo direto e margem de cada item. Produtos podem controlar estoque com custo médio."
        actions={write && <Button icon={Plus} onClick={() => setEditing({ tipo: 'SERVICO' })}>Novo item</Button>} />
      <Tabs value={tab} onChange={setTab} tabs={[['catalogo', 'Catálogo'], ['estoque', 'Movimentações de estoque']]} />

      {tab === 'catalogo' ? (
        <>
          <div className="flex flex-wrap gap-2 mb-4 items-center">
            <Select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-[180px]"><option value="">Produtos e serviços</option><option value="SERVICO">Só serviços</option><option value="PRODUTO">Só produtos</option></Select>
            <SearchInput value={q} onChange={setQ} />
            {stockVal > 0 && <span className="text-sm text-[var(--muted)] ml-auto">Valor em estoque (custo): <b className="text-[var(--ink)] num">{money(stockVal)}</b></span>}
          </div>
          <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden">
            {list.isLoading ? <Loading /> : !items.length ? (
              <Empty icon={Package} title="Catálogo vazio" text="Cadastre seus serviços (gestão de tráfego, social media, landing page…) para montar propostas em segundos." action={write && <Button icon={Plus} onClick={() => setEditing({ tipo: 'SERVICO' })}>Cadastrar serviço</Button>} />
            ) : (
              <div className="overflow-x-auto">
                <table className="tbl">
                  <thead><tr><th>Item</th><th>Cobrança</th><th className="r">Preço</th><th className="r">Custo direto</th><th className="r">Margem</th><th className="r">Estoque</th><th /></tr></thead>
                  <tbody>
                    {items.map((p) => (
                      <tr key={p.id}>
                        <td className="min-w-[220px]"><button className="font-semibold hover:underline text-left" onClick={() => write && setEditing(p)}>{p.nome}</button><div className="text-xs text-[var(--muted)]">{p.tipo === 'SERVICO' ? 'Serviço' : 'Produto'}{p.categoria ? ` · ${p.categoria}` : ''}{p.codigo ? ` · ${p.codigo}` : ''}{!p.ativo ? ' · inativo' : ''}</div></td>
                        <td>{p.cobranca === 'RECORRENTE' ? `Recorrente ${(p.periodicidade || 'MENSAL').toLowerCase()}` : 'Única'}</td>
                        <td className="r"><Money value={p.preco_venda} /><div className="text-xs text-[var(--muted)]">por {p.unidade.toLowerCase()}</div></td>
                        <td className="r"><Money value={p.custo_unitario} />{p.horas_estimadas > 0 && <div className="text-xs text-[var(--muted)]">{num(p.horas_estimadas)}h estimadas</div>}</td>
                        <td className="r"><span className={cx('num font-semibold', p.margem_percent < 30 && 'text-[var(--bad)]')}>{pct(p.margem_percent)}</span><div className="text-xs text-[var(--muted)] num">{money(p.margem_unitaria)}</div></td>
                        <td className="r">{p.controla_estoque ? <><span className={cx('num font-semibold', p.estoque_baixo && 'text-[var(--bad)]')}>{num(p.estoque_atual)} {p.unidade}</span><div className="text-xs text-[var(--muted)]">mín. {num(p.estoque_minimo)}</div></> : '—'}</td>
                        <td className="r">{p.controla_estoque && can('operacional:write') && <Button size="sm" variant="secondary" onClick={() => setMoving(p)}>Movimentar</Button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : (
        <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden">
          {moves.isLoading ? <Loading /> : !(moves.data || []).length ? <Empty icon={Package} title="Sem movimentações" text="Entradas, saídas e ajustes de estoque aparecem aqui." /> : (
            <div className="overflow-x-auto"><table className="tbl">
              <thead><tr><th>Data</th><th>Produto</th><th>Tipo</th><th className="r">Quantidade</th><th className="r">Custo unit.</th><th className="r">Saldo após</th><th>Contrato</th><th>Observação</th></tr></thead>
              <tbody>{moves.data.map((m) => (
                <tr key={m.id}><td className="num">{date(m.data)}</td><td className="font-semibold">{m.product?.nome}</td>
                  <td><StatusPill status={m.tipo === 'ENTRADA' ? 'PAGO' : m.tipo === 'SAIDA' ? 'PARCIAL' : 'RASCUNHO'} label={{ ENTRADA: 'Entrada', SAIDA: 'Saída', AJUSTE: 'Ajuste' }[m.tipo]} /></td>
                  <td className="r num">{num(m.quantidade)}</td><td className="r"><Money value={m.custo_unitario} /></td><td className="r num">{num(m.saldo_apos)}</td>
                  <td>{m.contract ? `#${m.contract.numero} ${m.contract.titulo}` : '—'}</td><td className="text-[var(--muted)]">{m.observacao || ''}</td></tr>
              ))}</tbody>
            </table></div>
          )}
        </section>
      )}

      {editing && <ProductForm initial={editing} onClose={() => setEditing(null)} />}
      {moving && <StockModal product={moving} onClose={() => setMoving(null)} />}
    </>
  );
}

function ProductForm({ initial, onClose }) {
  const L = useLookups();
  const isNew = !initial.id;
  const [f, setF] = useState({
    tipo: initial.tipo || 'SERVICO', nome: initial.nome || '', codigo: initial.codigo || '', descricao: initial.descricao || '', categoria: initial.categoria || '',
    unidade: initial.unidade || (initial.tipo === 'PRODUTO' ? 'UN' : 'MES'), preco_venda: initial.preco_venda ?? '', custo_unitario: initial.custo_unitario ?? '',
    horas_estimadas: initial.horas_estimadas ?? '', cobranca: initial.cobranca || 'UNICA', periodicidade: initial.periodicidade || 'MENSAL',
    controla_estoque: initial.controla_estoque ?? false, estoque_minimo: initial.estoque_minimo ?? '', estoque_inicial: '', account_id: initial.account_id || '', ativo: initial.ativo ?? true,
  });
  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e });
  const save = useBizMutation((body) => (isNew ? biz('/products', { method: 'POST', body }) : biz(`/products/${initial.id}`, { method: 'PUT', body })), { success: 'Item salvo', onSuccess: onClose });
  const del = useBizMutation(() => biz(`/products/${initial.id}`, { method: 'DELETE' }), { success: (d) => (d?.inativado ? 'Item inativado (já usado em propostas/contratos)' : 'Item excluído'), onSuccess: onClose });
  const margem = Number(f.preco_venda) > 0 ? ((Number(f.preco_venda) - Number(f.custo_unitario || 0)) / Number(f.preco_venda)) * 100 : null;
  const submit = (e) => {
    e.preventDefault();
    const nums = ['preco_venda', 'custo_unitario', 'horas_estimadas', 'estoque_minimo', 'estoque_inicial'];
    const body = { ...f };
    for (const k of nums) body[k] = body[k] === '' ? undefined : Number(body[k]);
    if (body.cobranca === 'UNICA') body.periodicidade = null;
    if (!body.account_id) body.account_id = null;
    if (!isNew) delete body.estoque_inicial;
    save.mutate(body);
  };
  return (
    <Modal open onClose={onClose} width={660} title={isNew ? 'Novo produto ou serviço' : 'Editar item'}
      footer={<>{!isNew && <Button variant="danger" icon={Trash2} className="mr-auto" onClick={() => window.confirm('Excluir este item?') && del.mutate()}>Excluir</Button>}<Button variant="secondary" onClick={onClose}>Cancelar</Button><Button type="submit" form="prodform" loading={save.isPending}>Salvar</Button></>}>
      <form id="prodform" onSubmit={submit} className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 inline-flex rounded-lg border border-[var(--line)] p-0.5 w-fit">
          {[['SERVICO', 'Serviço'], ['PRODUTO', 'Produto']].map(([k, l]) => <button type="button" key={k} onClick={() => setF({ ...f, tipo: k, controla_estoque: k === 'PRODUTO' ? f.controla_estoque : false, unidade: k === 'PRODUTO' ? 'UN' : f.unidade })} className={cx('px-4 h-9 rounded-md text-sm font-semibold', f.tipo === k ? 'bg-[var(--ink)] text-[var(--surface)]' : 'text-[var(--ink-2)]')}>{l}</button>)}
        </div>
        <Field label="Nome" className="sm:col-span-2"><Input required value={f.nome} onChange={set('nome')} placeholder={f.tipo === 'SERVICO' ? 'Gestão de tráfego pago' : 'Kit de brindes'} /></Field>
        <Field label="Descrição (aparece na proposta)" className="sm:col-span-2"><Textarea value={f.descricao} onChange={set('descricao')} rows={2} /></Field>
        <Field label="Preço de venda"><MoneyInput required value={f.preco_venda} onChange={set('preco_venda')} /></Field>
        <Field label={f.tipo === 'PRODUTO' ? 'Custo unitário' : 'Custo direto por unidade'} hint={margem !== null ? `Margem unitária: ${pct(margem)}` : 'Freelancers, ferramentas, produção…'}><MoneyInput value={f.custo_unitario} onChange={set('custo_unitario')} /></Field>
        <Field label="Cobrança"><Select value={f.cobranca} onChange={set('cobranca')}><option value="UNICA">Única (projeto/venda)</option><option value="RECORRENTE">Recorrente (assinatura)</option></Select></Field>
        {f.cobranca === 'RECORRENTE' ? (
          <Field label="Periodicidade"><Select value={f.periodicidade} onChange={set('periodicidade')}><option value="MENSAL">Mensal</option><option value="TRIMESTRAL">Trimestral</option><option value="SEMESTRAL">Semestral</option><option value="ANUAL">Anual</option></Select></Field>
        ) : <Field label="Unidade"><Select value={f.unidade} onChange={set('unidade')}>{['UN', 'H', 'MES', 'PROJETO', 'KG', 'CX'].map((u) => <option key={u}>{u}</option>)}</Select></Field>}
        {f.tipo === 'SERVICO' && <Field label="Horas estimadas por unidade" hint="Base para comparar previsto × realizado"><Input type="number" step="0.5" value={f.horas_estimadas} onChange={set('horas_estimadas')} /></Field>}
        <Field label="Conta de receita (DRE)">
          <Select value={f.account_id} onChange={set('account_id')}><option value="">Padrão do sistema</option>{L.accounts.filter((a) => a.grupo_dre === 'RECEITA_BRUTA').map((a) => <option key={a.id} value={a.id}>{a.codigo} {a.nome}</option>)}</Select>
        </Field>
        <Field label="Categoria"><Input value={f.categoria} onChange={set('categoria')} placeholder="Performance, conteúdo, tecnologia…" /></Field>
        <Field label="Código (SKU)"><Input value={f.codigo} onChange={set('codigo')} /></Field>
        {f.tipo === 'PRODUTO' && (
          <div className="sm:col-span-2 rounded-lg border border-[var(--line)] p-3 grid sm:grid-cols-3 gap-3 items-end">
            <label className="flex items-center gap-2 text-sm font-semibold h-10"><input type="checkbox" checked={f.controla_estoque} onChange={set('controla_estoque')} className="w-4 h-4" />Controlar estoque</label>
            {f.controla_estoque && <Field label="Estoque mínimo"><Input type="number" value={f.estoque_minimo} onChange={set('estoque_minimo')} /></Field>}
            {f.controla_estoque && isNew && <Field label="Estoque inicial"><Input type="number" value={f.estoque_inicial} onChange={set('estoque_inicial')} /></Field>}
          </div>
        )}
        {!isNew && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.ativo} onChange={set('ativo')} className="w-4 h-4" />Ativo no catálogo</label>}
      </form>
    </Modal>
  );
}

function StockModal({ product, onClose }) {
  const L = useLookups();
  const [f, setF] = useState({ tipo: 'ENTRADA', quantidade: '', custo_unitario: product.custo_unitario, contract_id: '', observacao: '', data: todayYmd() });
  const mv = useBizMutation((body) => biz(`/products/${product.id}/stock`, { method: 'POST', body }), { success: 'Estoque atualizado', onSuccess: onClose });
  const icons = { ENTRADA: ArrowDownToLine, SAIDA: ArrowUpFromLine, AJUSTE: SlidersHorizontal };
  return (
    <Modal open onClose={onClose} title={`Movimentar estoque: ${product.nome}`} description={`Saldo atual ${num(product.estoque_atual)} ${product.unidade} · custo médio ${money(product.custo_unitario)}`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancelar</Button><Button loading={mv.isPending} onClick={() => mv.mutate({ ...f, quantidade: Number(f.quantidade), custo_unitario: f.tipo === 'ENTRADA' ? Number(f.custo_unitario) : undefined, contract_id: f.contract_id || undefined })}>Registrar</Button></>}>
      <div className="grid grid-cols-3 gap-2 mb-4">
        {Object.entries({ ENTRADA: 'Entrada', SAIDA: 'Saída', AJUSTE: 'Ajuste' }).map(([k, l]) => {
          const I = icons[k];
          return <button key={k} type="button" onClick={() => setF({ ...f, tipo: k })} className={cx('rounded-lg border p-3 text-sm font-semibold flex flex-col items-center gap-1', f.tipo === k ? 'border-[var(--result)] bg-[var(--result-soft)]' : 'border-[var(--line)]')}><I className="w-4 h-4" />{l}</button>;
        })}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label={f.tipo === 'AJUSTE' ? 'Saldo correto (contagem)' : 'Quantidade'}><Input type="number" step="any" value={f.quantidade} onChange={(e) => setF({ ...f, quantidade: e.target.value })} /></Field>
        {f.tipo === 'ENTRADA' && <Field label="Custo unitário da compra" hint="Recalcula o custo médio"><MoneyInput value={f.custo_unitario} onChange={(v) => setF({ ...f, custo_unitario: v })} /></Field>}
        {f.tipo === 'SAIDA' && <Field label="Consumido no contrato" hint="O custo entra na margem do contrato"><Select value={f.contract_id} onChange={(e) => setF({ ...f, contract_id: e.target.value })}><option value="">Nenhum</option>{L.contracts.filter((c) => c.status === 'ATIVO').map((c) => <option key={c.id} value={c.id}>#{c.numero} {c.titulo}</option>)}</Select></Field>}
        <Field label="Data"><Input type="date" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Field>
        <Field label="Observação" className="col-span-2"><Input value={f.observacao} onChange={(e) => setF({ ...f, observacao: e.target.value })} placeholder="NF 1234, evento do cliente…" /></Field>
      </div>
    </Modal>
  );
}
