import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus, FileSignature, Eye, Copy, Send, Trash2, Repeat, ExternalLink, MessageCircle, GripVertical, X } from 'lucide-react';
import { toast } from 'sonner';
import { biz } from '../api';
import { useBiz, useBizQuery, useBizMutation } from '../BizContext';
import { PageHeader, Button, Field, Input, Select, Textarea, MoneyInput, StatusPill, Money, Empty, Loading, ErrorBox, SearchInput, useDebounced, Panel, cx } from '../components/ui';
import { useLookups } from '../components/lookups';
import { money, pct, date, ymd } from '../format';

export function ProposalList() {
  const { can } = useBiz();
  const nav = useNavigate();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounced(q);
  const list = useBizQuery('/proposals', { status, q: dq });
  const items = list.data?.items || [];
  const r = list.data?.resumo;
  return (
    <>
      <PageHeader title="Propostas" subtitle="Monte propostas com a marca da empresa, compartilhe por link e veja quando o cliente abriu."
        actions={can('comercial:write') && <Button icon={Plus} onClick={() => nav('/empresas/propostas/nova')}>Nova proposta</Button>} />
      {r && (
        <div className="flex flex-wrap gap-x-8 gap-y-2 mb-4 text-sm">
          <span>Em negociação: <b>{r.abertas}</b></span>
          <span>Pipeline recorrente <b className="num">{money(r.pipeline_recorrente)}/mês</b></span>
          <span>Pipeline de projetos <b className="num">{money(r.pipeline_unico)}</b></span>
          <span>Conversão <b>{pct(r.taxa_conversao)}</b></span>
        </div>
      )}
      <div className="flex flex-wrap gap-2 mb-4">
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="w-[180px]">
          <option value="">Todos os status</option>{['RASCUNHO', 'ENVIADA', 'VISUALIZADA', 'ACEITA', 'RECUSADA', 'EXPIRADA'].map((s) => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
        </Select>
        <SearchInput value={q} onChange={setQ} />
      </div>
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-hidden">
        {list.isLoading ? <Loading /> : !items.length ? (
          <Empty icon={FileSignature} title="Nenhuma proposta" text="Use os serviços do catálogo para montar uma proposta em minutos." action={can('comercial:write') && <Button icon={Plus} onClick={() => nav('/empresas/propostas/nova')}>Criar proposta</Button>} />
        ) : (
          <div className="overflow-x-auto"><table className="tbl">
            <thead><tr><th>Nº</th><th>Proposta</th><th>Status</th><th className="r">Mensal</th><th className="r">Projeto</th><th className="r">Margem estimada</th><th>Validade</th><th className="r">Aberturas</th></tr></thead>
            <tbody>{items.map((p) => (
              <tr key={p.id} className="cursor-pointer" onClick={() => nav(`/empresas/propostas/${p.id}`)}>
                <td className="num text-[var(--muted)]">#{p.numero}</td>
                <td className="min-w-[240px]"><b>{p.titulo}</b><div className="text-xs text-[var(--muted)]">{p.client?.nome_fantasia || p.client?.nome || p.prospect_empresa || p.prospect_nome}</div></td>
                <td><StatusPill status={p.status_efetivo} /></td>
                <td className="r"><Money value={p.total_recorrente} /></td>
                <td className="r"><Money value={p.total_unico} /></td>
                <td className="r num">{p.margem_recorrente_percent !== null ? pct(p.margem_recorrente_percent) : '—'}</td>
                <td className="num">{date(p.validade)}</td>
                <td className="r num">{p.visualizacoes}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </section>
    </>
  );
}

const fromProposal = (p) => ({ ...p, client_id: p.client_id || '', validade: ymd(p.validade), items: p.items.map((i) => ({ ...i, key: i.id })) });

const emptyItem = () => ({ key: Math.random().toString(36).slice(2), product_id: '', descricao: '', detalhes: '', quantidade: 1, preco_unitario: '', desconto_percent: 0, custo_unitario: 0, cobranca: 'UNICA' });

export function ProposalEditor() {
  const { id } = useParams();
  const isNew = id === 'nova';
  const nav = useNavigate();
  const { can, company } = useBiz();
  const L = useLookups();
  const q = useBizQuery(`/proposals/${id}`, null, { enabled: !isNew });
  const [f, setF] = useState(null);
  const [mode, setMode] = useState('cliente');

  useEffect(() => {
    if (isNew && !f) setF({ titulo: '', client_id: '', prospect_nome: '', prospect_empresa: '', prospect_email: '', introducao: '', escopo: '', condicoes: company?.proposta_termos || '', validade: '', desconto_percent: 0, prazo_contrato_meses: 12, responsavel: '', items: [emptyItem()] });
    if (!isNew && q.data && !f) {
      setMode(q.data.client_id ? 'cliente' : 'prospect');
      setF(fromProposal(q.data));
    }
  }, [isNew, q.data, f, company]);

  const editable = can('comercial:write') && (isNew || q.data?.status !== 'ACEITA');
  const save = useBizMutation((body) => (isNew ? biz('/proposals', { method: 'POST', body }) : biz(`/proposals/${id}`, { method: 'PUT', body })), {
    success: 'Proposta salva',
    onSuccess: (p) => {
      if (isNew) { setF(null); nav(`/empresas/propostas/${p.id}`, { replace: true }); } else setF(fromProposal(p));
    },
  });
  const send = useBizMutation(() => biz(`/proposals/${id}/send`, { method: 'POST', body: {} }), {
    onSuccess: (r) => { navigator.clipboard?.writeText(r.link).catch(() => {}); toast.success('Proposta enviada. Link copiado.'); },
  });
  const dup = useBizMutation(() => biz(`/proposals/${id}/duplicate`, { method: 'POST' }), { success: 'Nova versão criada', onSuccess: (p) => { setF(null); nav(`/empresas/propostas/${p.id}`); } });
  const del = useBizMutation(() => biz(`/proposals/${id}`, { method: 'DELETE' }), { success: 'Proposta excluída', onSuccess: () => nav('/empresas/propostas') });
  const convert = useBizMutation(() => biz(`/proposals/${id}/convert`, { method: 'POST', body: { ativar: false } }), { success: 'Contrato criado em rascunho', onSuccess: (c) => nav(`/empresas/contratos/${c.id}`) });

  const totals = useMemo(() => {
    if (!f) return null;
    const fator = 1 - Number(f.desconto_percent || 0) / 100;
    const t = (i) => Number(i.quantidade || 0) * Number(i.preco_unitario || 0) * (1 - Number(i.desconto_percent || 0) / 100);
    const rec = f.items.filter((i) => i.cobranca === 'RECORRENTE');
    const uni = f.items.filter((i) => i.cobranca !== 'RECORRENTE');
    const sum = (a, fn) => a.reduce((s, i) => s + fn(i), 0);
    const totalRec = sum(rec, t) * fator;
    const totalUni = sum(uni, t) * fator;
    const custoRec = sum(rec, (i) => Number(i.quantidade || 0) * Number(i.custo_unitario || 0));
    const custoUni = sum(uni, (i) => Number(i.quantidade || 0) * Number(i.custo_unitario || 0));
    const imp = Number(company?.aliquota_imposto || 0) / 100;
    return {
      totalRec, totalUni, margemRec: totalRec - custoRec - totalRec * imp, margemUni: totalUni - custoUni - totalUni * imp,
      margemRecPct: totalRec ? ((totalRec - custoRec - totalRec * imp) / totalRec) * 100 : null, margemUniPct: totalUni ? ((totalUni - custoUni - totalUni * imp) / totalUni) * 100 : null,
      contrato: totalUni + totalRec * Number(f.prazo_contrato_meses || 12),
    };
  }, [f, company]);

  if (!isNew && q.isLoading) return <Loading />;
  if (!isNew && q.error) return <ErrorBox error={q.error} />;
  if (!f) return <Loading />;

  const set = (k) => (e) => setF({ ...f, [k]: e?.target ? e.target.value : e });
  const setItem = (key, patch) => setF({ ...f, items: f.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) });
  const pickProduct = (key, pid) => {
    const p = L.products.find((x) => x.id === pid);
    if (!p) return setItem(key, { product_id: '' });
    setItem(key, { product_id: p.id, descricao: p.nome, detalhes: p.descricao || '', preco_unitario: p.preco_venda, custo_unitario: p.custo_unitario, cobranca: p.cobranca });
  };
  const submit = () => {
    const body = {
      ...f,
      client_id: mode === 'cliente' ? f.client_id || null : null,
      prospect_nome: mode === 'prospect' ? f.prospect_nome : null, prospect_empresa: mode === 'prospect' ? f.prospect_empresa : null, prospect_email: mode === 'prospect' ? f.prospect_email : null,
      desconto_percent: Number(f.desconto_percent || 0), prazo_contrato_meses: f.prazo_contrato_meses ? Number(f.prazo_contrato_meses) : null, validade: f.validade || undefined,
      items: f.items.filter((i) => i.descricao).map((i) => ({ product_id: i.product_id || null, descricao: i.descricao, detalhes: i.detalhes, quantidade: Number(i.quantidade || 1), preco_unitario: Number(i.preco_unitario || 0), desconto_percent: Number(i.desconto_percent || 0), custo_unitario: Number(i.custo_unitario || 0), cobranca: i.cobranca })),
    };
    for (const k of ['id', 'numero', 'status', 'status_efetivo', 'public_token', 'client', 'base_url', 'company_id', 'created_date', 'updated_date']) delete body[k];
    save.mutate(body);
  };
  const p = q.data;
  const link = p ? `${window.location.origin}/proposta/${p.public_token}` : null;
  const whatsText = p ? encodeURIComponent(`Olá! Segue a proposta "${p.titulo}": ${link}`) : '';

  return (
    <>
      <PageHeader title={isNew ? 'Nova proposta' : `Proposta #${p.numero}`} subtitle={isNew ? 'Escolha o cliente, adicione os itens do catálogo e envie o link.' : undefined}
        actions={<Link to="/empresas/propostas" className="text-sm font-semibold text-[var(--muted)] hover:text-[var(--ink)]">Voltar para propostas</Link>}>
        {p && <div className="flex items-center gap-3 mt-2"><StatusPill status={p.status_efetivo} />{p.visualizacoes > 0 && <span className="text-sm text-[var(--muted)]">Aberta {p.visualizacoes}x, última em {date(p.ultima_visualizacao)}</span>}{p.aceite_nome && <span className="text-sm text-[var(--in)] font-semibold">Aceita por {p.aceite_nome} em {date(p.respondida_em)}</span>}{p.motivo_recusa && <span className="text-sm text-[var(--bad)]">Motivo: {p.motivo_recusa}</span>}</div>}
      </PageHeader>

      <div className="grid xl:grid-cols-[1fr_340px] gap-5 items-start">
        <div className="space-y-5">
          <Panel title="Para quem">
            <div className="inline-flex rounded-lg border border-[var(--line)] p-0.5 mb-4">
              {[['cliente', 'Cliente cadastrado'], ['prospect', 'Novo contato']].map(([k, l]) => <button key={k} type="button" disabled={!editable} onClick={() => setMode(k)} className={cx('px-3 h-8 rounded-md text-sm font-semibold', mode === k ? 'bg-[var(--ink)] text-[var(--surface)]' : 'text-[var(--ink-2)]')}>{l}</button>)}
            </div>
            {mode === 'cliente' ? (
              <Field label="Cliente"><Select disabled={!editable} value={f.client_id} onChange={set('client_id')}><option value="">Selecione…</option>{L.clients.map((c) => <option key={c.id} value={c.id}>{c.nome_fantasia || c.nome}</option>)}</Select></Field>
            ) : (
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="Empresa"><Input disabled={!editable} value={f.prospect_empresa || ''} onChange={set('prospect_empresa')} /></Field>
                <Field label="Contato"><Input disabled={!editable} value={f.prospect_nome || ''} onChange={set('prospect_nome')} /></Field>
                <Field label="E-mail"><Input disabled={!editable} type="email" value={f.prospect_email || ''} onChange={set('prospect_email')} /></Field>
              </div>
            )}
          </Panel>

          <Panel title="Conteúdo">
            <div className="grid gap-4">
              <Field label="Título"><Input disabled={!editable} required value={f.titulo} onChange={set('titulo')} placeholder="Plano de crescimento digital 2027" /></Field>
              <Field label="Apresentação" hint="Aceita markdown: **negrito**, listas com -"><Textarea disabled={!editable} value={f.introducao || ''} onChange={set('introducao')} rows={4} placeholder="Contexto do cliente, objetivo e por que a sua empresa." /></Field>
              <Field label="Escopo e entregáveis"><Textarea disabled={!editable} value={f.escopo || ''} onChange={set('escopo')} rows={5} placeholder={'- 12 posts por mês\n- Gestão de Meta Ads e Google Ads\n- Relatório mensal de resultados'} /></Field>
            </div>
          </Panel>

          <Panel title="Itens e investimento" pad={false}>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th className="w-6" /><th>Item</th><th>Cobrança</th><th className="r">Qtd.</th><th className="r">Preço unit.</th><th className="r">Desc. %</th><th className="r">Custo unit.</th><th className="r">Total</th><th /></tr></thead>
                <tbody>
                  {f.items.map((i) => {
                    const total = Number(i.quantidade || 0) * Number(i.preco_unitario || 0) * (1 - Number(i.desconto_percent || 0) / 100);
                    return (
                      <tr key={i.key}>
                        <td className="text-[var(--muted)]"><GripVertical className="w-4 h-4" /></td>
                        <td className="min-w-[260px] space-y-1.5">
                          <Select disabled={!editable} value={i.product_id || ''} onChange={(e) => pickProduct(i.key, e.target.value)} className="h-9"><option value="">Item livre</option>{L.products.map((pp) => <option key={pp.id} value={pp.id}>{pp.nome}</option>)}</Select>
                          <Input disabled={!editable} value={i.descricao} onChange={(e) => setItem(i.key, { descricao: e.target.value })} placeholder="Descrição" className="h-9" />
                        </td>
                        <td><Select disabled={!editable} value={i.cobranca} onChange={(e) => setItem(i.key, { cobranca: e.target.value })} className="h-9" style={{ width: 120 }}><option value="UNICA">Única</option><option value="RECORRENTE">Mensal</option></Select></td>
                        <td className="r"><Input disabled={!editable} type="number" value={i.quantidade} onChange={(e) => setItem(i.key, { quantidade: e.target.value })} className="h-9 text-right" style={{ width: 72 }} /></td>
                        <td className="r"><MoneyInput disabled={!editable} value={i.preco_unitario} onChange={(v) => setItem(i.key, { preco_unitario: v })} className="h-9 text-right" style={{ width: 120 }} /></td>
                        <td className="r"><Input disabled={!editable} type="number" value={i.desconto_percent} onChange={(e) => setItem(i.key, { desconto_percent: e.target.value })} className="h-9 text-right" style={{ width: 72 }} /></td>
                        <td className="r"><MoneyInput disabled={!editable} value={i.custo_unitario} onChange={(v) => setItem(i.key, { custo_unitario: v })} className="h-9 text-right" style={{ width: 110 }} title="Interno: não aparece para o cliente" /></td>
                        <td className="r font-semibold"><Money value={total} /></td>
                        <td>{editable && <button type="button" onClick={() => setF({ ...f, items: f.items.filter((x) => x.key !== i.key) })} className="p-1.5 text-[var(--muted)] hover:text-[var(--bad)]" aria-label="Remover item"><X className="w-4 h-4" /></button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {editable && <div className="px-5 py-3"><Button variant="secondary" size="sm" icon={Plus} onClick={() => setF({ ...f, items: [...f.items, emptyItem()] })}>Adicionar item</Button><span className="text-xs text-[var(--muted)] ml-3">O custo unitário é interno e nunca aparece para o cliente.</span></div>}
          </Panel>

          <Panel title="Condições">
            <div className="grid sm:grid-cols-3 gap-4 mb-4">
              <Field label="Desconto geral (%)"><Input disabled={!editable} type="number" value={f.desconto_percent} onChange={set('desconto_percent')} /></Field>
              <Field label="Prazo do contrato (meses)"><Input disabled={!editable} type="number" value={f.prazo_contrato_meses || ''} onChange={set('prazo_contrato_meses')} /></Field>
              <Field label="Válida até"><Input disabled={!editable} type="date" value={f.validade || ''} onChange={set('validade')} /></Field>
            </div>
            <Field label="Condições comerciais"><Textarea disabled={!editable} value={f.condicoes || ''} onChange={set('condicoes')} rows={4} placeholder="Forma de pagamento, reajuste anual pelo IPCA, fidelidade, multa rescisória…" /></Field>
          </Panel>
        </div>

        <aside className="xl:sticky xl:top-6 space-y-4">
          <section className="rounded-xl bg-[var(--side)] text-white p-5">
            <p className="text-sm text-[#AEB6C7] font-semibold">Investimento do cliente</p>
            <p className="num text-[30px] font-extrabold leading-tight mt-1">{money(totals.totalRec)}<span className="text-base font-semibold text-[#AEB6C7]">/mês</span></p>
            {totals.totalUni > 0 && <p className="num text-lg font-bold">+ {money(totals.totalUni)} em projeto</p>}
            <p className="text-sm text-[#AEB6C7] mt-2">Valor total do contrato: <b className="text-white num">{money(totals.contrato)}</b></p>
            <div className="mt-4 pt-4 border-t border-white/10 text-[14px] space-y-2">
              <p className="text-xs text-[#AEB6C7]">Só você vê: margem estimada após custos diretos e {pct(company?.aliquota_imposto)} de impostos</p>
              {totals.totalRec > 0 && <div className="flex justify-between"><span>Mensal</span><span className={cx('num font-bold', totals.margemRecPct < Number(company?.meta_margem_contrato || 0) && 'text-[#F5B08B]')}>{money(totals.margemRec)} ({pct(totals.margemRecPct)})</span></div>}
              {totals.totalUni > 0 && <div className="flex justify-between"><span>Projeto</span><span className="num font-bold">{money(totals.margemUni)} ({pct(totals.margemUniPct)})</span></div>}
              <p className="text-xs text-[#AEB6C7]">Meta da empresa: {pct(company?.meta_margem_contrato)} de margem. Horas da equipe entram na margem real do contrato.</p>
            </div>
          </section>

          <div className="space-y-2">
            {editable && <Button className="w-full" loading={save.isPending} onClick={submit}>{isNew ? 'Salvar proposta' : 'Salvar alterações'}</Button>}
            {p && (
              <>
                {can('comercial:write') && ['RASCUNHO', 'EXPIRADA'].includes(p.status_efetivo) && <Button variant="success" className="w-full" icon={Send} loading={send.isPending} onClick={() => send.mutate()}>Enviar e copiar link</Button>}
                {p.status !== 'RASCUNHO' && (
                  <div className="grid grid-cols-2 gap-2">
                    <Button variant="secondary" icon={Copy} onClick={() => { navigator.clipboard.writeText(link); toast.success('Link copiado'); }}>Copiar link</Button>
                    <a href={`https://wa.me/?text=${whatsText}`} target="_blank" rel="noreferrer"><Button variant="secondary" icon={MessageCircle} className="w-full">WhatsApp</Button></a>
                  </div>
                )}
                <a href={`${link}?preview=1`} target="_blank" rel="noreferrer" className="block"><Button variant="secondary" icon={Eye} className="w-full">Ver como o cliente vê</Button></a>
                {p.contract_id ? (
                  <Link to={`/empresas/contratos/${p.contract_id}`} className="block"><Button variant="secondary" icon={ExternalLink} className="w-full">Abrir contrato gerado</Button></Link>
                ) : can('contratos:write') && ['ENVIADA', 'VISUALIZADA', 'ACEITA'].includes(p.status_efetivo) && (
                  <Button variant="secondary" icon={Repeat} className="w-full" loading={convert.isPending} onClick={() => window.confirm('Fechou por fora? Gerar o contrato a partir desta proposta?') && convert.mutate()}>Gerar contrato</Button>
                )}
                {can('comercial:write') && <Button variant="ghost" icon={Copy} className="w-full" loading={dup.isPending} onClick={() => dup.mutate()}>Duplicar como nova versão</Button>}
                {can('comercial:write') && p.status !== 'ACEITA' && <Button variant="ghost" icon={Trash2} className="w-full text-[var(--bad)]" onClick={() => window.confirm('Excluir esta proposta?') && del.mutate()}>Excluir</Button>}
              </>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}
