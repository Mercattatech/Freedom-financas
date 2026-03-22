import React, { useState } from 'react';
import { useUserAccess } from '../components/hooks/useUserAccess';
import { apiClient } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, Users, Heart, Baby, MoreVertical, Pencil, Trash2, CheckCircle } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";


const FAMILY_TYPES = [
  { value: 'SEM_FILHOS', label: 'Sem Filhos', icon: Heart, description: 'Casal sem dependentes' },
  { value: '2_FILHOS', label: '2 Filhos', icon: Baby, description: '2 crianças/dependentes' },
  { value: '3_FILHOS', label: '3 Filhos', icon: Baby, description: '3 crianças/dependentes' },
  { value: '4_FILHOS', label: '4 Filhos', icon: Baby, description: '4 crianças/dependentes' },
  { value: '5_FILHOS', label: '5 Filhos', icon: Baby, description: '5+ crianças/dependentes' }
];

export default function Families() {
  const queryClient = useQueryClient();
  const { limits, isAdmin } = useUserAccess();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFamily, setEditingFamily] = useState(null);
  const [selectedFamilyId, setSelectedFamilyId] = useState(() => localStorage.getItem('selectedFamilyId'));
  const [formData, setFormData] = useState({
    nome_familia: '',
    tipo_familia: 'SEM_FILHOS'
  });

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => apiClient.auth.me()
  });

  const { data: families = [], isLoading } = useQuery({
    queryKey: ['families', user?.email],
    queryFn: () => apiClient.entities.Family.filter({ created_by: user.email }),
    enabled: !!user
  });

  const saveFamilyMutation = useMutation({
    mutationFn: async ({ data, id }) => {
      if (id) {
        return await apiClient.entities.Family.update(id, data);
      } else {
        const newFamily = await apiClient.entities.Family.create(data);
        return newFamily;
      }
    },
    onSuccess: (savedFamily, variables) => {
      queryClient.invalidateQueries(['families']);
      queryClient.invalidateQueries(['categories']);
      queryClient.invalidateQueries(['subcategories']);
      setModalOpen(false);
      setEditingFamily(null);
      setFormData({ nome_familia: '', tipo_familia: 'SEM_FILHOS' });
      
      // Select the newly created family if it was a creation (not update)
      if (!variables.id && savedFamily && savedFamily.id) {
        localStorage.setItem('selectedFamilyId', savedFamily.id);
        setSelectedFamilyId(savedFamily.id);
      }
    }
  });

  const deleteFamilyMutation = useMutation({
    mutationFn: async (familyId) => {
      // Delete all related data
      const categories = await apiClient.entities.Category.filter({ family_id: familyId });
      for (const cat of categories) {
        const subcats = await apiClient.entities.Subcategory.filter({ category_id: cat.id });
        for (const sub of subcats) {
          await apiClient.entities.Subcategory.delete(sub.id);
        }
        await apiClient.entities.Category.delete(cat.id);
      }

      const months = await apiClient.entities.FinancialMonth.filter({ family_id: familyId });
      for (const month of months) {
        const incomes = await apiClient.entities.Income.filter({ month_id: month.id });
        for (const income of incomes) {
          await apiClient.entities.Income.delete(income.id);
        }
        
        const expenses = await apiClient.entities.Expense.filter({ month_id: month.id });
        for (const expense of expenses) {
          await apiClient.entities.Expense.delete(expense.id);
        }

        const budgets = await apiClient.entities.Budget.filter({ month_id: month.id });
        for (const budget of budgets) {
          await apiClient.entities.Budget.delete(budget.id);
        }

        await apiClient.entities.FinancialMonth.delete(month.id);
      }

      const debts = await apiClient.entities.Debt.filter({ family_id: familyId });
      for (const debt of debts) {
        await apiClient.entities.Debt.delete(debt.id);
      }

      await apiClient.entities.Family.delete(familyId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['families']);
      // Clear selected family from localStorage if it was deleted
      const selectedFamilyId = localStorage.getItem('selectedFamilyId');
      const stillExists = families.some(f => f.id === selectedFamilyId);
      if (!stillExists) {
        localStorage.removeItem('selectedFamilyId');
      }
    }
  });

  const handleOpenModal = (family = null) => {
    if (family) {
      setEditingFamily(family);
      setFormData({
        nome_familia: family.nome_familia,
        tipo_familia: family.tipo_familia
      });
    } else {
      setEditingFamily(null);
      setFormData({ nome_familia: '', tipo_familia: 'SEM_FILHOS' });
    }
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!formData.nome_familia.trim()) return;
    
    saveFamilyMutation.mutate({
      data: {
        nome_familia: formData.nome_familia.trim(),
        tipo_familia: formData.tipo_familia,
        moeda: 'BRL'
      },
      id: editingFamily?.id
    });
  };

  const handleSetActive = (familyId) => {
    localStorage.setItem('selectedFamilyId', familyId);
    setSelectedFamilyId(familyId);
    queryClient.invalidateQueries();
  };

  const getFamilyTypeLabel = (tipo) => {
    return FAMILY_TYPES.find(t => t.value === tipo)?.label || tipo;
  };

  const getFamilyTypeColor = (tipo) => {
    const colors = {
      'SEM_FILHOS': 'bg-purple-100 text-purple-700',
      '2_FILHOS': 'bg-blue-100 text-blue-700',
      '3_FILHOS': 'bg-green-100 text-green-700',
      '4_FILHOS': 'bg-amber-100 text-amber-700',
      '5_FILHOS': 'bg-red-100 text-red-700'
    };
    return colors[tipo] || 'bg-slate-100 text-slate-700';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* Aviso de limite */}
        {!isAdmin && limits?.limite_familias && families.length >= limits.limite_familias && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <span className="text-xl">⚠️</span>
            <div>
              <p className="font-semibold text-amber-800 text-sm">Limite de famílias atingido</p>
              <p className="text-amber-700 text-xs mt-0.5">
                Seu plano <strong>{limits?.plan_nome}</strong> permite até <strong>{limits.limite_familias} família{limits.limite_familias > 1 ? 's' : ''}</strong>.
                Faça upgrade para adicionar mais.
              </p>
            </div>
          </div>
        )}

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Famílias</h1>
            <p className="text-slate-500 mt-1">Gerencie as famílias do seu curso</p>
          </div>
          {(isAdmin || families.length < (limits?.limite_familias || 1)) && (
            <Button
              onClick={() => handleOpenModal()}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="w-4 h-4 mr-2" /> Nova Família
            </Button>
          )}
        </motion.div>

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-xl"
        >
          <div className="flex items-center gap-2 text-blue-800">
            <Users className="w-5 h-5" />
            <span className="font-medium">
              {families.length} família(s) cadastrada(s) • 
              Família ativa: <strong>{families.find(f => f.id === selectedFamilyId)?.nome_familia || 'Nenhuma'}</strong>
            </span>
          </div>
        </motion.div>

        {/* Families Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {families.map((family) => {
            const isActive = family.id === selectedFamilyId;
            return (
              <Card
              key={family.id}
              className={cn(
                "p-6 border-2 transition-all duration-300 hover:shadow-lg",
                isActive ? "border-emerald-500 bg-emerald-50/50" : "border-slate-200 hover:border-emerald-300"
              )}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center",
                      isActive ? "bg-emerald-100" : "bg-slate-100"
                    )}>
                      <Users className={cn("w-6 h-6", isActive ? "text-emerald-600" : "text-slate-600")} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        {family.nome_familia}
                        {isActive && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                      </h3>
                      <Badge className={cn("mt-1", getFamilyTypeColor(family.tipo_familia))}>
                        {getFamilyTypeLabel(family.tipo_familia)}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!isActive && (
                        <DropdownMenuItem onClick={() => handleSetActive(family.id)}>
                          <CheckCircle className="w-4 h-4 mr-2" /> Ativar Família
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleOpenModal(family)}>
                        <Pencil className="w-4 h-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => { 
                          if (confirm(`Tem certeza que deseja excluir a família "${family.nome_familia}"? Todos os dados serão perdidos.`)) {
                            deleteFamilyMutation.mutate(family.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-2 text-sm text-slate-600">
                  <div className="flex justify-between">
                    <span>Moeda:</span>
                    <span className="font-medium">{family.moeda}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Criado em:</span>
                    <span className="font-medium">
                      {new Date(family.created_date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>

                {isActive && (
                  <div className="mt-4 pt-4 border-t border-emerald-200">
                    <p className="text-xs text-emerald-700 font-medium text-center">
                      ✓ Família ativa no momento
                    </p>
                  </div>
                )}
              </Card>
            );
          })}

          {families.length === 0 && (
            <div className="col-span-full">
              <Card className="p-12 text-center border-2 border-dashed">
                <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 mb-4">Nenhuma família cadastrada</p>
                <Button onClick={() => handleOpenModal()} className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4 mr-2" /> Cadastrar Primeira Família
                </Button>
              </Card>
            </div>
          )}
        </motion.div>
      </div>

      {/* Family Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingFamily ? 'Editar Família' : 'Nova Família'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Nome da Família *</Label>
              <Input
                value={formData.nome_familia}
                onChange={(e) => setFormData({ ...formData, nome_familia: e.target.value })}
                placeholder="Ex: Família Silva"
                autoFocus
              />
            </div>

            <div className="space-y-3">
              <Label>Tipo de Família *</Label>
              <RadioGroup 
                value={formData.tipo_familia} 
                onValueChange={(v) => setFormData({ ...formData, tipo_familia: v })}
                className="grid gap-3"
              >
                {FAMILY_TYPES.map((type) => {
                  const Icon = type.icon;
                  return (
                    <div key={type.value}>
                      <RadioGroupItem value={type.value} id={type.value} className="peer sr-only" />
                      <Label
                        htmlFor={type.value}
                        className="flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all peer-data-[state=checked]:border-emerald-500 peer-data-[state=checked]:bg-emerald-50 hover:bg-slate-50"
                      >
                        <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center peer-data-[state=checked]:bg-emerald-100">
                          <Icon className="w-5 h-5 text-slate-600" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{type.label}</p>
                          <p className="text-sm text-slate-500">{type.description}</p>
                        </div>
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button 
                className="flex-1 bg-emerald-600 hover:bg-emerald-700" 
                onClick={handleSave}
                disabled={!formData.nome_familia.trim()}
              >
                {editingFamily ? 'Salvar' : 'Criar Família'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}