// @ts-nocheck
import { appParams } from '@/lib/app-params';

// Em dev usa porta 3000 local, em prod usa o que a KingHost prover via vite config
const API_URL = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:3000/api`;

const apiFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem('freedom_access_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` }),
    ...options.headers,
  };

  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });
    
    // Handle 204 No Content
    if (response.status === 204) return null;

    const data = await response.json();
    if (!response.ok) {
      const err = new Error(data.message || data.error || 'Erro na API');
      err.status = response.status;
      throw err;
    }
    return data;
  } catch (error) {
    if (error.message === 'Failed to fetch') {
      throw new Error('Servidor Backend (Node) está offline! Ligue-o!');
    }
    throw error;
  }
};

export const apiClient = {
  auth: {
    setToken(token) {
      localStorage.setItem('freedom_access_token', token);
    },
    removeToken() {
      localStorage.removeItem('freedom_access_token');
    },
    logout(redirectUrl) {
      this.removeToken();
      if (redirectUrl) window.location.href = redirectUrl;
    },
    redirectToLogin(nextUrl) {
      window.location.href = `/Login?from_url=${encodeURIComponent(nextUrl)}`;
    },
    async register(params) {
      const resp = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name: params.name, email: params.email, password: params.password })
      });
      if (resp.data?._dev_otp) alert(`[DEV MODE] Seu código OTP é: ${resp.data._dev_otp}`);
      return resp;
    },
    async loginViaEmailPassword(email, password) {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      this.setToken(data.access_token);
      return data;
    },
    async verifyOtp(params) {
      return await apiFetch('/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email: params.email, otpCode: params.otpCode })
      });
    },
    async resendOtp(email) {
      const resp = await apiFetch('/auth/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
      if (resp._dev_otp) alert(`[DEV MODE] NOVO código OTP: ${resp._dev_otp}`);
      return resp;
    },
    async forgotPassword(email) {
      return await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email })
      });
    },
    async resetPassword(params) {
      return await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify(params)
      });
    },
    async updatePasswordFirstAccess(newPassword) {
      return await apiFetch('/auth/update-password-first-access', {
        method: 'POST',
        body: JSON.stringify({ newPassword })
      });
    },
    async me() {
      try {
        return await apiFetch('/auth/me');
      } catch (err) {
        if (err.message.toLowerCase().includes('token')) this.removeToken();
        throw { status: 401, message: 'Unauthorized' };
      }
    },
    async checkAppVerification() {
      return { success: true };
    }
  },

  appState: {
    get: async () => ({
      name: appParams.name,
      maintenance_mode: false,
      color: appParams.primaryColor || '#000000',
    })
  },

  appLogs: {
    async logUserInApp(pageName) {
      console.log(`[API CLIENT] Navegação em: ${pageName}`);
      return { success: true };
    }
  },

  // Generic Entity Mapping to REST API
  entities: new Proxy({}, {
    get(target, model) {
      if (typeof model === 'symbol' || model === 'then') return undefined; 

      // Basic pluralization (Family -> families, Goal -> goals)
      const endpointName = model.toLowerCase().endsWith('y') 
        ? model.toLowerCase().slice(0, -1) + 'ies'
        : model.toLowerCase() + 's';
      
      const endpoint = `/${endpointName}`;

      return {
        async list() {
          return await apiFetch(endpoint);
        },
        async filter(query = {}) {
          const params = new URLSearchParams(query).toString();
          return await apiFetch(`${endpoint}?${params}`);
        },
        async create(data) {
          return await apiFetch(endpoint, {
            method: 'POST',
            body: JSON.stringify(data)
          });
        },
        async update(id, data) {
          return await apiFetch(`${endpoint}/${id}`, {
            method: 'PUT',
            body: JSON.stringify(data)
          });
        },
        async delete(id) {
          return await apiFetch(`${endpoint}/${id}`, {
            method: 'DELETE'
          });
        }
      };
    }
  }),
  
  functions: {
    async invoke(name, payload) {
      return await apiFetch(`/functions/invoke`, {
        method: 'POST',
        body: JSON.stringify({ name, payload })
      });
    }
  }
};
