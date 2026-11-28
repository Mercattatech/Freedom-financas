import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { MessageCircle, Phone, User, CheckCircle2, Loader2, Info, Mic, Type, Plus, Bot, KeyRound, Copy, Trash2 } from 'lucide-react';

const isLocalHost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_BASE = import.meta.env.VITE_API_URL || (isLocalHost ? `http://${window.location.hostname}:3000/api` : '/api');

async function personalFetch(path, opts = {}) {
  const token = localStorage.getItem('freedom_access_token');
  const res = await fetch(`${API_BASE}${path}`, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }), ...opts.headers },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Erro ${res.status}`);
  return data;
}

export default function Profile() {
  const { user, checkAppState } = useAuth();
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [waNumber, setWaNumber] = useState('');
  
  // Extra WhatsApp Numbers state
  const [numbersData, setNumbersData] = useState(null);
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  const [newNumber, setNewNumber] = useState('');
  const [newName, setNewName] = useState('');

  const fetchNumbers = async () => {
    setLoadingNumbers(true);
    try {
      const data = await apiClient.auth.getWhatsappNumbers();
      setNumbersData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingNumbers(false);
    }
  };

  useEffect(() => {
    if (user) {
      setWhatsappPhone(user.whatsapp_phone || '');
      setFullName(user.full_name || user.name || '');
      fetchNumbers();
    }
    // Busca o número de WhatsApp do sistema
    apiClient.auth.getSystemWhatsapp().then(d => setWaNumber(d?.number || '')).catch(() => {});
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.auth.updateProfile({ full_name: fullName, whatsapp_phone: whatsappPhone });
      await checkAppState();
      toast.success('Perfil atualizado com sucesso!');
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar perfil.');
    } finally {
      setSaving(false);
    }
  };

  const waLink = waNumber
    ? `https://wa.me/${waNumber.replace(/\D/g, '')}?text=Ol%C3%A1%2C+Freedom!`
    : null;

  const handleAddNumber = async () => {
    if (!newNumber) {
      toast.error('O número não pode ficar vazio.');
      return;
    }
    setSaving(true);
    try {
      if (!numbersData?.mainNumber && numbersData?.extraNumbers.length === 0) {
         // Se não tem número principal, salva primeiro como principal por retrocompatibilidade
         await apiClient.auth.updateProfile({ whatsapp_phone: newNumber });
         await checkAppState();
      } else {
         await apiClient.auth.addWhatsappNumber(newNumber, newName);
      }
      toast.success('Número vinculado com sucesso!');
      setNewNumber('');
      setNewName('');
      fetchNumbers();
    } catch (e) {
      toast.error(e.message || 'Erro ao vincular número.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveNumber = async (id) => {
    if (!confirm('Deseja realmente remover este número?')) return;
    try {
      await apiClient.auth.deleteWhatsappNumber(id);
      toast.success('Número removido com sucesso!');
      if (id === 'main') await checkAppState();
      fetchNumbers();
    } catch (e) {
      toast.error(e.message || 'Erro ao remover número.');
    }
  };

  const currentCount = (numbersData?.mainNumber ? 1 : 0) + (numbersData?.extraNumbers?.length || 0);
  const canAddMore = numbersData ? currentCount < numbersData.limit : false;
  const isLinked = currentCount > 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Meu Perfil</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Gerencie seus dados e configure o acesso por WhatsApp.</p>
      </div>

      {/* Profile card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-2xl shadow">
            {(user?.name || user?.email)?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{user?.name || user?.full_name || '—'}</p>
            <p className="text-sm text-slate-500">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">
              Nome completo
            </label>
            <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-800">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Seu nome"
                className="flex-1 bg-transparent text-sm text-slate-800 dark:text-white outline-none placeholder-slate-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar alterações'}
          </button>
        </form>
      </div>

      {/* WhatsApp section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Lançamentos por WhatsApp</h2>
            <p className="text-xs text-slate-500">Vincule seu número para lançar despesas e receitas por mensagem ou áudio.</p>
          </div>
          {isLinked && (
            <span className="ml-auto flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" /> Vinculado
            </span>
          )}
        </div>

        <div className="mt-5 space-y-4">
          
          {/* Lista de Números */}
          {numbersData && (
            <div className="space-y-2 mb-4">
              <div className="flex justify-between items-center mb-2">
                 <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Números Vinculados</p>
                 <p className="text-xs text-slate-400 font-medium">{currentCount} / {numbersData.limit} utilizados</p>
              </div>
              
              {numbersData.mainNumber && (
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-white">{numbersData.mainNumber.phone}</p>
                      <p className="text-xs text-slate-500">Principal</p>
                    </div>
                  </div>
                  <button onClick={() => handleRemoveNumber('main')} className="text-red-500 hover:text-red-600 text-xs font-medium px-2 py-1 bg-red-50 dark:bg-red-500/10 rounded-lg transition-colors">
                    Remover
                  </button>
                </div>
              )}

              {numbersData.extraNumbers.map(n => (
                <div key={n.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-white">{n.phone}</p>
                      {n.name && <p className="text-xs text-slate-500">{n.name}</p>}
                    </div>
                  </div>
                  <button onClick={() => handleRemoveNumber(n.id)} className="text-red-500 hover:text-red-600 text-xs font-medium px-2 py-1 bg-red-50 dark:bg-red-500/10 rounded-lg transition-colors">
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}

          {canAddMore ? (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block">
                Vincular novo número de WhatsApp
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-800 flex-1">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="tel"
                    value={newNumber}
                    onChange={e => setNewNumber(e.target.value)}
                    placeholder="Ex: 5511999999999"
                    className="w-full bg-transparent text-sm text-slate-800 dark:text-white outline-none placeholder-slate-400"
                  />
                </div>
                <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-800 flex-1">
                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="De quem é? (Opcional)"
                    className="w-full bg-transparent text-sm text-slate-800 dark:text-white outline-none placeholder-slate-400"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400">Digite apenas números, incluindo o 55. Exemplo: 5511987654321</p>

              <button
                onClick={handleAddNumber}
                disabled={saving || loadingNumbers}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 transition-colors"
              >
                {saving || loadingNumbers ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <><Plus className="w-4 h-4" /> Adicionar Número</>
                )}
              </button>
            </div>
          ) : (
            <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-500 text-sm font-medium p-4 rounded-xl text-center">
              Você já atingiu o limite de {numbersData?.limit} número(s) de WhatsApp para o seu plano.
            </div>
          )}
        </div>

        {/* Instrucoes */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Como usar</p>
          <div className="space-y-3">
            {[
              { icon: Type, title: 'Texto', desc: '"Gastei 80 reais no mercado no débito"' },
              { icon: Mic, title: 'Áudio', desc: 'Grave um áudio descrevendo o lançamento' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-white">{title}</p>
                  <p className="text-xs text-slate-500 italic">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500">
              A IA irá interpretar sua mensagem, pedir confirmação e lançar automaticamente na família selecionada. Funciona com texto e áudio em português.
            </p>
          </div>
        </div>

        {/* Botão iniciar conversa */}
        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-2 w-full border-2 border-green-500 text-green-600 font-semibold rounded-xl py-2.5 text-sm hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Abrir conversa com o Freedom no WhatsApp
          </a>
        )}
      </div>

      <PersonalMcpSection />
    </div>
  );
}

function PersonalMcpSection() {
  const [keys, setKeys] = useState([]);
  const [mcpUrl, setMcpUrl] = useState(`${window.location.origin}/api/personal/mcp`);
  const [families, setFamilies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ nome: 'ChatGPT Pessoal', family_id: '', escopo: 'COMPLETO' });
  const [createdKey, setCreatedKey] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [kRes, fRes] = await Promise.all([
        personalFetch('/personal/api-keys'),
        personalFetch('/families').catch(() => []),
      ]);
      setKeys(kRes.items || []);
      if (kRes.mcp_url) setMcpUrl(kRes.mcp_url);
      setFamilies(Array.isArray(fRes) ? fRes : (fRes?.data || []));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const copy = (val, label = 'Copiado!') => {
    navigator.clipboard?.writeText(val).then(() => toast.success(label)).catch(() => toast.info('Selecione e copie manualmente.'));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const res = await personalFetch('/personal/api-keys', {
        method: 'POST',
        body: {
          nome: form.nome.trim() || 'ChatGPT Pessoal',
          escopo: form.escopo,
          family_id: form.family_id || null,
        },
      });
      setCreatedKey(res);
      setForm((prev) => ({ ...prev, nome: 'ChatGPT Pessoal' }));
      toast.success('Token MCP pessoal gerado!');
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao gerar token');
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id) => {
    if (!confirm('Revogar este token? O ChatGPT/Claude conectado por ele perderá o acesso imediatamente.')) return;
    try {
      await personalFetch(`/personal/api-keys/${id}`, { method: 'DELETE' });
      toast.success('Token revogado');
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao revogar token');
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center shrink-0">
          <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div>
          <h2 className="font-semibold text-slate-900 dark:text-white">Integração com IA (MCP — ChatGPT &amp; Claude)</h2>
          <p className="text-xs text-slate-500">Conecte seu Freedom Pessoal ao ChatGPT ou Claude usando seu token exclusivo (separado do módulo empresarial).</p>
        </div>
      </div>

      {createdKey && (
        <div className="rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50/70 dark:bg-emerald-950/30 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4" /> Token gerado — copie e guarde agora (exibido uma única vez)
            </p>
            <button type="button" onClick={() => setCreatedKey(null)} className="text-xs text-slate-500 hover:text-slate-700">Fechar</button>
          </div>

          <div>
            <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 block mb-1">
              Link pronto para ChatGPT (Autenticação: Nenhuma)
            </label>
            <div className="flex gap-2">
              <input readOnly value={createdKey.mcp_url_com_token} className="flex-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200" />
              <button type="button" onClick={() => copy(createdKey.mcp_url_com_token, 'Link com token copiado!')} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1 shrink-0">
                <Copy className="w-3.5 h-3.5" /> Copiar
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              No ChatGPT → Plugins → Adicionar servidor MCP: cole o link acima, mude <b>Autenticação</b> para <b>Nenhuma</b> e use o ícone em <a href="/icon-mcp.png" target="_blank" rel="noreferrer" className="text-indigo-600 underline">/icon-mcp.png</a>.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-2 pt-1">
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 block mb-1">Token Bearer (Claude / API)</label>
              <div className="flex gap-1.5">
                <input readOnly value={createdKey.chave} className="flex-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200" />
                <button type="button" onClick={() => copy(createdKey.chave, 'Token copiado!')} className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div>
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400 block mb-1">URL limpa do servidor MCP</label>
              <div className="flex gap-1.5">
                <input readOnly value={createdKey.mcp_url || mcpUrl} className="flex-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200" />
                <button type="button" onClick={() => copy(createdKey.mcp_url || mcpUrl, 'URL copiada!')} className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleCreate} className="grid sm:grid-cols-4 gap-3 items-end pt-2 border-t border-slate-100 dark:border-slate-800">
        <div className="sm:col-span-2">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Nome do conector</label>
          <input
            type="text"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            placeholder="Ex.: ChatGPT Pessoal"
            className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-white outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Família</label>
          <select
            value={form.family_id}
            onChange={(e) => setForm({ ...form, family_id: e.target.value })}
            className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-slate-800 dark:text-white outline-none"
          >
            <option value="">Todas as famílias</option>
            {families.map((f) => <option key={f.id} value={f.id}>{f.nome_familia}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Permissão</label>
          <select
            value={form.escopo}
            onChange={(e) => setForm({ ...form, escopo: e.target.value })}
            className="w-full text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-2 text-slate-800 dark:text-white outline-none"
          >
            <option value="COMPLETO">Lançar e consultar</option>
            <option value="LEITURA">Somente consulta</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="sm:col-span-4 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Gerar novo token MCP pessoal</>}
        </button>
      </form>

      <div className="space-y-2">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tokens gerados</p>
        {loading ? (
          <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
        ) : keys.length === 0 ? (
          <p className="text-xs text-slate-500">Nenhum token gerado ainda.</p>
        ) : (
          <div className="space-y-2">
            {keys.map((k) => (
              <div key={k.id} className={`flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 ${k.revogada ? 'opacity-50' : ''}`}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800 dark:text-white">{k.nome}</span>
                    <code className="text-xs font-mono text-slate-500">{k.prefixo}…</code>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold ${k.revogada ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'}`}>
                      {k.revogada ? 'Revogada' : 'Ativa'}
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                      {k.escopo === 'LEITURA' ? 'Somente leitura' : 'Completo'}
                    </span>
                    {k.family_nome && <span className="text-[11px] text-indigo-600 dark:text-indigo-400">🏠 {k.family_nome}</span>}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {k.ultimo_uso ? `Último uso: ${new Date(k.ultimo_uso).toLocaleString('pt-BR')}` : 'Nunca usado'}
                  </p>
                </div>
                {!k.revogada && (
                  <button
                    type="button"
                    onClick={() => handleRevoke(k.id)}
                    className="text-red-500 hover:text-red-600 text-xs font-medium px-2.5 py-1 bg-red-50 dark:bg-red-500/10 rounded-lg inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Revogar
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
