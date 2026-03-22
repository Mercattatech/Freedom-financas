import React, { useState } from 'react';
import { apiClient } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, MoreVertical, Pencil, Trash2, PiggyBank, Wallet, ArrowUpCircle, ArrowDownCircle } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function InvestmentBoxes() {
  const queryClient = useQueryClient();
  const [boxModalOpen, setBoxModalOpen] = useState(false);
  const [depositModalOpen, setDepositModalOpen] = useState(false);
  const [editingBox, setEditingBox] = useState(null);
  const [selectedBox, setSelectedBox] = useState(null);

  const [boxForm, setBoxForm] = useState({
    nome: '',
    objetivo: '',
    valor_inicial: '',
    tipo_rendimento: 'PERCENTUAL_MENSAL',
    taxa_mensal: '1',
    taxa_anual_cdi: '110',
    cor: '#10B981'
  });

  const [depositForm, setDepositForm] = useState({
    valor: '',
    data: new Date().toISOString().split('T')[0],
    descricao: '',
    tipo: 'APORTE'
  });

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

  const { data: boxes = [] } = useQuery({
    queryKey: ['investmentBoxes', family?.id],
    queryFn: () => apiClient.entities.InvestmentBox.filter({ family_id: family.id, ativo: true }),
    enabled: !!family
  });

  const { data: allDeposits = [] } = useQuery({
    queryKey: ['investmentDeposits'],
    queryFn: () => apiClient.entities.InvestmentDeposit.list()
  });

  const saveBoxMutation = useMutation({
    mutationFn: async ({ data, id }) => {
      if (id) {
        const deposits = allDeposits.filter(d => d.box_id === id);
        const aportes = deposits.filter(d => d.tipo === 'APORTE').reduce((sum, d) => sum + (parseFloat(d.valor) || 0), 0);
        const resgates = deposits.filter(d => d.tipo === 'RESGATE').reduce((sum, d) => sum + (parseFloat(d.valor) || 0), 0);
        
        return await apiClient.entities.InvestmentBox.update(id, {
          ...data,
          saldo_atual: (data.valor_inicial || 0) + aportes - resgates
        });
      } else {
        return await apiClient.entities.InvestmentBox.create({
          ...data,
          saldo_atual: data.valor_inicial || 0
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['investmentBoxes']);
      setBoxModalOpen(false);
      setEditingBox(null);
    }
  });

  const deleteBoxMutation = useMutation({
    mutationFn: async (boxId) => {
      const deposits = allDeposits.filter(d => d.box_id === boxId);
      for (const deposit of deposits) {
        await apiClient.entities.InvestmentDeposit.delete(deposit.id);
      }
      await apiClient.entities.InvestmentBox.delete(boxId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['investmentBoxes', 'investmentDeposits']);
    }
  });

  const saveDepositMutation = useMutation({
    mutationFn: async (data) => {
      await apiClient.entities.InvestmentDeposit.create(data);
      
      const box = boxes.find(b => b.id === selectedBox.id);
      const valorAjuste = data.tipo === 'RESGATE' ? -data.valor : data.valor;
      
      await apiClient.entities.InvestmentBox.update(box.id, {
        saldo_atual: (box.saldo_atual || 0) + valorAjuste
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['investmentBoxes', 'investmentDeposits']);
      setDepositModalOpen(false);
      setDepositForm({
        valor: '',
        data: new Date().toISOString().split('T')[0],
        descricao: '',
        tipo: 'APORTE'
      });
    }
  });

  const handleSaveBox = () => {
    if (!boxForm.nome.trim()) return;
    
    const data = {
      family_id: family.id,
      nome: boxForm.nome,
      objetivo: boxForm.objetivo,
      valor_inicial: parseFloat(boxForm.valor_inicial) || 0,
      tipo_rendimento: boxForm.tipo_rendimento,
      taxa_mensal: boxForm.tipo_rendimento === 'PERCENTUAL_MENSAL' ? parseFloat(boxForm.taxa_mensal) : null,
      taxa_anual_cdi: boxForm.tipo_rendimento === 'CDB_CDI' ? parseFloat(boxForm.taxa_anual_cdi) : null,
      cor: boxForm.cor,
      ativo: true
    };

    saveBoxMutation.mutate({ data, id: editingBox?.id });
  };

  const handleSaveDeposit = () => {
    if (!depositForm.valor || !selectedBox) return;
    
    saveDepositMutation.mutate({
      box_id: selectedBox.id,
      valor: parseFloat(depositForm.valor),
      data: depositForm.data,
      descricao: depositForm.descricao,
      tipo: depositForm.tipo
    });
  };

  const getBoxDeposits = (boxId) => {
    return allDeposits.filter(d => d.box_id === boxId).sort((a, b) => 
      new Date(b.data) - new Date(a.data)
    );
  };

  const calculateProjectedValue = (box, months) => {
    let value = box.saldo_atual || 0;
    
    if (box.tipo_rendimento === 'PERCENTUAL_MENSAL' && box.taxa_mensal) {
      const rate = box.taxa_mensal / 100;
      value = value * Math.pow(1 + rate, months);
    } else if (box.tipo_rendimento === 'CDB_CDI' && box.taxa_anual_cdi) {
      const cdiAnual = 13.75; // Taxa CDI atual aproximada
      const taxaEfetiva = (cdiAnual * box.taxa_anual_cdi) / 100;
      const rateMensal = Math.pow(1 + taxaEfetiva / 100, 1/12) - 1;
      value = value * Math.pow(1 + rateMensal, months);
    }
    
    return value;
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const totalInvested = boxes.reduce((sum, box) => sum + (box.saldo_atual || 0), 0);

  if (!family) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50 flex items-center justify-center">
        <p className="text-slate-600">Selecione uma família primeiro</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
        >
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Caixinhas de Investimento</h1>
            <p className="text-slate-500 mt-1">Organize e acompanhe seus investimentos</p>
          </div>
          <Button
            onClick={() => {
              setEditingBox(null);
              setBoxForm({
                nome: '',
                objetivo: '',
                valor_inicial: '',
                tipo_rendimento: 'PERCENTUAL_MENSAL',
                taxa_mensal: '1',
                taxa_anual_cdi: '110',
                cor: '#10B981'
              });
              setBoxModalOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4 mr-2" /> Nova Caixinha
          </Button>
        </motion.div>

        {/* Total Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Card className="p-6 border-0 shadow-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-emerald-100 text-sm font-medium">Total Investido</p>
                <p className="text-3xl font-bold mt-2">{formatCurrency(totalInvested)}</p>
                <p className="text-emerald-100 text-sm mt-1">{boxes.length} caixinha(s) ativa(s)</p>
              </div>
              <div className="p-4 bg-white/20 rounded-2xl">
                <Wallet className="w-8 h-8" />
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Boxes Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {boxes.map((box) => {
            const deposits = getBoxDeposits(box.id);
            const projected12m = calculateProjectedValue(box, 12);
            const totalDeposits = deposits.filter(d => d.tipo === 'APORTE').reduce((sum, d) => sum + d.valor, 0);

            return (
              <Card key={box.id} className="p-6 border-0 shadow-sm hover:shadow-lg transition-all">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: (box.cor || '#10B981') + '20' }}
                    >
                      <PiggyBank
                        className="w-6 h-6"
                        style={{ color: box.cor || '#10B981' }}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">{box.nome}</h3>
                      {box.objetivo && (
                        <p className="text-sm text-slate-500">{box.objetivo}</p>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        setEditingBox(box);
                        setBoxForm({
                          nome: box.nome,
                          objetivo: box.objetivo || '',
                          valor_inicial: box.valor_inicial?.toString() || '',
                          tipo_rendimento: box.tipo_rendimento,
                          taxa_mensal: box.taxa_mensal?.toString() || '1',
                          taxa_anual_cdi: box.taxa_anual_cdi?.toString() || '110',
                          cor: box.cor || '#10B981'
                        });
                        setBoxModalOpen(true);
                      }}>
                        <Pencil className="w-4 h-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => {
                          if (confirm(`Excluir caixinha "${box.nome}"?`)) {
                            deleteBoxMutation.mutate(box.id);
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4 mr-2" /> Excluir
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-sm text-slate-500">Saldo Atual</p>
                    <p className="text-2xl font-bold text-slate-900">{formatCurrency(box.saldo_atual || 0)}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-slate-500">Rendimento</p>
                      <p className="font-medium text-slate-700">
                        {box.tipo_rendimento === 'PERCENTUAL_MENSAL' && `${box.taxa_mensal}% a.m.`}
                        {box.tipo_rendimento === 'CDB_CDI' && `${box.taxa_anual_cdi}% CDI`}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Em 12 meses</p>
                      <p className="font-medium text-emerald-600">{formatCurrency(projected12m)}</p>
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      setSelectedBox(box);
                      setDepositForm({
                        valor: '',
                        data: new Date().toISOString().split('T')[0],
                        descricao: '',
                        tipo: 'APORTE'
                      });
                      setDepositModalOpen(true);
                    }}
                    className="w-full bg-emerald-600 hover:bg-emerald-700"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Novo Aporte
                  </Button>

                  {deposits.length > 0 && (
                    <div className="pt-3 border-t border-slate-100">
                      <p className="text-xs text-slate-500 mb-2">Últimas movimentações:</p>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {deposits.slice(0, 3).map((deposit) => (
                          <div key={deposit.id} className="flex items-center justify-between text-xs">
                            <div className="flex items-center gap-1">
                              {deposit.tipo === 'APORTE' ? (
                                <ArrowUpCircle className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <ArrowDownCircle className="w-3 h-3 text-red-500" />
                              )}
                              <span className="text-slate-600">
                                {format(new Date(deposit.data), 'dd/MM', { locale: ptBR })}
                              </span>
                            </div>
                            <span className={cn(
                              "font-medium",
                              deposit.tipo === 'APORTE' ? "text-emerald-600" : "text-red-600"
                            )}>
                              {deposit.tipo === 'APORTE' ? '+' : '-'}{formatCurrency(deposit.valor)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
            );
          })}

          {boxes.length === 0 && (
            <div className="col-span-full">
              <Card className="p-12 text-center border-2 border-dashed">
                <PiggyBank className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <p className="text-slate-600 mb-4">Nenhuma caixinha criada ainda</p>
                <Button onClick={() => setBoxModalOpen(true)} className="bg-emerald-600 hover:bg-emerald-700">
                  <Plus className="w-4 h-4 mr-2" /> Criar Primeira Caixinha
                </Button>
              </Card>
            </div>
          )}
        </motion.div>
      </div>

      {/* Box Modal */}
      <Dialog open={boxModalOpen} onOpenChange={setBoxModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingBox ? 'Editar Caixinha' : 'Nova Caixinha'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Caixinha *</Label>
              <Input
                value={boxForm.nome}
                onChange={(e) => setBoxForm({ ...boxForm, nome: e.target.value })}
                placeholder="Ex: Viagem para Europa"
              />
            </div>

            <div className="space-y-2">
              <Label>Objetivo</Label>
              <Input
                value={boxForm.objetivo}
                onChange={(e) => setBoxForm({ ...boxForm, objetivo: e.target.value })}
                placeholder="Descrição do objetivo"
              />
            </div>

            <div className="space-y-2">
              <Label>Valor Inicial (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={boxForm.valor_inicial}
                onChange={(e) => setBoxForm({ ...boxForm, valor_inicial: e.target.value })}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Rendimento</Label>
              <Select
                value={boxForm.tipo_rendimento}
                onValueChange={(v) => setBoxForm({ ...boxForm, tipo_rendimento: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PERCENTUAL_MENSAL">Percentual Mensal Fixo</SelectItem>
                  <SelectItem value="CDB_CDI">CDB/CDI</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {boxForm.tipo_rendimento === 'PERCENTUAL_MENSAL' && (
              <div className="space-y-2">
                <Label>Taxa Mensal (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={boxForm.taxa_mensal}
                  onChange={(e) => setBoxForm({ ...boxForm, taxa_mensal: e.target.value })}
                  placeholder="1.0"
                />
              </div>
            )}

            {boxForm.tipo_rendimento === 'CDB_CDI' && (
              <div className="space-y-2">
                <Label>Taxa do CDI (% ao ano)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={boxForm.taxa_anual_cdi}
                  onChange={(e) => setBoxForm({ ...boxForm, taxa_anual_cdi: e.target.value })}
                  placeholder="110"
                />
                <p className="text-xs text-slate-500">Ex: 110 = 110% do CDI</p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={boxForm.cor}
                  onChange={(e) => setBoxForm({ ...boxForm, cor: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  value={boxForm.cor}
                  onChange={(e) => setBoxForm({ ...boxForm, cor: e.target.value })}
                  placeholder="#10B981"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setBoxModalOpen(false)}>
                Cancelar
              </Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveBox}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deposit Modal */}
      <Dialog open={depositModalOpen} onOpenChange={setDepositModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Movimentação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedBox && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-500">Caixinha:</p>
                <p className="font-medium text-slate-800">{selectedBox.nome}</p>
                <p className="text-sm text-slate-600 mt-1">
                  Saldo: {formatCurrency(selectedBox.saldo_atual || 0)}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>Tipo de Movimentação</Label>
              <Select
                value={depositForm.tipo}
                onValueChange={(v) => setDepositForm({ ...depositForm, tipo: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APORTE">Aporte (Depósito)</SelectItem>
                  <SelectItem value="RESGATE">Resgate (Retirada)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                value={depositForm.valor}
                onChange={(e) => setDepositForm({ ...depositForm, valor: e.target.value })}
                placeholder="0,00"
              />
            </div>

            <div className="space-y-2">
              <Label>Data *</Label>
              <Input
                type="date"
                value={depositForm.data}
                onChange={(e) => setDepositForm({ ...depositForm, data: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={depositForm.descricao}
                onChange={(e) => setDepositForm({ ...depositForm, descricao: e.target.value })}
                placeholder="Opcional"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setDepositModalOpen(false)}>
                Cancelar
              </Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveDeposit}>
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}