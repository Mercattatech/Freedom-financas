import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Loader2, Save, MessageSquare, Brain, ShieldCheck, HelpCircle,
  AlertTriangle, ExternalLink, Plus, Trash2, TestTube2, CheckCircle2,
  XCircle, ChevronDown, ChevronUp, Power, Settings
} from 'lucide-react';
import { toast } from 'sonner';

const API_BASE = () => {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  return isLocal ? `http://${window.location.hostname}:3000/api` : '/api';
};

const authHeader = () => ({
  'Authorization': `Bearer ${localStorage.getItem('freedom_access_token')}`,
  'Content-Type': 'application/json'
});

const CONFIG_KEYS = [
  { key: 'WHATSAPP_ACCESS_TOKEN', label: 'Token de Acesso (WhatsApp)', category: 'whatsapp', placeholder: 'EAAB...', help: 'Token permanente gerado via Usuário do Sistema no Meta for Developers.' },
  { key: 'WHATSAPP_PHONE_NUMBER_ID', label: 'Phone Number ID', category: 'whatsapp', placeholder: '1234567890', help: 'ID numérico do número de telefone (não é o número em si).' },
  { key: 'WHATSAPP_VERIFY_TOKEN', label: 'Token de Verificação do Webhook', category: 'whatsapp', placeholder: 'Ex: freedom_token_2026', help: 'Token que você define aqui e configura no painel da Meta.' },
  { key: 'OPENAI_API_KEY', label: 'OpenAI API Key', category: 'ai', placeholder: 'sk-...', help: 'Chave secreta da OpenAI para processar a inteligência das mensagens.' }
];

const INTENT_OPTIONS = [
  { value: 'create_expense', label: '💸 Despesa (PIX/débito/dinheiro)' },
  { value: 'create_credit_card_expense', label: '💳 Despesa no cartão de crédito' },
  { value: 'create_income', label: '💰 Receita / Entrada' },
  { value: 'unknown', label: '❓ Não entender (unknown)' },
];

const DATA_FIELDS = {
  create_expense: ['amount', 'description', 'payment_method', 'category'],
  create_credit_card_expense: ['amount', 'description', 'credit_card', 'installments'],
  create_income: ['amount', 'description', 'category'],
  unknown: [],
};

// ─────────────────────────────────────────
// Aba: Configurações
// ─────────────────────────────────────────
function ConfigTab() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({});

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['system-config'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE()}/admin/config`, { headers: authHeader() });
      if (!res.ok) throw new Error('Erro ao carregar configurações');
      return (await res.json()).data || [];
    }
  });

  useEffect(() => {
    if (configs.length > 0) {
      const m = {};
      configs.forEach(c => m[c.key] = c.value);
      setForm(m);
    }
  }, [configs]);

  const saveMutation = useMutation({
    mutationFn: async ({ key, value }) => {
      const r = await fetch(`${API_BASE()}/admin/config`, {
        method: 'POST', headers: authHeader(), body: JSON.stringify({ key, value })
      });
      if (!r.ok) throw new Error('Erro ao salvar');
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries(['system-config'])
  });

  const handleSaveAll = async () => {
    try {
      await Promise.all(Object.entries(form).map(([key, value]) => saveMutation.mutateAsync({ key, value })));
      toast.success('Configurações salvas com sucesso!');
    } catch { toast.error('Erro ao salvar configurações.'); }
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 space-y-6">
        <Card className="bg-slate-900 border-slate-800 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-2">
            <ShieldCheck className="w-5 h-5 text-blue-400" /> WhatsApp Cloud API
          </h3>
          {CONFIG_KEYS.filter(k => k.category === 'whatsapp').map(item => (
            <div key={item.key} className="space-y-1.5">
              <Label className="text-slate-300 flex items-center justify-between">
                {item.label}
                <HelpCircle className="w-4 h-4 text-slate-500 cursor-help" title={item.help} />
              </Label>
              <Input type={item.key.includes('TOKEN') ? 'password' : 'text'} value={form[item.key] || ''}
                onChange={e => setForm({ ...form, [item.key]: e.target.value })} placeholder={item.placeholder}
                className="bg-slate-800 border-slate-700 text-white" />
              <p className="text-[10px] text-slate-500">{item.help}</p>
            </div>
          ))}
        </Card>

        <Card className="bg-slate-900 border-slate-800 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-2">
            <Brain className="w-5 h-5 text-purple-400" /> Inteligência Artificial
          </h3>
          {CONFIG_KEYS.filter(k => k.category === 'ai').map(item => (
            <div key={item.key} className="space-y-1.5">
              <Label className="text-slate-300">{item.label}</Label>
              <Input type="password" value={form[item.key] || ''}
                onChange={e => setForm({ ...form, [item.key]: e.target.value })} placeholder={item.placeholder}
                className="bg-slate-800 border-slate-700 text-white" />
              <p className="text-[10px] text-slate-500">{item.help}</p>
            </div>
          ))}
        </Card>

        <Button onClick={handleSaveAll} className="w-full bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 h-11" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Salvar Alterações
        </Button>
      </div>

      <div className="space-y-4">
        <Card className="bg-blue-500/10 border-blue-500/20 p-5">
          <h4 className="font-bold text-blue-400 flex items-center gap-2 mb-3"><HelpCircle className="w-4 h-4" /> Como configurar?</h4>
          <div className="space-y-3 text-sm text-blue-200/80">
            <p>1. Crie um App no <span className="font-bold">developers.facebook.com</span> do tipo Business.</p>
            <p>2. Adicione o produto "WhatsApp" ao App.</p>
            <p>3. Configure o Webhook para:</p>
            <code className="block bg-slate-950 p-2 rounded text-[10px] text-emerald-400 break-all">
              https://www.mercattafreedom.com.br/api/webhooks/whatsapp
            </code>
            <p>4. Inscreva-se no campo <span className="font-bold text-white">messages</span>.</p>
          </div>
          <a href="https://developers.facebook.com/apps" target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-blue-400 hover:underline mt-4 font-semibold">
            Abrir Meta Developers <ExternalLink className="w-3 h-3" />
          </a>
        </Card>

        <Card className="bg-amber-500/10 border-amber-500/20 p-5">
          <h4 className="font-bold text-amber-400 flex items-center gap-2 mb-2"><AlertTriangle className="w-4 h-4" /> Importante</h4>
          <p className="text-xs text-amber-200/70 leading-relaxed">
            O token temporário expira em 24h. Para produção, use um <span className="font-bold text-white">Usuário do Sistema</span> no Gerenciador de Negócios para gerar um token permanente.
          </p>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// Aba: Treinamento da IA
// ─────────────────────────────────────────
function TrainingTab() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [testMsg, setTestMsg] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [testLoading, setTestLoading] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState({
    input_message: '', expected_intent: 'create_expense',
    expected_data: { amount: null, description: null, payment_method: null, credit_card: null, category: null },
    notes: ''
  });

  const { data: examples = [], isLoading } = useQuery({
    queryKey: ['ai-training'],
    queryFn: async () => {
      const r = await fetch(`${API_BASE()}/admin/ai-training`, { headers: authHeader() });
      return (await r.json()).data || [];
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const r = await fetch(`${API_BASE()}/admin/ai-training`, {
        method: 'POST', headers: authHeader(), body: JSON.stringify(data)
      });
      if (!r.ok) throw new Error('Erro ao criar exemplo');
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['ai-training']);
      setShowForm(false);
      setForm({ input_message: '', expected_intent: 'create_expense', expected_data: {}, notes: '' });
      toast.success('Exemplo de treinamento adicionado!');
    },
    onError: () => toast.error('Erro ao salvar exemplo.')
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }) => {
      const r = await fetch(`${API_BASE()}/admin/ai-training/${id}`, {
        method: 'PUT', headers: authHeader(), body: JSON.stringify({ ativo })
      });
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries(['ai-training'])
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      const r = await fetch(`${API_BASE()}/admin/ai-training/${id}`, {
        method: 'DELETE', headers: authHeader()
      });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['ai-training']);
      toast.success('Exemplo removido.');
    }
  });

  const handleTest = async () => {
    if (!testMsg.trim()) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const r = await fetch(`${API_BASE()}/admin/ai-training/test`, {
        method: 'POST', headers: authHeader(), body: JSON.stringify({ message: testMsg })
      });
      const data = await r.json();
      setTestResult(data.data);
    } catch { toast.error('Erro ao testar mensagem.'); }
    finally { setTestLoading(false); }
  };

  const handleSubmitForm = () => {
    const clean = Object.fromEntries(Object.entries(form.expected_data).filter(([, v]) => v !== null && v !== ''));
    createMutation.mutate({ ...form, expected_data: clean });
  };

  const fields = DATA_FIELDS[form.expected_intent] || [];

  return (
    <div className="space-y-6">
      {/* Tester */}
      <Card className="bg-slate-900 border-slate-800 p-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-1">
          <TestTube2 className="w-5 h-5 text-cyan-400" /> Testar Mensagem na IA
        </h3>
        <p className="text-xs text-slate-400 mb-4">Digite uma mensagem como o usuário enviaria e veja o que a IA interpreta.</p>
        <div className="flex gap-2">
          <Input value={testMsg} onChange={e => setTestMsg(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleTest()}
            placeholder='Ex: "gastei 50 reais no posto no débito"'
            className="bg-slate-800 border-slate-700 text-white flex-1" />
          <Button onClick={handleTest} disabled={testLoading || !testMsg.trim()} className="bg-cyan-600 hover:bg-cyan-700 shrink-0">
            {testLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Testar'}
          </Button>
        </div>

        {testResult && (
          <div className="mt-4 p-4 bg-slate-950 rounded-lg border border-slate-700 space-y-3">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${testResult.intent === 'unknown' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                {testResult.intent}
              </span>
              <span className="text-xs text-slate-400">confiança: {Math.round((testResult.confidence || 0) * 100)}%</span>
            </div>

            {testResult.data && Object.keys(testResult.data).length > 0 && (
              <div className="grid grid-cols-2 gap-1">
                {Object.entries(testResult.data).filter(([, v]) => v !== null).map(([k, v]) => (
                  <div key={k} className="flex gap-1 text-xs">
                    <span className="text-slate-500">{k}:</span>
                    <span className="text-white font-medium">{String(v)}</span>
                  </div>
                ))}
              </div>
            )}

            {testResult.missing_fields?.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-amber-400">
                <AlertTriangle className="w-3 h-3" />
                Campos faltando: {testResult.missing_fields.join(', ')}
              </div>
            )}

            {testResult.user_question && (
              <div className="text-xs text-blue-300 bg-blue-500/10 rounded p-2">
                💬 {testResult.user_question}
              </div>
            )}

            {testResult.summary_for_confirmation && (
              <div className="text-xs text-emerald-300 bg-emerald-500/10 rounded p-2 whitespace-pre-line">
                {testResult.summary_for_confirmation}
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Lista + Form */}
      <Card className="bg-slate-900 border-slate-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" /> Exemplos de Treinamento
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">{examples.filter(e => e.ativo).length} ativos · {examples.length} total</p>
          </div>
          <Button onClick={() => setShowForm(!showForm)} size="sm" className="bg-purple-600 hover:bg-purple-700">
            <Plus className="w-4 h-4 mr-1.5" /> Novo Exemplo
          </Button>
        </div>

        {/* Formulário de novo exemplo */}
        {showForm && (
          <div className="mb-6 p-5 bg-slate-800/60 rounded-xl border border-slate-700 space-y-4">
            <h4 className="font-semibold text-white text-sm">Novo Exemplo de Treinamento</h4>

            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Mensagem do usuário *</Label>
              <Input value={form.input_message} onChange={e => setForm({ ...form, input_message: e.target.value })}
                placeholder='Ex: "paguei o aluguel 1500 no pix"'
                className="bg-slate-900 border-slate-700 text-white" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Intent esperado *</Label>
              <select value={form.expected_intent}
                onChange={e => setForm({ ...form, expected_intent: e.target.value, expected_data: {} })}
                className="w-full bg-slate-900 border border-slate-700 text-white rounded-md px-3 py-2 text-sm">
                {INTENT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            {fields.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Dados esperados</Label>
                <div className="grid grid-cols-2 gap-2">
                  {fields.map(field => (
                    <div key={field} className="space-y-0.5">
                      <Label className="text-slate-400 text-[10px] uppercase tracking-wide">{field}</Label>
                      <Input value={form.expected_data[field] || ''}
                        onChange={e => setForm({ ...form, expected_data: { ...form.expected_data, [field]: e.target.value || null } })}
                        placeholder={field === 'amount' ? '100' : field === 'payment_method' ? 'PIX | DINHEIRO | DEBITO' : ''}
                        className="bg-slate-900 border-slate-700 text-white text-xs h-8" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Observação (opcional)</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Ex: usar quando falar em aluguel"
                className="bg-slate-900 border-slate-700 text-white" />
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} className="text-slate-400">Cancelar</Button>
              <Button size="sm" onClick={handleSubmitForm} disabled={!form.input_message || !form.expected_intent || createMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700">
                {createMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Plus className="w-3 h-3 mr-1" />} Salvar Exemplo
              </Button>
            </div>
          </div>
        )}

        {/* Lista de exemplos */}
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-purple-400" /></div>
        ) : examples.length === 0 ? (
          <div className="text-center py-10 text-slate-500">
            <Brain className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum exemplo cadastrado ainda.</p>
            <p className="text-xs mt-1">Adicione exemplos para melhorar a precisão da IA.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {examples.map(ex => (
              <div key={ex.id}
                className={`rounded-lg border transition-all ${ex.ativo ? 'border-slate-700 bg-slate-800/40' : 'border-slate-800 bg-slate-900/40 opacity-50'}`}>
                <div className="flex items-center gap-3 p-3 cursor-pointer" onClick={() => setExpandedId(expandedId === ex.id ? null : ex.id)}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${ex.ativo ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                  <span className="text-sm text-white flex-1 truncate">"{ex.input_message}"</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                    ex.expected_intent === 'create_expense' ? 'bg-red-500/20 text-red-400' :
                    ex.expected_intent === 'create_income' ? 'bg-emerald-500/20 text-emerald-400' :
                    ex.expected_intent === 'create_credit_card_expense' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-slate-500/20 text-slate-400'}`}>
                    {ex.expected_intent.replace('create_', '')}
                  </span>
                  {expandedId === ex.id ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                </div>

                {expandedId === ex.id && (
                  <div className="px-4 pb-3 space-y-2 border-t border-slate-700 pt-3">
                    {Object.keys(ex.expected_data || {}).length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(ex.expected_data).filter(([, v]) => v !== null).map(([k, v]) => (
                          <span key={k} className="text-[10px] bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{k}: {String(v)}</span>
                        ))}
                      </div>
                    )}
                    {ex.notes && <p className="text-xs text-slate-400 italic">{ex.notes}</p>}
                    <div className="flex gap-2 justify-end mt-1">
                      <Button size="sm" variant="ghost"
                        onClick={() => toggleMutation.mutate({ id: ex.id, ativo: !ex.ativo })}
                        className={ex.ativo ? 'text-amber-400 hover:bg-amber-400/10' : 'text-emerald-400 hover:bg-emerald-400/10'}>
                        <Power className="w-3 h-3 mr-1" /> {ex.ativo ? 'Desativar' : 'Ativar'}
                      </Button>
                      <Button size="sm" variant="ghost"
                        onClick={() => { if (confirm('Remover este exemplo?')) deleteMutation.mutate(ex.id); }}
                        className="text-red-400 hover:bg-red-400/10">
                        <Trash2 className="w-3 h-3 mr-1" /> Remover
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────
// Componente Principal
// ─────────────────────────────────────────
const TABS = [
  { id: 'config', label: 'Configuração', icon: Settings },
  { id: 'training', label: 'Treinamento da IA', icon: Brain },
];

export default function WhatsAppConfig() {
  const [activeTab, setActiveTab] = useState('config');

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-emerald-500" /> WhatsApp & IA
        </h2>
        <p className="text-slate-400 text-sm mt-1">Configure a integração WhatsApp e treine a IA para reconhecer os lançamentos corretamente.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/50 p-1 rounded-xl w-fit border border-slate-700/50">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50'
              }`}>
              <Icon className="w-4 h-4" /> {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'config' && <ConfigTab />}
      {activeTab === 'training' && <TrainingTab />}
    </div>
  );
}
