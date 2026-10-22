import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, Plus, KeyRound, ShieldCheck, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { biz } from '../api';
import { useBiz, useBizQuery, useBizMutation } from '../BizContext';
import { PageHeader, Tabs, Panel, Field, Input, Select, Textarea, Button, Loading, StatusPill, Modal, Empty } from '../components/ui';
import Registry, { COST_CENTERS, BANKS, RegistryForm } from './Registry';
import { GRUPOS_DRE } from '../components/lookups';
import { date, money } from '../format';

const TABS = [['empresa', 'Empresa e marca'], ['asaas', 'Asaas'], ['ia', 'Integração com IA (MCP)'], ['contas', 'Plano de contas'], ['centros', 'Centros de custo'], ['bancos', 'Contas financeiras'], ['usuarios', 'Usuários'], ['auditoria', 'Auditoria']];

export default function Settings() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('aba') || 'empresa';
  return (
    <>
      <PageHeader title="Configurações" />
      <Tabs tabs={TABS} value={tab} onChange={(k) => setSp({ aba: k })} />
      {tab === 'empresa' && <CompanyTab />}
      {tab === 'asaas' && <AsaasTab />}
      {tab === 'ia' && <McpTab />}
      {tab === 'contas' && <AccountsTab />}
      {tab === 'centros' && <div className="[&_h1]:text-lg"><Registry config={COST_CENTERS} /></div>}
      {tab === 'bancos' && <div className="[&_h1]:text-lg"><Registry config={BANKS} /></div>}
      {tab === 'usuarios' && <UsersTab />}
      {tab === 'auditoria' && <AuditTab />}
    </>
  );
}

function CompanyTab() {
  const q = useBizQuery('/company');
  const { refetchCompanies } = useBiz();
  const [f, setF] = useState(null);
  const save = useBizMutation((body) => biz('/company', { method: 'PUT', body }), { success: 'Dados da empresa salvos', onSuccess: () => refetchCompanies() });
  if (q.isLoading) return <Loading />;
  const c = f || q.data;
  const set = (k) => (e) => setF({ ...c, [k]: e.target.value });
  const submit = (e) => {
    e.preventDefault();
    const body = { ...c };
    for (const k of ['aliquota_imposto', 'aliquota_comissao', 'meta_margem_contrato', 'proposta_validade_dias']) body[k] = Number(body[k]);
    for (const k of ['id', 'papel', 'asaas_configurado', 'asaas_api_key_mascarada', 'created_date', 'updated_date', 'created_by', 'plano', 'ativo']) delete body[k];
    save.mutate(body);
  };
  return (
    <form onSubmit={submit} className="grid xl:grid-cols-[1fr_380px] gap-5 items-start">
      <div className="space-y-5">
        <Panel title="Dados cadastrais">
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Razão social"><Input required value={c.razao_social || ''} onChange={set('razao_social')} /></Field>
            <Field label="Nome fantasia"><Input value={c.nome_fantasia || ''} onChange={set('nome_fantasia')} /></Field>
            <Field label="CNPJ"><Input value={c.cnpj || ''} onChange={set('cnpj')} /></Field>
            <Field label="E-mail"><Input value={c.email || ''} onChange={set('email')} /></Field>
            <Field label="Telefone"><Input value={c.telefone || ''} onChange={set('telefone')} /></Field>
            <Field label="Site"><Input value={c.site || ''} onChange={set('site')} /></Field>
          </div>
        </Panel>
        <Panel title="Parâmetros de margem">
          <div className="grid sm:grid-cols-3 gap-4">
            <Field label="Regime tributário"><Select value={c.regime_tributario} onChange={set('regime_tributario')}><option value="MEI">MEI</option><option value="SIMPLES">Simples Nacional</option><option value="PRESUMIDO">Lucro presumido</option><option value="REAL">Lucro real</option></Select></Field>
            <Field label="Imposto sobre faturamento (%)"><Input type="number" step="0.01" value={c.aliquota_imposto} onChange={set('aliquota_imposto')} /></Field>
            <Field label="Comissão comercial padrão (%)"><Input type="number" step="0.1" value={c.aliquota_comissao} onChange={set('aliquota_comissao')} /></Field>
            <Field label="Meta de margem por contrato (%)"><Input type="number" step="1" value={c.meta_margem_contrato} onChange={set('meta_margem_contrato')} /></Field>
            <Field label="Rateio do overhead" hint="Como a estrutura é distribuída entre contratos"><Select value={c.rateio_overhead} onChange={set('rateio_overhead')}><option value="RECEITA">Proporcional à receita</option><option value="HORAS">Proporcional às horas</option><option value="NENHUM">Não ratear</option></Select></Field>
          </div>
        </Panel>
        <Panel title="Propostas">
          <div className="grid gap-4">
            <Field label="Validade padrão (dias)" className="max-w-[200px]"><Input type="number" value={c.proposta_validade_dias} onChange={set('proposta_validade_dias')} /></Field>
            <Field label="Condições gerais padrão" hint="Pré-preenchidas em toda proposta nova"><Textarea rows={4} value={c.proposta_termos || ''} onChange={set('proposta_termos')} /></Field>
            <Field label="Rodapé"><Input value={c.proposta_rodape || ''} onChange={set('proposta_rodape')} /></Field>
          </div>
        </Panel>
        <Button type="submit" loading={save.isPending}>Salvar alterações</Button>
      </div>
      <Panel title="Marca nas propostas">
        <div className="space-y-4">
          <Field label="URL do logo" hint="PNG ou SVG com fundo transparente"><Input value={c.logo_url || ''} onChange={set('logo_url')} placeholder="https://…/logo.png" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cor principal"><div className="flex gap-2"><input type="color" value={c.cor_primaria} onChange={set('cor_primaria')} className="h-10 w-12 rounded border border-[var(--line)]" /><Input value={c.cor_primaria} onChange={set('cor_primaria')} /></div></Field>
            <Field label="Cor de destaque"><div className="flex gap-2"><input type="color" value={c.cor_secundaria} onChange={set('cor_secundaria')} className="h-10 w-12 rounded border border-[var(--line)]" /><Input value={c.cor_secundaria} onChange={set('cor_secundaria')} /></div></Field>
          </div>
          <div className="rounded-xl overflow-hidden border border-[var(--line)]">
            <div className="p-5 text-white" style={{ background: c.cor_primaria }}>
              {c.logo_url ? <img src={c.logo_url} alt="" className="h-7 object-contain" /> : <b>{c.nome_fantasia || c.razao_social}</b>}
              <p className="text-xl font-extrabold mt-6">Plano de crescimento digital</p>
            </div>
            <div className="p-4 bg-white"><div className="rounded-lg p-3 text-white" style={{ background: c.cor_secundaria }}><p className="text-xs opacity-80">Investimento mensal</p><p className="font-extrabold text-lg">R$ 6.000,00</p></div></div>
          </div>
          <p className="text-xs text-[var(--muted)]">Prévia de como o cliente vê a proposta.</p>
        </div>
      </Panel>
    </form>
  );
}

function AsaasTab() {
  const st = useBizQuery('/company/asaas/status');
  const [key, setKey] = useState('');
  const [amb, setAmb] = useState(null);
  const save = useBizMutation((body) => biz('/company/asaas', { method: 'PUT', body }), {
    onSuccess: (r) => { setKey(''); r.conexao?.ok ? toast.success(`Asaas conectado. Saldo: ${money(r.conexao.saldo)}`) : toast.error(r.conexao?.erro || 'Chave salva, mas a conexão falhou'); },
  });
  if (st.isLoading) return <Loading />;
  const s = st.data;
  const copy = (v) => { navigator.clipboard.writeText(v); toast.success('Copiado'); };
  return (
    <div className="grid xl:grid-cols-2 gap-5 items-start">
      <Panel title="Conexão">
        <div className="flex items-center gap-2 mb-4 text-sm">
          {s.conectado ? <><CheckCircle2 className="w-5 h-5 text-[var(--in)]" /><span>Conectado ao ambiente <b>{s.ambiente === 'PRODUCAO' ? 'de produção' : 'sandbox'}</b>. Saldo: <b className="num">{money(s.saldo)}</b></span></>
            : s.configurado ? <><AlertTriangle className="w-5 h-5 text-[var(--bad)]" /><span>{s.erro}</span></> : <span className="text-[var(--muted)]">Ainda não configurado.</span>}
        </div>
        <div className="space-y-4">
          <Field label="Ambiente"><Select value={amb || s.ambiente} onChange={(e) => setAmb(e.target.value)}><option value="SANDBOX">Sandbox (testes)</option><option value="PRODUCAO">Produção</option></Select></Field>
          <Field label="Chave de API" hint="No Asaas: Integrações › Chaves de API. Guardamos a chave criptografada."><Input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={s.configurado ? 'Deixe em branco para manter a atual' : '$aact_…'} autoComplete="off" /></Field>
          <div className="flex gap-2">
            <Button loading={save.isPending} disabled={!key && !amb} onClick={() => save.mutate({ ...(key && { api_key: key }), ambiente: amb || s.ambiente })}>Salvar e testar</Button>
            {s.configurado && <Button variant="danger" onClick={() => window.confirm('Desconectar o Asaas? Cobranças existentes continuam lá.') && save.mutate({ api_key: null })}>Desconectar</Button>}
          </div>
        </div>
      </Panel>
      <Panel title="Webhook (retorno de pagamentos)">
        <p className="text-sm text-[var(--ink-2)] mb-4">No Asaas, vá em Integrações › Webhooks, crie um webhook de cobranças com a URL e o token abaixo e marque os eventos listados. Assim os pagamentos dão baixa sozinhos aqui.</p>
        <div className="space-y-3">
          {[['URL', s.webhook.url], ['Token de autenticação', s.webhook.token]].map(([l, v]) => (
            <Field key={l} label={l}><div className="flex gap-2"><Input readOnly value={v} className="num text-xs" /><Button variant="secondary" icon={Copy} onClick={() => copy(v)} aria-label={`Copiar ${l}`} /></div></Field>
          ))}
          <Field label="Eventos"><p className="text-xs text-[var(--muted)] leading-relaxed">{s.webhook.eventos.join(', ')}</p></Field>
        </div>
      </Panel>
    </div>
  );
}

function McpTab() {
  const keys = useBizQuery('/api-keys');
  const [novo, setNovo] = useState(null);
  const [created, setCreated] = useState(null);
  const create = useBizMutation((body) => biz('/api-keys', { method: 'POST', body }), { onSuccess: (k) => { setNovo(null); setCreated(k); } });
  const revoke = useBizMutation((id) => biz(`/api-keys/${id}`, { method: 'DELETE' }), { success: 'Chave revogada' });
  const mcpUrl = `${window.location.origin}/api/biz/mcp`;
  const copy = (v) => { navigator.clipboard.writeText(v); toast.success('Copiado'); };
  return (
    <div className="grid xl:grid-cols-[1fr_420px] gap-5 items-start">
      <Panel title="Chaves de acesso" action={<Button size="sm" icon={Plus} onClick={() => setNovo({ nome: '', escopo: 'ESCRITA' })}>Nova chave</Button>} pad={false}>
        {keys.isLoading ? <Loading /> : !(keys.data || []).length ? <Empty icon={KeyRound} title="Nenhuma chave criada" text="Crie uma chave para conectar Claude, ChatGPT ou outro assistente à sua empresa." /> : (
          <table className="tbl"><thead><tr><th>Nome</th><th>Permissão</th><th>Prefixo</th><th>Último uso</th><th /></tr></thead>
            <tbody>{keys.data.map((k) => (
              <tr key={k.id}><td className="font-semibold">{k.nome}</td><td>{k.escopo === 'LEITURA' ? 'Somente leitura' : 'Leitura e escrita'}</td><td className="num text-xs">{k.prefixo}…</td><td className="num">{k.ultimo_uso ? date(k.ultimo_uso) : 'Nunca'}</td>
                <td className="r">{k.revogada ? <StatusPill status="CANCELADO" label="Revogada" /> : <Button size="sm" variant="danger" icon={Trash2} onClick={() => window.confirm('Revogar esta chave? Assistentes que usam ela perdem o acesso.') && revoke.mutate(k.id)}>Revogar</Button>}</td></tr>
            ))}</tbody>
          </table>
        )}
      </Panel>
      <Panel title="Como conectar">
        <ol className="text-sm text-[var(--ink-2)] space-y-3 list-decimal pl-4">
          <li>Crie uma chave ao lado. Use "somente leitura" para quem só consulta relatórios.</li>
          <li>No Claude, abra Configurações › Conectores › Adicionar conector personalizado e informe a URL do servidor MCP:
            <div className="flex gap-2 mt-2"><Input readOnly value={mcpUrl} className="text-xs num" /><Button variant="secondary" icon={Copy} onClick={() => copy(mcpUrl)} aria-label="Copiar URL" /></div>
          </li>
          <li>Envie a chave no cabeçalho <code className="text-xs bg-[var(--line-2)] px-1 rounded">Authorization: Bearer fbk_…</code>. Em apps que só aceitam comando local, use:
            <pre className="text-[11px] bg-[var(--paper)] border border-[var(--line)] rounded-lg p-2 mt-2 overflow-x-auto">{`npx mcp-remote ${mcpUrl} \\\n  --header "Authorization: Bearer SUA_CHAVE"`}</pre>
          </li>
          <li>Pergunte, por exemplo: "Qual a margem dos meus contratos este mês?", "Lança R$ 900 de fotógrafo no contrato da Locadora Alfa" ou "Cria uma proposta de tráfego + social media para a Delta".</li>
        </ol>
        <p className="text-xs text-[var(--muted)] mt-4 flex gap-1.5"><ShieldCheck className="w-4 h-4 shrink-0" />Toda ação feita pela IA fica registrada na auditoria com a origem MCP.</p>
      </Panel>
      {novo && (
        <Modal open onClose={() => setNovo(null)} title="Nova chave de acesso" footer={<><Button variant="secondary" onClick={() => setNovo(null)}>Cancelar</Button><Button loading={create.isPending} onClick={() => create.mutate(novo)}>Criar chave</Button></>}>
          <div className="space-y-4">
            <Field label="Nome"><Input value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} placeholder="Claude do Matheus" /></Field>
            <Field label="Permissão"><Select value={novo.escopo} onChange={(e) => setNovo({ ...novo, escopo: e.target.value })}><option value="ESCRITA">Leitura e escrita (segue o seu papel)</option><option value="LEITURA">Somente leitura</option></Select></Field>
          </div>
        </Modal>
      )}
      {created && (
        <Modal open onClose={() => setCreated(null)} title="Chave criada" description="Copie agora. Por segurança, ela não será exibida de novo." footer={<Button onClick={() => setCreated(null)}>Pronto</Button>}>
          <div className="flex gap-2"><Input readOnly value={created.chave} className="num text-xs" /><Button variant="secondary" icon={Copy} onClick={() => copy(created.chave)} aria-label="Copiar chave" /></div>
        </Modal>
      )}
    </div>
  );
}

const ACCOUNT_CFG = {
  entity: 'accounts', perm: 'config:write', singular: 'Conta', newLabel: 'Nova conta',
  fields: [
    { k: 'codigo', label: 'Código', required: true, placeholder: '5.1.07' }, { k: 'nome', label: 'Nome', required: true },
    { k: 'natureza', label: 'Natureza', type: 'select', options: [['DESPESA', 'Despesa'], ['RECEITA', 'Receita']], def: 'DESPESA' },
    { k: 'grupo_dre', label: 'Linha da DRE', type: 'select', options: Object.entries(GRUPOS_DRE), def: 'DESPESAS_ADMINISTRATIVAS' },
    { k: 'custo_direto', label: 'Custo direto', type: 'bool', checkLabel: 'Entra no custo do contrato' }, { k: 'fixa', label: 'Despesa fixa', type: 'bool', checkLabel: 'Usar no ponto de equilíbrio' },
    { k: 'ativo', label: 'Situação', type: 'bool', checkLabel: 'Ativa', def: true },
  ],
};

function AccountsTab() {
  const q = useBizQuery('/accounts');
  const [editing, setEditing] = useState(null);
  if (q.isLoading) return <Loading />;
  const groups = Object.keys(GRUPOS_DRE).map((g) => [g, (q.data || []).filter((a) => a.grupo_dre === g)]).filter(([, l]) => l.length);
  return (
    <>
      <div className="flex justify-between items-center mb-4"><p className="text-sm text-[var(--ink-2)]">Cada conta aponta para uma linha da DRE. Ajuste à realidade da sua empresa.</p><Button icon={Plus} onClick={() => setEditing({})}>Nova conta</Button></div>
      <div className="grid lg:grid-cols-2 gap-5">
        {groups.map(([g, list]) => (
          <Panel key={g} title={GRUPOS_DRE[g]} pad={false}>
            <table className="tbl"><tbody>{list.map((a) => (
              <tr key={a.id} className="cursor-pointer" onClick={() => setEditing(a)}><td className="num text-[var(--muted)] w-[80px]">{a.codigo}</td><td>{a.nome}{!a.ativo && <span className="text-xs text-[var(--muted)]"> (inativa)</span>}</td><td className="r text-xs text-[var(--muted)]">{[a.custo_direto && 'custo direto', a.fixa && 'fixa'].filter(Boolean).join(', ')}</td></tr>
            ))}</tbody></table>
          </Panel>
        ))}
      </div>
      {editing && <RegistryForm config={ACCOUNT_CFG} initial={editing} onClose={() => setEditing(null)} />}
    </>
  );
}

const PAPEIS = [['OWNER', 'Proprietário'], ['ADMIN', 'Administrador'], ['FINANCEIRO', 'Financeiro'], ['COMERCIAL', 'Comercial'], ['OPERACIONAL', 'Operacional'], ['LEITURA', 'Somente leitura']];
function UsersTab() {
  const q = useBizQuery('/members');
  const [f, setF] = useState({ email: '', papel: 'FINANCEIRO' });
  const add = useBizMutation((body) => biz('/members', { method: 'POST', body }), { success: 'Acesso concedido', onSuccess: () => setF({ email: '', papel: 'FINANCEIRO' }) });
  const upd = useBizMutation(({ id, ...body }) => biz(`/members/${id}`, { method: 'PUT', body }), { success: 'Acesso atualizado' });
  if (q.isLoading) return <Loading />;
  return (
    <div className="grid xl:grid-cols-[1fr_360px] gap-5 items-start">
      <Panel title="Quem acessa esta empresa" pad={false}>
        <table className="tbl"><thead><tr><th>Usuário</th><th>Papel</th><th>Situação</th></tr></thead>
          <tbody>{q.data.map((m) => (
            <tr key={m.id}><td className="font-semibold">{m.email}</td>
              <td><Select value={m.papel} onChange={(e) => upd.mutate({ id: m.id, papel: e.target.value })} className="h-9 w-[180px]">{PAPEIS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></td>
              <td><button onClick={() => upd.mutate({ id: m.id, ativo: !m.ativo })}><StatusPill status={m.ativo ? 'ATIVO' : 'INATIVO'} /></button></td></tr>
          ))}</tbody>
        </table>
      </Panel>
      <Panel title="Dar acesso">
        <div className="space-y-3">
          <Field label="E-mail do usuário" hint="A pessoa precisa ter conta no Freedom"><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
          <Field label="Papel"><Select value={f.papel} onChange={(e) => setF({ ...f, papel: e.target.value })}>{PAPEIS.filter(([k]) => k !== 'OWNER').map(([k, l]) => <option key={k} value={k}>{l}</option>)}</Select></Field>
          <Button loading={add.isPending} onClick={() => add.mutate(f)} disabled={!f.email}>Conceder acesso</Button>
          <p className="text-xs text-[var(--muted)]">Financeiro: lança e baixa contas, vê relatórios. Comercial: clientes e propostas, sem ver margens e DRE. Operacional: horas e estoque.</p>
        </div>
      </Panel>
    </div>
  );
}

function AuditTab() {
  const [origem, setOrigem] = useState('');
  const q = useBizQuery('/audit', { origem, limit: 300 });
  return (
    <>
      <Select value={origem} onChange={(e) => setOrigem(e.target.value)} className="w-[220px] mb-4"><option value="">Todas as origens</option><option value="APP">Aplicativo</option><option value="MCP">Assistentes de IA (MCP)</option><option value="WEBHOOK">Asaas (webhook)</option><option value="PUBLICO">Cliente (link público)</option><option value="SISTEMA">Sistema</option></Select>
      <section className="rounded-xl border border-[var(--line)] bg-[var(--surface)] overflow-x-auto">
        {q.isLoading ? <Loading /> : (
          <table className="tbl"><thead><tr><th>Quando</th><th>Origem</th><th>O que aconteceu</th></tr></thead>
            <tbody>{(q.data || []).map((a) => (
              <tr key={a.id}><td className="num whitespace-nowrap">{new Date(a.created_date).toLocaleString('pt-BR')}</td><td><StatusPill status={a.origem === 'MCP' ? 'ENVIADA' : a.origem === 'WEBHOOK' ? 'PAGO' : 'RASCUNHO'} label={{ APP: 'App', MCP: 'IA (MCP)', WEBHOOK: 'Asaas', PUBLICO: 'Cliente', SISTEMA: 'Sistema' }[a.origem]} /></td><td>{a.resumo}</td></tr>
            ))}</tbody>
          </table>
        )}
      </section>
    </>
  );
}
