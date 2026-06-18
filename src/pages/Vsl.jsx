import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { useNavigate } from 'react-router-dom';
import { Loader2, ShieldCheck, HeartHandshake, Clock, Users, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// Helper to render video from URL or Iframe string
const VideoPlayer = ({ urlOrIframe }) => {
  if (!urlOrIframe) return null;
  
  // If it's already an iframe string
  if (urlOrIframe.trim().startsWith('<iframe')) {
    return <div className="video-container" dangerouslySetInnerHTML={{ __html: urlOrIframe }} />;
  }

  // If it's a YouTube URL
  let embedUrl = urlOrIframe;
  if (urlOrIframe.includes('youtube.com/watch?v=')) {
    const videoId = new URLSearchParams(new URL(urlOrIframe).search).get('v');
    embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&disablekb=1&modestbranding=1&rel=0`;
  } else if (urlOrIframe.includes('youtu.be/')) {
    const videoId = urlOrIframe.split('youtu.be/')[1].split('?')[0];
    embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&disablekb=1&modestbranding=1&rel=0`;
  } else if (urlOrIframe.includes('vimeo.com/')) {
    const videoId = urlOrIframe.split('vimeo.com/')[1].split('?')[0];
    embedUrl = `https://player.vimeo.com/video/${videoId}?autoplay=1&background=1&muted=0`; // For vimeo background=1 hides controls, or controls=0. Actually controls=0 is better. Let's use controls=0.
    embedUrl = `https://player.vimeo.com/video/${videoId}?autoplay=1&controls=0&title=0&byline=0&portrait=0`;
  }

  return (
    <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-2xl">
      <iframe 
        src={embedUrl} 
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
        allowFullScreen
        className="absolute inset-0 w-full h-full"
      ></iframe>
    </div>
  );
};

export default function Vsl() {
  const navigate = useNavigate();
  const [timeLeft, setTimeLeft] = useState(null);
  const [viewers, setViewers] = useState(1342);
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [hasCommented, setHasCommented] = useState(false);
  const [loadingPlan, setLoadingPlan] = useState(null);

  // Fetch Current User
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => apiClient.auth.me(),
    retry: false
  });

  // Fetch VSL Config
  const { data: vslData, isLoading: isLoadingVsl } = useQuery({
    queryKey: ['vsl-cms'],
    queryFn: () => apiClient.entities.VslCms.list(),
  });
  
  const vslConfig = vslData?.[0] || {};

  // Fetch Plans
  const { data: plansData, isLoading: isLoadingPlans } = useQuery({
    queryKey: ['plans'],
    queryFn: () => apiClient.entities.Plan.list(),
  });
  
  const activePlans = (plansData || [])
    .filter(p => p.ativo)
    .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

  // Countdown Logic
  useEffect(() => {
    if (!vslConfig.countdown_end_date) return;
    
    const endDate = new Date(vslConfig.countdown_end_date).getTime();
    
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = endDate - now;
      
      if (distance <= 0) {
        clearInterval(interval);
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0 });
        if (vslConfig.redirect_url) {
           window.location.href = vslConfig.redirect_url;
        }
      } else {
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        setTimeLeft({ hours, minutes, seconds });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [vslConfig.countdown_end_date, vslConfig.redirect_url]);

  // Fake Viewers Logic
  useEffect(() => {
    const baseViewers = Math.floor(Math.random() * 50) + 1200;
    setViewers(baseViewers);
    
    const interval = setInterval(() => {
      setViewers(prev => prev + (Math.floor(Math.random() * 5) - 2)); // Float by -2 to +2
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Fake Comments Logic (24h memory)
  useEffect(() => {
    const STORAGE_KEY = 'vsl_comments_state';
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
    
    const allCommentsPool = [
      { name: "Maria Clara", text: "Isso mudou a forma como eu vejo minhas finanças, incrível!", time: "Agora mesmo" },
      { name: "João Pedro", text: "Cara, o Freedom é exatamente o que eu estava procurando.", time: "1 min atrás" },
      { name: "Ana Beatriz", text: "As caixinhas me ajudaram a juntar pro meu carro. Gratidão 🙏", time: "2 min atrás" },
      { name: "Carlos Eduardo", text: "Já tentei outras planilhas, mas isso aqui é outro nível.", time: "3 min atrás" },
      { name: "Fernanda Lima", text: "Recomendo muito. O suporte é rápido e resolve de verdade.", time: "5 min atrás" },
      { name: "Lucas Mendes", text: "Meu casamento melhorou 100% depois que começamos a usar o app juntos.", time: "7 min atrás" },
      { name: "Juliana Silva", text: "Muito fácil de usar, parabéns aos criadores!", time: "8 min atrás" },
      { name: "Rafael Costa", text: "Gente, a funcionalidade do WhatsApp é surreal. Amo!", time: "10 min atrás" },
      { name: "Patrícia Alves", text: "Apoiar o Wise Madness é um diferencial lindo. Contem comigo.", time: "12 min atrás" },
      { name: "Ricardo Santos", text: "Melhor investimento que já fiz para minha família.", time: "15 min atrás" },
    ];

    let savedState = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) savedState = JSON.parse(raw);
    } catch(e) {}

    const now = Date.now();

    if (savedState && (now - savedState.timestamp < TWENTY_FOUR_HOURS)) {
      // Use saved comments
      setComments(savedState.comments);
    } else {
      // Generate new subset of comments
      const shuffled = [...allCommentsPool].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 4);
      setComments(selected);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ timestamp: now, comments: selected }));
    }

    // Add new comments dynamically
    const interval = setInterval(() => {
      setComments(prev => {
        if(prev.length > 6) return prev; // Keep max 6 comments on screen
        const unused = allCommentsPool.filter(c => !prev.find(p => p.name === c.name));
        if(unused.length === 0) return prev;
        const nextComment = unused[Math.floor(Math.random() * unused.length)];
        const newComments = [nextComment, ...prev];
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ timestamp: Date.now(), comments: newComments }));
        return newComments;
      });
    }, 15000); // Every 15 seconds a new comment pops up

    return () => clearInterval(interval);
  }, []);

  const handleAddComment = (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    
    const myComment = {
      name: "Você",
      text: newComment,
      time: "Agora mesmo"
    };
    
    const STORAGE_KEY = 'vsl_comments_state';
    setComments(prev => {
      const updated = [myComment, ...prev];
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ timestamp: Date.now(), comments: updated }));
      return updated;
    });
    setNewComment('');
    setHasCommented(true);
    
    // Simulate someone reading and hide the "You commented" after a while if desired,
    // but usually it's fine to just leave it in the feed.
  };

  const handleSelectPlan = async (plan) => {
    if (!user) {
      navigate(`/register?plan=${plan.id}`);
      return;
    }

    const interval = plan.tipo?.toLowerCase() === 'anual' ? 'year' : 'month';
    const priceId = interval === 'year' ? plan.stripe_price_id_anual : plan.stripe_price_id_mensal;
    
    if (!priceId) {
      toast.error('Este plano não está disponível para compra ainda.');
      return;
    }

    setLoadingPlan(plan.id);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify({ plan_id: plan.id, interval })
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.message || 'Erro ao iniciar pagamento.');
      }
    } catch (e) {
      toast.error('Erro de conexão');
    } finally {
      setLoadingPlan(null);
    }
  };

  if (isLoadingVsl || isLoadingPlans) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30">
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 md:py-12 space-y-20">
        
        {/* HERO E VÍDEO */}
        <section className="space-y-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-semibold mb-4 animate-pulse">
            <div className="w-2 h-2 rounded-full bg-red-500"></div>
            AULA AO VIVO LIBERADA
          </div>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-white tracking-tight leading-tight">
            Descubra o método exato para organizar as <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-500">finanças da sua família</span> hoje.
          </h1>
          
          <div className="flex items-center justify-center gap-2 text-slate-400 font-medium">
            <Users className="w-5 h-5 text-emerald-500" />
            <span className="text-white font-bold">{viewers.toLocaleString()}</span> pessoas assistindo agora
          </div>

          <div className="max-w-4xl mx-auto mt-8 relative">
            <VideoPlayer urlOrIframe={vslConfig.video_url} />
          </div>
          
          {/* USER COMMENT INPUT E FEED */}
          <div className="max-w-2xl mx-auto mt-12 bg-slate-900/50 p-4 md:p-6 rounded-2xl border border-slate-800 backdrop-blur-sm text-left">
            <h3 className="text-white font-bold mb-6 flex items-center gap-2 text-lg">
              <MessageSquare className="w-5 h-5 text-emerald-500" />
              Comentários ao vivo
            </h3>

            {/* FEED DE COMENTÁRIOS (exibindo até 6) */}
            <div className="flex flex-col gap-4 mb-6">
              {comments.slice(0, 6).map((comment, i) => (
                <div key={i} className="bg-slate-950/50 p-4 rounded-xl border border-slate-800 flex gap-3 text-left animate-in slide-in-from-bottom-2 fade-in duration-300">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold shrink-0">
                    {comment.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-white">{comment.name}</p>
                      <span className="text-[10px] text-slate-500">{comment.time}</span>
                    </div>
                    <p className="text-sm text-slate-300 mt-1">{comment.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-slate-800 pt-6">
            {!hasCommented ? (
              <form onSubmit={handleAddComment} className="flex flex-col gap-3">
                <textarea 
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 resize-none h-20"
                  placeholder="O que você está achando da aula?"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  maxLength={150}
                ></textarea>
                <div className="flex justify-end">
                  <Button type="submit" size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg px-6">
                    Enviar
                  </Button>
                </div>
              </form>
            ) : (
              <div className="text-center py-6 text-emerald-400 font-medium bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                Obrigado pelo seu comentário! 🎉
              </div>
            )}
          </div>
        </section>

        {/* COUNTDOWN E OFERTA */}
        {timeLeft && (
          <section className="bg-gradient-to-b from-slate-900 to-slate-950 rounded-3xl p-8 md:p-12 border border-slate-800 shadow-2xl text-center max-w-4xl mx-auto transform hover:scale-[1.01] transition-transform">
            <div className="mb-8">
              <h2 className="text-2xl md:text-3xl font-black text-white mb-2">Esta oferta encerra em breve</h2>
              <p className="text-slate-400">Garanta seu acesso antes que o cronômetro zere.</p>
            </div>
            
            <div className="flex justify-center gap-4 md:gap-8 mb-12">
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 md:w-24 md:h-24 bg-slate-800 rounded-2xl flex items-center justify-center text-4xl md:text-5xl font-black text-emerald-400 shadow-inner">
                  {String(timeLeft.hours).padStart(2, '0')}
                </div>
                <span className="text-xs text-slate-500 font-bold uppercase mt-3 tracking-widest">Horas</span>
              </div>
              <div className="text-4xl md:text-5xl font-black text-slate-700 mt-4 md:mt-6">:</div>
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 md:w-24 md:h-24 bg-slate-800 rounded-2xl flex items-center justify-center text-4xl md:text-5xl font-black text-emerald-400 shadow-inner">
                  {String(timeLeft.minutes).padStart(2, '0')}
                </div>
                <span className="text-xs text-slate-500 font-bold uppercase mt-3 tracking-widest">Minutos</span>
              </div>
              <div className="text-4xl md:text-5xl font-black text-slate-700 mt-4 md:mt-6">:</div>
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 md:w-24 md:h-24 bg-slate-800 rounded-2xl flex items-center justify-center text-4xl md:text-5xl font-black text-red-400 shadow-inner animate-pulse">
                  {String(timeLeft.seconds).padStart(2, '0')}
                </div>
                <span className="text-xs text-slate-500 font-bold uppercase mt-3 tracking-widest">Segundos</span>
              </div>
            </div>

            {/* PLANOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 max-w-3xl mx-auto text-left">
              {activePlans.map(plan => (
                <div key={plan.id} className={`bg-slate-900 border rounded-2xl p-6 relative flex flex-col h-full ${plan.destaque ? 'border-emerald-500 shadow-lg shadow-emerald-500/20' : 'border-slate-700'}`}>
                  {plan.badge && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      {plan.badge}
                    </div>
                  )}
                  <h3 className="text-xl font-bold text-white mb-2">{plan.nome}</h3>
                  <div className="flex items-baseline gap-2 mb-4">
                    <span className="text-4xl font-black text-emerald-400">R$ {plan.preco}</span>
                    <span className="text-slate-400 text-sm">/{plan.tipo.toLowerCase()}</span>
                  </div>
                  {plan.descricao && <p className="text-sm text-slate-400 mb-6 flex-1">{plan.descricao}</p>}
                  
                  <ul className="space-y-3 mb-8">
                    {(plan.features || '').split(',').map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-slate-300">
                        <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0" />
                        {f.trim()}
                      </li>
                    ))}
                  </ul>

                  <Button 
                    className={`w-full py-6 text-lg font-bold rounded-xl mt-auto flex items-center justify-center ${plan.destaque ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-white'}`}
                    onClick={() => handleSelectPlan(plan)}
                    disabled={loadingPlan === plan.id}
                  >
                    {loadingPlan === plan.id ? <Loader2 className="w-5 h-5 animate-spin" /> : `Assinar ${plan.nome}`}
                  </Button>
                </div>
              ))}
            </div>

            {/* GARANTIAS REFORÇADAS */}
            <div className="mt-12 flex flex-col md:flex-row items-center justify-center gap-6 text-sm text-slate-400">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-500" />
                <span><strong>Cancelamento a qualquer momento.</strong> Sem fidelidade anual.</span>
              </div>
              <div className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-emerald-500" />
                <span><strong>Suporte 100% humanizado</strong> no plano Pro.</span>
              </div>
            </div>
          </section>
        )}

        {/* INSTITUTO WISE MADNESS */}
        <section className="max-w-4xl mx-auto text-center py-12 border-t border-slate-800">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-500/10 mb-6">
            <HeartHandshake className="w-8 h-8 text-rose-500" />
          </div>
          <h2 className="text-3xl font-black text-white mb-6">
            Nós apoiamos o <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-orange-400">Instituto Wise Madness</span>
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Ao assinar o Freedom, você não apenas transforma a vida financeira da sua família, mas também <strong>ajuda diretamente uma causa social com muita força</strong>. Parte do nosso sucesso é destinado ao Instituto Wise Madness, apoiando crianças e jovens que precisam.
          </p>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-800/50 bg-slate-900/30 py-8 text-center text-sm text-slate-500">
        <div className="max-w-4xl mx-auto px-4">
          <p>© {new Date().getFullYear()} Freedom Gestão Financeira. Todos os direitos reservados.</p>
          <div className="flex items-center justify-center gap-4 mt-4 text-xs">
            <a href="#" className="hover:text-slate-300 transition-colors">Termos de Uso</a>
            <a href="#" className="hover:text-slate-300 transition-colors">Política de Privacidade</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
