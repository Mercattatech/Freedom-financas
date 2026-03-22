import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';

export function useNotifications(familyId) {
  const { data: debts = [] } = useQuery({
    queryKey: ['debts', familyId],
    queryFn: () => apiClient.entities.Debt.filter({ family_id: familyId }),
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000
  });

  const { data: recurring = [] } = useQuery({
    queryKey: ['recurringExpenses', familyId],
    queryFn: () => apiClient.entities.RecurringExpense.filter({ family_id: familyId, ativo: true }),
    enabled: !!familyId,
    staleTime: 5 * 60 * 1000
  });

  const today = new Date();
  const currentDay = today.getDate();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const getDaysUntil = (dueDay) => {
     if (!dueDay) return null;
     const actualDueDay = Math.min(dueDay, daysInMonth);
     let daysUntil = actualDueDay - currentDay;
     
     if (daysUntil < 0) {
        const nextMonthDays = new Date(currentYear, currentMonth + 2, 0).getDate();
        daysUntil = (daysInMonth - currentDay) + Math.min(dueDay, nextMonthDays);
     }
     
     return daysUntil;
  };

  const notifications = [];

  debts.filter(d => d.status === 'ATIVA').forEach(d => {
     const days = getDaysUntil(d.vencimento_dia);
     if (days !== null && days <= 7) {
         notifications.push({
            id: `debt-${d.id}`,
            title: `Vencimento de Dívida`,
            message: `A parcela de "${d.nome_divida}" vence ${days === 0 ? 'hoje' : 'em ' + days + ' dias'}.`,
            type: days <= 2 ? 'urgent' : 'warning',
            days,
            link: 'Debts'
         });
     }
  });

  recurring.forEach(r => {
     const days = getDaysUntil(r.dia_vencimento);
     if (days !== null && days <= 7) {
         notifications.push({
            id: `rec-${r.id}`,
            title: `Despesa Recorrente`,
            message: `A despesa "${r.descricao}" de R$ ${r.valor.toFixed(2).replace('.',',')} vence ${days === 0 ? 'hoje' : 'em ' + days + ' dias'}.`,
            type: days <= 2 ? 'urgent' : 'info',
            days,
            link: 'Transactions?tab=recurring'
         });
     }
  });

  notifications.sort((a, b) => a.days - b.days);

  return { notifications, unreadCount: notifications.length };
}
