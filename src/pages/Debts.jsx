import React, { useState } from 'react';
import { apiClient } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Pencil, Trash2, CreditCard, TrendingDown, Calculator, CheckCircle, History, Calendar } from "lucide-react";
import { motion } from "framer-motion";

import DebtModal from '@/components/modals/DebtModal';


export default function Debts() {
  const queryClient = useQueryClient();
  const [debtModalOpen, setDebtModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState(null);
  const [selectedDebt, setSelectedDebt] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => apiClient.auth.me()
  });

  const { data: families = [] } = useQuery({
    queryKey: ['families', user?.email],
    queryFn: () => apiClient.entities.Family.filter({ created_by: user.email }),
    enabled: !!user
  });

  const selectedFamilyId = localStorage.getItem('selectedFamilyId');
  const family = selectedFamilyId 
    ? families.find(f => f.id === selectedFamilyId) 
    : families[0];

  const { data: debts = [] } = useQuery({
    queryKey: ['debts', family?.id],
    queryFn: () => apiClient.entities.Debt.filter({ family_id: family.id }),
    enabled: !!family
  });

  const { data: payments = [] } = useQuery({
    queryKey: ['debtPayments'],
    queryFn: () => apiClient.entities.DebtPayment.list()
  });

  // ── Credit Card Faturas ──
  const { data: creditCards = [] } = useQuery({
    queryKey: ['creditcards', family?.id],
    queryFn: () => apiClient.entities.CreditCard.filter({ family_id: family.id, ativo: true }),
    enabled: !!family
  });
  // Busca todas as expenses que são faturas auto-geradas da família
  const { data: allFaturas = [] } = useQuery({
    queryKey: ['faturas-cartao', family?.id],
    queryFn: async () => {
      // Busca expenses is_fatura_cartao=true via filter
      const resp = await apiClient.entities.Expense.filter({ family_id: family.id, is_fatura_cartao: true });
      return resp;
    },
    enabled: !!family
  });

  const saveDebtMutation = useMutation({
    mutationFn: ({ data, id }) => id ? apiClient.entities.Debt.update(id, data) : apiClient.entities.Debt.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['debts']);
      setDebtModalOpen(false);
      setEditingDebt(null);
    }
  });

  const deleteDebtMutation = useMutation({
    mutationFn: (id) => apiClient.entities.Debt.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['debts'])
  });

  const paymentMutation = useMutation({
    mutationFn: async ({ debtId, amount }) => {
      const debt = debts.find(d => d.id === debtId);
      const newBalance = Math.max(0, (debt.saldo_atual || 0) - amount);
      
      await apiClient.entities.DebtPayment.create({
        month_id: 'payment',
        debt_id: debtId,
        valor_pagamento: amount,
        data_pagamento: paymentDate
      });

      await apiClient.entities.Debt.update(debtId, {
        saldo_atual: newBalance,
        status: newBalance === 0 ? 'QUITADA' : 'ATIVA'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['debts']);
      queryClient.invalidateQueries(['debtPayments']);
      setPaymentModalOpen(false);
      setPaymentAmount('');
    }
  });

  const handleSaveDebt = (data, id) => {
    saveDebtMutation.mutate({ data, id });
  };

  const handlePayment = () => {
    const amount = parseFloat(paymentAmount);
    if (amount > 0 && selectedDebt) {
      paymentMutation.mutate({ debtId: selectedDebt.id, amount });
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const getDebtTypeLabel = (tipo) => {
    const labels = {
      'CARTAO_CREDITO': 'Cartão de Crédito',
      'FINANCIAMENTO': 'Financiamento',
      'EMPRESTIMO': 'Empréstimo',
      'IMPOSTO': 'Imposto',
      'OUTROS': 'Outros'
    };
    return labels[tipo] || tipo;
  };

  const getDebtTypeColor = (tipo) => {
    const colors = {
      'CARTAO_CREDITO': 'bg-purple-100 text-purple-700',
      'FINANCIAMENTO': 'bg-blue-100 text-blue-700',
      'EMPRESTIMO': 'bg-amber-100 text-amber-700',
      'IMPOSTO': 'bg-red-100 text-red-700',
      'OUTROS': 'bg-slate-100 text-slate-700'
    };
    return colors[tipo] || 'bg-slate-100 text-slate-700';
  };

  const calculateProjectedBalance = (debt, months) => {
    const rate = (debt.juros_mensal_percent || 0) / 100;
    return debt.saldo_atual * Math.pow(1 + rate, months);
  };

  const activeDebts = debts.filter(d => d.status === 'ATIVA');
  const paidDebts = debts.filter(d => d.status === 'QUITADA');
  const totalDebt = activeDebts.reduce((sum, d) => sum + (d.saldo_atual || 0), 0);
  const totalInitial = activeDebts.reduce((sum, d) => sum + (d.saldo_inicial || d.saldo_atual || 0), 0);
  const totalPaid = totalInitial - totalDebt;
  const progressPercent = totalInitial > 0 ? ((totalPaid / totalInitial) * 100) : 0;

  // Total de faturas de cartão pendentes
  const totalFaturas = allFaturas.reduce((s, f) => s + (f.valor || 0), 0);
  const fmt = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Dívidas</h1>
            <p className="text-slate-500 mt-1">Acompanhe e quite suas dívidas</p>
          </div>
          <Button
            onClick={() => { setEditingDebt(null); setDebtModalOpen(true); }}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4 mr-2" /> Nova Dívida
          </Button>
        </motion.div>

        {/* Summary Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8"
        >
          <Card className="p-6 border-0 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-red-50 rounded-lg">
                <CreditCard className="w-5 h-5 text-red-600" />
              </div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Saldo Devedor</p>
            </div>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalDebt)}</p>
            {totalFaturas > 0 && (
              <p className="text-xs text-slate-500 mt-1">+ {fmt(totalFaturas)} em faturas de cartão</p>
            )}
          </Card>
          <Card className="p-6 border-0 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <TrendingDown className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Já Pago</p>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalPaid)}</p>
          </Card>
          <Card className="p-6 border-0 shadow-sm">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-violet-50 rounded-lg">
                <Calculator className="w-5 h-5 text-violet-600" />
              </div>
              <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Progresso</p>
            </div>
            <div className="space-y-2">
              <p className="text-2xl font-bold text-slate-900">{progressPercent.toFixed(1)}%</p>
              <Progress value={progressPercent} className="h-2 [&>div]:bg-emerald-500" />
            </div>
          </Card>
        </motion.div>

        {/* Active Debts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4 mb-8"
        >
          <h2 className="text-lg font-semibold text-slate-800">Dívidas Ativas ({activeDebts.length})</h2>
          {activeDebts.length === 0 ? (
            <Card className="p-12 border-0 shadow-sm text-center">
              <CheckCircle className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
              <p className="text-slate-600">Parabéns! Você não tem dívidas ativas.</p>
            </Card>
          ) : (
            <div className="grid gap-4">
              {activeDebts.map((debt) => {
                const paidAmount = (debt.saldo_inicial || debt.saldo_atual) - debt.saldo_atual;
                const paidPercent = debt.saldo_inicial ? (paidAmount / debt.saldo_inicial) * 100 : 0;
                const projected3m = calculateProjectedBalance(debt, 3);

                return (
                  <Card key={debt.id} className="p-6 border-0 shadow-sm">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      <div className="flex items-start gap-4">
                        <div className="p-3 bg-slate-100 rounded-xl">
                          <CreditCard className="w-6 h-6 text-slate-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-800">{debt.nome_divida}</h3>
                          <p className="text-sm text-slate-500">{debt.credor || 'Sem credor'}</p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge className={getDebtTypeColor(debt.tipo)}>
                              {getDebtTypeLabel(debt.tipo)}
                            </Badge>
                            {debt.juros_mensal_percent > 0 && (
                              <Badge variant="outline" className="text-red-600 border-red-200">
                                {debt.juros_mensal_percent}% a.m.
                              </Badge>
                            )}
                            {debt.vencimento_dia && (
                              <Badge variant="outline">
                                Vence dia {debt.vencimento_dia}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-2xl font-bold text-slate-900">
                            {formatCurrency(debt.saldo_atual)}
                          </p>
                          {debt.saldo_inicial && (
                            <p className="text-sm text-slate-500">
                              de {formatCurrency(debt.saldo_inicial)}
                            </p>
                          )}
                          {debt.juros_mensal_percent > 0 && (
                            <p className="text-xs text-red-500 mt-1">
                              Em 3 meses: {formatCurrency(projected3m)}
                            </p>
                          )}
                        </div>

                        <div className="flex gap-2">
                          <Button
                            onClick={() => { setSelectedDebt(debt); setPaymentModalOpen(true); }}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            Pagar
                          </Button>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => { setSelectedDebt(debt); setHistoryModalOpen(true); }}>
                                <History className="w-4 h-4 mr-2" /> Extrato
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => { setEditingDebt(debt); setDebtModalOpen(true); }}>
                                <Pencil className="w-4 h-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => deleteDebtMutation.mutate(debt.id)}
                              >
                                <Trash2 className="w-4 h-4 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>

                    {debt.saldo_inicial && (
                      <div className="mt-4">
                        <div className="flex justify-between text-sm text-slate-500 mb-1">
                          <span>Progresso de pagamento</span>
                          <span>{paidPercent.toFixed(1)}%</span>
                        </div>
                        <Progress value={paidPercent} className="h-2 [&>div]:bg-emerald-500" />
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ── Faturas de Cartão ── */}
        {creditCards.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-4 mb-8"
          >
            <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-purple-600" /> Faturas de Cartão
            </h2>
            <div className="grid gap-3">
              {creditCards.map(card => {
                const fatura = allFaturas.find(f => f.credit_card_id === card.id);
                const valor = fatura?.valor || 0;
                const vencimento = fatura?.data;
                const limiteUsado = card.limite > 0 ? (valor / card.limite) * 100 : 0;
                const hoje = new Date();
                const vencDate = vencimento ? new Date(vencimento + 'T00:00:00') : null;
                const diasVenc = vencDate ? Math.ceil((vencDate - hoje) / (1000 * 60 * 60 * 24)) : null;
                const isVencida = diasVenc !== null && diasVenc < 0;
                const isProxima = diasVenc !== null && diasVenc <= 7 && diasVenc >= 0;

                return (
                  <Card key={card.id} className={`p-5 border-0 shadow-sm ${
                    isVencida ? 'bg-red-50 ring-1 ring-red-200' :
                    isProxima ? 'bg-amber-50 ring-1 ring-amber-200' : ''
                  }`}>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: card.cor || '#6366F1' }}>
                          <CreditCard className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{card.nome}</p>
                          <p className="text-xs text-slate-500">
                            {card.ultimos_digitos ? `•••• ${card.ultimos_digitos} · ` : ''}
                            Fecha dia {card.dia_fechamento} · Vence dia {card.dia_vencimento}
                          </p>
                          {vencimento && (
                            <p className={`text-xs font-medium mt-0.5 ${
                              isVencida ? 'text-red-600' : isProxima ? 'text-amber-600' : 'text-slate-500'
                            }`}>
                              {isVencida
                                ? `⚠️ Vencida há ${Math.abs(diasVenc)} dias`
                                : isProxima
                                ? `⏰ Vence em ${diasVenc} dia${diasVenc !== 1 ? 's' : ''}`
                                : `Vence em ${format(new Date(vencimento + 'T00:00:00'), 'dd/MM/yyyy')}`
                              }
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {valor > 0 ? (
                          <>
                            <p className="text-xl font-bold text-slate-900">{fmt(valor)}</p>
                            {card.limite > 0 && (
                              <>
                                <div className="w-28 h-1.5 bg-slate-200 rounded-full mt-2 overflow-hidden">
                                  <div className="h-full rounded-full transition-all"
                                    style={{
                                      width: `${Math.min(limiteUsado, 100)}%`,
                                      backgroundColor: limiteUsado > 90 ? '#EF4444' : limiteUsado > 70 ? '#F97316' : '#6366F1'
                                    }} />
                                </div>
                                <p className="text-xs text-slate-400 mt-0.5 text-right">{limiteUsado.toFixed(0)}% do limite</p>
                              </>
                            )}
                          </>
                        ) : (
                          <Badge className="bg-emerald-100 text-emerald-700">Sem débito</Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Paid Debts */}
        {paidDebts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-slate-800">Dívidas Quitadas ({paidDebts.length})</h2>
            <div className="grid gap-4">
              {paidDebts.map((debt) => (
                <Card key={debt.id} className="p-4 border-0 shadow-sm bg-emerald-50/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                      <div>
                        <p className="font-medium text-slate-800">{debt.nome_divida}</p>
                        <p className="text-sm text-slate-500">{debt.credor}</p>
                      </div>
                    </div>
                    <Badge className="bg-emerald-100 text-emerald-700">Quitada</Badge>
                  </div>
                </Card>
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Debt Modal */}
      <DebtModal
        open={debtModalOpen}
        onOpenChange={setDebtModalOpen}
        onSave={handleSaveDebt}
        debt={editingDebt}
        familyId={family?.id}
      />

      {/* Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="font-medium text-slate-800">{selectedDebt?.nome_divida}</p>
              <p className="text-sm text-slate-500">
                Saldo atual: {formatCurrency(selectedDebt?.saldo_atual || 0)}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Valor do Pagamento (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label>Data do Pagamento</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>

            <div className="flex gap-3 mt-4">
              <Button variant="outline" className="flex-1" onClick={() => setPaymentModalOpen(false)}>
                Cancelar
              </Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handlePayment}>
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Modal */}
      <Dialog open={historyModalOpen} onOpenChange={setHistoryModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Extrato de Pagamentos</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-lg">
              <p className="font-medium text-slate-800">{selectedDebt?.nome_divida}</p>
              <p className="text-sm text-slate-500">
                Saldo atual: {formatCurrency(selectedDebt?.saldo_atual || 0)}
              </p>
            </div>

            <div className="space-y-3">
              {payments.filter(p => p.debt_id === selectedDebt?.id).length === 0 ? (
                <div className="text-center py-6 text-slate-400">
                  <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p>Nenhum pagamento registrado ainda.</p>
                </div>
              ) : (
                payments.filter(p => p.debt_id === selectedDebt?.id)
                  .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
                  .map((payment) => (
                    <div key={payment.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-lg bg-white shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                          <CheckCircle className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">{formatCurrency(payment.valor_pagamento)}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> 
                            {format(new Date(payment.data_pagamento + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))
              )}
            </div>

            <Button variant="outline" className="w-full mt-4" onClick={() => setHistoryModalOpen(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}