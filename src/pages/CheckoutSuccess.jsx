import React, { useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { CheckCircle, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import confetti from 'canvas-confetti';

export default function CheckoutSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sessionId = params.get('session_id');

  useEffect(() => {
    // Celebra com confetti
    const fire = () => {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#10b981', '#6366f1', '#f59e0b', '#ec4899']
      });
    };
    fire();
    const t = setTimeout(fire, 600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex items-center justify-center px-4">
      <div className="bg-slate-800/80 border border-emerald-500/30 rounded-2xl p-10 max-w-md w-full text-center shadow-2xl">
        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-10 h-10 text-emerald-400" />
        </div>

        <h1 className="text-3xl font-bold text-white mb-3">Parabéns! 🎉</h1>
        <p className="text-slate-400 mb-2">
          Sua assinatura foi ativada com sucesso.
        </p>
        <p className="text-emerald-400 font-medium mb-8">
          ✨ 7 dias de trial gratuito estão correndo — aproveite!
        </p>

        <div className="bg-slate-700/50 rounded-xl p-4 mb-8 text-left space-y-2">
          <p className="text-sm text-slate-300 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            Acesso completo por 7 dias grátis
          </p>
          <p className="text-sm text-slate-300 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            Cobrança automática após o trial
          </p>
          <p className="text-sm text-slate-300 flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            Cancele quando quiser no seu perfil
          </p>
        </div>

        <Button
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
          onClick={() => navigate('/dashboard')}
        >
          Ir para o Dashboard <ArrowRight className="w-4 h-4 ml-2" />
        </Button>

        <p className="text-slate-500 text-xs mt-4">
          Dúvidas? Fale conosco no suporte.
        </p>
      </div>
    </div>
  );
}
