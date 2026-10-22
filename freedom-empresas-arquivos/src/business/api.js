// Cliente HTTP do módulo Freedom Empresas (/api/biz)
const isLocal = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
const API_URL = import.meta.env.VITE_API_URL || (isLocal ? `http://${window.location.hostname}:3000/api` : '/api');

export const companyStore = {
  get: () => { try { return localStorage.getItem('bizCompanyId'); } catch { return null; } },
  set: (id) => { try { id ? localStorage.setItem('bizCompanyId', id) : localStorage.removeItem('bizCompanyId'); } catch { /* sem storage */ } },
};

export async function biz(path, { method = 'GET', body, query, auth = true } = {}) {
  const token = localStorage.getItem('freedom_access_token');
  const companyId = companyStore.get();
  const qs = query ? `?${new URLSearchParams(Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== '')))}` : '';
  const res = await fetch(`${API_URL}/biz${path}${qs}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(auth && token && { Authorization: `Bearer ${token}` }),
      ...(auth && companyId && { 'x-company-id': companyId }),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* sem corpo */ }
  if (!res.ok) {
    const err = new Error(data?.message || `Erro ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const API_BASE = API_URL;
