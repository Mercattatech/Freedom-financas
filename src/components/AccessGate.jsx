import React from 'react';
import { useUserAccess } from './hooks/useUserAccess';
import { Button } from '@/components/ui/button';
import { Loader2, Lock, AlertTriangle } from 'lucide-react';
import { createPageUrl } from '@/utils';

/**
 * Componente que bloqueia acesso a áreas do app para usuários sem plano ativo.
 * Uso: <AccessGate> ... conteúdo protegido ... </AccessGate>
 * 
 * Props:
 * - checkFamilyLimit: boolean — se true, verifica o limite de famílias
 * - familyCount: number — quantidade atual de famílias do usuário
 */
export default function AccessGate({ children, checkFamilyLimit = false, familyCount = 0 }) {
  const { isLoading, hasAccess, isAdmin, limits, reason, plan } = useUserAccess();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
      </div>
    );
  }

  // Admin: acesso total
  if (isAdmin) return children;

  // Sem acesso
  if (!hasAccess) {
    const messages = {
      no_access: { title: 'Acesso Restrito', desc: 'Você ainda não possui um plano ativo. Escolha um plano para ter acesso completo ao Freedom.' },
      access_suspenso: { title: 'Acesso Suspenso', desc: 'Seu acesso foi suspenso. Pode haver um problema com o seu pagamento. Entre em contato com o suporte.' },
      access_cancelado: { title: 'Plano Cancelado', desc: 'Seu plano foi cancelado. Renove para continuar usando o Freedom.' },
      expired: { title: 'Plano Expirado', desc: 'Seu plano expirou. Renove para continuar tendo acesso.' },
    };
    const msg = messages[reason] || messages.no_access;

    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
          <Lock className="w-8 h-8 text-amber-400" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-3">{msg.title}</h2>
        <p className="text-slate-500 max-w-md mb-8 leading-relaxed">{msg.desc}</p>
        <Button
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-8 py-3 rounded-xl"
          onClick={() => window.location.href = createPageUrl('LandingPage') + '#planos'}
        >
          Ver Planos e Preços →
        </Button>
      </div>
    );
  }

  // Verifica limite de famílias
  if (checkFamilyLimit && !isAdmin) {
    const maxFamilias = limits?.limite_familias || 1;
    if (familyCount >= maxFamilias) {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 flex items-start gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-amber-800 mb-1">Limite de famílias atingido</h3>
            <p className="text-amber-700 text-sm">
              Seu plano <strong>{limits?.plan_nome}</strong> permite até <strong>{maxFamilias} família{maxFamilias > 1 ? 's' : ''}</strong>.
              Você já tem {familyCount} cadastrada{familyCount > 1 ? 's' : ''}.
            </p>
            <p className="text-amber-600 text-xs mt-2">Faça upgrade do plano para adicionar mais famílias.</p>
            <Button
              size="sm"
              className="mt-3 bg-amber-600 hover:bg-amber-500 text-white"
              onClick={() => window.location.href = createPageUrl('LandingPage') + '#planos'}
            >
              Fazer Upgrade
            </Button>
          </div>
        </div>
      );
    }
  }

  return children;
}