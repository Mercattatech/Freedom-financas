// @ts-nocheck
import React, { useState } from 'react';
import { apiClient } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, differenceInMonths, addMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Plus, Target, TrendingUp, Pencil, Trash2, MoreVertical, Calendar, PiggyBank, CheckCircle, Sparkles, Trophy, Rocket, Heart, Home, Car, Plane, GraduationCap, Shield } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { formatCurrency } from '@/utils/formatCurrency';

const GOAL_ICONS = {
  VIAGEM: { icon: Plane, color: '#3B82F6', label: 'Viagem' },
  CARRO: { icon: Car, color: '#F59E0B', label: 'Carro' },
  CASA: { icon: Home, color: '#8B5CF6', label: 'Casa' },
  EDUCACAO: { icon: GraduationCap, color: '#10B981', label: 'Educação' },
  EMERGENCIA: { icon: Shield, color: '#EF4444', label: 'Reserva de Emergência' },
  CASAMENTO: { icon: Heart, color: '#EC4899', label: 'Casamento' },
  INVESTIMENTO: { icon: TrendingUp, color: '#14B8A6', label: 'Investimento' },
  OUTRO: { icon: Target, color: '#6366F1', label: 'Outro' },
};

const emptyGoal = () => ({
  nome: '',
  tipo: 'VIAGEM',
  valor_alvo: '',
  valor_atual: '',
  prazo: format(addMonths(new Date(), 6), 'yyyy-MM-dd'),
  descricao: '',
  ativo: true
});

export default function Goals() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [depositAmount, setDepositAmount] = useState('');
  const [form, setForm] = useState(emptyGoal());
  const [filter, setFilter] = useState('ativas'); // ativas, concluidas, todas

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
  const family = selectedFamilyId ? families.find(f => f.id === selectedFamilyId) : families[0];

  // Query goals - using a generic entity store
  const { data: goals = [], isLoading } = useQuery({
    queryKey: ['goals', family?.id],
    queryFn: async () => {
      try {
        return await apiClient.entities.Goal.filter({ family_id: family.id });
      } catch {
        // If Goal entity doesn't exist yet, return empty
        return [];
      }
    },
    enabled: !!family
  });

  const saveMutation = useMutation({
    mutationFn: ({ data, id }) => id
      ? apiClient.entities.Goal.update(id, data)
      : apiClient.entities.Goal.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['goals']);
      setModalOpen(false);
      setEditing(null);
      setForm(emptyGoal());
      toast.success(editing ? 'Meta atualizada!' : 'Meta criada!');
    },
    onError: (e) => toast.error('Erro: ' + e.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.entities.Goal.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['goals']);
      toast.success('Meta removida');
    }
  });

  const depositMutation = useMutation({
    mutationFn: async ({ goalId, amount }) => {
      const goal = goals.find(g => g.id === goalId);
      const newAmount = (goal.valor_atual || 0) + amount;
      const isComplete = newAmount >= (goal.valor_alvo || 0);
      await apiClient.entities.Goal.update(goalId, {
        valor_atual: newAmount,
        ativo: !isComplete,
        concluida: isComplete
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['goals']);
      setDepositModalOpen(false);
      setDepositAmount('');
      toast.success('Depósito registrado! 🎉');
    }
  });

  const handleSave = (e) => {
    e.preventDefault();
    if (!form.nome || !form.valor_alvo) {
      toast.error('Nome e valor alvo são obrigatórios');
      return;
    }
    saveMutation.mutate({
      data: {
        ...form,
        family_id: family?.id || 'mock_family_id_fallback',
        valor_alvo: parseFloat(form.valor_alvo) || 0,
        valor_atual: parseFloat(form.valor_atual) || 0,
      },
      id: editing?.id
    });
  };

  const handleDeposit = () => {
    const amount = parseFloat(depositAmount);
    if (amount > 0 && selectedGoal) {
      depositMutation.mutate({ goalId: selectedGoal.id, amount });
    }
  };

  const openEdit = (goal) => {
    setEditing(goal);
    setForm({
      nome: goal.nome || '',
      tipo: goal.tipo || 'OUTRO',
      valor_alvo: String(goal.valor_alvo || ''),
      valor_atual: String(goal.valor_atual || ''),
      prazo: goal.prazo || '',
      descricao: goal.descricao || '',
      ativo: goal.ativo !== false
    });
    setModalOpen(true);
  };

  const f = (v) => setForm(prev => ({ ...prev, ...v }));

  const filteredGoals = goals.filter(g => {
    if (filter === 'ativas') return g.ativo !== false && !g.concluida;
    if (filter === 'concluidas') return g.concluida;
    return true;
  });

  const totalTarget = goals.filter(g => g.ativo !== false).reduce((s, g) => s + (g.valor_alvo || 0), 0);
  const totalSaved = goals.filter(g => g.ativo !== false).reduce((s, g) => s + (g.valor_atual || 0), 0);
  const totalProgress = totalTarget > 0 ? (totalSaved / totalTarget * 100) : 0;
  const completedGoals = goals.filter(g => g.concluida).length;

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
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Metas Financeiras</h1>
            <p className="text-slate-500 mt-1">Defina objetivos e acompanhe seu progresso</p>
          </div>
          <Button
            onClick={() => { setEditing(null); setForm(emptyGoal()); setModalOpen(true); }}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4 mr-2" /> Nova Meta
          </Button>
        </motion.div>

        {/* Summary Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8"
        >
          <Card className="p-5 border-0 shadow-sm bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5" />
              <p className="text-sm font-medium text-indigo-100">Total a Alcançar</p>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(totalTarget)}</p>
          </Card>
          <Card className="p-5 border-0 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <PiggyBank className="w-5 h-5 text-emerald-600" />
              <p className="text-xs font-medium text-slate-500 uppercase">Já Guardado</p>
            </div>
            <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalSaved)}</p>
          </Card>
          <Card className="p-5 border-0 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Rocket className="w-5 h-5 text-indigo-600" />
              <p className="text-xs font-medium text-slate-500 uppercase">Progresso Geral</p>
            </div>
            <p className="text-2xl font-bold text-slate-800">{totalProgress.toFixed(1)}%</p>
            <Progress value={Math.min(totalProgress, 100)} className="h-2 mt-2 [&>div]:bg-indigo-500" />
          </Card>
          <Card className="p-5 border-0 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="w-5 h-5 text-yellow-600" />
              <p className="text-xs font-medium text-slate-500 uppercase">Metas Concluídas</p>
            </div>
            <p className="text-2xl font-bold text-slate-800">{completedGoals}</p>
          </Card>
        </motion.div>

        {/* Filter */}
        <div className="flex gap-2 mb-6 bg-slate-100 p-1 rounded-xl w-fit">
          {[
            { key: 'ativas', label: 'Ativas' },
            { key: 'concluidas', label: 'Concluídas' },
            { key: 'todas', label: 'Todas' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`py-2 px-4 rounded-lg text-sm font-medium transition-all ${filter === f.key ? 'bg-white shadow text-slate-800' : 'text-slate-500'
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Goals Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredGoals.map(goal => {
            const goalType = GOAL_ICONS[goal.tipo] || GOAL_ICONS.OUTRO;
            const Icon = goalType.icon;
            const progress = goal.valor_alvo > 0 ? (goal.valor_atual || 0) / goal.valor_alvo * 100 : 0;
            const remaining = (goal.valor_alvo || 0) - (goal.valor_atual || 0);
            const monthsLeft = goal.prazo ? Math.max(0, differenceInMonths(new Date(goal.prazo), new Date())) : 0;
            const monthlyNeeded = monthsLeft > 0 ? remaining / monthsLeft : remaining;
            const isComplete = goal.concluida || progress >= 100;

            return (
              <Card key={goal.id} className={`p-6 border-0 shadow-sm transition-all hover:shadow-lg ${isComplete ? 'bg-emerald-50/50 ring-2 ring-emerald-200' : ''}`}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ backgroundColor: goalType.color + '20' }}
                    >
                      {isComplete ? (
                        <CheckCircle className="w-6 h-6 text-emerald-600" />
                      ) : (
                        <Icon className="w-6 h-6" style={{ color: goalType.color }} />
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">{goal.nome}</h3>
                      <Badge variant="outline" className="text-xs mt-1" style={{ borderColor: goalType.color + '40', color: goalType.color }}>
                        {goalType.label}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon"><MoreVertical className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(goal)}>
                        <Pencil className="w-4 h-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-red-600" onClick={() => {
                        if (confirm(`Excluir meta "${goal.nome}"?`)) deleteMutation.mutate(goal.id);
                      }}>
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {goal.descricao && (
                  <p className="text-sm text-slate-500 mb-4">{goal.descricao}</p>
                )}

                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Progresso</span>
                    <span className="font-semibold text-slate-800">{Math.min(progress, 100).toFixed(1)}%</span>
                  </div>
                  <Progress
                    value={Math.min(progress, 100)}
                    className={`h-3 [&>div]:transition-all [&>div]:duration-500 ${isComplete ? '[&>div]:bg-emerald-500' : '[&>div]:bg-indigo-500'
                      }`}
                  />

                  <div className="grid grid-cols-2 gap-3 text-center pt-2">
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500">Guardado</p>
                      <p className="text-sm font-bold text-emerald-600">{formatCurrency(goal.valor_atual || 0)}</p>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg">
                      <p className="text-xs text-slate-500">Meta</p>
                      <p className="text-sm font-bold text-slate-800">{formatCurrency(goal.valor_alvo || 0)}</p>
                    </div>
                  </div>

                  {!isComplete && (
                    <div className="p-3 bg-indigo-50 rounded-lg space-y-1">
                      {goal.prazo && (
                        <div className="flex items-center gap-2 text-xs text-indigo-700">
                          <Calendar className="w-3 h-3" />
                          <span>Prazo: {format(new Date(goal.prazo), 'dd/MM/yyyy', { locale: ptBR })}</span>
                          <span className="font-bold">({monthsLeft} meses)</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-xs text-indigo-700">
                        <Sparkles className="w-3 h-3" />
                        <span>Guardar <strong>{formatCurrency(monthlyNeeded)}</strong>/mês para atingir</span>
                      </div>
                    </div>
                  )}

                  {!isComplete && (
                    <Button
                      onClick={() => { setSelectedGoal(goal); setDepositModalOpen(true); }}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 mt-2"
                      size="sm"
                    >
                      <Plus className="w-4 h-4 mr-2" /> Depositar
                    </Button>
                  )}

                  {isComplete && (
                    <div className="text-center py-2">
                      <p className="text-emerald-600 font-bold text-sm">🎉 Meta alcançada!</p>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}

          {filteredGoals.length === 0 && (
            <div className="col-span-full">
              <Card className="p-12 text-center border-2 border-dashed border-slate-200">
                <Target className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-4">
                  {filter === 'concluidas' ? 'Nenhuma meta concluída ainda' : 'Nenhuma meta criada'}
                </p>
                {filter !== 'concluidas' && (
                  <Button
                    onClick={() => { setEditing(null); setForm(emptyGoal()); setModalOpen(true); }}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Criar Primeira Meta
                  </Button>
                )}
              </Card>
            </div>
          )}
        </motion.div>
      </div>

      {/* Goal Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Meta' : 'Nova Meta Financeira'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Meta *</Label>
              <Input value={form.nome} onChange={e => f({ nome: e.target.value })} placeholder="Ex: Viagem para Europa" required />
            </div>

            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => f({ tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(GOAL_ICONS).map(([key, val]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <val.icon className="w-4 h-4" style={{ color: val.color }} />
                        {val.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor Alvo (R$) *</Label>
                <Input type="number" step="0.01" value={form.valor_alvo} onChange={e => f({ valor_alvo: e.target.value })} placeholder="10000" required />
              </div>
              <div className="space-y-2">
                <Label>Valor Atual (R$)</Label>
                <Input type="number" step="0.01" value={form.valor_atual} onChange={e => f({ valor_atual: e.target.value })} placeholder="0" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Prazo</Label>
              <Input type="date" value={form.prazo} onChange={e => f({ prazo: e.target.value })} />
            </div>

            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Input value={form.descricao} onChange={e => f({ descricao: e.target.value })} placeholder="Detalhes sobre a meta..." />
            </div>

            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700">
                {editing ? 'Salvar' : 'Criar Meta'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deposit Modal */}
      <Dialog open={depositModalOpen} onOpenChange={setDepositModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Depositar na Meta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedGoal && (
              <div className="p-4 bg-slate-50 rounded-lg">
                <p className="font-medium text-slate-800">{selectedGoal.nome}</p>
                <p className="text-sm text-slate-500 mt-1">
                  Saldo atual: {formatCurrency(selectedGoal.valor_atual || 0)} de {formatCurrency(selectedGoal.valor_alvo || 0)}
                </p>
                <p className="text-sm text-slate-500">
                  Faltam: {formatCurrency((selectedGoal.valor_alvo || 0) - (selectedGoal.valor_atual || 0))}
                </p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Valor do Depósito (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={depositAmount}
                onChange={e => setDepositAmount(e.target.value)}
                placeholder="0,00"
                autoFocus
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDepositModalOpen(false)}>
                Cancelar
              </Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleDeposit}>
                Depositar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
