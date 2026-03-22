import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, ShieldAlert, Save, Eye, BarChart3, MessageSquare, HelpCircle, DollarSign, Tag, Plus, Check, X, RefreshCw, Pencil, Trash2, ToggleLeft, ToggleRight, ExternalLink, Upload } from 'lucide-react';
import AdminUsers from '../components/admin/AdminUsers';
import AdminPayments from '../components/admin/AdminPayments';
import AdminFamilies from '../components/admin/AdminFamilies';
import AdminAccounts from '../components/admin/AdminAccounts';
import { toast } from 'sonner';

const TABS = [
  { id: 'payments', label: '💳 Pagamentos' },
  { id: 'users', label: '👥 Acessos Manuais' },
  { id: 'accounts', label: '📈 Contas & Engajamento' },
  { id: 'families', label: '🏠 Famílias Cadastradas' },
  { id: 'plans', label: '💰 Planos & Preços' },
  { id: 'cms', label: '🎨 Landing Page (CMS)' },
];

// ─── CMS EDITOR ──────────────────────────────────────────────────────────────

const DEFAULT_CMS = {
  hero_badge: '🚀 O app de finanças que transforma famílias',
  hero_titulo: 'Liberdade Financeira começa aqui',
  hero_subtitulo: 'O Freedom é o sistema de gestão financeira familiar mais completo do Brasil.',
  hero_cta: 'Ver Planos e Preços',
  hero_video_url: '',
  hero_stat1_n: '2.400+', hero_stat1_l: 'Famílias usando',
  hero_stat2_n: 'R$ 12M+', hero_stat2_l: 'Economizados',
  hero_stat3_n: '4.9★', hero_stat3_l: 'Avaliação média',
  problema_titulo: 'Você se identifica com isso?',
  problema_subtitulo: 'Esses são os problemas mais comuns que resolvemos para famílias brasileiras',
  features_titulo: 'Tudo que sua família precisa',
  features_subtitulo: 'Uma plataforma completa para transformar sua relação com o dinheiro',
  depoimentos_titulo: 'O que dizem nossos clientes',
  depoimentos_subtitulo: 'Histórias reais de famílias que transformaram sua vida financeira',
  depoimentos_json: JSON.stringify([
    { nome: 'Ana Paula S.', cargo: 'Professora', texto: 'Em 3 meses usando o Freedom, consegui quitar uma dívida de R$8.000 e ainda sobrou para guardar!', estrelas: 5 },
    { nome: 'Carlos M.', cargo: 'Engenheiro', texto: 'Eu e minha esposa finalmente estamos alinhados nas finanças. O Freedom mudou nossa família.', estrelas: 5 },
    { nome: 'Fernanda R.', cargo: 'Autônoma', texto: 'As caixinhas de investimento mudaram minha vida. Consegui juntar para a viagem dos sonhos!', estrelas: 5 },
  ], null, 2),
  planos_titulo: 'Escolha seu plano',
  planos_subtitulo: 'Sem surpresas. Sem letras miúdas. Cancele quando quiser.',
  faq_titulo: 'Perguntas frequentes',
  faqs_json: JSON.stringify([
    { p: 'Posso cancelar a qualquer momento?', r: 'Sim! Você pode cancelar sua assinatura a qualquer momento sem multas ou taxas.' },
    { p: 'O app funciona no celular?', r: 'Sim! O Freedom é 100% responsivo e funciona perfeitamente em celulares, tablets e computadores.' },
    { p: 'Meus dados financeiros estão seguros?', r: 'Absolutamente! Usamos criptografia de ponta a ponta e os dados nunca são compartilhados com terceiros.' },
    { p: 'Como funciona o pagamento?', r: 'O pagamento é feito via cartão de crédito de forma 100% segura pelo Stripe.' },
  ], null, 2),
  cta_final_titulo: 'Sua família merece liberdade financeira',
  cta_final_subtitulo: 'Junte-se a mais de 2.400 famílias que já estão no controle do seu dinheiro.',
  cta_final_btn: 'Quero começar agora',
  footer_texto: '© 2025 Freedom Gestão Financeira. Todos os direitos reservados.',
};

function CMSEditor() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);

  const { data: cmsData, isLoading } = useQuery({
    queryKey: ['landing-cms'],
    queryFn: () => apiClient.entities.LandingCMS.list('-updated_date', 1),
  });

  useEffect(() => {
    if (cmsData && !form) setForm({ ...DEFAULT_CMS, ...(cmsData[0] || {}) });
  }, [cmsData]);

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const existing = cmsData?.[0];
      if (existing?.id) return apiClient.entities.LandingCMS.update(existing.id, data);
      return apiClient.entities.LandingCMS.create(data);
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['landing-cms'] }); toast.success('Landing page atualizada!'); },
    onError: (e) => toast.error('Erro: ' + e.message),
  });

  const f = (v) => setForm(prev => ({ ...prev, ...v }));

  if (isLoading || !form) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;

  const Field = ({ label, field, placeholder, multiline, hint }) => (
    <div>
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">{label}</label>
      {multiline ? (
        <textarea value={form[field] || ''} onChange={e => f({ [field]: e.target.value })} placeholder={placeholder} rows={6}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 text-white p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono" />
      ) : (
        <input value={form[field] || ''} onChange={e => f({ [field]: e.target.value })} placeholder={placeholder}
          className="w-full rounded-lg border border-slate-700 bg-slate-800 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
      )}
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  );

  const ImageField = ({ label, field, hint, dimensions }) => {
    const [uploading, setUploading] = useState(false);

    const handleUpload = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) return toast.error('Máximo 5MB por imagem.');
      
      setUploading(true);
      const formData = new FormData();
      formData.append('image', file);

      try {
        const token = localStorage.getItem('freedom_access_token');
        const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
        const res = await fetch(`${baseUrl}/upload`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Erro no upload');
        f({ [field]: data.url });
        toast.success('Imagem salva!');
      } catch (err) {
        toast.error(err.message);
      } finally {
        setUploading(false);
      }
    };

    return (
      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700/50 flex flex-col md:flex-row gap-6 items-start">
        <div className="flex-1 w-full">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide mb-1 block">{label}</label>
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            <input type="file" accept="image/*" id={`img-${field}`} className="hidden" onChange={handleUpload} />
            <Button
              type="button"
              variant="outline"
              className="border-slate-600 bg-slate-700/50 text-emerald-400 hover:text-emerald-300 hover:bg-slate-700 flex-shrink-0"
              onClick={() => document.getElementById(`img-${field}`).click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Fazer Upload
            </Button>
            <input
              value={form[field] || ''}
              onChange={e => f({ [field]: e.target.value })}
              placeholder="Ou cole o link da imagem (URL)"
              className="w-full flex-1 rounded-lg border border-slate-600 bg-slate-900 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <p className="text-xs text-slate-400 mt-3 font-mono bg-slate-900/50 inline-block px-2 py-1 rounded">
            Dimensões: {dimensions} | Máx: 5MB
          </p>
          {hint && <p className="text-xs text-slate-500 mt-2">{hint}</p>}
        </div>
        
        {form[field] && (
          <div className="w-full md:w-32 h-24 bg-slate-950 rounded-lg flex items-center justify-center border border-slate-700 overflow-hidden flex-shrink-0">
            <img src={form[field]} alt="Preview" className="max-w-full max-h-full object-contain" />
          </div>
        )}
      </div>
    );
  };

  const Section = ({ title, icon: Icon, children }) => (
    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
      <h3 className="font-bold text-white flex items-center gap-2 text-base mb-2">
        {Icon && <Icon className="w-5 h-5 text-emerald-500" />} {title}
      </h3>
      {children}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Editor da Landing Page</h2>
          <p className="text-slate-400 text-sm mt-1">Edite todos os textos e conteúdos da sua página de vendas</p>
        </div>
        <div className="flex gap-3">
          <a href="/landing-page" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800"><Eye className="w-4 h-4 mr-2" /> Ver página</Button>
          </a>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Salvar
          </Button>
        </div>
      </div>
      <Section title="Imagens e Identidade Visual" icon={Eye}>
        <ImageField label="Logo Principal (Header)" field="logo_url" dimensions="300x120 pixels" hint="Logo principal que aparece no menu do topo." />
        <ImageField label="Imagem do Hero (Desktop)" field="hero_image_desktop" dimensions="1200x800 pixels" hint="A imagem grande exibida na primeira seção (Hero) para computadores." />
        <ImageField label="Imagem do Hero (Mobile/Flutuante)" field="hero_image_mobile" dimensions="600x800 pixels" hint="A imagem secundária flutuante (opcional) exibida no Hero." />
        <ImageField label="Imagem da Seção 'Problema'" field="problema_image" dimensions="800x800 pixels" hint="Imagem ilustrativa para a seção de dores/problemas." />
      </Section>

      <Section title="Seção Hero (topo)" icon={BarChart3}>
        <Field label="Badge" field="hero_badge" />
        <Field label="Título Principal" field="hero_titulo" />
        <Field label="Subtítulo" field="hero_subtitulo" />
        <Field label="Texto do Botão CTA" field="hero_cta" />
        <Field label="URL do Vídeo" field="hero_video_url" hint="Cole a URL do YouTube. Deixe vazio para não exibir." />
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2"><Field label="Stat 1 – Número" field="hero_stat1_n" /><Field label="Stat 1 – Label" field="hero_stat1_l" /></div>
          <div className="space-y-2"><Field label="Stat 2 – Número" field="hero_stat2_n" /><Field label="Stat 2 – Label" field="hero_stat2_l" /></div>
          <div className="space-y-2"><Field label="Stat 3 – Número" field="hero_stat3_n" /><Field label="Stat 3 – Label" field="hero_stat3_l" /></div>
        </div>
      </Section>

      <Section title="Seção Problema"><Field label="Título" field="problema_titulo" /><Field label="Subtítulo" field="problema_subtitulo" /></Section>
      <Section title="Seção Funcionalidades"><Field label="Título" field="features_titulo" /><Field label="Subtítulo" field="features_subtitulo" /></Section>

      <Section title="Depoimentos" icon={MessageSquare}>
        <Field label="Título da Seção" field="depoimentos_titulo" />
        <Field label="Subtítulo" field="depoimentos_subtitulo" />
        <Field label="Depoimentos (JSON)" field="depoimentos_json" multiline hint='Array JSON: [{"nome": "Ana S.", "cargo": "Professora", "texto": "...", "estrelas": 5}]' />
      </Section>

      <Section title="Seção Planos"><Field label="Título" field="planos_titulo" /><Field label="Subtítulo" field="planos_subtitulo" /></Section>

      <Section title="FAQ" icon={HelpCircle}>
        <Field label="Título da Seção" field="faq_titulo" />
        <Field label="Perguntas e Respostas (JSON)" field="faqs_json" multiline hint='Array JSON: [{"p": "Pergunta?", "r": "Resposta..."}]' />
      </Section>

      <Section title="CTA Final"><Field label="Título" field="cta_final_titulo" /><Field label="Subtítulo" field="cta_final_subtitulo" /><Field label="Texto do Botão" field="cta_final_btn" /></Section>
      <Section title="Rodapé"><Field label="Texto de Copyright" field="footer_texto" /></Section>

      <div className="flex justify-end pb-8">
        <Button className="bg-emerald-600 hover:bg-emerald-700 px-8" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />} Salvar todas as alterações
        </Button>
      </div>
    </div>
  );
}

// ─── PLANS EDITOR ────────────────────────────────────────────────────────────

const TIPOS = [
  { value: 'MENSAL', label: '📅 Mensalidade' },
  { value: 'ANUAL', label: '📆 Assinatura Anual' },
  { value: 'UNICO', label: '💳 Pagamento Único' },
];
const CORES = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#EC4899'];
const emptyPlan = () => ({ nome: '', descricao: '', tipo: 'MENSAL', preco: '', preco_original: '', features: '', destaque: false, badge: '', upsell_texto: '', upsell_price_id: '', limite_familias: 1, cor: '#10B981', ordem: 0, ativo: true });

function PlansEditor() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyPlan());
  const [syncingId, setSyncingId] = useState(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['plans-admin'],
    queryFn: () => apiClient.entities.Plan.list(),
  });
  const sorted = [...plans].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

  const saveMutation = useMutation({
    mutationFn: ({ data, id }) => id ? apiClient.entities.Plan.update(id, data) : apiClient.entities.Plan.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['plans-admin'] }); queryClient.invalidateQueries({ queryKey: ['plans-landing'] }); toast.success(editing ? 'Plano atualizado!' : 'Plano criado!'); cancelEdit(); },
    onError: (e) => toast.error('Erro: ' + e.message),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.entities.Plan.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['plans-admin'] }); queryClient.invalidateQueries({ queryKey: ['plans-landing'] }); toast.success('Plano removido'); },
  });
  const toggleMutation = useMutation({
    mutationFn: ({ id, ativo }) => apiClient.entities.Plan.update(id, { ativo }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['plans-admin'] }); queryClient.invalidateQueries({ queryKey: ['plans-landing'] }); },
  });

  const cancelEdit = () => { setEditing(null); setForm(emptyPlan()); };
  const startEdit = (plan) => { setEditing(plan.id); setForm({ nome: plan.nome || '', descricao: plan.descricao || '', tipo: plan.tipo || 'MENSAL', preco: plan.preco || '', preco_original: plan.preco_original || '', features: plan.features || '', destaque: plan.destaque || false, badge: plan.badge || '', upsell_texto: plan.upsell_texto || '', upsell_price_id: plan.upsell_price_id || '', limite_familias: plan.limite_familias || 1, cor: plan.cor || '#10B981', ordem: plan.ordem || 0, ativo: plan.ativo !== false }); };
  const handleSave = (e) => { e.preventDefault(); if (!form.nome || !form.preco) { toast.error('Nome e preço são obrigatórios'); return; } saveMutation.mutate({ data: { ...form, preco: parseFloat(form.preco) || 0, preco_original: parseFloat(form.preco_original) || null, ordem: parseInt(form.ordem) || 0, limite_familias: parseInt(form.limite_familias) || 1 }, id: editing }); };
  const handleSyncStripe = async (plan) => { setSyncingId(plan.id); try { const res = await apiClient.functions.invoke('syncStripePlan', { plan_id: plan.id, nome: plan.nome, descricao: plan.descricao, preco: plan.preco, tipo: plan.tipo }); if (res.data?.success) { queryClient.invalidateQueries({ queryKey: ['plans-admin'] }); toast.success('Sincronizado! Price ID: ' + res.data.stripe_price_id); } else toast.error(res.data?.error || 'Erro ao sincronizar'); } catch (e) { toast.error('Erro: ' + e.message); } finally { setSyncingId(null); } };
  const f = (v) => setForm(prev => ({ ...prev, ...v }));

  const inputCls = "w-full rounded-lg border border-slate-700 bg-slate-800 text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Planos & Preços</h2>
          <p className="text-slate-400 text-sm mt-1">Configure preços, features e sincronize com o Stripe</p>
        </div>
        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => { cancelEdit(); setEditing('new'); }}>
          <Plus className="w-4 h-4 mr-2" /> Novo Plano
        </Button>
      </div>

      {editing && (
        <form onSubmit={handleSave} className="bg-slate-900 border-2 border-emerald-600/40 rounded-2xl p-6 shadow-lg">
          <h2 className="text-lg font-bold text-white mb-6">{editing === 'new' ? '✨ Novo Plano' : '✏️ Editar Plano'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2"><label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Nome do Plano *</label><input className={inputCls} placeholder="Ex: Plano Pro..." value={form.nome} onChange={e => f({ nome: e.target.value })} required /></div>
            <div className="md:col-span-2"><label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Descrição</label><input className={inputCls} placeholder="Ideal para famílias..." value={form.descricao} onChange={e => f({ descricao: e.target.value })} /></div>
            <div><label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Tipo *</label><Select value={form.tipo} onValueChange={v => f({ tipo: v })}><SelectTrigger className="bg-slate-800 border-slate-700 text-white"><SelectValue /></SelectTrigger><SelectContent>{TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
            <div><label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Preço (R$) *</label><input className={inputCls} type="number" step="0.01" placeholder="29.90" value={form.preco} onChange={e => f({ preco: e.target.value })} required /></div>
            <div><label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Preço Original (tachado)</label><input className={inputCls} type="number" step="0.01" placeholder="49.90" value={form.preco_original} onChange={e => f({ preco_original: e.target.value })} /></div>
            <div><label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Limite de Famílias</label><input className={inputCls} type="number" min="1" value={form.limite_familias} onChange={e => f({ limite_familias: e.target.value })} /></div>
            <div><label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Badge</label><input className={inputCls} placeholder="Mais Popular" value={form.badge} onChange={e => f({ badge: e.target.value })} /></div>
            <div><label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Ordem</label><input className={inputCls} type="number" value={form.ordem} onChange={e => f({ ordem: e.target.value })} /></div>
            <div className="md:col-span-2"><label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Features (separadas por vírgula)</label><input className={inputCls} placeholder="Dashboard, Controle de dívidas..." value={form.features} onChange={e => f({ features: e.target.value })} /></div>
            <div className="md:col-span-2"><label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Texto de Upsell</label><input className={inputCls} placeholder="Adicione consultoria por +R$9,90/mês" value={form.upsell_texto} onChange={e => f({ upsell_texto: e.target.value })} /></div>
            <div className="md:col-span-2"><label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Stripe Price ID do Upsell</label><input className={inputCls} placeholder="price_xxxxx" value={form.upsell_price_id} onChange={e => f({ upsell_price_id: e.target.value })} /></div>
            <div><label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">Cor</label><div className="flex gap-2 mt-1">{CORES.map(c => (<button key={c} type="button" className={`w-8 h-8 rounded-full border-2 transition-transform ${form.cor === c ? 'border-white scale-110' : 'border-transparent'}`} style={{ backgroundColor: c }} onClick={() => f({ cor: c })} />))}</div></div>
            <div className="flex gap-6 items-center"><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.destaque} onChange={e => f({ destaque: e.target.checked })} className="w-4 h-4 accent-emerald-600" /><span className="text-sm font-medium text-slate-300">⭐ Plano em destaque</span></label><label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={form.ativo} onChange={e => f({ ativo: e.target.checked })} className="w-4 h-4 accent-emerald-600" /><span className="text-sm font-medium text-slate-300">✓ Ativo na landing</span></label></div>
          </div>
          <div className="flex gap-3 mt-6">
            <Button type="submit" disabled={saveMutation.isPending} className="bg-emerald-600 hover:bg-emerald-700 flex-1">{saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}{editing === 'new' ? 'Criar Plano' : 'Salvar'}</Button>
            <Button type="button" variant="outline" onClick={cancelEdit} className="border-slate-700 text-slate-300 hover:bg-slate-800"><X className="w-4 h-4 mr-2" /> Cancelar</Button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-slate-900 rounded-2xl border border-dashed border-slate-700"><Tag className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Nenhum plano criado. Crie o primeiro!</p></div>
      ) : (
        <div className="space-y-4">
          {sorted.map((plan) => {
            const features = plan.features ? plan.features.split(',').slice(0, 3) : [];
            const isSyncing = syncingId === plan.id;
            return (
              <div key={plan.id} className={`bg-slate-900 rounded-2xl border-2 p-5 flex flex-col md:flex-row md:items-center gap-4 ${plan.destaque ? 'border-emerald-500/40' : 'border-slate-800'}`}>
                <div className="w-2 h-full min-h-[60px] rounded-full flex-shrink-0" style={{ backgroundColor: plan.cor || '#10B981' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h3 className="font-bold text-white text-lg">{plan.nome}</h3>
                    {plan.destaque && <Badge className="bg-yellow-500/20 text-yellow-400 text-xs">⭐ Destaque</Badge>}
                    {plan.badge && <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">{plan.badge}</Badge>}
                    <Badge variant="outline" className="text-xs border-slate-700 text-slate-400">{TIPOS.find(t => t.value === plan.tipo)?.label}</Badge>
                    {plan.ativo ? <Badge className="bg-green-500/20 text-green-400 text-xs">Ativo</Badge> : <Badge className="bg-slate-700 text-slate-400 text-xs">Inativo</Badge>}
                  </div>
                  <div className="flex flex-wrap items-baseline gap-2 mb-2">
                    {plan.preco_original && <span className="text-slate-500 text-sm line-through">R$ {plan.preco_original}</span>}
                    <span className="text-2xl font-black text-white">R$ {plan.preco}<span className="text-sm font-normal text-slate-400 ml-1">{plan.tipo === 'MENSAL' ? '/mês' : plan.tipo === 'ANUAL' ? '/ano' : ''}</span></span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 text-xs text-slate-400">{features.map(f => <span key={f}>✓ {f.trim()}</span>)}{plan.features && plan.features.split(',').length > 3 && <span>+{plan.features.split(',').length - 3} mais</span>}</div>
                  {plan.stripe_price_id ? <p className="text-xs text-emerald-500 mt-1 font-mono">✓ Stripe: {plan.stripe_price_id}</p> : <p className="text-xs text-amber-500 mt-1">⚠ Não sincronizado com Stripe</p>}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button variant="outline" size="sm" onClick={() => handleSyncStripe(plan)} disabled={isSyncing} className="text-xs border-slate-700 text-slate-300 hover:bg-slate-800">{isSyncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}<span className="ml-1 hidden sm:inline">Sync Stripe</span></Button>
                  <button onClick={() => toggleMutation.mutate({ id: plan.id, ativo: !plan.ativo })} className="p-2 rounded-lg hover:bg-slate-800 transition-colors">{plan.ativo ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-slate-500" />}</button>
                  <button onClick={() => startEdit(plan)} className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => { if (confirm(`Excluir "${plan.nome}"?`)) deleteMutation.mutate(plan.id); }} className="p-2 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-5 text-sm text-blue-300">
        <h4 className="font-bold mb-2 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Como configurar:</h4>
        <ol className="list-decimal list-inside space-y-1 text-blue-400">
          <li>Crie o plano com nome, preço e features</li>
          <li>Clique em <strong>"Sync Stripe"</strong> para criar no Stripe automaticamente</li>
          <li>O plano aparecerá na landing page se estiver ativo</li>
        </ol>
        <a href="https://dashboard.stripe.com/products" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-3 text-blue-400 hover:underline font-medium">
          Abrir painel do Stripe <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

export default function Admin() {
  const [tab, setTab] = useState('users');
  const [authChecked, setAuthChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    apiClient.auth.me().then(user => {
      setIsAdmin(user?.role === 'admin');
      setAuthChecked(true);
    }).catch(() => {
      setIsAdmin(false);
      setAuthChecked(true);
    });
  }, []);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-red-400" />
        </div>
        <h1 className="text-2xl font-black">Acesso Negado</h1>
        <p className="text-slate-400">Esta área é restrita ao proprietário do aplicativo.</p>
        <a href="/" className="text-emerald-400 text-sm hover:underline mt-2">← Voltar ao início</a>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Sidebar */}
      <div className="flex">
        <aside className="w-64 min-h-screen bg-slate-900 border-r border-slate-800 fixed top-0 left-0 z-30 flex flex-col">
          {/* Logo */}
          <div className="p-6 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow">
                <span className="text-white font-black text-lg">F</span>
              </div>
              <div>
                <p className="font-black text-white text-sm">Freedom Admin</p>
                <p className="text-xs text-slate-400">Painel do Proprietário</p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-4 space-y-1">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  tab === t.id
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-slate-800">
            <a href="/" className="text-xs text-slate-500 hover:text-slate-300 transition-colors">← Voltar ao app</a>
          </div>
        </aside>

        {/* Main content */}
        <main className="ml-64 flex-1 min-h-screen bg-slate-950 p-8">
          {tab === 'payments' && <AdminPayments />}
          {tab === 'users' && <AdminUsers />}
          {tab === 'families' && <AdminFamilies />}
          {tab === 'plans' && <PlansEditor />}
          {tab === 'cms' && <CMSEditor />}
        </main>
      </div>
    </div>
  );
}