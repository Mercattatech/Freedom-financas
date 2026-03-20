import { useState, useEffect } from 'react';
import { apiClient } from '@/api/apiClient';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, Shield, TrendingUp, PiggyBank, BarChart3, CreditCard,
  Star, ArrowRight, Zap, Users, Target, ChevronDown, ChevronUp, Loader2,
  Play, Check, MessageCircle
} from 'lucide-react';
import { toast } from 'sonner';

const fmt = (v, tipo) => {
  const formatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
  if (tipo === 'MENSAL') return `${formatted}/mês`;
  if (tipo === 'ANUAL') return `${formatted}/ano`;
  return formatted;
};

const APP_SCREENSHOTS = [
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6966c3ae3b08052b8a78a665/82f9a725f_CapturadeTela2026-03-09as212311.png',
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6966c3ae3b08052b8a78a665/f53808210_CapturadeTela2026-03-09as212546.png',
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6966c3ae3b08052b8a78a665/db1054406_CapturadeTela2026-03-09as212603.png',
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6966c3ae3b08052b8a78a665/194fd3611_CapturadeTela2026-03-09as212648.png',
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6966c3ae3b08052b8a78a665/494069185_CapturadeTela2026-03-09as212706.png',
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6966c3ae3b08052b8a78a665/5a4b66fa9_CapturadeTela2026-03-09as212722.png',
  'https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/6966c3ae3b08052b8a78a665/e952fc611_CapturadeTela2026-03-09as212751.png',
];

const DEFAULT_CONTENT = {
  hero_badge: '🚀 O app de finanças que transforma famílias',
  hero_titulo: 'Liberdade Financeira começa aqui',
  hero_subtitulo: 'O Freedom é o sistema de gestão financeira familiar mais completo do Brasil. Controle receitas, despesas, dívidas, investimentos e orçamento — tudo em um só lugar.',
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
  faq_titulo: 'Perguntas frequentes',
  cta_final_titulo: 'Sua família merece liberdade financeira',
  cta_final_subtitulo: 'Junte-se a mais de 2.400 famílias que já estão no controle do seu dinheiro.',
  cta_final_btn: 'Quero começar agora',
  planos_titulo: 'Escolha seu plano',
  planos_subtitulo: 'Sem surpresas. Sem letras miúdas. Cancele quando quiser.',
  footer_texto: '© 2025 Freedom Gestão Financeira. Todos os direitos reservados.',
};

const FEATURES_PRINCIPAIS = [
  { icon: BarChart3, titulo: 'Dashboard Completo', desc: 'Visão geral de toda sua vida financeira em tempo real, com gráficos e indicadores precisos.' },
  { icon: TrendingUp, titulo: 'Controle de Receitas e Despesas', desc: 'Registre e categorize cada transação. Saiba exatamente para onde vai cada centavo.' },
  { icon: Target, titulo: 'Orçamento Inteligente', desc: 'Defina metas por categoria e receba alertas quando estiver se aproximando do limite.' },
  { icon: CreditCard, titulo: 'Gestão de Dívidas', desc: 'Visualize todas as suas dívidas, juros e prazos. Planeje a quitação de forma estratégica.' },
  { icon: PiggyBank, titulo: 'Caixinhas de Investimento', desc: 'Separe dinheiro para objetivos específicos como viagem, carro ou emergência com rendimentos.' },
  { icon: Shield, titulo: 'Patrimônio e Ações', desc: 'Acompanhe seus investimentos em ações, FIIs e ETFs com alertas de preço personalizados.' },
];

const DEPOIMENTOS_DEFAULT = [
  { nome: 'Ana Paula S.', cargo: 'Professora', texto: 'Em 3 meses usando o Freedom, consegui quitar uma dívida de R$8.000 e ainda sobrou para guardar. A clareza que o sistema dá é incrível!', estrelas: 5 },
  { nome: 'Carlos M.', cargo: 'Engenheiro', texto: 'Eu e minha esposa nunca conseguíamos alinhar as finanças. Com o Freedom, temos tudo centralizado e finalmente estamos no mesmo page.', estrelas: 5 },
  { nome: 'Fernanda R.', cargo: 'Autônoma', texto: 'As caixinhas de investimento mudaram minha vida. Finalmente consegui juntar para a viagem dos sonhos sem me endividar!', estrelas: 5 },
];

const FAQS_DEFAULT = [
  { p: 'Posso cancelar a qualquer momento?', r: 'Sim! Você pode cancelar sua assinatura a qualquer momento sem multas ou taxas. Seu acesso permanece ativo até o fim do período pago.' },
  { p: 'O app funciona no celular?', r: 'Sim! O Freedom é 100% responsivo e funciona perfeitamente em celulares, tablets e computadores. Sem necessidade de baixar nada.' },
  { p: 'Quantas famílias posso cadastrar?', r: 'Depende do plano escolhido. O plano básico permite 1 família, o Pro permite mais. Veja os detalhes em cada plano acima.' },
  { p: 'Meus dados financeiros estão seguros?', r: 'Absolutamente! Usamos criptografia de ponta a ponta e os dados nunca são compartilhados com terceiros. Sua privacidade é nossa prioridade.' },
  { p: 'Como funciona o pagamento?', r: 'O pagamento é feito via cartão de crédito de forma 100% segura pelo Stripe, o processador de pagamentos mais confiável do mundo.' },
];

function VideoModal({ url, onClose }) {
  if (!url) return null;
  const isYoutube = url.includes('youtube.com') || url.includes('youtu.be');
  let embedUrl = url;
  if (isYoutube) {
    const id = url.includes('youtu.be/') ? url.split('youtu.be/')[1]?.split('?')[0] : new URLSearchParams(url.split('?')[1]).get('v');
    embedUrl = `https://www.youtube.com/embed/${id}?autoplay=1`;
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-4xl aspect-video rounded-2xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <iframe src={embedUrl} className="w-full h-full" allow="autoplay; fullscreen" allowFullScreen title="Demo" />
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [loadingPlanId, setLoadingPlanId] = useState(null);
  const [openFaq, setOpenFaq] = useState(null);
  const [showVideo, setShowVideo] = useState(false);
  const [activeScreenshot, setActiveScreenshot] = useState(0);

  const { data: plans = [], isLoading: loadingPlans } = useQuery({
    queryKey: ['plans-landing'],
    queryFn: () => apiClient.entities.Plan.filter({ ativo: true }),
  });

  const { data: cmsData } = useQuery({
    queryKey: ['landing-cms'],
    queryFn: () => apiClient.entities.LandingCMS.list('-updated_date', 1),
  });

  const cms = { ...DEFAULT_CONTENT, ...(cmsData?.[0] || {}) };

  let depoimentos = DEPOIMENTOS_DEFAULT;
  let faqs = FAQS_DEFAULT;
  try { if (cms.depoimentos_json) depoimentos = JSON.parse(cms.depoimentos_json); } catch (_) {}
  try { if (cms.faqs_json) faqs = JSON.parse(cms.faqs_json); } catch (_) {}

  const sortedPlans = [...plans].sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

  useEffect(() => {
    const timer = setInterval(() => setActiveScreenshot(i => (i + 1) % APP_SCREENSHOTS.length), 3500);
    return () => clearInterval(timer);
  }, []);

  const handleCheckout = async (plan) => {
    const isInIframe = window.self !== window.top;
    if (isInIframe) {
      toast.error('O checkout só funciona no app publicado. Abra em uma nova aba para testar.');
      return;
    }
    setLoadingPlanId(plan.id);
    try {
      const response = await apiClient.functions.invoke('createCheckout', {
        plan_id: plan.id,
        success_url: window.location.origin + '/Dashboard',
        cancel_url: window.location.origin + window.location.pathname,
      });
      if (response.data?.url) window.location.href = response.data.url;
      else toast.error(response.data?.error || 'Erro ao iniciar checkout');
    } catch (e) {
      toast.error('Erro ao conectar com o servidor de pagamento');
    } finally {
      setLoadingPlanId(null);
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans">
      {showVideo && <VideoModal url={cms.hero_video_url} onClose={() => setShowVideo(false)} />}

      {/* ── TOP NAV BAR ─────────────────────────────────────── */}
      <div className="absolute top-0 left-0 right-0 z-50 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {cms.logo_url ? (
              <img src={cms.logo_url} alt="Freedom Logo" className="h-9 w-auto object-contain" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <span className="text-white font-bold">F</span>
              </div>
            )}
            <span className="text-white font-bold text-lg">Freedom</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#planos" className="text-slate-300 hover:text-white text-sm font-medium transition-colors hidden sm:block">Planos</a>
            <a href="#features" className="text-slate-300 hover:text-white text-sm font-medium transition-colors hidden sm:block">Funcionalidades</a>
            <a href="#faq" className="text-slate-300 hover:text-white text-sm font-medium transition-colors hidden sm:block">FAQ</a>
            <a
              href="/Login"
              className="bg-white/10 hover:bg-white/20 text-white border border-white/20 font-medium px-5 py-2 rounded-xl text-sm transition-all backdrop-blur-sm"
            >
              Entrar
            </a>
          </div>
        </div>
      </div>

      {/* ── HERO ─────────────────────────────────────────────── */}
      <section className="relative min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white overflow-hidden flex items-center">
        <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'radial-gradient(circle at 25% 50%, #10b981 0%, transparent 50%), radial-gradient(circle at 75% 20%, #0d9488 0%, transparent 40%)'}} />
        <div className="absolute top-20 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-6 py-16 w-full">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <Badge className="mb-6 bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-sm px-4 py-1.5 rounded-full">
                {cms.hero_badge}
              </Badge>
              <h1 className="text-5xl md:text-6xl font-black mb-6 leading-[1.1]">
                {cms.hero_titulo.split(' ').slice(0, -2).join(' ')}{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
                  {cms.hero_titulo.split(' ').slice(-2).join(' ')}
                </span>
              </h1>
              <p className="text-lg md:text-xl text-slate-300 mb-8 leading-relaxed max-w-xl">
                {cms.hero_subtitulo}
              </p>

              <div className="flex flex-col sm:flex-row gap-4 mb-10">
                <Button
                  size="lg"
                  className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-lg px-8 py-6 rounded-2xl shadow-2xl shadow-emerald-500/30"
                  onClick={() => document.getElementById('planos').scrollIntoView({ behavior: 'smooth' })}
                >
                  {cms.hero_cta} <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
                {cms.hero_video_url && (
                  <Button
                    size="lg"
                    variant="outline"
                    className="border-white/30 text-white hover:bg-white/10 font-bold px-8 py-6 rounded-2xl backdrop-blur-sm"
                    onClick={() => setShowVideo(true)}
                  >
                    <Play className="mr-2 w-5 h-5 fill-white" /> Ver demonstração
                  </Button>
                )}
              </div>

              <div className="flex flex-wrap gap-6 text-sm text-slate-400">
                <span className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Sem taxa de adesão</span>
                <span className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Cancele quando quiser</span>
                <span className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Acesso imediato</span>
              </div>
            </div>

            <div className="relative">
              {cms.hero_image_mobile && (
                <div className="absolute -left-12 -bottom-12 w-48 z-20 rounded-2xl shadow-2xl shadow-emerald-500/20 rotate-[-10deg] animate-float hover:rotate-0 hover:z-30 transition-all duration-500 hidden lg:block">
                  <img src={cms.hero_image_mobile} alt="App no Celular" className="w-full h-auto rounded-2xl border border-white/20" />
                </div>
              )}
              <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10 z-10">
                <img
                  src={cms.hero_image_desktop || APP_SCREENSHOTS[activeScreenshot]}
                  alt="Freedom App"
                  className="w-full h-auto object-cover transition-all duration-700 aspect-video bg-slate-900"
                  style={{ minHeight: 300 }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 to-transparent pointer-events-none" />
                {cms.hero_video_url && (
                  <button
                    onClick={() => setShowVideo(true)}
                    className="absolute inset-0 flex items-center justify-center group"
                  >
                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm border border-white/40 flex items-center justify-center group-hover:scale-110 transition-transform shadow-xl">
                      <Play className="w-7 h-7 text-white fill-white ml-1" />
                    </div>
                  </button>
                )}
              </div>

              {!cms.hero_video_url && (
                <div className="mt-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 flex items-center gap-3 text-slate-400 text-sm">
                  <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                    <Play className="w-5 h-5" />
                  </div>
                  <span>Adicione a URL do vídeo no CMS para exibir aqui</span>
                </div>
              )}

              <div className="flex justify-center gap-2 mt-4">
                {APP_SCREENSHOTS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveScreenshot(i)}
                    className={`rounded-full transition-all ${i === activeScreenshot ? 'w-6 h-2 bg-emerald-400' : 'w-2 h-2 bg-white/30 hover:bg-white/50'}`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 mt-16 pt-10 border-t border-white/10 max-w-lg">
            {[
              { n: cms.hero_stat1_n, l: cms.hero_stat1_l },
              { n: cms.hero_stat2_n, l: cms.hero_stat2_l },
              { n: cms.hero_stat3_n, l: cms.hero_stat3_l },
            ].map((s) => (
              <div key={s.l}>
                <p className="text-3xl font-black text-emerald-400">{s.n}</p>
                <p className="text-slate-400 text-sm mt-1">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROBLEMA / DOR ──────────────────────────────────── */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-slate-900 mb-4">{cms.problema_titulo}</h2>
            <p className="text-slate-500 text-lg">{cms.problema_subtitulo}</p>
          </div>
          <div className={`flex flex-col gap-12 mb-16 items-center ${cms.problema_image ? 'lg:flex-row' : ''}`}>
            <div className={`grid gap-6 w-full ${cms.problema_image ? 'md:grid-cols-1 lg:grid-cols-2 lg:w-2/3' : 'md:grid-cols-3'}`}>
              {[
                { emoji: '😰', t: '"Não sei para onde vai o meu dinheiro"', d: 'Fim do mês chega e o saldo está negativo, mas você não sabe onde gastou.' },
                { emoji: '💳', t: '"Minhas dívidas só crescem"', d: 'Paga o mínimo do cartão, paga empréstimo, e no final não sobra nada.' },
                { emoji: '🎯', t: '"Nunca consigo juntar dinheiro"', d: 'Tem um objetivo mas sempre aparece um imprevisto que compromete as economias.' },
              ].map((p) => (
                <div key={p.t} className="bg-white rounded-2xl p-6 shadow-sm border-2 border-red-100 text-left hover:shadow-lg transition-shadow">
                  <div className="text-5xl mb-4">{p.emoji}</div>
                  <h3 className="font-bold text-slate-800 mb-2 text-lg">{p.t}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{p.d}</p>
                </div>
              ))}
            </div>
            {cms.problema_image && (
              <div className="w-full lg:w-1/3 flex justify-center">
                <img src={cms.problema_image} alt="Ilustração do problema" className="w-full max-w-sm h-auto object-contain rounded-2xl drop-shadow-2xl mix-blend-multiply" />
              </div>
            )}
          </div>
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-3xl p-10 text-white text-center shadow-2xl shadow-emerald-500/20">
            <Zap className="w-14 h-14 mx-auto mb-5 text-yellow-300" />
            <h3 className="text-3xl font-black mb-4">O Freedom resolve tudo isso</h3>
            <p className="text-emerald-100 text-xl max-w-2xl mx-auto leading-relaxed">
              Em menos de 10 minutos por semana, você tem controle total da sua vida financeira.
              Nossa metodologia já ajudou mais de 2.400 famílias a saírem do vermelho.
            </p>
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────── */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-slate-900 mb-4">{cms.features_titulo}</h2>
            <p className="text-slate-500 text-lg">{cms.features_subtitulo}</p>
          </div>

          <div className="space-y-24 mb-16">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 text-sm font-semibold px-4 py-2 rounded-full mb-6">
                  <BarChart3 className="w-4 h-4" /> Dashboard
                </div>
                <h3 className="text-3xl font-black text-slate-900 mb-4">Sua vida financeira em um só lugar</h3>
                <p className="text-slate-500 text-lg leading-relaxed mb-6">
                  Veja receitas, despesas, saldo, dívidas e investimentos num painel intuitivo. Tome decisões com dados reais, não com chutes.
                </p>
                <ul className="space-y-3">
                  {['DRE mensal completo', 'Gráficos de despesas por categoria', 'Alertas inteligentes de orçamento', 'Resumo de patrimônio líquido'].map(f => (
                    <li key={f} className="flex items-center gap-3 text-slate-700">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl overflow-hidden shadow-2xl border border-slate-100">
                <img src={APP_SCREENSHOTS[0]} alt="Dashboard Freedom" className="w-full h-auto" />
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="order-2 lg:order-1 rounded-2xl overflow-hidden shadow-2xl border border-slate-100">
                <img src={APP_SCREENSHOTS[4]} alt="Orçamento Freedom" className="w-full h-auto" />
              </div>
              <div className="order-1 lg:order-2">
                <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 text-sm font-semibold px-4 py-2 rounded-full mb-6">
                  <Target className="w-4 h-4" /> Orçamento
                </div>
                <h3 className="text-3xl font-black text-slate-900 mb-4">Orçamento por categoria com % da renda</h3>
                <p className="text-slate-500 text-lg leading-relaxed mb-6">
                  Defina quanto gastar em cada categoria — em valor fixo ou percentual da renda. Veja em tempo real onde está gastando demais.
                </p>
                <ul className="space-y-3">
                  {['Orçamento por valor fixo ou % da renda', 'Barras de progresso coloridas por categoria', 'Alertas ao atingir 80% do limite', 'Comparativo orçado vs. gasto'].map(f => (
                    <li key={f} className="flex items-center gap-3 text-slate-700">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 bg-purple-50 text-purple-700 text-sm font-semibold px-4 py-2 rounded-full mb-6">
                  <PiggyBank className="w-4 h-4" /> Caixinhas
                </div>
                <h3 className="text-3xl font-black text-slate-900 mb-4">Invista com objetivo e veja crescer</h3>
                <p className="text-slate-500 text-lg leading-relaxed mb-6">
                  Crie caixinhas para cada sonho: viagem, carro, emergência, reforma. Acompanhe o saldo crescendo com rendimento configurável.
                </p>
                <ul className="space-y-3">
                  {['Múltiplas caixinhas por objetivo', 'Rendimento por CDI ou taxa mensal', 'Projeção de 12 meses', 'Histórico completo de aportes'].map(f => (
                    <li key={f} className="flex items-center gap-3 text-slate-700">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl overflow-hidden shadow-2xl border border-slate-100">
                <img src={APP_SCREENSHOTS[5]} alt="Caixinhas Freedom" className="w-full h-auto" />
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES_PRINCIPAIS.map(({ icon: Icon, titulo, desc }) => (
              <div key={titulo} className="group p-6 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:shadow-lg transition-all bg-slate-50 hover:bg-white">
                <div className="w-12 h-12 bg-emerald-100 group-hover:bg-emerald-200 rounded-xl flex items-center justify-center mb-4 transition-colors">
                  <Icon className="w-6 h-6 text-emerald-700" />
                </div>
                <h3 className="font-bold text-slate-900 mb-2 text-lg">{titulo}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PROVA SOCIAL ──────────────────────────────────── */}
      <section className="py-16 bg-emerald-600 text-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { n: cms.hero_stat1_n, l: cms.hero_stat1_l },
              { n: cms.hero_stat2_n, l: cms.hero_stat2_l },
              { n: cms.hero_stat3_n, l: cms.hero_stat3_l },
              { n: '< 10min', l: 'por semana para organizar' },
            ].map((s) => (
              <div key={s.l}>
                <p className="text-4xl font-black text-white mb-1">{s.n}</p>
                <p className="text-emerald-100 text-sm">{s.l}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEPOIMENTOS ─────────────────────────────────────── */}
      <section id="depoimentos" className="py-24 bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black mb-4">{cms.depoimentos_titulo}</h2>
            <p className="text-slate-400 text-lg">{cms.depoimentos_subtitulo}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {depoimentos.map((d, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-7 backdrop-blur-sm hover:bg-white/10 transition-colors">
                <div className="flex mb-5">
                  {Array.from({ length: d.estrelas || 5 }).map((_, j) => (
                    <Star key={j} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-slate-300 leading-relaxed mb-6 text-sm">"{d.texto}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center font-bold text-sm">
                    {d.nome?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-bold text-white">{d.nome}</p>
                    <p className="text-slate-400 text-xs">{d.cargo}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── PLANOS ──────────────────────────────────────────── */}
      <section id="planos" className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-black text-slate-900 mb-4">{cms.planos_titulo}</h2>
            <p className="text-slate-500 text-lg">{cms.planos_subtitulo}</p>
          </div>

          {loadingPlans ? (
            <div className="flex justify-center py-16">
              <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
            </div>
          ) : sortedPlans.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <p className="text-lg">Planos sendo configurados. Volte em breve!</p>
            </div>
          ) : (
            <div className={`grid gap-8 justify-center ${sortedPlans.length === 1 ? 'max-w-sm mx-auto' : sortedPlans.length === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-3xl mx-auto' : 'grid-cols-1 md:grid-cols-3'}`}>
              {sortedPlans.map((plan) => {
                const features = plan.features ? plan.features.split(',').map(f => f.trim()).filter(Boolean) : [];
                const isLoading = loadingPlanId === plan.id;
                return (
                  <div
                    key={plan.id}
                    className={`relative rounded-3xl p-8 border-2 flex flex-col transition-all ${
                      plan.destaque
                        ? 'border-emerald-500 shadow-2xl shadow-emerald-500/20 scale-105 bg-gradient-to-b from-emerald-50 to-white'
                        : 'border-slate-200 bg-white hover:border-emerald-200 hover:shadow-xl'
                    }`}
                  >
                    {plan.badge && (
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                        <Badge className="bg-emerald-500 text-white font-bold px-4 py-1.5 text-sm shadow-lg rounded-full">
                          {plan.badge}
                        </Badge>
                      </div>
                    )}

                    <div className="mb-6">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: (plan.cor || '#10B981') + '20' }}>
                        <Zap className="w-6 h-6" style={{ color: plan.cor || '#10B981' }} />
                      </div>
                      <h3 className="text-2xl font-black text-slate-900 mb-2">{plan.nome}</h3>
                      {plan.descricao && <p className="text-slate-500 text-sm">{plan.descricao}</p>}
                    </div>

                    <div className="mb-6">
                      {plan.preco_original && plan.preco_original > plan.preco && (
                        <p className="text-slate-400 line-through text-sm mb-1">{fmt(plan.preco_original, plan.tipo)}</p>
                      )}
                      <p className="text-4xl font-black text-slate-900">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(plan.preco || 0)}
                        <span className="text-base font-normal text-slate-400 ml-1">
                          {plan.tipo === 'MENSAL' ? '/mês' : plan.tipo === 'ANUAL' ? '/ano' : ' único'}
                        </span>
                      </p>
                      {plan.tipo === 'ANUAL' && plan.preco && (
                        <p className="text-emerald-600 text-sm font-medium mt-1">
                          ≈ {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(plan.preco / 12)}/mês
                        </p>
                      )}
                    </div>

                    <ul className="space-y-3 mb-8 flex-1">
                      {features.map((f) => (
                        <li key={f} className="flex items-start gap-3 text-sm text-slate-700">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                      {plan.limite_familias && (
                        <li className="flex items-start gap-3 text-sm text-slate-700">
                          <Users className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                          <span>{plan.limite_familias === 1 ? '1 família' : `Até ${plan.limite_familias} famílias`}</span>
                        </li>
                      )}
                    </ul>

                    {plan.upsell_texto && (
                      <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                        ⚡ {plan.upsell_texto}
                      </div>
                    )}

                    <Button
                      size="lg"
                      className={`w-full font-bold py-6 rounded-2xl text-base ${
                        plan.destaque
                          ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/30'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                      onClick={() => handleCheckout(plan)}
                      disabled={isLoading || !plan.stripe_price_id}
                    >
                      {isLoading ? (
                        <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Aguarde...</>
                      ) : !plan.stripe_price_id ? (
                        'Em breve'
                      ) : (
                        <>Começar agora <ArrowRight className="ml-2 w-4 h-4" /></>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-14 text-center">
            <div className="flex flex-wrap justify-center gap-8 text-slate-500 text-sm">
              <span className="flex items-center gap-2"><Shield className="w-4 h-4 text-emerald-500" /> Pagamento 100% seguro via Stripe</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Cancele quando quiser</span>
              <span className="flex items-center gap-2"><Zap className="w-4 h-4 text-emerald-500" /> Acesso imediato após o pagamento</span>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────── */}
      <section id="faq" className="py-24 bg-slate-50">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="text-4xl font-black text-slate-900 text-center mb-16">{cms.faq_titulo}</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <button
                  className="w-full flex items-center justify-between p-6 text-left hover:bg-slate-50 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-semibold text-slate-900 pr-4">{faq.p}</span>
                  {openFaq === i ? (
                    <ChevronUp className="w-5 h-5 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-slate-400 flex-shrink-0" />
                  )}
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-6 text-slate-600 leading-relaxed border-t border-slate-100 pt-4">{faq.r}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA FINAL ───────────────────────────────────────── */}
      <section className="py-24 relative overflow-hidden bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white text-center">
        <div className="absolute inset-0 opacity-30" style={{backgroundImage: 'radial-gradient(circle at 50% 50%, #10b981 0%, transparent 60%)'}} />
        <div className="relative max-w-3xl mx-auto px-6">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-8">
            <Zap className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-4xl md:text-6xl font-black mb-6 leading-tight">{cms.cta_final_titulo}</h2>
          <p className="text-emerald-200 text-xl mb-10 leading-relaxed">{cms.cta_final_subtitulo}</p>
          <Button
            size="lg"
            className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xl px-14 py-8 rounded-2xl shadow-2xl shadow-emerald-500/30"
            onClick={() => document.getElementById('planos').scrollIntoView({ behavior: 'smooth' })}
          >
            {cms.cta_final_btn} <ArrowRight className="ml-3 w-6 h-6" />
          </Button>
          <p className="mt-6 text-emerald-300 text-sm">Sem riscos. Cancele quando quiser.</p>

          <div className="flex flex-wrap justify-center gap-6 mt-12 text-sm text-slate-400">
            <span className="flex items-center gap-2"><Shield className="w-4 h-4 text-emerald-400" /> SSL 256-bit</span>
            <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Stripe Secured</span>
            <span className="flex items-center gap-2"><Users className="w-4 h-4 text-emerald-400" /> 2.400+ famílias</span>
            <span className="flex items-center gap-2"><Star className="w-4 h-4 text-yellow-400 fill-yellow-400" /> Avaliação 4.9</span>
          </div>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="bg-slate-950 text-slate-400 py-12">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
                <span className="text-white font-bold">F</span>
              </div>
              <span className="text-white font-bold text-lg">Freedom</span>
            </div>
            <div className="flex gap-6 text-sm">
              <a href="#features" className="hover:text-white transition-colors">Funcionalidades</a>
              <a href="#planos" className="hover:text-white transition-colors">Planos</a>
              <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
            <p>{cms.footer_texto}</p>
            <p className="text-xs">Pagamentos processados com segurança pelo Stripe.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}