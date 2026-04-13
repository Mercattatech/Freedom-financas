import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';
import { useNavigate } from 'react-router-dom';
import { Check, Zap, Crown, Star, Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export default function Pricing() {
  const navigate = useNavigate();
  const [interval, setInterval] = useState('month');
  const [loadingPlan, setLoadingPlan] = useState(null);

  const { data: plansRes, isLoading } = useQuery({
    queryKey: ['plans-public'],
    queryFn: () => fetch('/api/admin/plans').then(r => r.json())
  });

  const plans = (plansRes?.data || []).filter(p => p.ativo);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => apiClient.auth.me(),
    retry: false
  });

  const handleSelectPlan = async (plan) => {
    if (!user) {
      navigate(`/register?plan=${plan.id}`);
      return;
    }

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

  const getPlanIcon = (index) => {
    const icons = [Zap, Crown, Star];
    return icons[index % icons.length];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 py-20 px-4">
      {/* Header */}
      <div className="text-center mb-16">
        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 mb-4">
          💰 Freedom — Gestão Financeira
        </Badge>
        <h1 className="text-4xl md:text-5xl font-bold text-white mt-4 mb-6">
          Assuma o controle das<br />
          <span className="text-emerald-400">suas finanças</span>
        </h1>
        <p className="text-slate-400 text-lg max-w-xl mx-auto">
          7 dias grátis, sem cartão de crédito. Cancele quando quiser.
        </p>

        {/* Toggle mensal/anual */}
        <div className="flex items-center justify-center gap-3 mt-8">
          <span className={`text-sm ${interval === 'month' ? 'text-white' : 'text-slate-500'}`}>Mensal</span>
          <button
            onClick={() => setInterval(v => v === 'month' ? 'year' : 'month')}
            className={`relative w-12 h-6 rounded-full transition-colors ${interval === 'year' ? 'bg-emerald-500' : 'bg-slate-600'}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${interval === 'year' ? 'left-7' : 'left-1'}`} />
          </button>
          <span className={`text-sm ${interval === 'year' ? 'text-white' : 'text-slate-500'}`}>
            Anual <Badge className="bg-emerald-500 text-white text-xs ml-1">-20%</Badge>
          </span>
        </div>
      </div>

      {/* Plans */}
      {isLoading ? (
        <div className="flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-400" /></div>
      ) : plans.length === 0 ? (
        <div className="text-center text-slate-400 py-20">
          <p className="text-xl">Nenhum plano disponível</p>
          <p className="text-sm mt-2">Volte em breve!</p>
        </div>
      ) : (
        <div className={`max-w-5xl mx-auto grid gap-6 ${plans.length === 1 ? 'max-w-md' : plans.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
          {plans.map((plan, i) => {
            const Icon = getPlanIcon(i);
            const price = interval === 'year' && plan.preco_anual
              ? plan.preco_anual / 12
              : plan.preco_mensal || plan.preco;
            const hasAnnual = plan.preco_anual && plan.stripe_price_id_anual;
            const features = (() => { try { return JSON.parse(plan.features || '[]'); } catch { return []; } })();

            return (
              <div
                key={plan.id}
                className={`relative rounded-2xl p-8 border transition-all duration-300 hover:-translate-y-1 ${
                  plan.destaque
                    ? 'bg-emerald-600 border-emerald-400 shadow-2xl shadow-emerald-500/30 scale-105'
                    : 'bg-slate-800/80 border-slate-700 hover:border-slate-500'
                }`}
              >
                {plan.destaque && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-white text-emerald-700 font-bold px-4">{plan.badge || '⭐ Mais Popular'}</Badge>
                  </div>
                )}
                {plan.badge && !plan.destaque && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-emerald-500 text-white font-bold px-4">{plan.badge}</Badge>
                  </div>
                )}

                <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-6 ${plan.destaque ? 'bg-white/20' : 'bg-emerald-500/20'}`}>
                  <Icon className={`w-6 h-6 ${plan.destaque ? 'text-white' : 'text-emerald-400'}`} />
                </div>

                <h2 className={`text-2xl font-bold mb-2 ${plan.destaque ? 'text-white' : 'text-slate-100'}`}>{plan.nome}</h2>
                {plan.descricao && (
                  <p className={`text-sm mb-6 ${plan.destaque ? 'text-emerald-100' : 'text-slate-400'}`}>{plan.descricao}</p>
                )}

                <div className="mb-6">
                  <div className="flex items-end gap-1">
                    <span className={`text-4xl font-bold ${plan.destaque ? 'text-white' : 'text-slate-100'}`}>
                      {fmt(price)}
                    </span>
                    <span className={`text-sm pb-1 ${plan.destaque ? 'text-emerald-200' : 'text-slate-500'}`}>/mês</span>
                  </div>
                  {interval === 'year' && hasAnnual && (
                    <p className={`text-xs mt-1 ${plan.destaque ? 'text-emerald-200' : 'text-slate-500'}`}>
                      Cobrado {fmt(plan.preco_anual)}/ano
                    </p>
                  )}
                  <p className={`text-xs mt-2 font-medium ${plan.destaque ? 'text-emerald-200' : 'text-emerald-400'}`}>
                    ✨ {plan.trial_dias || 7} dias grátis
                  </p>
                </div>

                <Button
                  className={`w-full mb-6 font-semibold ${
                    plan.destaque
                      ? 'bg-white text-emerald-700 hover:bg-emerald-50'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                  disabled={loadingPlan === plan.id}
                  onClick={() => handleSelectPlan(plan)}
                >
                  {loadingPlan === plan.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>Começar grátis <ArrowRight className="w-4 h-4 ml-1" /></>
                  )}
                </Button>

                {features.length > 0 && (
                  <ul className="space-y-3">
                    {features.map((feat, fi) => (
                      <li key={fi} className="flex items-center gap-2">
                        <Check className={`w-4 h-4 flex-shrink-0 ${plan.destaque ? 'text-emerald-200' : 'text-emerald-400'}`} />
                        <span className={`text-sm ${plan.destaque ? 'text-emerald-100' : 'text-slate-400'}`}>{feat}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="text-center mt-16 text-slate-500 text-sm">
        <p>🔒 Pagamento seguro via Stripe · Cancele quando quiser · Suporte por e-mail</p>
      </div>
    </div>
  );
}
