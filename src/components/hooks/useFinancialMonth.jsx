import { useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';

/**
 * Hook centralizado para buscar/criar o mês financeiro.
 * Usa um ref para garantir que nunca crie duplicatas mesmo em re-renders rápidos.
 */
export function useFinancialMonth(familyId, competencia) {
  const queryClient = useQueryClient();
  const creatingRef = useRef(false);

  const { data: months = [], isLoading } = useQuery({
    queryKey: ['months', familyId, competencia],
    queryFn: () => apiClient.entities.FinancialMonth.filter({ family_id: familyId, competencia }),
    enabled: !!familyId && !!competencia,
    staleTime: 30000,
  });

  const createMonthMutation = useMutation({
    mutationFn: (data) => apiClient.entities.FinancialMonth.create(data),
    onSuccess: () => {
      creatingRef.current = false;
      queryClient.invalidateQueries({ queryKey: ['months', familyId, competencia] });
    },
    onError: () => {
      creatingRef.current = false;
    }
  });

  useEffect(() => {
    // Só cria se: não está carregando, não há mês, e não está já criando
    if (!isLoading && familyId && competencia && months.length === 0 && !creatingRef.current) {
      creatingRef.current = true;
      createMonthMutation.mutate({
        family_id: familyId,
        competencia,
        status: 'ABERTO',
        renda_total_calculada: 0
      });
    }
  }, [isLoading, familyId, competencia, months.length]);

  return {
    month: months[0] || null,
    isLoading: isLoading || createMonthMutation.isPending,
  };
}