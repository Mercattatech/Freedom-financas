import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { biz, companyStore } from './api';

const MATRIX = {
  OWNER: ['*'], ADMIN: ['*'],
  FINANCEIRO: ['financeiro:write', 'cadastros:write', 'contratos:write', 'relatorios:read', 'operacional:write', 'comercial:write', 'clientes:write'],
  COMERCIAL: ['comercial:write', 'clientes:write'],
  OPERACIONAL: ['operacional:write'],
  LEITURA: ['relatorios:read'],
};

const Ctx = createContext(null);

export function BizProvider({ children }) {
  const [companyId, setCompanyIdState] = useState(companyStore.get());
  const qc = useQueryClient();

  const companiesQ = useQuery({ queryKey: ['biz', 'companies'], queryFn: () => biz('/companies'), staleTime: 60_000 });
  const companies = companiesQ.data || [];
  const current = companies.find((c) => c.id === companyId) || companies[0] || null;
  if (current && current.id !== companyId) companyStore.set(current.id);

  const setCompanyId = useCallback((id) => {
    companyStore.set(id);
    setCompanyIdState(id);
    qc.removeQueries({ predicate: (q) => q.queryKey[0] === 'biz' && q.queryKey[1] !== 'companies' });
  }, [qc]);

  const value = useMemo(() => {
    const papel = current?.papel;
    const can = (perm) => { const l = MATRIX[papel] || []; return l.includes('*') || l.includes(perm); };
    return { companies, company: current, companyId: current?.id, papel, can, setCompanyId, loading: companiesQ.isLoading, error: companiesQ.error, refetchCompanies: companiesQ.refetch };
  }, [companies, current, companiesQ.isLoading, companiesQ.error, companiesQ.refetch, setCompanyId]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useBiz = () => useContext(Ctx);

// Consulta escopada pela empresa atual
export function useBizQuery(path, query, opts = {}) {
  const { companyId } = useBiz();
  return useQuery({
    queryKey: ['biz', companyId, path, query || null],
    queryFn: () => biz(path, { query }),
    enabled: !!companyId && opts.enabled !== false,
    staleTime: 15_000,
    ...opts,
  });
}

// Mutação que invalida os dados da empresa e mostra feedback
export function useBizMutation(fn, { success, onSuccess } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data, vars) => {
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'biz' });
      if (success) toast.success(typeof success === 'function' ? success(data, vars) : success);
      onSuccess?.(data, vars);
    },
    onError: (e) => toast.error(e.message || 'Não foi possível concluir'),
  });
}
