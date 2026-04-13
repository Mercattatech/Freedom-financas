import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Lock, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token');

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tokenError, setTokenError] = useState('');

  useEffect(() => {
    if (!token) {
      setTokenError('Link inválido. Solicite um novo link de acesso.');
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    if (password !== confirm) {
      toast.error('As senhas não coincidem');
      return;
    }

    setLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_URL || '/api';
      const res = await fetch(`${baseUrl}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: decodeURIComponent(token), new_password: password })
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.message || 'Erro ao redefinir senha');
        if (res.status === 400) setTokenError('Link expirado ou inválido. Solicite um novo acesso.');
        return;
      }

      setSuccess(true);
      toast.success('Senha definida com sucesso!');

      // Faz login automático se vier o token de acesso
      if (data.access_token) {
        localStorage.setItem('access_token', data.access_token);
        if (data.user) localStorage.setItem('user', JSON.stringify(data.user));
        setTimeout(() => navigate('/Dashboard'), 2000);
      } else {
        setTimeout(() => navigate('/Login'), 2000);
      }
    } catch (err) {
      toast.error('Erro de conexão. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  // Token inválido
  if (tokenError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex items-center justify-center px-4">
        <div className="bg-slate-800/80 border border-red-500/30 rounded-2xl p-10 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Link inválido</h1>
          <p className="text-slate-400 mb-6">{tokenError}</p>
          <Button
            className="bg-emerald-600 hover:bg-emerald-500 text-white w-full"
            onClick={() => navigate('/Login')}
          >
            Ir para o Login
          </Button>
        </div>
      </div>
    );
  }

  // Sucesso
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex items-center justify-center px-4">
        <div className="bg-slate-800/80 border border-emerald-500/30 rounded-2xl p-10 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-3">Senha definida! 🎉</h1>
          <p className="text-slate-400 mb-2">Redirecionando para o dashboard...</p>
          <Loader2 className="w-5 h-5 animate-spin text-emerald-400 mx-auto mt-4" />
        </div>
      </div>
    );
  }

  // Formulário de nova senha
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex items-center justify-center px-4">
      <div className="bg-slate-800/80 border border-emerald-500/20 rounded-2xl p-10 max-w-md w-full shadow-2xl">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/30 mb-4">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Criar sua senha</h1>
          <p className="text-slate-400 text-sm mt-2">Defina uma senha segura para acessar o Freedom</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nova senha */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Nova senha</label>
            <div className="relative">
              <Input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 pr-10"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
              >
                {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirmar senha */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1.5">Confirmar senha</label>
            <Input
              type={showPwd ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              placeholder="Repita a senha"
              className="bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
              required
            />
            {confirm && password !== confirm && (
              <p className="text-red-400 text-xs mt-1">As senhas não coincidem</p>
            )}
            {confirm && password === confirm && confirm.length >= 6 && (
              <p className="text-emerald-400 text-xs mt-1 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Senhas coincidem
              </p>
            )}
          </div>

          <Button
            type="submit"
            disabled={loading || password !== confirm || password.length < 6}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold mt-2"
          >
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Salvando...</> : '🔐 Criar senha e acessar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
