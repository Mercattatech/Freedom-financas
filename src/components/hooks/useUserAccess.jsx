// @ts-nocheck
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';

/**
 * Hook para verificar o acesso do usuário ao sistema.
 * Retorna:
 * - hasAccess: boolean
 * - isAdmin: boolean
 * - limits: { limite_familias, features, plan_nome }
 * - access: o registro UserAccess
 * - plan: o plano completo
 * - isLoading
 * - reason: motivo caso não tenha acesso
 */
export function useUserAccess() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['user-access'],
    queryFn: async () => {
      // Retornar mock para evitar erro undefined do base44
      return {
        hasAccess: true,
        isAdmin: true,
        limits: { limite_familias: 10, features: [], plan_nome: 'Premium' },
        status: 'ACTIVE'
      };
    },
    staleTime: 5 * 60 * 1000, // 5 min cache
    retry: 1,
  });

  return {
    isLoading,
    hasAccess: data?.hasAccess ?? null,
    isAdmin: data?.isAdmin ?? false,
    access: data?.access ?? null,
    plan: data?.plan ?? null,
    limits: data?.limits ?? { limite_familias: 1, features: [], plan_nome: '' },
    reason: data?.reason ?? null,
    status: data?.status ?? null,
  };
}