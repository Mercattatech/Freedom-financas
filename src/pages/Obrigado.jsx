import { CheckCircle2, ArrowRight, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPageUrl } from '@/utils';

export default function Obrigado() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center px-6">
      <div className="max-w-lg w-full text-center">
        {/* Ícone de sucesso */}
        <div className="flex items-center justify-center mb-8">
          <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-emerald-400" />
          </div>
        </div>

        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow">
            <span className="text-white font-black text-lg">F</span>
          </div>
          <span className="text-xl font-black text-white">Freedom</span>
        </div>

        {/* Mensagem */}
        <h1 className="text-4xl md:text-5xl font-black text-white mb-4 leading-tight">
          Compra realizada<br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">
            com sucesso! 🎉
          </span>
        </h1>

        <p className="text-slate-300 text-lg mb-10 leading-relaxed">
          Bem-vindo ao Freedom! Sua assinatura está ativa e você já tem acesso completo à plataforma. Vamos começar sua jornada rumo à liberdade financeira!
        </p>

        {/* Checklist rápida */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 text-left space-y-3">
          {[
            'Acesso imediato à plataforma',
            'Suporte via e-mail disponível',
            'Sem limites de lançamentos',
            'Cancele quando quiser',
          ].map((item) => (
            <div key={item} className="flex items-center gap-3 text-slate-300 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>

        {/* Botão de acesso */}
        <Button
          size="lg"
          className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-lg py-7 rounded-2xl shadow-2xl shadow-emerald-500/30 mb-4"
          onClick={() => { window.location.href = createPageUrl('Dashboard'); }}
        >
          Acessar o sistema agora <ArrowRight className="ml-2 w-5 h-5" />
        </Button>

        <p className="text-slate-500 text-sm flex items-center justify-center gap-2">
          <Shield className="w-4 h-4 text-emerald-500" />
          Pagamento processado com segurança pelo Stripe
        </p>
      </div>
    </div>
  );
}