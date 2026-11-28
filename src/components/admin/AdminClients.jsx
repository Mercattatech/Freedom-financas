import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, X, Check, Search, Users, Building2, Phone, Trash2, KeyRound, Lock, Unlock, Copy, ShieldCheck, UserCog, Bot } from 'lucide-react';
import { toast } from 'sonner';

async function api(path, opts = {}) {
  const token = (localStorage.getItem('freedom_access_token') || localStorage.getItem('access_token'));
  const res = await fetch(`/api/admin/clientes${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Erro ${res.status}`);
  return data;
}

const fmtPhone = (p) => {
  const d = String(p || '').replace(/^55/, '');
  return d.length === 11 ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}` : d.length === 10 ? `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}` : p;
};
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—');

const inputCls = 'bg-slate-800 border-slate-700 text-white placeholder:text-slate-500';
const Label = ({ children }) => <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">{children}</label>;
const Card = ({ className = '', children }) => <div className={`bg-slate-900 border border-slate-800 rounded-2xl ${className}`}>{children}</div>;

const PAPEL = {
  OWNER: { label: 'Proprietário (total + MCP)', cls: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
  ADMIN: { label: 'Administrador (total + MCP)', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  COLABORADOR: { label: 'Colaborador (contas a pagar/receber)', cls: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
};
const papelInfo = (p) => PAPEL[p] || { label: p, cls: 'bg-slate-700 text-slate-300 border-slate-600' };

// Mostra a senha provisória gerada para o admin repassar ao cliente
function showCredentials(email, senha) {
  if (!senha) { toast.success(`Acesso liberado para ${email} (usuário já existia, senha mantida).`); return; }
  const txt = `Acesso Mercatta Freedom\nLogin: ${email}\nSenha provisória: ${senha}\n(será pedida a troca no 1º acesso)\n${window.location.origin}`;
  navigator.clipboard?.writeText(txt).catch(() => {});
  toast.success(`Criado! Login: ${email} • Senha provisória: ${senha} (copiado para a área de transferência)`, { duration: 15000 });
}

// ───────────────────────── PESSOAL ─────────────────────────
function PersonalForm({ onClose }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ full_name: '', email: '', password: '', qtd_pessoas_familia: 2, nome_familia: '', observacoes: '' });
  const [phones, setPhones] = useState([{ phone: '', name: '' }]);
  const save = useMutation({
    mutationFn: () => api('/pessoal', { method: 'POST', body: { ...f, whatsapps: phones.filter((p) => p.phone.trim()) } }),
    onSuccess: (r) => { showCredentials(r.email, r.senha_provisoria); qc.invalidateQueries({ queryKey: ['adm-pessoal'] }); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Card className="p-6 border-emerald-500/40">
      <h3 className="text-lg font-bold text-white mb-5">✨ Novo cliente — Finanças pessoais</h3>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid md:grid-cols-2 gap-4">
        <div><Label>Nome completo *</Label><Input required value={f.full_name} onChange={set('full_name')} className={inputCls} /></div>
        <div><Label>E-mail (login) *</Label><Input required type="email" value={f.email} onChange={set('email')} className={inputCls} /></div>
        <div><Label>Senha provisória</Label><Input value={f.password} onChange={set('password')} placeholder="Vazio = gerar automaticamente" className={inputCls} /></div>
        <div><Label>Pessoas na família</Label><Input type="number" min="1" max="20" value={f.qtd_pessoas_familia} onChange={set('qtd_pessoas_familia')} className={inputCls} /></div>
        <div className="md:col-span-2"><Label>Nome da família</Label><Input value={f.nome_familia} onChange={set('nome_familia')} placeholder={`Família ${f.full_name.split(' ').slice(-1)[0] || 'Silva'}`} className={inputCls} /></div>
        <div className="md:col-span-2 space-y-2">
          <Label>WhatsApps liberados para lançar pelo WhatsApp</Label>
          {phones.map((p, i) => (
            <div key={i} className="flex gap-2">
              <Input value={p.phone} onChange={(e) => setPhones(phones.map((x, j) => (j === i ? { ...x, phone: e.target.value } : x)))} placeholder="(11) 99999-9999" className={`${inputCls} flex-1`} />
              <Input value={p.name} onChange={(e) => setPhones(phones.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="De quem? (ex.: Esposa)" className={`${inputCls} flex-1`} />
              {phones.length > 1 && <Button type="button" variant="ghost" onClick={() => setPhones(phones.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-400"><X className="w-4 h-4" /></Button>}
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => setPhones([...phones, { phone: '', name: '' }])} className="border-slate-700 text-slate-300 hover:bg-slate-800"><Plus className="w-4 h-4 mr-1" /> Adicionar número</Button>
          <p className="text-xs text-slate-500">O primeiro número vira o principal. Só números cadastrados aqui conseguem lançar pelo WhatsApp.</p>
        </div>
        <div className="md:col-span-2"><Label>Observações internas</Label><Input value={f.observacoes} onChange={set('observacoes')} className={inputCls} /></div>
        <div className="md:col-span-2 flex gap-3">
          <Button type="submit" disabled={save.isPending} className="bg-emerald-600 hover:bg-emerald-500 flex-1">{save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}Cadastrar cliente</Button>
          <Button type="button" variant="outline" onClick={onClose} className="border-slate-700 text-slate-300 hover:bg-slate-800"><X className="w-4 h-4 mr-2" />Cancelar</Button>
        </div>
      </form>
    </Card>
  );
}

function PersonalRow({ u }) {
  const qc = useQueryClient();
  const [phone, setPhone] = useState({ phone: '', name: '' });
  const [open, setOpen] = useState(false);
  const [createdMcp, setCreatedMcp] = useState(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ['adm-pessoal'] });
  const upd = useMutation({ mutationFn: (body) => api(`/pessoal/${u.id}`, { method: 'PUT', body }), onSuccess: () => { toast.success('Atualizado'); refresh(); }, onError: (e) => toast.error(e.message) });
  const addPhone = useMutation({ mutationFn: () => api(`/pessoal/${u.id}/whatsapps`, { method: 'POST', body: phone }), onSuccess: () => { toast.success('Número liberado'); setPhone({ phone: '', name: '' }); refresh(); }, onError: (e) => toast.error(e.message) });
  const delPhone = useMutation({ mutationFn: (pid) => api(`/pessoal/${u.id}/whatsapps/${pid}`, { method: 'DELETE' }), onSuccess: () => { toast.success('Número removido'); refresh(); }, onError: (e) => toast.error(e.message) });
  const mcpQ = useQuery({ queryKey: ['adm-pessoal-mcp', u.id], queryFn: () => api(`/pessoal/${u.id}/mcp-keys`), enabled: open });
  const createMcp = useMutation({
    mutationFn: (body = {}) => api(`/pessoal/${u.id}/mcp-keys`, { method: 'POST', body: { nome: 'ChatGPT Pessoal', escopo: 'COMPLETO', ...body } }),
    onSuccess: (r) => {
      setCreatedMcp(r);
      navigator.clipboard?.writeText(r.mcp_url_com_token).catch(() => {});
      toast.success(`Link MCP criado e copiado para ${u.email}!`, { duration: 10000 });
      qc.invalidateQueries({ queryKey: ['adm-pessoal-mcp', u.id] });
    },
    onError: (e) => toast.error(e.message),
  });
  const revokeMcp = useMutation({
    mutationFn: (keyId) => api(`/pessoal/${u.id}/mcp-keys/${keyId}`, { method: 'DELETE' }),
    onSuccess: () => { toast.success('Chave MCP revogada'); qc.invalidateQueries({ queryKey: ['adm-pessoal-mcp', u.id] }); },
    onError: (e) => toast.error(e.message),
  });
  const phones = [...(u.whatsapp_phone ? [{ id: 'principal', phone: u.whatsapp_phone, name: 'Principal' }] : []), ...u.whatsappAllowedPhones];
  return (
    <Card className={`p-5 ${u.disabled ? 'opacity-60' : ''}`}>
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center font-bold text-white shrink-0">{(u.full_name || u.email)[0].toUpperCase()}</div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2"><span className="font-bold text-white">{u.full_name || u.email}</span>{u.disabled && <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-300">Bloqueado</span>}{u.must_change_password && <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">Aguardando 1º acesso</span>}</div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-400 mt-1">
            <span>{u.email}</span>
            <span>👨‍👩‍👧 {u.qtd_pessoas_familia} pessoa{u.qtd_pessoas_familia > 1 ? 's' : ''}</span>
            <span>📱 {phones.length}/{u.limite_numeros_whatsapp} WhatsApp</span>
            {u.families?.[0] && <span>🏠 {u.families.map((x) => x.nome_familia).join(', ')}</span>}
            <span>Desde {fmtDate(u.created_date)}</span>
            <span>Último acesso {fmtDate(u.last_login)}</span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => setOpen(!open)} className="border-slate-700 text-slate-300 hover:bg-slate-800"><UserCog className="w-4 h-4 mr-1" />{open ? 'Fechar' : 'Gerenciar'}</Button>
          <Button size="sm" variant="ghost" title={u.disabled ? 'Desbloquear' : 'Bloquear'} onClick={() => upd.mutate({ disabled: !u.disabled })} className={u.disabled ? 'text-emerald-400' : 'text-slate-400 hover:text-red-400'}>{u.disabled ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}</Button>
        </div>
      </div>
      {open && (
        <div className="mt-4 pt-4 border-t border-slate-800 grid md:grid-cols-2 gap-5">
          <div className="space-y-3">
            <p className="text-sm font-bold text-slate-200 flex items-center gap-2"><Phone className="w-4 h-4 text-emerald-400" />WhatsApps liberados</p>
            {phones.length === 0 && <p className="text-xs text-slate-500">Nenhum número liberado.</p>}
            {phones.map((p) => (
              <div key={p.id} className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2 text-sm">
                <span className="text-white">{fmtPhone(p.phone)} <span className="text-slate-400 text-xs">{p.name ? `· ${p.name}` : ''}</span></span>
                <button onClick={() => confirm(`Remover ${fmtPhone(p.phone)}?`) && delPhone.mutate(p.id)} className="text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <form onSubmit={(e) => { e.preventDefault(); addPhone.mutate(); }} className="flex gap-2">
              <Input required value={phone.phone} onChange={(e) => setPhone({ ...phone, phone: e.target.value })} placeholder="(11) 99999-9999" className={inputCls} />
              <Input value={phone.name} onChange={(e) => setPhone({ ...phone, name: e.target.value })} placeholder="De quem?" className={inputCls} />
              <Button type="submit" disabled={addPhone.isPending} className="bg-emerald-600 hover:bg-emerald-500"><Plus className="w-4 h-4" /></Button>
            </form>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-bold text-slate-200 flex items-center gap-2"><Users className="w-4 h-4 text-emerald-400" />Família e limites</p>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Pessoas na família</Label><Input type="number" min="1" defaultValue={u.qtd_pessoas_familia} onBlur={(e) => Number(e.target.value) !== u.qtd_pessoas_familia && upd.mutate({ qtd_pessoas_familia: Number(e.target.value) })} className={inputCls} /></div>
              <div><Label>Limite de WhatsApps</Label><Input type="number" min="1" defaultValue={u.limite_numeros_whatsapp} onBlur={(e) => Number(e.target.value) !== u.limite_numeros_whatsapp && upd.mutate({ limite_numeros_whatsapp: Number(e.target.value) })} className={inputCls} /></div>
            </div>
            <Button size="sm" variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => { const s = prompt('Nova senha provisória (mín. 6 caracteres):'); if (s && s.length >= 6) upd.mutate({ password: s }, { onSuccess: () => showCredentials(u.email, s) }); }}><KeyRound className="w-4 h-4 mr-1" />Redefinir senha</Button>
          </div>
          <div className="md:col-span-2 pt-4 border-t border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-bold text-slate-200 flex items-center gap-2"><Bot className="w-4 h-4 text-indigo-400" />MCP Pessoal (ChatGPT / Claude)</p>
              <Button type="button" size="sm" disabled={createMcp.isPending} onClick={() => createMcp.mutate({})} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                {createMcp.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}Gerar link MCP
              </Button>
            </div>
            {createdMcp && (
              <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-300">Link MCP gerado (copie agora):</span>
                  <button type="button" onClick={() => setCreatedMcp(null)} className="text-slate-400 hover:text-white"><X className="w-3.5 h-3.5" /></button>
                </div>
                <div className="flex gap-2">
                  <Input readOnly value={createdMcp.mcp_url_com_token} className={`${inputCls} font-mono text-xs h-8`} />
                  <Button type="button" size="sm" className="bg-emerald-600 hover:bg-emerald-500 h-8" onClick={() => { navigator.clipboard?.writeText(createdMcp.mcp_url_com_token); toast.success('Link copiado!'); }}><Copy className="w-3.5 h-3.5 mr-1" />Copiar</Button>
                </div>
                <p className="text-slate-400">Token isolado: <code className="text-slate-200 font-mono">{createdMcp.chave}</code></p>
              </div>
            )}
            {mcpQ.isLoading ? (
              <p className="text-xs text-slate-500">Carregando tokens MCP…</p>
            ) : !(mcpQ.data?.items?.length) ? (
              <p className="text-xs text-slate-500">Nenhum token MCP pessoal criado para este cliente.</p>
            ) : (
              <div className="space-y-2">
                {mcpQ.data.items.map((k) => (
                  <div key={k.id} className={`flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-2 text-xs ${k.revogada ? 'opacity-50' : ''}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-white font-semibold">{k.nome}</span>
                      <code className="text-slate-400 font-mono">{k.prefixo}…</code>
                      <span className={`px-1.5 py-0.5 rounded ${k.revogada ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>{k.revogada ? 'Revogada' : 'Ativa'}</span>
                      {k.family_nome && <span className="text-indigo-300">🏠 {k.family_nome}</span>}
                    </div>
                    {!k.revogada && (
                      <button type="button" onClick={() => confirm('Revogar este token MCP?') && revokeMcp.mutate(k.id)} className="text-slate-500 hover:text-red-400" title="Revogar token"><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function PersonalTab() {
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const list = useQuery({ queryKey: ['adm-pessoal', q], queryFn: () => api(`/pessoal?q=${encodeURIComponent(q)}`) });
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome, e-mail ou WhatsApp…" className="pl-10 bg-slate-900 border-slate-800 text-white placeholder:text-slate-500" /></div>
        <Button onClick={() => setCreating(true)} className="bg-emerald-600 hover:bg-emerald-500"><Plus className="w-4 h-4 mr-2" />Novo cliente pessoal</Button>
      </div>
      {creating && <PersonalForm onClose={() => setCreating(false)} />}
      {list.isLoading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
        : list.error ? <p className="text-red-400">{list.error.message}</p>
          : !list.data?.length ? <Card className="p-10 text-center text-slate-500">Nenhum cliente encontrado.</Card>
            : <div className="space-y-3">{list.data.map((u) => <PersonalRow key={u.id} u={u} />)}</div>}
    </div>
  );
}

// ───────────────────────── EMPRESARIAL ─────────────────────────
function CompanyForm({ onClose }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ razao_social: '', nome_fantasia: '', cnpj: '', telefone: '', plano: 'PRO', admin: { full_name: '', email: '', password: '' } });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const setA = (k) => (e) => setF({ ...f, admin: { ...f.admin, [k]: e.target.value } });
  const save = useMutation({
    mutationFn: () => api('/empresas', { method: 'POST', body: f }),
    onSuccess: (r) => { showCredentials(r.admin.email, r.admin.senha_provisoria); qc.invalidateQueries({ queryKey: ['adm-empresas'] }); onClose(); },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Card className="p-6 border-emerald-500/40">
      <h3 className="text-lg font-bold text-white mb-5">🏢 Nova empresa — Freedom Empresas</h3>
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="grid md:grid-cols-2 gap-4">
        <div><Label>Razão social *</Label><Input required value={f.razao_social} onChange={set('razao_social')} className={inputCls} /></div>
        <div><Label>Nome fantasia</Label><Input value={f.nome_fantasia} onChange={set('nome_fantasia')} className={inputCls} /></div>
        <div><Label>CNPJ</Label><Input value={f.cnpj} onChange={set('cnpj')} className={inputCls} /></div>
        <div><Label>Plano</Label>
          <select value={f.plano} onChange={set('plano')} className="w-full h-10 rounded-md px-3 bg-slate-800 border border-slate-700 text-white text-sm">
            {['TRIAL', 'ESSENCIAL', 'PRO', 'ENTERPRISE'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <p className="md:col-span-2 text-sm font-bold text-slate-200 pt-2 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-400" />Administrador principal (acesso total + MCP)</p>
        <div><Label>Nome *</Label><Input required value={f.admin.full_name} onChange={setA('full_name')} className={inputCls} /></div>
        <div><Label>E-mail (login) *</Label><Input required type="email" value={f.admin.email} onChange={setA('email')} className={inputCls} /></div>
        <div><Label>Senha provisória</Label><Input value={f.admin.password} onChange={setA('password')} placeholder="Vazio = gerar automaticamente" className={inputCls} /></div>
        <div className="md:col-span-2 flex gap-3">
          <Button type="submit" disabled={save.isPending} className="bg-emerald-600 hover:bg-emerald-500 flex-1">{save.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}Cadastrar empresa</Button>
          <Button type="button" variant="outline" onClick={onClose} className="border-slate-700 text-slate-300 hover:bg-slate-800"><X className="w-4 h-4 mr-2" />Cancelar</Button>
        </div>
      </form>
    </Card>
  );
}

function CompanyRow({ c }) {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: ['adm-empresas'] });
  const [open, setOpen] = useState(false);
  const [nu, setNu] = useState({ full_name: '', email: '', password: '', papel: 'COLABORADOR' });
  const addUser = useMutation({
    mutationFn: () => api(`/empresas/${c.id}/usuarios`, { method: 'POST', body: nu }),
    onSuccess: (r) => { showCredentials(r.member.email, r.senha_provisoria); setNu({ full_name: '', email: '', password: '', papel: 'COLABORADOR' }); refresh(); },
    onError: (e) => toast.error(e.message),
  });
  const updMember = useMutation({ mutationFn: ({ id, ...body }) => api(`/empresas/${c.id}/usuarios/${id}`, { method: 'PUT', body }), onSuccess: () => { toast.success('Acesso atualizado'); refresh(); }, onError: (e) => toast.error(e.message) });
  const updCompany = useMutation({ mutationFn: (body) => api(`/empresas/${c.id}`, { method: 'PUT', body }), onSuccess: () => { toast.success('Empresa atualizada'); refresh(); }, onError: (e) => toast.error(e.message) });
  const ativos = c.members.filter((m) => m.ativo);
  return (
    <Card className={`p-5 ${!c.ativo ? 'opacity-60' : ''}`}>
      <div className="flex flex-col md:flex-row md:items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 flex items-center justify-center text-white shrink-0"><Building2 className="w-5 h-5" /></div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2"><span className="font-bold text-white">{c.nome_fantasia || c.razao_social}</span><span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">{c.plano}</span>{!c.ativo && <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-300">Desativada</span>}</div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-400 mt-1">
            <span>{c.razao_social}</span>{c.cnpj && <span>CNPJ {c.cnpj}</span>}
            <span>👤 {ativos.filter((m) => m.papel !== 'COLABORADOR').length} admin · {ativos.filter((m) => m.papel === 'COLABORADOR').length} colaborador(es)</span>
            <span>Desde {fmtDate(c.created_date)}</span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={() => setOpen(!open)} className="border-slate-700 text-slate-300 hover:bg-slate-800"><Users className="w-4 h-4 mr-1" />{open ? 'Fechar' : 'Usuários'}</Button>
          <Button size="sm" variant="ghost" title={c.ativo ? 'Desativar empresa' : 'Reativar empresa'} onClick={() => confirm(c.ativo ? 'Desativar esta empresa? Ninguém conseguirá acessar.' : 'Reativar esta empresa?') && updCompany.mutate({ ativo: !c.ativo })} className={c.ativo ? 'text-slate-400 hover:text-red-400' : 'text-emerald-400'}>{c.ativo ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}</Button>
        </div>
      </div>
      {open && (
        <div className="mt-4 pt-4 border-t border-slate-800 space-y-4">
          <div className="space-y-2">
            {c.members.map((m) => (
              <div key={m.id} className={`flex flex-col md:flex-row md:items-center gap-3 bg-slate-800/60 rounded-lg px-3 py-2 ${!m.ativo ? 'opacity-50' : ''}`}>
                <div className="flex-1 min-w-0 text-sm">
                  <span className="text-white font-medium">{m.full_name || m.email}</span> <span className="text-slate-400 text-xs">{m.email}</span>
                  {m.pendente_troca_senha && <span className="ml-2 text-[11px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">aguardando 1º acesso</span>}
                </div>
                <select value={m.papel} disabled={!m.ativo} onChange={(e) => updMember.mutate({ id: m.id, papel: e.target.value })} className={`h-8 rounded-md px-2 text-xs border ${papelInfo(m.papel).cls} bg-slate-900`}>
                  {['OWNER', 'ADMIN', 'COLABORADOR'].map((p) => <option key={p} value={p}>{PAPEL[p].label}</option>)}
                  {!PAPEL[m.papel] && <option value={m.papel}>{m.papel}</option>}
                </select>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" title="Redefinir senha" className="text-slate-400 hover:text-white" onClick={() => { const s = prompt(`Nova senha provisória para ${m.email}:`); if (s && s.length >= 6) updMember.mutate({ id: m.id, password: s }, { onSuccess: () => showCredentials(m.email, s) }); }}><KeyRound className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" title={m.ativo ? 'Remover acesso' : 'Reativar acesso'} className={m.ativo ? 'text-slate-400 hover:text-red-400' : 'text-emerald-400'} onClick={() => updMember.mutate({ id: m.id, ativo: !m.ativo })}>{m.ativo ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}</Button>
                </div>
              </div>
            ))}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); addUser.mutate(); }} className="grid md:grid-cols-5 gap-2 items-end">
            <div><Label>Nome</Label><Input value={nu.full_name} onChange={(e) => setNu({ ...nu, full_name: e.target.value })} className={inputCls} /></div>
            <div><Label>E-mail *</Label><Input required type="email" value={nu.email} onChange={(e) => setNu({ ...nu, email: e.target.value })} className={inputCls} /></div>
            <div><Label>Senha provisória</Label><Input value={nu.password} onChange={(e) => setNu({ ...nu, password: e.target.value })} placeholder="Automática" className={inputCls} /></div>
            <div><Label>Acesso</Label>
              <select value={nu.papel} onChange={(e) => setNu({ ...nu, papel: e.target.value })} className="w-full h-10 rounded-md px-2 bg-slate-800 border border-slate-700 text-white text-sm">
                <option value="ADMIN">Administrador (total + MCP)</option>
                <option value="COLABORADOR">Colaborador (só contas a pagar/receber)</option>
              </select>
            </div>
            <Button type="submit" disabled={addUser.isPending} className="bg-emerald-600 hover:bg-emerald-500">{addUser.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4 mr-1" />Adicionar</>}</Button>
          </form>
        </div>
      )}
    </Card>
  );
}

function BusinessTab() {
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const list = useQuery({ queryKey: ['adm-empresas'], queryFn: () => api('/empresas') });
  const items = (list.data || []).filter((c) => !q || `${c.razao_social} ${c.nome_fantasia || ''} ${c.cnpj || ''} ${c.members.map((m) => m.email).join(' ')}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar empresa, CNPJ ou e-mail de usuário…" className="pl-10 bg-slate-900 border-slate-800 text-white placeholder:text-slate-500" /></div>
        <Button onClick={() => setCreating(true)} className="bg-emerald-600 hover:bg-emerald-500"><Plus className="w-4 h-4 mr-2" />Nova empresa</Button>
      </div>
      {creating && <CompanyForm onClose={() => setCreating(false)} />}
      {list.isLoading ? <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
        : list.error ? <p className="text-red-400">{list.error.message}</p>
          : !items.length ? <Card className="p-10 text-center text-slate-500">Nenhuma empresa encontrada.</Card>
            : <div className="space-y-3">{items.map((c) => <CompanyRow key={c.id} c={c} />)}</div>}
      <Card className="p-5 text-xs text-slate-400 space-y-1">
        <p className="font-bold text-slate-300 text-sm mb-1">Níveis de acesso na empresa</p>
        <p><b className="text-emerald-300">Administrador</b>: acesso total — dashboard, DRE, contratos, configurações, Asaas e criação de chaves do MCP (ChatGPT/Claude).</p>
        <p><b className="text-sky-300">Colaborador</b>: vê e lança apenas contas a pagar e contas a receber. Sem relatórios, configurações ou MCP.</p>
      </Card>
    </div>
  );
}

export default function AdminClients() {
  const [tab, setTab] = useState('pessoal');
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-white">Cadastro de clientes</h2>
        <p className="text-slate-400 text-sm mt-1">Crie acessos para clientes do Freedom pessoal e do Freedom Empresas</p>
      </div>
      <div className="inline-flex rounded-xl bg-slate-900 border border-slate-800 p-1">
        {[['pessoal', '👨‍👩‍👧 Pessoal'], ['empresa', '🏢 Empresarial']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`px-5 py-2 rounded-lg text-sm font-semibold transition ${tab === k ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>{l}</button>
        ))}
      </div>
      {tab === 'pessoal' ? <PersonalTab /> : <BusinessTab />}
    </div>
  );
}
