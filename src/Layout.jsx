import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { createPageUrl } from './utils';
import { useAuth } from '@/lib/AuthContext';
import { Home, Receipt, PieChart, CreditCard, TrendingUp, Users, Tag, PiggyBank, BarChart3, Target, LineChart, LogOut, Menu, X, Settings, ShieldAlert, Loader2, Moon, Sun, HelpCircle, Eye, EyeOff, Bell } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useNotifications } from '@/hooks/useNotifications';
import { apiClient } from '@/api/apiClient';
import { toast } from 'sonner';

// Modal de bloqueio de primeiro acesso
function ForcePasswordChangeModal({ onPasswordChanged }) {
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) return toast.error("A senha deve ter no mínimo 6 caracteres.");

    setLoading(true);
    try {
      await apiClient.auth.updatePasswordFirstAccess(newPassword);
      toast.success("Senha atualizada! Bem-vindo de volta.");
      onPasswordChanged();
    } catch (err) {
      toast.error(err.message || 'Erro ao atualizar senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-emerald-500/30 rounded-2xl p-8 max-w-sm w-full shadow-2xl text-center">
        <ShieldAlert className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
        <h2 className="text-2xl font-black text-white mb-2">Primeiro Acesso</h2>
        <p className="text-sm text-slate-400 mb-6">Por segurança, você precisa alterar a senha gerada automaticamente antes de continuar.</p>
        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div>
            <label className="text-xs font-semibold text-slate-400 block mb-1">Nova Senha</label>
            <input 
              type="password" 
              required
              minLength={6}
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full bg-slate-800 border-slate-700 rounded-lg p-3 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Digite no mínimo 6 caracteres"
            />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg p-3 flex justify-center items-center">
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Atualizar e Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function Layout({ children, currentPageName }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout, checkAppState, isAuthenticated } = useAuth();
  const { theme, setTheme } = useTheme();
  const [helpOpen, setHelpOpen] = useState(false);
  const [privacyMode, setPrivacyMode] = useState(window.isPrivacyModeOn || false);
  const familyId = localStorage.getItem('selectedFamilyId');
  const { notifications, unreadCount } = useNotifications(familyId, isAuthenticated);

  const togglePrivacy = () => {
    const newVal = !privacyMode;
    setPrivacyMode(newVal);
    window.isPrivacyModeOn = newVal;
    localStorage.setItem('freedom_privacy_mode', String(newVal));
    window.location.reload();
  };

  const navItems = [
    { name: 'Dashboard', icon: Home, path: 'Dashboard' },
    { name: 'Transações', icon: Receipt, path: 'Transactions' },
    { name: 'Orçamento', icon: PieChart, path: 'Budget' },
    { name: 'Metas', icon: Target, path: 'Goals' },
    { name: 'Dívidas', icon: CreditCard, path: 'Debts' },
    { name: 'Evolução', icon: LineChart, path: 'Evolution' },
    { name: 'Patrimônio', icon: TrendingUp, path: 'Wealth' },
    { name: 'Caixinhas', icon: PiggyBank, path: 'InvestmentBoxes' },
    { name: 'Cartões', icon: CreditCard, path: 'CreditCards' },
    { name: 'Categorias', icon: Tag, path: 'Categories' },
    { name: 'Ações', icon: BarChart3, path: 'Stocks' },
    { name: 'Famílias', icon: Users, path: 'Families' },
  ];

  const isLandingPage = currentPageName === 'LandingPage' || currentPageName === 'Obrigado' || currentPageName === 'Login';

  if (isLandingPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Top Navigation */}
      <nav className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link to={createPageUrl('Dashboard')} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-xl">F</span>
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-xl font-bold text-slate-900">Freedom</h1>
                  <p className="text-xs text-slate-500">Gestão Financeira</p>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {navItems.slice(0, 8).map((item) => {
                const Icon = item.icon;
                const isActive = currentPageName === item.path;
                return (
                  <Link
                    key={item.path}
                    to={createPageUrl(item.path)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700 font-medium'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
              
              {/* More dropdown for remaining items */}
              <div className="relative group">
                <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-600 hover:bg-slate-50 transition-all text-sm">
                  <Menu className="w-4 h-4" />
                  <span>Mais</span>
                </button>
                <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl py-2 w-48 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
                  {navItems.slice(8).map((item) => {
                    const Icon = item.icon;
                    const isActive = currentPageName === item.path;
                    return (
                      <Link
                        key={item.path}
                        to={createPageUrl(item.path)}
                        className={`flex items-center gap-3 px-4 py-2.5 transition-all text-sm ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 font-medium'
                            : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* User Info / Logout / Actions */}
            <div className="flex items-center gap-3">
              <Popover>
                <PopoverTrigger asChild>
                  <button className="relative p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-slate-800 transition-all flex">
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900 animate-pulse"></span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0 mr-4 mt-2" align="end">
                  <div className="p-4 border-b border-slate-100 bg-slate-50 rounded-t-lg">
                    <h3 className="font-semibold text-slate-800">Notificações</h3>
                    <p className="text-xs text-slate-500">Avisos e vencimentos próximos</p>
                  </div>
                  <div className="max-h-80 overflow-y-auto p-2 space-y-1">
                    {notifications.length === 0 ? (
                      <p className="text-sm text-slate-500 text-center py-6">Nenhuma notificação nova.</p>
                    ) : (
                      notifications.map(n => (
                        <Link key={n.id} to={createPageUrl(n.link)} className="block p-3 rounded-lg hover:bg-slate-50 transition-colors">
                          <div className={`text-xs font-semibold mb-1 ${n.type === 'urgent' ? 'text-red-600' : 'text-amber-600'}`}>
                            {n.title}
                          </div>
                          <p className="text-sm text-slate-700">{n.message}</p>
                          <span className="text-[10px] text-slate-400 mt-1 block">Clique para ver os detalhes</span>
                        </Link>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <button
                onClick={togglePrivacy}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-emerald-400 dark:hover:bg-slate-800 transition-all flex"
                title={privacyMode ? "Mostrar Valores" : "Ocultar Valores (Modo Privacidade)"}
              >
                {privacyMode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>

              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-amber-400 dark:hover:bg-slate-800 transition-all hidden sm:flex"
                title="Alternar Tema Escuro"
              >
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
              
              <Link
                to={createPageUrl('HelpCenter')}
                className={`p-2 hover:text-emerald-600 hover:bg-emerald-50 transition-all rounded-full border shadow-sm hidden sm:flex ${currentPageName === 'HelpCenter' ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700' : 'text-slate-400 border-slate-200 dark:border-slate-700'}`}
                title="Como usar o sistema"
              >
                <HelpCircle className="w-5 h-5" />
              </Link>

              {user && (
                <div className="hidden sm:flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-medium text-slate-800">{user.name || user.email?.split('@')[0]}</p>
                    <p className="text-xs text-slate-400">{user.email}</p>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-sm">
                    {(user.name || user.email)?.[0]?.toUpperCase()}
                  </div>
                </div>
              )}
              {user?.role === 'admin' && (
                <Link
                  to={createPageUrl('Admin')}
                  className="p-2 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-all flex items-center gap-2 border border-emerald-200"
                  title="Painel Administrativo"
                >
                  <Settings className="w-5 h-5" />
                  <span className="text-sm font-semibold hidden md:block">Admin</span>
                </Link>
              )}
              <button
                onClick={() => logout()}
                className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                title="Sair"
              >
                <LogOut className="w-5 h-5" />
              </button>
              
              {/* Mobile menu toggle */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-t border-slate-100 py-2 px-4 shadow-lg">
            <div className="grid grid-cols-3 gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPageName === item.path;
                return (
                  <Link
                    key={item.path}
                    to={createPageUrl(item.path)}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex flex-col items-center gap-1 px-2 py-3 rounded-xl transition-all text-center ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs font-medium">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Mobile Bottom Navigation (simplified - top 5 items) */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50">
        <div className="flex justify-around px-2 py-2">
          {navItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = currentPageName === item.path;
            return (
              <Link
                key={item.path}
                to={createPageUrl(item.path)}
                className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-all ${
                  isActive
                    ? 'text-emerald-700'
                    : 'text-slate-500'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-600' : ''}`} />
                <span className="text-[10px] font-medium">{item.name}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg text-slate-500"
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-medium">Mais</span>
          </button>
          
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg text-slate-500"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            <span className="text-[10px] font-medium">Tema</span>
          </button>
          
          <Link
            to={createPageUrl('HelpCenter')}
            className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg font-bold transition-all ${currentPageName === 'HelpCenter' ? 'text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30' : 'text-emerald-600'}`}
          >
            <HelpCircle className="w-5 h-5" />
            <span className="text-[10px] font-medium">Ajuda</span>
          </Link>
        </div>
      </nav>

      <main className="pb-20 lg:pb-0 relative z-0">
        <div className="dark:text-slate-100">
          {children}
        </div>
      </main>

      {/* Admin acessível via rota /Admin apenas */}

      {user?.must_change_password && (
        <ForcePasswordChangeModal onPasswordChanged={checkAppState} />
      )}
    </div>
  );
}