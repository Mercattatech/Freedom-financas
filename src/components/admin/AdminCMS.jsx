import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Save, Eye, BarChart3, MessageSquare, HelpCircle } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_CMS = {
  logo_url: '',
  hero_image_desktop: '',
  hero_image_mobile: '',
  problema_image: '',
  hero_badge: '🚀 O app de finanças que transforma famílias',
  hero_titulo: 'Liberdade Financeira começa aqui',
  hero_subtitulo: 'O Freedom é o sistema de gestão financeira familiar mais completo do Brasil.',
  hero_cta: 'Ver Planos e Preços',
  hero_video_url: '',
  hero_stat1_n: '2.400+', hero_stat1_l: 'Famílias usando',
  hero_stat2_n: 'R$ 12M+', hero_stat2_l: 'Economizados',
  hero_stat3_n: '4.9★', hero_stat3_l: 'Avaliação média',
  problema_titulo: 'Você se identifica com isso?',
  problema_subtitulo: 'Esses são os problemas mais comuns que resolvemos',
  features_titulo: 'Tudo que sua família precisa',
  features_subtitulo: 'Uma plataforma completa para transformar sua relação com o dinheiro',
  depoimentos_titulo: 'O que dizem nossos clientes',
  depoimentos_subtitulo: 'Histórias reais de famílias que transformaram sua vida financeira',
  depoimentos_json: JSON.stringify([
    { nome: 'Ana Paula S.', cargo: 'Professora', texto: 'Em 3 meses usando o Freedom, consegui quitar uma dívida de R$8.000!', estrelas: 5 },
    { nome: 'Carlos M.', cargo: 'Engenheiro', texto: 'Finalmente estamos alinhados nas finanças. O Freedom mudou nossa família.', estrelas: 5 },
    { nome: 'Fernanda R.', cargo: 'Autônoma', texto: 'As caixinhas de investimento mudaram minha vida!', estrelas: 5 },
  ], null, 2),
  planos_titulo: 'Escolha seu plano',
  planos_subtitulo: 'Sem surpresas. Sem letras miúdas. Cancele quando quiser.',
  faq_titulo: 'Perguntas frequentes',
  faqs_json: JSON.stringify([
    { p: 'Posso cancelar a qualquer momento?', r: 'Sim! Você pode cancelar sua assinatura sem multas ou taxas.' },
    { p: 'O app funciona no celular?', r: 'Sim! O Freedom é 100% responsivo.' },
    { p: 'Meus dados financeiros estão seguros?', r: 'Absolutamente! Usamos criptografia de ponta a ponta.' },
    { p: 'Como funciona o pagamento?', r: 'Pagamento via cartão pelo Stripe, 100% seguro.' },
  ], null, 2),
  cta_final_titulo: 'Sua família merece liberdade financeira',
  cta_final_subtitulo: 'Junte-se a mais de 2.400 famílias que já estão no controle do seu dinheiro.',
  cta_final_btn: 'Quero começar agora',
  footer_texto: '© 2025 Freedom Gestão Financeira. Todos os direitos reservados.',
};

export default function AdminCMS() {
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

  const Field = ({ label, field, placeholder, multiline, hint, isImage }) => (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1 block">{label}</label>
      <div className="flex gap-4 items-start">
        <div className="flex-1">
          {multiline ? (
            <textarea
              value={form[field] || ''}
              onChange={e => f({ [field]: e.target.value })}
              placeholder={placeholder}
              rows={6}
              className="w-full rounded-lg border border-slate-700 bg-slate-800 text-white p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
            />
          ) : (
            <Input
              value={form[field] || ''}
              onChange={e => f({ [field]: e.target.value })}
              placeholder={placeholder}
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          )}
          {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
        </div>
        
        {isImage && form[field] && (
          <div className="shrink-0 w-16 h-16 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center p-1">
            <img src={form[field]} alt="Preview" className="max-w-full max-h-full object-contain" onError={(e) => e.target.style.display='none'} onLoad={(e) => e.target.style.display='block'} />
          </div>
        )}
      </div>
    </div>
  );

  const Section = ({ title, icon: Icon, iconColor, children }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
      <h3 className="font-bold text-white flex items-center gap-2 text-base">
        {Icon && <Icon className={`w-5 h-5 ${iconColor || 'text-emerald-500'}`} />}
        {title}
      </h3>
      {children}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">Editor da Landing Page</h2>
          <p className="text-slate-400 text-sm mt-1">Edite todos os textos e conteúdos da sua página de vendas</p>
        </div>
        <div className="flex gap-3">
          <a href="/landing-page" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800">
              <Eye className="w-4 h-4 mr-2" /> Ver página
            </Button>
          </a>
          <Button className="bg-emerald-600 hover:bg-emerald-500" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>

      <Section title="Navbar do Site (Menu Superior)" icon={BarChart3} iconColor="text-sky-500">
        <Field label="URL do Logo" field="logo_url" placeholder="Ex: https://i.imgur.com/logo.png" hint="Se vazio, a logo padrão do Freedom será usada em formato texto." isImage />
      </Section>

      <Section title="Seção Hero (topo)" icon={BarChart3}>
        <Field label="URL (Imagem Secundária - Mockup Mobile Frontal)" field="hero_image_mobile" placeholder="https://..." hint="Opcional. Uma segunda imagem ex: Celular flutuando à esquerda." isImage />
        <Field label="URL da Imagem Principal (Hero Desktop)" field="hero_image_desktop" placeholder="https://..." hint="Pode ser URL estática (.png/.jpg) ou Vídeo que toque automático (.mp4)" isImage />
        <Field label="Badge" field="hero_badge" placeholder="🚀 O app de finanças..." />
        <Field label="Título Principal" field="hero_titulo" placeholder="Liberdade Financeira começa aqui" />
        <Field label="Subtítulo" field="hero_subtitulo" placeholder="Descrição..." />
        <Field label="Texto do Botão CTA" field="hero_cta" placeholder="Ver Planos e Preços" />
        <Field label="URL do Vídeo YouTube Pop-up" field="hero_video_url" placeholder="https://youtube.com/watch?v=..." hint="Botão de assistir vídeo principal. Deixe vazio para não exibir." />
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Field label="Stat 1 – Número" field="hero_stat1_n" placeholder="2.400+" />
            <Field label="Stat 1 – Label" field="hero_stat1_l" placeholder="Famílias usando" />
          </div>
          <div className="space-y-2">
            <Field label="Stat 2 – Número" field="hero_stat2_n" placeholder="R$ 12M+" />
            <Field label="Stat 2 – Label" field="hero_stat2_l" placeholder="Economizados" />
          </div>
          <div className="space-y-2">
            <Field label="Stat 3 – Número" field="hero_stat3_n" placeholder="4.9★" />
            <Field label="Stat 3 – Label" field="hero_stat3_l" placeholder="Avaliação média" />
          </div>
        </div>
      </Section>

      <Section title="Seção Problema" icon={HelpCircle} iconColor="text-red-500">
        <Field label="Título" field="problema_titulo" />
        <Field label="Subtítulo" field="problema_subtitulo" />
        <Field label="URL da Imagem Ilustrativa" field="problema_image" placeholder="https://..." hint="Exibe uma imagem ao lado dos textos da dor." isImage />
      </Section>

      <Section title="Funcionalidades">
        <Field label="Título" field="features_titulo" />
        <Field label="Subtítulo" field="features_subtitulo" />
      </Section>

      <Section title="Depoimentos" icon={MessageSquare}>
        <Field label="Título" field="depoimentos_titulo" />
        <Field label="Subtítulo" field="depoimentos_subtitulo" />
        <Field label="Depoimentos (JSON)" field="depoimentos_json" multiline hint='[{"nome":"Ana S.", "cargo":"Professora", "texto":"...", "estrelas":5}]' />
      </Section>

      <Section title="Planos">
        <Field label="Título" field="planos_titulo" />
        <Field label="Subtítulo" field="planos_subtitulo" />
      </Section>

      <Section title="FAQ" icon={HelpCircle}>
        <Field label="Título" field="faq_titulo" />
        <Field label="Perguntas e Respostas (JSON)" field="faqs_json" multiline hint='[{"p":"Pergunta?", "r":"Resposta..."}]' />
      </Section>

      <Section title="CTA Final">
        <Field label="Título" field="cta_final_titulo" />
        <Field label="Subtítulo" field="cta_final_subtitulo" />
        <Field label="Texto do Botão" field="cta_final_btn" />
      </Section>

      <Section title="Rodapé">
        <Field label="Texto de Copyright" field="footer_texto" />
      </Section>

      <div className="flex justify-end pb-8">
        <Button className="bg-emerald-600 hover:bg-emerald-500 px-8" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar todas as alterações
        </Button>
      </div>
    </div>
  );
}