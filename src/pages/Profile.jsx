import React, { useState, useEffect } from 'react';
import { apiClient } from '@/api/apiClient';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import { MessageCircle, Phone, User, CheckCircle2, Loader2, Info, Mic, Type, Plus } from 'lucide-react';

export default function Profile() {
  const { user, checkAppState } = useAuth();
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [saving, setSaving] = useState(false);
  const [waNumber, setWaNumber] = useState('');
  
  // Extra WhatsApp Numbers state
  const [numbersData, setNumbersData] = useState(null);
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  const [newNumber, setNewNumber] = useState('');
  const [newName, setNewName] = useState('');

  const fetchNumbers = async () => {
    setLoadingNumbers(true);
    try {
      const data = await apiClient.auth.getWhatsappNumbers();
      setNumbersData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingNumbers(false);
    }
  };

  useEffect(() => {
    if (user) {
      setWhatsappPhone(user.whatsapp_phone || '');
      setFullName(user.full_name || user.name || '');
      fetchNumbers();
    }
    // Busca o número de WhatsApp do sistema
    apiClient.auth.getSystemWhatsapp().then(d => setWaNumber(d?.number || '')).catch(() => {});
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.auth.updateProfile({ full_name: fullName, whatsapp_phone: whatsappPhone });
      await checkAppState();
      toast.success('Perfil atualizado com sucesso!');
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar perfil.');
    } finally {
      setSaving(false);
    }
  };

  const waLink = waNumber
    ? `https://wa.me/${waNumber.replace(/\D/g, '')}?text=Ol%C3%A1%2C+Freedom!`
    : null;

  const handleAddNumber = async () => {
    if (!newNumber) {
      toast.error('O número não pode ficar vazio.');
      return;
    }
    setSaving(true);
    try {
      if (!numbersData?.mainNumber && numbersData?.extraNumbers.length === 0) {
         // Se não tem número principal, salva primeiro como principal por retrocompatibilidade
         await apiClient.auth.updateProfile({ whatsapp_phone: newNumber });
         await checkAppState();
      } else {
         await apiClient.auth.addWhatsappNumber(newNumber, newName);
      }
      toast.success('Número vinculado com sucesso!');
      setNewNumber('');
      setNewName('');
      fetchNumbers();
    } catch (e) {
      toast.error(e.message || 'Erro ao vincular número.');
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveNumber = async (id) => {
    if (!confirm('Deseja realmente remover este número?')) return;
    try {
      await apiClient.auth.deleteWhatsappNumber(id);
      toast.success('Número removido com sucesso!');
      if (id === 'main') await checkAppState();
      fetchNumbers();
    } catch (e) {
      toast.error(e.message || 'Erro ao remover número.');
    }
  };

  const currentCount = (numbersData?.mainNumber ? 1 : 0) + (numbersData?.extraNumbers?.length || 0);
  const canAddMore = numbersData ? currentCount < numbersData.limit : false;
  const isLinked = currentCount > 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Meu Perfil</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Gerencie seus dados e configure o acesso por WhatsApp.</p>
      </div>

      {/* Profile card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-2xl shadow">
            {(user?.name || user?.email)?.[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{user?.name || user?.full_name || '—'}</p>
            <p className="text-sm text-slate-500">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block mb-1">
              Nome completo
            </label>
            <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-800">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Seu nome"
                className="flex-1 bg-transparent text-sm text-slate-800 dark:text-white outline-none placeholder-slate-400"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvar alterações'}
          </button>
        </form>
      </div>

      {/* WhatsApp section */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 dark:text-white">Lançamentos por WhatsApp</h2>
            <p className="text-xs text-slate-500">Vincule seu número para lançar despesas e receitas por mensagem ou áudio.</p>
          </div>
          {isLinked && (
            <span className="ml-auto flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
              <CheckCircle2 className="w-3.5 h-3.5" /> Vinculado
            </span>
          )}
        </div>

        <div className="mt-5 space-y-4">
          
          {/* Lista de Números */}
          {numbersData && (
            <div className="space-y-2 mb-4">
              <div className="flex justify-between items-center mb-2">
                 <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Números Vinculados</p>
                 <p className="text-xs text-slate-400 font-medium">{currentCount} / {numbersData.limit} utilizados</p>
              </div>
              
              {numbersData.mainNumber && (
                <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-white">{numbersData.mainNumber.phone}</p>
                      <p className="text-xs text-slate-500">Principal</p>
                    </div>
                  </div>
                  <button onClick={() => handleRemoveNumber('main')} className="text-red-500 hover:text-red-600 text-xs font-medium px-2 py-1 bg-red-50 dark:bg-red-500/10 rounded-lg transition-colors">
                    Remover
                  </button>
                </div>
              )}

              {numbersData.extraNumbers.map(n => (
                <div key={n.id} className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3 rounded-xl">
                  <div className="flex items-center gap-3">
                    <Phone className="w-4 h-4 text-green-600" />
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-white">{n.phone}</p>
                      {n.name && <p className="text-xs text-slate-500">{n.name}</p>}
                    </div>
                  </div>
                  <button onClick={() => handleRemoveNumber(n.id)} className="text-red-500 hover:text-red-600 text-xs font-medium px-2 py-1 bg-red-50 dark:bg-red-500/10 rounded-lg transition-colors">
                    Remover
                  </button>
                </div>
              ))}
            </div>
          )}

          {canAddMore ? (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-3">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide block">
                Vincular novo número de WhatsApp
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-800 flex-1">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="tel"
                    value={newNumber}
                    onChange={e => setNewNumber(e.target.value)}
                    placeholder="Ex: 5511999999999"
                    className="w-full bg-transparent text-sm text-slate-800 dark:text-white outline-none placeholder-slate-400"
                  />
                </div>
                <div className="flex items-center gap-2 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2.5 bg-slate-50 dark:bg-slate-800 flex-1">
                  <User className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="De quem é? (Opcional)"
                    className="w-full bg-transparent text-sm text-slate-800 dark:text-white outline-none placeholder-slate-400"
                  />
                </div>
              </div>
              <p className="text-xs text-slate-400">Digite apenas números, incluindo o 55. Exemplo: 5511987654321</p>

              <button
                onClick={handleAddNumber}
                disabled={saving || loadingNumbers}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl py-2.5 text-sm flex items-center justify-center gap-2 transition-colors"
              >
                {saving || loadingNumbers ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                  <><Plus className="w-4 h-4" /> Adicionar Número</>
                )}
              </button>
            </div>
          ) : (
            <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-500 text-sm font-medium p-4 rounded-xl text-center">
              Você já atingiu o limite de {numbersData?.limit} número(s) de WhatsApp para o seu plano.
            </div>
          )}
        </div>

        {/* Instrucoes */}
        <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Como usar</p>
          <div className="space-y-3">
            {[
              { icon: Type, title: 'Texto', desc: '"Gastei 80 reais no mercado no débito"' },
              { icon: Mic, title: 'Áudio', desc: 'Grave um áudio descrevendo o lançamento' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-white">{title}</p>
                  <p className="text-xs text-slate-500 italic">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
            <p className="text-xs text-slate-500">
              A IA irá interpretar sua mensagem, pedir confirmação e lançar automaticamente na família selecionada. Funciona com texto e áudio em português.
            </p>
          </div>
        </div>

        {/* Botão iniciar conversa */}
        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 flex items-center justify-center gap-2 w-full border-2 border-green-500 text-green-600 font-semibold rounded-xl py-2.5 text-sm hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
          >
            <MessageCircle className="w-4 h-4" />
            Abrir conversa com o Freedom no WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
