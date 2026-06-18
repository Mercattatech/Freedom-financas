import { useState, useEffect, useRef, useCallback } from 'react';
import { apiClient } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2, Save, Eye, ChevronDown, ChevronRight,
  Upload, X, Image, MessageSquare, Home, BarChart3,
  Users, Heart, DollarSign, HelpCircle, Star, Info,
  Building2, Camera, Globe
} from 'lucide-react';
import { toast } from 'sonner';
import { DEFAULT_CMS_CONTENT } from '@/pages/LandingPage';

// ─── IMAGE UPLOAD ────────────────────────────────────────────────────────────
function compressImage(file, maxWidth = 1400, quality = 0.82) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function ImageUpload({ label, value, onChange, hint, sizeHint, aspectRatio = '16/9' }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) {
      toast.error('Apenas imagens são aceitas');
      return;
    }
    setLoading(true);
    try {
      const compressed = await compressImage(file);
      const kb = Math.round(compressed.length * 0.75 / 1024);
      onChange(compressed);
      toast.success(`Imagem carregada (${kb}KB comprimida)`);
    } catch { toast.error('Erro ao processar imagem'); }
    finally { setLoading(false); }
  };

  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, []);

  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">{label}</label>
      {sizeHint && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-800/40 rounded-lg px-2.5 py-1.5 mb-1">
          <Info className="w-3 h-3 text-emerald-600 flex-shrink-0" />
          <span>Tamanho ideal: <strong className="text-slate-400">{sizeHint}</strong></span>
        </div>
      )}
      <div
        className={`relative border-2 border-dashed rounded-xl transition-all cursor-pointer overflow-hidden ${dragging ? 'border-emerald-500 bg-emerald-950/20' : 'border-slate-700 hover:border-slate-600 bg-slate-800/30'}`}
        style={{ aspectRatio: value ? undefined : aspectRatio, minHeight: value ? 'auto' : 120 }}
        onClick={() => inputRef.current?.click()}
        onDrop={onDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
      >
        {loading && (
          <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-10">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
          </div>
        )}
        {value ? (
          <div className="relative group">
            <img src={value} alt="Preview" className="w-full h-auto block rounded-xl" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3 rounded-xl">
              <button
                onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
                className="bg-emerald-500 text-black rounded-lg px-3 py-2 text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-400"
              >
                <Upload className="w-3.5 h-3.5" /> Trocar
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onChange(''); }}
                className="bg-slate-700 text-white rounded-lg px-3 py-2 text-xs font-bold flex items-center gap-1.5 hover:bg-red-700"
              >
                <X className="w-3.5 h-3.5" /> Remover
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
            <Image className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-sm text-slate-500 font-medium">Clique ou arraste a imagem</p>
            <p className="text-xs text-slate-600 mt-1">JPG, PNG, WEBP · Máx. 10MB</p>
          </div>
        )}
      </div>
      {hint && <p className="text-xs text-slate-600 leading-relaxed">{hint}</p>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
    </div>
  );
}

// ─── SECTION WRAPPER ─────────────────────────────────────────────────────────
function Section({ id, title, icon: Icon, iconColor = 'text-emerald-500', children, defaultOpen = false, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 sm:px-6 py-4 hover:bg-slate-800/40 transition-colors text-left"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {Icon && <Icon className={`w-4 h-4 ${iconColor} flex-shrink-0`} />}
          <h3 className="font-bold text-white text-sm">{title}</h3>
          {badge && <span className="text-xs bg-emerald-900/50 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-800/50 ml-1 flex-shrink-0">{badge}</span>}
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-slate-500 flex-shrink-0 ml-2" /> : <ChevronRight className="w-4 h-4 text-slate-500 flex-shrink-0 ml-2" />}
      </button>
      {open && (
        <div className="px-4 sm:px-6 pb-6 border-t border-slate-800">
          <div className="pt-5 space-y-5">{children}</div>
        </div>
      )}
    </div>
  );
}

// ─── FIELD ────────────────────────────────────────────────────────────────────
function Field({ label, value, onChange, placeholder, multiline, hint, rows = 3 }) {
  return (
    <div className="space-y-1.5">
      {label && <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">{label}</label>}
      {multiline ? (
        <textarea
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full rounded-xl border border-slate-700 bg-slate-800/60 text-white p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
        />
      ) : (
        <Input
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-600 rounded-xl"
        />
      )}
      {hint && <p className="text-xs text-slate-600 leading-relaxed">{hint}</p>}
    </div>
  );
}

// ─── GRID ────────────────────────────────────────────────────────────────────
function Grid({ children, cols = 2 }) {
  return (
    <div className={`grid gap-4 grid-cols-1 ${cols === 2 ? 'sm:grid-cols-2' : cols === 3 ? 'sm:grid-cols-3' : ''}`}>
      {children}
    </div>
  );
}

// ─── DIVIDER ─────────────────────────────────────────────────────────────────
function Divider({ label }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="h-px bg-slate-800 flex-1" />
      <span className="text-xs text-slate-600 font-semibold uppercase tracking-wider">{label}</span>
      <div className="h-px bg-slate-800 flex-1" />
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
export default function AdminCMS() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data: cmsData, isLoading } = useQuery({
    queryKey: ['LandingCMS'],
    queryFn: () => apiClient.entities.LandingCMS.list(),
  });

  useEffect(() => {
    if (cmsData !== undefined && !form) {
      const stored = cmsData?.[0]?.content;
      setForm(stored ? mergeDeep(DEFAULT_CMS_CONTENT, stored) : { ...DEFAULT_CMS_CONTENT });
    }
  }, [cmsData]);

  const saveMutation = useMutation({
    mutationFn: async (content) => {
      const existing = cmsData?.[0];
      const payload = { content };
      if (existing?.id) return apiClient.entities.LandingCMS.update(existing.id, payload);
      return apiClient.entities.LandingCMS.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['LandingCMS'] });
      toast.success('Landing page salva com sucesso!');
      setSaving(false);
    },
    onError: (e) => { toast.error('Erro: ' + e.message); setSaving(false); },
  });

  const handleSave = () => {
    setSaving(true);
    saveMutation.mutate(form);
  };

  // Helper: deeply set a nested path
  const set = (path, value) => {
    setForm(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) {
        if (obj[keys[i]] === undefined) obj[keys[i]] = {};
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  };

  // Helper: set array item
  const setArr = (path, index, subKey, value) => {
    setForm(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = next;
      for (const k of keys) obj = obj[k];
      obj[index][subKey] = value;
      return next;
    });
  };

  if (isLoading || !form) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Sticky Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between sticky top-0 z-10 bg-slate-950/90 backdrop-blur-sm py-3 -mx-1 px-1">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-white">Editor da Landing Page</h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">Edite textos, imagens e conteúdos da página de vendas</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <a href="/" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="border-slate-700 text-slate-300 hover:bg-slate-800 rounded-xl text-xs sm:text-sm">
              <Eye className="w-3.5 h-3.5 mr-1.5" /> Ver página
            </Button>
          </a>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs sm:text-sm"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
            Salvar tudo
          </Button>
        </div>
      </div>

      {/* ── NAVBAR ── */}
      <Section id="navbar" title="Navbar / Cabeçalho" icon={Globe} defaultOpen>
        <Grid>
          <Field label="Nome da marca" value={form.navbar?.brand} onChange={v => set('navbar.brand', v)} placeholder="Freedom" />
          <Field label="Texto do botão CTA" value={form.navbar?.ctaText} onChange={v => set('navbar.ctaText', v)} placeholder="Começar Grátis" />
        </Grid>
      </Section>

      {/* ── HERO ── */}
      <Section id="hero" title="Hero (Seção inicial)" icon={Home} iconColor="text-blue-400" defaultOpen>
        <Field label="Badge / Label" value={form.hero?.label} onChange={v => set('hero.label', v)} placeholder="Gestão Financeira com IA" />
        <Field label="Título principal" value={form.hero?.headline} onChange={v => set('hero.headline', v)} placeholder="Liberdade financeira começa aqui" hint="As 2 últimas palavras ficam em verde. Ex: 'começa aqui'" />
        <Field label="Subtítulo" value={form.hero?.sub} onChange={v => set('hero.sub', v)} placeholder="Descrição..." multiline rows={2} />
        <Grid>
          <Field label="Botão primário" value={form.hero?.cta1} onChange={v => set('hero.cta1', v)} placeholder="Começar Grátis" />
          <Field label="Botão secundário" value={form.hero?.cta2} onChange={v => set('hero.cta2', v)} placeholder="Ver como funciona" />
        </Grid>
      </Section>

      {/* ── WHATSAPP ── */}
      <Section id="whatsapp" title="Seção WhatsApp Bot" icon={MessageSquare} iconColor="text-green-400">
        <Field label="Badge / Tag" value={form.whatsapp?.tag} onChange={v => set('whatsapp.tag', v)} placeholder="WhatsApp Bot" />
        <Field label="Título" value={form.whatsapp?.headline} onChange={v => set('whatsapp.headline', v)} placeholder="Lance tudo pelo WhatsApp" />
        <Field label="Descrição" value={form.whatsapp?.sub} onChange={v => set('whatsapp.sub', v)} multiline rows={2} />
        <Divider label="6 funcionalidades do bot" />
        {(form.whatsapp?.features || []).map((f, i) => (
          <div key={i} className="border border-slate-800 rounded-xl p-4 space-y-3 bg-slate-800/20">
            <p className="text-xs font-bold text-slate-500 uppercase">Funcionalidade {i + 1}</p>
            <Grid cols={3}>
              <Field label="Emoji/Ícone" value={f.icon} onChange={v => setArr('whatsapp.features', i, 'icon', v)} placeholder="💬" />
              <div className="sm:col-span-2">
                <Field label="Título" value={f.title} onChange={v => setArr('whatsapp.features', i, 'title', v)} placeholder="Lançamento rápido" />
              </div>
            </Grid>
            <Field label="Descrição" value={f.desc} onChange={v => setArr('whatsapp.features', i, 'desc', v)} placeholder="Descrição..." />
          </div>
        ))}
      </Section>

      {/* ── FEATURES ── */}
      <Section id="features" title="Seções de Funcionalidades (4)" icon={BarChart3} iconColor="text-purple-400">
        {(form.features || []).map((feat, i) => (
          <div key={i} className="border border-slate-800 rounded-xl p-4 space-y-3 bg-slate-800/20">
            <p className="text-xs font-bold text-emerald-600 uppercase">Seção {i + 1}: {feat.tag}</p>
            <Grid>
              <Field label="Tag/Badge" value={feat.tag} onChange={v => setArr('features', i, 'tag', v)} placeholder="Dashboard" />
              <div />
            </Grid>
            <Field label="Título" value={feat.headline} onChange={v => setArr('features', i, 'headline', v)} placeholder="Título da seção" />
            <Field label="Subtítulo" value={feat.sub} onChange={v => setArr('features', i, 'sub', v)} multiline rows={2} />
            <div>
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-2">Bullets (4 itens)</label>
              {(feat.bullets || []).map((b, j) => (
                <div key={j} className="mb-2">
                  <Input value={b} onChange={e => {
                    setForm(prev => {
                      const n = JSON.parse(JSON.stringify(prev));
                      n.features[i].bullets[j] = e.target.value;
                      return n;
                    });
                  }} placeholder={`Item ${j + 1}`} className="bg-slate-800/60 border-slate-700 text-white placeholder:text-slate-600 rounded-xl" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </Section>

      {/* ── ACTIONS ── */}
      <Section id="actions" title="Grid de 8 Ações" icon={Globe} iconColor="text-yellow-400">
        <p className="text-xs text-slate-500">8 cards que mostram o que o Freedom faz.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(form.actions || []).map((a, i) => (
            <div key={i} className="border border-slate-800 rounded-xl p-3 space-y-2 bg-slate-800/20">
              <p className="text-xs font-bold text-slate-500">Ação {i + 1}</p>
              <Grid cols={3}>
                <Field label="Emoji" value={a.icon} onChange={v => setArr('actions', i, 'icon', v)} placeholder="💸" />
                <div className="sm:col-span-2"><Field label="Título" value={a.title} onChange={v => setArr('actions', i, 'title', v)} placeholder="Registrar gasto" /></div>
              </Grid>
              <Field label="Descrição" value={a.desc} onChange={v => setArr('actions', i, 'desc', v)} placeholder="Descrição..." />
            </div>
          ))}
        </div>
      </Section>

      {/* ── INSTITUTO WISE MADNESS ── */}
      <Section id="instituto" title="Instituto Wise Madness" icon={Heart} iconColor="text-rose-400" badge="Causa Social" defaultOpen>
        <div className="p-3 bg-rose-950/20 border border-rose-900/30 rounded-xl text-xs text-rose-300 leading-relaxed">
          💡 Esta seção exibe a parceria social com o Instituto. Aqui você cadastra a instituição, suas fotos e mensagem de impacto.
        </div>

        <Divider label="Identidade da Instituição" />
        <Grid>
          <Field label="Nome da instituição" value={form.instituto?.nome} onChange={v => set('instituto.nome', v)} placeholder="Instituto Wise Madness" />
          <Field label="Tagline" value={form.instituto?.tagline} onChange={v => set('instituto.tagline', v)} placeholder="Transformando jovens através da educação" />
        </Grid>

        <Divider label="Imagens principais" />
        <Grid>
          <ImageUpload
            label="Logo da Instituição"
            value={form.instituto?.logo}
            onChange={v => set('instituto.logo', v)}
            sizeHint="400 × 400px (quadrado)"
            aspectRatio="1/1"
            hint="Logo do instituto. Exibido no hero como ícone circular. Fundo transparente (PNG) funciona melhor."
          />
          <ImageUpload
            label="Imagem do Hero (Banner principal)"
            value={form.instituto?.heroImage}
            onChange={v => set('instituto.heroImage', v)}
            sizeHint="1920 × 600px (panorâmica)"
            aspectRatio="16/5"
            hint="Imagem de fundo do banner principal da seção. Foto da instituição ou das ações sociais. Horizontal e ampla."
          />
        </Grid>
        <ImageUpload
          label="Foto principal da Instituição"
          value={form.instituto?.fotoInstituicao}
          onChange={v => set('instituto.fotoInstituicao', v)}
          sizeHint="800 × 600px (4:3)"
          aspectRatio="4/3"
          hint="Foto da fachada da escola, sala de aula ou atividade. Exibida ao lado do texto descritivo."
        />

        <Divider label="Textos descritivos" />
        <Field label="Descrição da instituição" value={form.instituto?.descricao} onChange={v => set('instituto.descricao', v)} multiline rows={3} placeholder="O Instituto Wise Madness acredita que educação financeira é o primeiro passo..." />
        <Field label="Missão" value={form.instituto?.missao} onChange={v => set('instituto.missao', v)} multiline rows={2} placeholder="Nossa missão é simples: levar conhecimento financeiro a quem mais precisa." />
        <Field label="Frase de impacto" value={form.instituto?.impactoQuote} onChange={v => set('instituto.impactoQuote', v)} multiline rows={2} placeholder="Cada assinatura Freedom doa 1% do lucro para que jovens..." hint="Use '1%' no texto — aparecerá destacado em verde." />
        <Field label="Complemento da frase de impacto" value={form.instituto?.impactoSub} onChange={v => set('instituto.impactoSub', v)} multiline rows={2} placeholder="Desde 2022, nossa parceria já transformou a vida de centenas de famílias..." />

        <Divider label="4 Estatísticas de impacto" />
        <Grid cols={2}>
          {(form.instituto?.stats || []).map((s, i) => (
            <div key={i} className="border border-slate-800 rounded-xl p-3 space-y-2 bg-slate-800/20">
              <p className="text-xs font-bold text-slate-500">Stat {i + 1}</p>
              <Field label="Número" value={s.val} onChange={v => setArr('instituto.stats', i, 'val', v)} placeholder="480+" />
              <Field label="Label" value={s.label} onChange={v => setArr('instituto.stats', i, 'label', v)} placeholder="Jovens formados" />
            </div>
          ))}
        </Grid>

        <Divider label="Galeria de Ações Sociais (4 fotos)" />
        <p className="text-xs text-slate-500">Fotos das atividades, aulas, formatura, entregas de certificado, etc.</p>
        {(form.instituto?.galeria || []).map((foto, i) => (
          <div key={i} className="border border-slate-800 rounded-xl p-4 space-y-3 bg-slate-800/20">
            <p className="text-xs font-bold text-slate-500">Foto {i + 1}{i === 0 ? ' (maior — ocupa 2 colunas)' : ''}</p>
            <ImageUpload
              label={`Foto ${i + 1}`}
              value={foto.url}
              onChange={v => setArr('instituto.galeria', i, 'url', v)}
              sizeHint={i === 0 ? "1200 × 600px (2:1, mais larga)" : "600 × 450px (4:3)"}
              aspectRatio={i === 0 ? "2/1" : "4/3"}
              hint={`Foto de uma ação social.`}
            />
            <Field label="Legenda" value={foto.caption} onChange={v => setArr('instituto.galeria', i, 'caption', v)} placeholder="Formatura do programa de educação financeira" />
          </div>
        ))}
      </Section>

      {/* ── RESULTADOS ── */}
      <Section id="results" title="Resultados / Números" icon={BarChart3} iconColor="text-cyan-400">
        <Grid>
          <Field label="Tag" value={form.results?.tag} onChange={v => set('results.tag', v)} placeholder="Resultados" />
          <Field label="Título" value={form.results?.headline} onChange={v => set('results.headline', v)} placeholder="Números que transformam vidas" />
        </Grid>
        <Divider label="4 Estatísticas" />
        <Grid cols={2}>
          {(form.results?.stats || []).map((s, i) => (
            <div key={i} className="border border-slate-800 rounded-xl p-3 space-y-2 bg-slate-800/20">
              <p className="text-xs font-bold text-slate-500">Stat {i + 1}</p>
              <Field label="Número" value={s.num} onChange={v => setArr('results.stats', i, 'num', v)} placeholder="2.400+" />
              <Field label="Label" value={s.label} onChange={v => setArr('results.stats', i, 'label', v)} placeholder="Famílias ativas" />
            </div>
          ))}
        </Grid>
      </Section>

      {/* ── DEPOIMENTOS ── */}
      <Section id="testimonials" title="Depoimentos (3)" icon={Star} iconColor="text-yellow-400">
        {(form.testimonials || []).map((t, i) => (
          <div key={i} className="border border-slate-800 rounded-xl p-4 space-y-3 bg-slate-800/20">
            <p className="text-xs font-bold text-slate-500">Depoimento {i + 1}</p>
            <Field label="Texto do depoimento" value={t.text} onChange={v => setArr('testimonials', i, 'text', v)} multiline rows={2} placeholder="O Freedom mudou nossa relação com dinheiro..." />
            <Grid cols={3}>
              <Field label="Inicial (avatar)" value={t.initial} onChange={v => setArr('testimonials', i, 'initial', v)} placeholder="A" />
              <div className="sm:col-span-2"><Field label="Nome completo" value={t.name} onChange={v => setArr('testimonials', i, 'name', v)} placeholder="Ana Paula M." /></div>
            </Grid>
            <Field label="Cargo / Cidade" value={t.role} onChange={v => setArr('testimonials', i, 'role', v)} placeholder="Mãe e empreendedora, SP" />
          </div>
        ))}
      </Section>

      {/* ── PLANOS ── */}
      <Section id="plans" title="Planos / Preços" icon={DollarSign} iconColor="text-emerald-400">
        <Grid>
          <Field label="Tag" value={form.plans?.tag} onChange={v => set('plans.tag', v)} placeholder="Planos" />
          <Field label="Título" value={form.plans?.headline} onChange={v => set('plans.headline', v)} placeholder="Simples, transparente, sem surpresas" />
        </Grid>
        <Field label="Linha de garantia" value={form.plans?.guarantee} onChange={v => set('plans.guarantee', v)} placeholder="🔒 Garantia de 7 dias · Cancele quando quiser" hint="Exibida abaixo dos cards de plano." />
        <div className="p-3 bg-slate-800/40 rounded-xl text-xs text-slate-500">
          💡 Os planos em si (preços, features) são cadastrados em <strong className="text-slate-400">Admin → Planos</strong> e integrados ao Stripe.
        </div>
      </Section>

      {/* ── SOBRE ── */}
      <Section id="about" title="Sobre a Mercatta" icon={Building2} iconColor="text-slate-400">
        <Grid>
          <Field label="Tag" value={form.about?.tag} onChange={v => set('about.tag', v)} placeholder="Sobre a Mercatta" />
          <Field label="Título" value={form.about?.headline} onChange={v => set('about.headline', v)} placeholder="Tecnologia que gera liberdade financeira" />
        </Grid>
        <Field label="Descrição" value={form.about?.sub} onChange={v => set('about.sub', v)} multiline rows={2} />
        <Divider label="4 Estatísticas da empresa" />
        <Grid cols={2}>
          {(form.about?.stats || []).map((s, i) => (
            <div key={i} className="border border-slate-800 rounded-xl p-3 space-y-2 bg-slate-800/20">
              <Field label="Label" value={s.label} onChange={v => setArr('about.stats', i, 'label', v)} placeholder="Fundação" />
              <Field label="Valor" value={s.val} onChange={v => setArr('about.stats', i, 'val', v)} placeholder="2021" />
            </div>
          ))}
        </Grid>
      </Section>

      {/* ── FAQ ── */}
      <Section id="faq" title="FAQ — Perguntas Frequentes" icon={HelpCircle} iconColor="text-orange-400">
        {(form.faq || []).map((item, i) => (
          <div key={i} className="border border-slate-800 rounded-xl p-4 space-y-3 bg-slate-800/20">
            <p className="text-xs font-bold text-slate-500">Pergunta {i + 1}</p>
            <Field label="Pergunta" value={item.q} onChange={v => setArr('faq', i, 'q', v)} placeholder="O Freedom é gratuito?" />
            <Field label="Resposta" value={item.a} onChange={v => setArr('faq', i, 'a', v)} multiline rows={2} placeholder="Resposta..." />
          </div>
        ))}
      </Section>

      {/* ── CTA FINAL ── */}
      <Section id="cta" title="CTA Final (Última seção)" icon={Home} iconColor="text-rose-400">
        <Field label="Título" value={form.cta?.headline} onChange={v => set('cta.headline', v)} placeholder="Comece hoje. É grátis." />
        <Field label="Subtítulo" value={form.cta?.sub} onChange={v => set('cta.sub', v)} multiline rows={2} />
        <Field label="Texto do botão" value={form.cta?.btn} onChange={v => set('cta.btn', v)} placeholder="Criar conta grátis" />
      </Section>

      {/* ── FOOTER ── */}
      <Section id="footer" title="Footer / Rodapé" icon={Globe} iconColor="text-slate-500">
        <Grid>
          <Field label="Nome da marca" value={form.footer?.brand} onChange={v => set('footer.brand', v)} placeholder="Freedom" />
          <Field label="Disclaimer legal" value={form.footer?.disclaimer} onChange={v => set('footer.disclaimer', v)} placeholder="© 2025 Mercatta Tech..." />
        </Grid>
        <Field label="Descrição" value={form.footer?.desc} onChange={v => set('footer.desc', v)} multiline rows={2} />
        <Divider label="Nos siga nas redes sociais" />
        <Grid>
          <Field label="Instagram (URL)" value={form.footer?.instagram} onChange={v => set('footer.instagram', v)} placeholder="https://instagram.com/seuapp" />
          <Field label="Facebook (URL)" value={form.footer?.facebook} onChange={v => set('footer.facebook', v)} placeholder="https://facebook.com/seuapp" />
        </Grid>
        <Grid>
          <Field label="YouTube (URL)" value={form.footer?.youtube} onChange={v => set('footer.youtube', v)} placeholder="https://youtube.com/@seucanal" />
          <Field label="LinkedIn (URL)" value={form.footer?.linkedin} onChange={v => set('footer.linkedin', v)} placeholder="https://linkedin.com/company/seuapp" />
        </Grid>
        <Field label="WhatsApp (URL com número)" value={form.footer?.whatsapp} onChange={v => set('footer.whatsapp', v)} placeholder="https://wa.me/5511999999999" hint="Use o formato: https://wa.me/55DDDNUMERO" />
      </Section>

      {/* ── TRACKING ── */}
      <Section id="tracking" title="Rastreamento / Analytics" icon={Globe} iconColor="text-violet-400">
        <div className="text-xs text-slate-500 mb-4 p-3 rounded-lg bg-slate-900/40 border border-slate-700/50">
          💡 Os scripts são injetados automaticamente na landing page quando os campos estiverem preenchidos.
        </div>
        <Grid>
          <Field label="Google Tag Manager (GTM ID)" value={form.tracking?.gtm} onChange={v => set('tracking.gtm', v)} placeholder="GTM-XXXXXXX" hint="Ex: GTM-AB12CD3" />
          <Field label="Google Analytics 4 (Measurement ID)" value={form.tracking?.ga4} onChange={v => set('tracking.ga4', v)} placeholder="G-XXXXXXXXXX" hint="Ex: G-AB12CD3EFG" />
        </Grid>
        <Field label="Meta Pixel ID" value={form.tracking?.metaPixel} onChange={v => set('tracking.metaPixel', v)} placeholder="1234567890123456" hint="Somente o número do Pixel. Ex: 1234567890123456" />
      </Section>

      {/* SAVE BUTTON (bottom) */}
      <div className="flex justify-end pb-8">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-8 py-3 text-sm font-bold"
        >
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar toda a landing page
        </Button>
      </div>
    </div>
  );
}

function mergeDeep(defaults, overrides) {
  const result = { ...defaults };
  for (const key of Object.keys(overrides || {})) {
    if (overrides[key] !== null && typeof overrides[key] === 'object' && !Array.isArray(overrides[key])) {
      result[key] = mergeDeep(defaults[key] || {}, overrides[key]);
    } else if (overrides[key] !== undefined && overrides[key] !== null && overrides[key] !== '') {
      result[key] = overrides[key];
    }
  }
  return result;
}
