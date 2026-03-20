import { useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const CACHE_PREFIX = 'transaction_cache_';

export function useTransactionCache(monthId, entityType) {
  const queryClient = useQueryClient();

  const getCacheKey = useCallback(() => {
    return `${CACHE_PREFIX}${monthId}_${entityType}`;
  }, [monthId, entityType]);

  const saveToCache = useCallback((data) => {
    if (!monthId) return;
    const key = `${CACHE_PREFIX}${monthId}_${entityType}`;
    const cached = JSON.parse(localStorage.getItem(key) || '[]');
    
    // Adiciona ou atualiza item no cache
    const exists = cached.find(item => item.id === data.id);
    if (exists) {
      Object.assign(exists, data);
    } else {
      cached.push(data);
    }
    
    localStorage.setItem(key, JSON.stringify(cached));
    console.log(`[CACHE] Salvos ${entityType}:`, cached);
  }, [monthId, entityType]);

  const getFromCache = useCallback(() => {
    if (!monthId) return [];
    const key = `${CACHE_PREFIX}${monthId}_${entityType}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  }, [monthId, entityType]);

  const removeFromCache = useCallback((id) => {
    if (!monthId) return;
    const key = `${CACHE_PREFIX}${monthId}_${entityType}`;
    const cached = JSON.parse(localStorage.getItem(key) || '[]');
    const filtered = cached.filter(item => item.id !== id);
    localStorage.setItem(key, JSON.stringify(filtered));
    console.log(`[CACHE] Removido ${entityType}:`, id);
  }, [monthId, entityType]);

  const clearCache = useCallback(() => {
    if (!monthId) return;
    const key = `${CACHE_PREFIX}${monthId}_${entityType}`;
    localStorage.removeItem(key);
    console.log(`[CACHE] Cache limpo para ${entityType}`);
  }, [monthId, entityType]);

  // Sincronizar com banco quando os dados mudarem
  const syncWithDatabase = useCallback(async (base44Entity) => {
    if (!monthId) return;
    
    const cached = getFromCache();
    if (cached.length === 0) return;

    console.log(`[SYNC] Iniciando sincronização de ${entityType}`);
    
    for (const item of cached) {
      try {
        // Garante que month_id está presente
        const dataToSave = { ...item, month_id: monthId };
        
        if (item.id?.includes('temp_')) {
          // Item com ID temporário = novo item, criar no banco
          const { id, ...dataWithoutId } = dataToSave;
          const created = await base44Entity.create(dataWithoutId);
          
          // Atualizar cache com ID real
          const key = `${CACHE_PREFIX}${monthId}_${entityType}`;
          const updated = cached.map(c => c.id === item.id ? created : c);
          localStorage.setItem(key, JSON.stringify(updated));
          console.log(`[SYNC] Item criado:`, created.id);
        } else {
          // Item com ID real = atualizar
          await base44Entity.update(item.id, dataToSave);
          console.log(`[SYNC] Item atualizado:`, item.id);
        }
      } catch (error) {
        console.error(`[SYNC] Erro ao sincronizar item:`, error);
      }
    }

    console.log(`[SYNC] Sincronização concluída para ${entityType}`);
  }, [monthId, entityType, getFromCache]);

  // Sincronizar quando a página ganha foco
  useEffect(() => {
    if (!monthId) return;

    const handleFocus = () => {
      console.log(`[SYNC] Página recuperou foco, sincronizando ${entityType}`);
      // Invalidar queries para buscar dados atualizados do banco
      queryClient.invalidateQueries({ queryKey: [entityType, monthId] });
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [monthId, entityType, queryClient]);

  return {
    saveToCache,
    getFromCache,
    removeFromCache,
    clearCache,
    syncWithDatabase
  };
}