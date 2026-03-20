// @ts-nocheck
import React, { useState } from 'react';
import { apiClient } from '@/api/apiClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Eye, EyeOff, Mail, Lock, User, ArrowRight, ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export default function Login() {
  const [mode, setMode] = useState('login'); // login, register, forgot, reset-sent
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
    otpCode: ''
  });

  const f = (v) => setForm(prev => ({ ...prev, ...v }));

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast.error('Preencha todos os campos');
      return;
    }
    setLoading(true);
    try {
      // Usa o SDK do Base44 para login
      await apiClient.auth.loginViaEmailPassword(form.email, form.password);
      toast.success('Login realizado com sucesso!');
      window.location.href = '/Dashboard';
    } catch (error) {
      console.error('Login error:', error);
      if (error.message?.toLowerCase().includes('verify your email')) {
        toast.error('Você precisa verificar seu email primeiro.');
        setMode('verify-otp');
      } else if (error.status === 401 || error.status === 403) {
        toast.error('Email ou senha incorretos (ou email não verificado)');
      } else if (error.message?.includes('not registered')) {
        toast.error('Você não está registrado neste aplicativo. Entre em contato com o administrador.');
      } else {
        toast.error('Erro ao fazer login. Verifique suas credenciais.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password || !form.name) {
      toast.error('Preencha todos os campos');
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }
    if (form.password.length < 6) {
      toast.error('A senha deve ter pelo menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      await apiClient.auth.register({
        email: form.email,
        password: form.password,
        name: form.name
      });
      toast.success('Conta criada! Verifique seu email para obter o código de confirmação.');
      setMode('verify-otp');
    } catch (error) {
      console.error('Register error:', error);
      if (error.message?.includes('already exists')) {
        toast.error('Este email já está cadastrado. Tente fazer login.');
      } else {
        toast.error('Erro ao criar conta. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!form.otpCode) {
      toast.error('Digite o código recebido no email');
      return;
    }
    setLoading(true);
    try {
      await apiClient.auth.verifyOtp({ email: form.email, otpCode: form.otpCode });
      toast.success('Conta verificada com sucesso! Fazendo login...');
      await apiClient.auth.loginViaEmailPassword(form.email, form.password);
      window.location.href = '/Dashboard';
    } catch (error) {
      console.error('Verify OTP error:', error);
      toast.error('Código inválido ou expirado. Verifique e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    if (!form.email) {
      toast.error('Digite seu email');
      return;
    }
    setLoading(true);
    try {
      await apiClient.auth.forgotPassword(form.email);
      setMode('reset-sent');
      toast.success('Email de recuperação enviado!');
    } catch (error) {
      console.error('Forgot password error:', error);
      toast.error('Erro ao enviar email. Verifique o endereço e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = (provider) => {
    try {
      apiClient.auth.redirectToLogin(window.location.origin + '/Dashboard', provider);
    } catch (error) {
      toast.error('Erro ao conectar. Tente novamente.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 flex items-center justify-center p-4">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 right-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 left-20 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-20" 
          style={{backgroundImage: 'radial-gradient(circle, #10b981 0%, transparent 70%)'}} />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/30 mb-4">
            <span className="text-white font-black text-2xl">F</span>
          </div>
          <h1 className="text-3xl font-black text-white">Freedom</h1>
          <p className="text-slate-400 text-sm mt-1">Gestão Financeira Familiar</p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-8 shadow-2xl">
          <AnimatePresence mode="wait">
            {/* LOGIN */}
            {mode === 'login' && (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <h2 className="text-2xl font-bold text-white mb-2">Bem-vindo de volta!</h2>
                <p className="text-slate-400 text-sm mb-6">Entre na sua conta para continuar</p>

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        type="email"
                        value={form.email}
                        onChange={e => f({ email: e.target.value })}
                        placeholder="seu@email.com"
                        className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20 h-12 rounded-xl"
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={e => f({ password: e.target.value })}
                        placeholder="••••••••"
                        className="pl-10 pr-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 focus:ring-emerald-500/20 h-12 rounded-xl"
                        autoComplete="current-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 text-base"
                  >
                    {loading ? (
                      <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Entrando...</>
                    ) : (
                      <>Entrar <ArrowRight className="w-5 h-5 ml-2" /></>
                    )}
                  </Button>
                </form>

                {/* Social Login */}
                <div className="mt-6">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-700" />
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-slate-900 px-4 text-slate-500">ou continue com</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleSocialLogin('google')}
                      className="h-11 bg-slate-800/50 border-slate-700 text-white hover:bg-slate-700 rounded-xl"
                    >
                      <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                      Google
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => handleSocialLogin('github')}
                      className="h-11 bg-slate-800/50 border-slate-700 text-white hover:bg-slate-700 rounded-xl"
                    >
                      <svg className="w-5 h-5 mr-2" fill="white" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                      GitHub
                    </Button>
                  </div>
                </div>

                <p className="text-center text-slate-500 text-sm mt-6 flex flex-col gap-2">
                  <span>Não tem conta?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('register')}
                      className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
                    >
                      Criar conta grátis
                    </button>
                  </span>
                  <span>Já tem um código?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('verify-otp')}
                      className="text-emerald-400 hover:text-emerald-300 font-semibold transition-colors"
                    >
                      Verificar email
                    </button>
                  </span>
                </p>
              </motion.div>
            )}

            {/* REGISTER */}
            {mode === 'register' && (
              <motion.div
                key="register"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <button
                  onClick={() => setMode('login')}
                  className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Voltar ao login
                </button>

                <h2 className="text-2xl font-bold text-white mb-2">Crie sua conta</h2>
                <p className="text-slate-400 text-sm mb-6">Comece a organizar suas finanças agora</p>

                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm">Nome completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        type="text"
                        value={form.name}
                        onChange={e => f({ name: e.target.value })}
                        placeholder="Seu nome"
                        className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 h-12 rounded-xl"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        type="email"
                        value={form.email}
                        onChange={e => f({ email: e.target.value })}
                        placeholder="seu@email.com"
                        className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 h-12 rounded-xl"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm">Senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={e => f({ password: e.target.value })}
                        placeholder="Mínimo 6 caracteres"
                        className="pl-10 pr-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 h-12 rounded-xl"
                        minLength={6}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {/* Password strength indicator */}
                    {form.password && (
                      <div className="flex gap-1 mt-2">
                        {[1,2,3,4].map(i => (
                          <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${
                            form.password.length >= i * 3
                              ? form.password.length >= 12 ? 'bg-emerald-500' : form.password.length >= 8 ? 'bg-yellow-500' : 'bg-red-500'
                              : 'bg-slate-700'
                          }`} />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm">Confirmar senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        type="password"
                        value={form.confirmPassword}
                        onChange={e => f({ confirmPassword: e.target.value })}
                        placeholder="Repita a senha"
                        className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 h-12 rounded-xl"
                        required
                      />
                    </div>
                    {form.confirmPassword && form.password !== form.confirmPassword && (
                      <p className="text-red-400 text-xs">As senhas não coincidem</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || form.password !== form.confirmPassword}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 text-base"
                  >
                    {loading ? (
                      <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Criando conta...</>
                    ) : (
                      <>Criar conta <ArrowRight className="w-5 h-5 ml-2" /></>
                    )}
                  </Button>

                  <p className="text-xs text-slate-500 text-center">
                    Ao criar sua conta, você concorda com nossos Termos de Uso e Política de Privacidade.
                  </p>
                </form>
              </motion.div>
            )}

            {/* VERIFY OTP */}
            {mode === 'verify-otp' && (
              <motion.div
                key="verify-otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <button
                  onClick={() => setMode('login')}
                  className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Voltar ao login
                </button>

                <h2 className="text-2xl font-bold text-white mb-2">Verifique seu email</h2>
                <p className="text-slate-400 text-sm mb-6">
                  Enviamos um código de 6 dígitos para o seu email. Digite-o abaixo para concluir seu cadastro.
                </p>

                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        type="email"
                        value={form.email}
                        onChange={e => f({ email: e.target.value })}
                        placeholder="seu@email.com"
                        className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 h-12 rounded-xl"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm">Código de Verificação</Label>
                    <div className="relative">
                      <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        type="text"
                        value={form.otpCode}
                        onChange={e => f({ otpCode: e.target.value })}
                        placeholder="000000"
                        maxLength={6}
                        className="pl-10 text-center tracking-[0.5em] font-mono text-lg bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 h-12 rounded-xl"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || form.otpCode.length < 6}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 text-base"
                  >
                    {loading ? (
                      <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Verificando...</>
                    ) : (
                      <>Confirmar Código <ArrowRight className="w-5 h-5 ml-2" /></>
                    )}
                  </Button>
                  
                  <p className="text-center text-sm text-slate-500 mt-4">
                    Não recebeu? <button type="button" onClick={async () => {
                      try {
                        if (!form.email) return toast.error('Preencha o email primeiro');
                        await apiClient.auth.resendOtp(form.email);
                        toast.success('Novo código enviado!');
                      } catch(e) { toast.error('Erro ao reenviar'); }
                    }} className="text-emerald-400 hover:underline">Reenviar código</button>
                  </p>
                </form>
              </motion.div>
            )}

            {/* FORGOT PASSWORD */}
            {mode === 'forgot' && (
              <motion.div
                key="forgot"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <button
                  onClick={() => setMode('login')}
                  className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-4 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Voltar ao login
                </button>

                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mb-4">
                  <KeyRound className="w-7 h-7 text-emerald-400" />
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">Recuperar senha</h2>
                <p className="text-slate-400 text-sm mb-6">
                  Digite seu email e enviaremos um link para redefinir sua senha.
                </p>

                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-300 text-sm">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                      <Input
                        type="email"
                        value={form.email}
                        onChange={e => f({ email: e.target.value })}
                        placeholder="seu@email.com"
                        className="pl-10 bg-slate-800/50 border-slate-700 text-white placeholder:text-slate-500 focus:border-emerald-500 h-12 rounded-xl"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 text-base"
                  >
                    {loading ? (
                      <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Enviando...</>
                    ) : (
                      <>Enviar link de recuperação <ArrowRight className="w-5 h-5 ml-2" /></>
                    )}
                  </Button>
                </form>
              </motion.div>
            )}

            {/* RESET SENT CONFIRMATION */}
            {mode === 'reset-sent' && (
              <motion.div
                key="reset-sent"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">Email enviado!</h2>
                <p className="text-slate-400 text-sm mb-6">
                  Enviamos um link de recuperação para <strong className="text-white">{form.email}</strong>.
                  Verifique sua caixa de entrada e spam.
                </p>

                <div className="p-4 bg-slate-800/50 rounded-xl border border-slate-700 mb-6">
                  <p className="text-slate-400 text-xs">
                    Não recebeu o email? Verifique sua pasta de spam ou tente novamente em alguns minutos.
                  </p>
                </div>

                <Button
                  onClick={() => setMode('login')}
                  variant="outline"
                  className="w-full h-12 border-slate-700 text-white hover:bg-slate-800 rounded-xl"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao login
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-xs mt-6">
          © 2025 Freedom Gestão Financeira. Todos os direitos reservados.
        </p>
      </motion.div>
    </div>
  );
}
