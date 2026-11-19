import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Copy, Plus, KeyRound, ShieldCheck, Trash2, CheckCircle2, AlertTriangle, RefreshCw, DownloadCloud, Check, FileText, Info, CheckCheck, Bot, Sparkles, ExternalLink, Terminal, Cpu, Zap, Code } from 'lucide-react';
import { toast } from 'sonner';
import { biz } from '../api';
import { useBiz, useBizQuery, useBizMutation } from '../BizContext';
import { PageHeader, Tabs, Panel, Field, Input, Select, Textarea, Button, Loading, StatusPill, Modal, Empty, cx } from '../components/ui';
import Registry, { COST_CENTERS, BANKS, RegistryForm } from './Registry';
import { GRUPOS_DRE } from '../components/lookups';
import { date, money } from '../format';

const TABS = [
  ['empresa', 'Empresa e marca'],
  ['asaas', 'Asaas'],
  ['nfse', 'Nota Fiscal (NFS-e)'],
  ['ia', 'Controle por IA (Claude & ChatGPT)'],
  ['contas', 'Plano de contas'],
  ['centros', 'Centros de custo'],
  ['bancos', 'Contas financeiras'],
  ['usuarios', 'Usuários'],
  ['auditoria', 'Auditoria'],
];

export default function Settings() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('aba') || 'empresa';
  return (
    <>
      <PageHeader title="Configurações" />
      <Tabs tabs={TABS} value={tab} onChange={(k) => setSp({ aba: k })} />
      {tab === 'empresa' && <CompanyTab />}
      {tab === 'asaas' && <AsaasTab />}
      {tab === 'nfse' && <NfseTab />}
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
  const [syncStats, setSyncStats] = useState(null);
  const save = useBizMutation((body) => biz('/company/asaas', { method: 'PUT', body }), {
    onSuccess: (r) => { setKey(''); r.conexao?.ok ? toast.success(`Asaas conectado. Saldo: ${money(r.conexao.saldo)}`) : toast.error(r.conexao?.erro || 'Chave salva, mas a conexão falhou'); },
  });
  const sync = useBizMutation(() => biz('/company/asaas/sync', { method: 'POST' }), {
    onSuccess: (res) => {
      setSyncStats(res.stats);
      toast.success('Histórico do Asaas sincronizado!');
    },
  });
  if (st.isLoading) return <Loading />;
  const s = st.data;
  const copy = (v) => { navigator.clipboard.writeText(v); toast.success('Copiado'); };
  return (
    <div className="space-y-5">
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

      <Panel title="Importação e Sincronização do Histórico">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-sm text-[var(--ink-2)]">
              Importe ou sincronize todo o histórico da sua conta Asaas para o Freedom de forma segura e sem duplicidades:
            </p>
            <ul className="text-xs text-[var(--muted)] list-disc pl-4 mt-2 space-y-1">
              <li><b>Clientes:</b> importa cadastros com CPF/CNPJ, e-mail e telefone para sua base.</li>
              <li><b>Assinaturas:</b> cria contratos recorrentes no Freedom vinculados aos clientes.</li>
              <li><b>Cobranças (Recebíveis):</b> importa títulos pagos e em aberto, com baixas e tarifas conciliadas.</li>
              <li><b>Contas a pagar:</b> importa pagamentos e agendamentos de boletos efetuados no Asaas.</li>
            </ul>
          </div>
          <div className="shrink-0">
            <Button
              size="lg"
              variant="primary"
              icon={RefreshCw}
              loading={sync.isPending}
              disabled={!s.conectado}
              onClick={() => sync.mutate()}
            >
              {sync.isPending ? 'Sincronizando Asaas…' : 'Sincronizar histórico agora'}
            </Button>
          </div>
        </div>

        {syncStats && (
          <div className="mt-5 p-4 rounded-xl border border-[var(--in)]/30 bg-[var(--in)]/5">
            <h4 className="font-bold text-sm text-[var(--in)] flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4" /> Sincronização concluída com sucesso!
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-[var(--surface)] rounded-lg border border-[var(--line)]">
                <span className="text-[var(--muted)] block">Clientes</span>
                <b className="text-sm font-extrabold text-[var(--ink)]">+{syncStats.clientes?.importados || 0}</b>
                <span className="text-[10px] text-[var(--muted)] block">{syncStats.clientes?.atualizados || 0} atualizados</span>
              </div>
              <div className="p-3 bg-[var(--surface)] rounded-lg border border-[var(--line)]">
                <span className="text-[var(--muted)] block">Contratos (Assinaturas)</span>
                <b className="text-sm font-extrabold text-[var(--ink)]">+{syncStats.assinaturas?.importadas || 0}</b>
                <span className="text-[10px] text-[var(--muted)] block">{syncStats.assinaturas?.atualizadas || 0} atualizados</span>
              </div>
              <div className="p-3 bg-[var(--surface)] rounded-lg border border-[var(--line)]">
                <span className="text-[var(--muted)] block">Cobranças a receber</span>
                <b className="text-sm font-extrabold text-[var(--ink)]">+{syncStats.cobrancas?.importadas || 0}</b>
                <span className="text-[10px] text-[var(--muted)] block">{syncStats.cobrancas?.atualizadas || 0} atualizadas</span>
              </div>
              <div className="p-3 bg-[var(--surface)] rounded-lg border border-[var(--line)]">
                <span className="text-[var(--muted)] block">Contas a pagar</span>
                <b className="text-sm font-extrabold text-[var(--ink)]">+{syncStats.contas_pagar?.importadas || 0}</b>
                <span className="text-[10px] text-[var(--muted)] block">{syncStats.contas_pagar?.atualizadas || 0} atualizadas</span>
              </div>
            </div>
          </div>
        )}
      </Panel>

      <NfseConfigPanel />
    </div>
  );
}

function NfseTab() {
  const compQ = useBizQuery('/company');
  const asaasQ = useBizQuery('/company/asaas/status');
  const [f, setF] = useState(null);
  const save = useBizMutation((body) => biz('/company', { method: 'PUT', body }), {
    success: 'Parâmetros fiscais da NFS-e salvos com sucesso!',
    onSuccess: () => compQ.refetch(),
  });

  if (compQ.isLoading || asaasQ.isLoading) return <Loading />;
  const c = f || compQ.data || {};
  const s = asaasQ.data || {};

  const set = (k) => (e) => {
    const val = e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e;
    setF({ ...c, [k]: val });
  };

  const handleSave = (e) => {
    e.preventDefault();
    save.mutate({
      municipal_service_code: c.municipal_service_code || null,
      municipal_service_name: c.municipal_service_name || null,
      nfse_descricao_padrao: c.nfse_descricao_padrao || null,
      nfse_aliquota_iss: c.nfse_aliquota_iss !== undefined && c.nfse_aliquota_iss !== '' ? Number(c.nfse_aliquota_iss) : null,
      nfse_reter_iss: !!c.nfse_reter_iss,
      nfse_emitir_ao_receber: !!c.nfse_emitir_ao_receber,
    });
  };

  const hasAsaas = s.conectado;
  const hasCode = !!c.municipal_service_code;
  const hasName = !!c.municipal_service_name;
  const hasIss = c.nfse_aliquota_iss !== undefined && c.nfse_aliquota_iss !== null && c.nfse_aliquota_iss !== '';
  const isReady = hasAsaas && hasCode && hasIss;

  return (
    <div className="space-y-6">
      {/* Cards de Prontidão / Prevenção de Erros */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className={cx('p-4 rounded-xl border', hasAsaas ? 'bg-[var(--in)]/5 border-[var(--in)]/30' : 'bg-[var(--bad)]/5 border-[var(--bad)]/30')}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--muted)] font-bold">1. Conexão Asaas</span>
            {hasAsaas ? <CheckCircle2 className="w-4 h-4 text-[var(--in)]" /> : <AlertTriangle className="w-4 h-4 text-[var(--bad)]" />}
          </div>
          <p className="font-extrabold text-sm">{hasAsaas ? 'Conectado e Ativo' : 'Não conectado'}</p>
          <span className="text-[11px] text-[var(--muted)]">{hasAsaas ? `Ambiente: ${s.ambiente}` : 'Configure na aba Asaas'}</span>
        </div>

        <div className={cx('p-4 rounded-xl border', hasCode ? 'bg-[var(--in)]/5 border-[var(--in)]/30' : 'bg-[var(--warn)]/5 border-[var(--warn)]/30')}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--muted)] font-bold">2. Código Municipal</span>
            {hasCode ? <CheckCircle2 className="w-4 h-4 text-[var(--in)]" /> : <AlertTriangle className="w-4 h-4 text-[var(--warn)]" />}
          </div>
          <p className="font-extrabold text-sm">{c.municipal_service_code || 'Não informado'}</p>
          <span className="text-[11px] text-[var(--muted)]">{hasCode ? 'Tributação definida' : 'Obrigatório para emissão'}</span>
        </div>

        <div className={cx('p-4 rounded-xl border', hasIss ? 'bg-[var(--in)]/5 border-[var(--in)]/30' : 'bg-[var(--warn)]/5 border-[var(--warn)]/30')}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--muted)] font-bold">3. Alíquota de ISS</span>
            {hasIss ? <CheckCircle2 className="w-4 h-4 text-[var(--in)]" /> : <AlertTriangle className="w-4 h-4 text-[var(--warn)]" />}
          </div>
          <p className="font-extrabold text-sm">{hasIss ? `${c.nfse_aliquota_iss}%` : 'Não informada'}</p>
          <span className="text-[11px] text-[var(--muted)]">{c.nfse_reter_iss ? 'Com retenção na fonte' : 'Sem retenção'}</span>
        </div>

        <div className="p-4 rounded-xl border bg-[var(--surface)] border-[var(--line)]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--muted)] font-bold">4. Emissão Automática</span>
            <CheckCheck className="w-4 h-4 text-[var(--result)]" />
          </div>
          <p className="font-extrabold text-sm">{c.nfse_emitir_ao_receber ? 'Ativada' : 'Manual sob demanda'}</p>
          <span className="text-[11px] text-[var(--muted)]">{c.nfse_emitir_ao_receber ? 'Emite ao receber pagamento' : 'Você decide quando emitir'}</span>
        </div>
      </div>

      <div className="grid xl:grid-cols-[1fr_380px] gap-6 items-start">
        {/* Formulário Principal */}
        <Panel title="Configuração dos Dados Fiscais de NFS-e">
          <form onSubmit={handleSave} className="space-y-4">
            <p className="text-sm text-[var(--ink-2)]">
              Preencha os dados cadastrados na prefeitura do seu município para que as notas fiscais sejam emitidas e autorizadas sem rejeição pela prefeitura via Asaas.
            </p>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Código do Serviço Municipal" hint="Código do serviço na tabela da prefeitura (ex: 1.07 ou 0107)">
                <Input
                  required
                  value={c.municipal_service_code || ''}
                  onChange={set('municipal_service_code')}
                  placeholder="Ex: 1.07"
                />
              </Field>
              <Field label="Nome / Discriminação do Serviço" hint="Nome do serviço conforme alvará municipal">
                <Input
                  value={c.municipal_service_name || ''}
                  onChange={set('municipal_service_name')}
                  placeholder="Ex: Suporte técnico e consultoria em TI"
                />
              </Field>
            </div>

            <Field label="Descrição Padrão dos Serviços" hint="Texto padrão impresso no corpo de cada nota fiscal (pode ser personalizado na hora da emissão)">
              <Textarea
                rows={3}
                value={c.nfse_descricao_padrao || ''}
                onChange={set('nfse_descricao_padrao')}
                placeholder="Prestação de serviços profissionais conforme contrato de prestação de serviços..."
              />
            </Field>

            <div className="grid sm:grid-cols-2 gap-4 items-center">
              <Field label="Alíquota Padrão de ISS (%)" hint="Alíquota municipal de ISS (ex: 2.00 a 5.00)">
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={c.nfse_aliquota_iss ?? ''}
                  onChange={set('nfse_aliquota_iss')}
                  placeholder="Ex: 2.00"
                />
              </Field>
              <div className="space-y-3 pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-[var(--ink)]">
                  <input
                    type="checkbox"
                    checked={!!c.nfse_reter_iss}
                    onChange={set('nfse_reter_iss')}
                    className="w-4 h-4 rounded border-[var(--line)] accent-[var(--result)]"
                  />
                  Reter ISS na fonte por padrão
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-[var(--ink)]">
                  <input
                    type="checkbox"
                    checked={!!c.nfse_emitir_ao_receber}
                    onChange={set('nfse_emitir_ao_receber')}
                    className="w-4 h-4 rounded border-[var(--line)] accent-[var(--result)]"
                  />
                  Emitir NFS-e automaticamente ao receber pagamento
                </label>
              </div>
            </div>

            <div className="pt-2">
              <Button type="submit" loading={save.isPending}>Salvar configurações de NFS-e</Button>
            </div>
          </form>
        </Panel>

        {/* Guia de Prevenção de Erros */}
        <Panel title="Prevenção de Erros de Emissão">
          <div className="space-y-4 text-xs text-[var(--ink-2)] leading-relaxed">
            <div className="p-3 rounded-lg border border-[var(--line)] bg-[var(--surface-2)]">
              <b className="text-sm font-bold text-[var(--ink)] block mb-1 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-[var(--result)]" /> 1. Certificado no Asaas
              </b>
              <p>
                No painel web do Asaas (<b>Configurações › Notas Fiscais</b>), certifique-se de que a emissão municipal está ativada com o seu <b>Certificado Digital A1</b> ou credenciais da prefeitura.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-[var(--line)] bg-[var(--surface-2)]">
              <b className="text-sm font-bold text-[var(--ink)] block mb-1 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-[var(--result)]" /> 2. Dados do Cliente (Tomador)
              </b>
              <p>
                A prefeitura exige obrigatoriamente <b>CPF ou CNPJ válido</b> e <b>endereço completo</b> (com CEP, logradouro e número). Você pode editar esses dados a qualquer momento diretamente na tabela de Contas a Receber.
              </p>
            </div>

            <div className="p-3 rounded-lg border border-[var(--line)] bg-[var(--surface-2)]">
              <b className="text-sm font-bold text-[var(--ink)] block mb-1 flex items-center gap-1.5">
                <Info className="w-4 h-4 text-[var(--result)]" /> 3. Código do Serviço
              </b>
              <p>
                O código de serviço deve corresponder exatamente a uma atividade habilitada no alvará/inscrição municipal do seu CNPJ, evitando recusa pelo sistema tributário da sua cidade.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function McpTab() {
  const keys = useBizQuery('/api-keys');
  const [novo, setNovo] = useState(null);
  const [created, setCreated] = useState(null);
  const [activePlatform, setActivePlatform] = useState('claude');
  const create = useBizMutation((body) => biz('/api-keys', { method: 'POST', body }), { onSuccess: (k) => { setNovo(null); setCreated(k); } });
  const revoke = useBizMutation((id) => biz(`/api-keys/${id}`, { method: 'DELETE' }), { success: 'Chave revogada' });

  const mcpUrl = `${window.location.origin}/api/biz/mcp`;
  const openApiUrl = `${window.location.origin}/api/biz/ai/openapi.json`;
  const copy = (v) => { navigator.clipboard.writeText(v); toast.success('Copiado para a área de transferência'); };

  const claudeSnippet = `{
  "mcpServers": {
    "freedom-empresas": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "${mcpUrl}",
        "--header",
        "Authorization: Bearer SUA_CHAVE_AQUI"
      ]
    }
  }
}`;

  return (
    <div className="space-y-6">
      {/* Banner de Destaque e Monetização do Módulo de IA */}
      <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-gradient-to-r from-indigo-950 via-slate-900 to-indigo-950 text-white p-6 shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> Módulo Enterprise de IA & MCP
            </div>
            <h2 className="text-xl font-extrabold tracking-tight">
              Controle Operacional por Inteligência Artificial (Claude & ChatGPT)
            </h2>
            <p className="text-sm text-indigo-200/90 leading-relaxed">
              Opere sua empresa inteira por linguagem natural: crie cobranças, assinaturas no Asaas, dê baixas em contas, consulte margens, DRE e fluxo de caixa direto do Claude ou de um Custom GPT no ChatGPT.
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="text-xs font-semibold px-3 py-1 rounded-lg bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Token Corporativo Isolado
            </span>
            <span className="text-[11px] text-indigo-300/80">
              Cada empresa possui chaves únicas com permissão e auditoria completa.
            </span>
          </div>
        </div>
      </div>

      <div className="grid xl:grid-cols-[1fr_480px] gap-6 items-start">
        {/* Painel de Tokens da Empresa */}
        <Panel
          title="Tokens de Acesso da Empresa"
          action={
            <Button size="sm" icon={Plus} onClick={() => setNovo({ nome: '', escopo: 'ESCRITA' })}>
              Gerar Novo Token IA
            </Button>
          }
          pad={false}
        >
          {keys.isLoading ? (
            <Loading />
          ) : !(keys.data || []).length ? (
            <Empty
              icon={KeyRound}
              title="Nenhum token corporativo gerado"
              text="Gere uma chave de acesso para conectar o Claude Desktop, Claude Web ou o ChatGPT à sua empresa."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Nome / Destino</th>
                    <th>Escopo</th>
                    <th>Prefixo do Token</th>
                    <th>Último uso</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {keys.data.map((k) => (
                    <tr key={k.id}>
                      <td className="font-semibold text-sm flex items-center gap-2">
                        <Bot className="w-4 h-4 text-indigo-600" />
                        {k.nome}
                      </td>
                      <td>
                        <span className={cx(
                          'text-xs px-2 py-0.5 rounded font-semibold',
                          k.escopo === 'LEITURA' ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200' : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200'
                        )}>
                          {k.escopo === 'LEITURA' ? 'Somente Leitura' : 'Leitura & Escrita'}
                        </span>
                      </td>
                      <td className="num text-xs font-mono">{k.prefixo}…</td>
                      <td className="num text-xs">{k.ultimo_uso ? date(k.ultimo_uso) : 'Nunca utilizado'}</td>
                      <td className="r">
                        {k.revogada ? (
                          <StatusPill status="CANCELADO" label="Revogada" />
                        ) : (
                          <Button
                            size="sm"
                            variant="danger"
                            icon={Trash2}
                            onClick={() => window.confirm('Revogar esta chave de IA? Assistentes conectados a ela perderão o acesso imediatamente.') && revoke.mutate(k.id)}
                          >
                            Revogar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {/* Guias de Conexão: Claude e ChatGPT */}
        <div className="space-y-4">
          <div className="flex rounded-xl border border-[var(--line)] bg-[var(--surface)] p-1">
            <button
              type="button"
              onClick={() => setActivePlatform('claude')}
              className={cx(
                'flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2',
                activePlatform === 'claude' ? 'bg-indigo-600 text-white shadow-sm' : 'text-[var(--ink-2)] hover:bg-[var(--line-2)]'
              )}
            >
              <Cpu className="w-4 h-4" /> Anthropic Claude (MCP)
            </button>
            <button
              type="button"
              onClick={() => setActivePlatform('chatgpt')}
              className={cx(
                'flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2',
                activePlatform === 'chatgpt' ? 'bg-emerald-600 text-white shadow-sm' : 'text-[var(--ink-2)] hover:bg-[var(--line-2)]'
              )}
            >
              <Bot className="w-4 h-4" /> OpenAI ChatGPT (Custom GPT)
            </button>
          </div>

          {activePlatform === 'claude' ? (
            <Panel title="Como conectar no Claude">
              <div className="text-xs text-[var(--ink-2)] space-y-3.5">
                <p>
                  O Claude pode operar via <b>Claude Desktop</b> (no seu computador) ou <b>Claude Web Connectors</b> (versões corporativas/Team).
                </p>

                <div className="space-y-1">
                  <label className="font-bold text-[var(--ink)] block">1. URL do Servidor MCP Remoto:</label>
                  <div className="flex gap-2">
                    <Input readOnly value={mcpUrl} className="text-xs font-mono" />
                    <Button variant="secondary" icon={Copy} onClick={() => copy(mcpUrl)}>Copiar</Button>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-bold text-[var(--ink)]">2. Configuração do Claude Desktop (`claude_desktop_config.json`):</label>
                    <button
                      type="button"
                      onClick={() => copy(claudeSnippet)}
                      className="text-indigo-600 hover:underline font-semibold flex items-center gap-1"
                    >
                      <Copy className="w-3 h-3" /> Copiar JSON
                    </button>
                  </div>
                  <pre className="text-[11px] bg-[var(--paper)] border border-[var(--line)] rounded-lg p-2.5 overflow-x-auto font-mono">
                    {claudeSnippet}
                  </pre>
                  <span className="text-[10px] text-[var(--muted)] block">
                    Substitua <code>SUA_CHAVE_AQUI</code> pelo token gerado ao lado (prefixo <code>fbk_...</code>).
                  </span>
                </div>

                <div className="pt-2 border-t border-[var(--line)] space-y-1">
                  <span className="font-bold text-[var(--ink)] block">Exemplos de prompts no Claude:</span>
                  <ul className="list-disc pl-4 space-y-1 text-[var(--muted)]">
                    <li>"Qual a receita, despesas e inadimplência da empresa este mês?"</li>
                    <li>"Cria uma assinatura no Asaas de R$ 250/mês para o cliente Alfa."</li>
                    <li>"Lança R$ 850 de freelancer no contrato da Locadora Beta."</li>
                  </ul>
                </div>
              </div>
            </Panel>
          ) : (
            <Panel title="Como conectar no ChatGPT (Custom GPT / Actions)">
              <div className="text-xs text-[var(--ink-2)] space-y-3.5">
                <p>
                  Você pode criar um assistente personalizado no <b>ChatGPT Plus / Team / Enterprise</b> com todas as ferramentas financeiras da sua empresa.
                </p>

                <div className="space-y-1">
                  <label className="font-bold text-[var(--ink)] block">1. URL do Schema OpenAPI 3.0:</label>
                  <div className="flex gap-2">
                    <Input readOnly value={openApiUrl} className="text-xs font-mono" />
                    <Button variant="secondary" icon={Copy} onClick={() => copy(openApiUrl)}>Copiar URL</Button>
                  </div>
                </div>

                <div className="space-y-1.5 p-3 rounded-lg border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20">
                  <span className="font-bold text-emerald-900 dark:text-emerald-300 block">
                    2. Passo a passo no ChatGPT:
                  </span>
                  <ol className="list-decimal pl-4 space-y-1 text-[var(--ink-2)] text-[11px]">
                    <li>No ChatGPT, acesse <b>Explore GPTs</b> › <b>Create</b>.</li>
                    <li>Na aba <b>Configure</b>, desça até <b>Actions</b> e clique em <b>Create new action</b>.</li>
                    <li>Clique em <b>Import from URL</b> e cole a URL do schema acima.</li>
                    <li>Em <b>Authentication</b>, selecione <b>Bearer</b> e cole seu token gerado ao lado (<code>fbk_...</code>).</li>
                    <li>Pronto! O ChatGPT agora controla o seu financeiro.</li>
                  </ol>
                </div>

                <div className="pt-2 border-t border-[var(--line)] space-y-1">
                  <span className="font-bold text-[var(--ink)] block">Exemplos de comandos no ChatGPT:</span>
                  <ul className="list-disc pl-4 space-y-1 text-[var(--muted)]">
                    <li>"Gera o link de pagamento Asaas com PIX para a fatura pendente do cliente X."</li>
                    <li>"Me dê um resumo do fluxo de caixa e o DRE dos últimos 30 dias."</li>
                    <li>"Registra o recebimento de R$ 1.500 da fatura #123."</li>
                  </ul>
                </div>
              </div>
            </Panel>
          )}

          <p className="text-xs text-[var(--muted)] flex items-center gap-1.5 px-1">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            Todas as operações feitas pela IA ficam registradas na aba <b>Auditoria</b> com identificação de usuário e parâmetros.
          </p>
        </div>
      </div>

      {novo && (
        <Modal
          open
          onClose={() => setNovo(null)}
          title="Gerar Novo Token Corporativo de IA"
          description="Este token autoriza o Claude ou ChatGPT a operar as finanças da sua empresa."
          footer={
            <>
              <Button variant="secondary" onClick={() => setNovo(null)}>Cancelar</Button>
              <Button loading={create.isPending} onClick={() => create.mutate(novo)}>Gerar Token</Button>
            </>
          }
        >
          <div className="space-y-4">
            <Field label="Nome da Aplicação / Usuário">
              <Input
                value={novo.nome}
                onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
                placeholder="Ex.: Claude Desktop - Matheus ou ChatGPT Finanças"
              />
            </Field>
            <Field label="Nível de Permissão">
              <Select value={novo.escopo} onChange={(e) => setNovo({ ...novo, escopo: e.target.value })}>
                <option value="ESCRITA">Leitura e Escrita (pode consultar relatórios, criar contas, assinaturas e cobranças)</option>
                <option value="LEITURA">Somente Leitura (apenas consulta faturamento, relatórios e DRE)</option>
              </Select>
            </Field>
          </div>
        </Modal>
      )}

      {created && (
        <Modal
          open
          onClose={() => setCreated(null)}
          title="Token Corporativo Gerado com Sucesso"
          description="Copie a chave agora. Por motivos de segurança, ela não será exibida novamente após fechar esta janela."
          footer={<Button onClick={() => setCreated(null)}>Entendido e Copiado</Button>}
        >
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input readOnly value={created.chave} className="num text-xs font-mono font-bold" />
              <Button variant="secondary" icon={Copy} onClick={() => copy(created.chave)}>Copiar Token</Button>
            </div>
            <p className="text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/60 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              Guarde este token em local seguro. Utilize-o nas configurações do Claude ou nas Actions do ChatGPT com o cabeçalho Authorization: Bearer {created.chave}.
            </p>
          </div>
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
