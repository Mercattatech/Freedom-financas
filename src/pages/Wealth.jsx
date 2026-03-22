import React, { useState } from 'react';
import { apiClient } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Landmark, Home, Car, Wallet, Plus, Trash2, ArrowUpRight, ArrowDownRight, Scale, Coins, HardDrive } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ASSET_TYPES = {
  IMOVEL: { label: 'Imóvel / Terreno', icon: Home, color: '#3B82F6' },
  VEICULO: { label: 'Veículo', icon: Car, color: '#F59E0B' },
  DINHEIRO: { label: 'Dinheiro / Conta Corrente', icon: Wallet, color: '#10B981' },
  RECEBIVEL: { label: 'Direito / Herança', icon: Scale, color: '#8B5CF6' },
  OUTROS: { label: 'Outros Bens', icon: HardDrive, color: '#64748B' },
};

export default function Wealth() {
  const queryClient = useQueryClient();
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [newAsset, setNewAsset] = useState({ nome: '', tipo: 'IMOVEL', valor: '', descricao: '' });

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

  const familyId = family?.id;

  // Queries para Patrimônio
  const { data: assets = [] } = useQuery({
    queryKey: ['assets', familyId],
    queryFn: () => apiClient.entities.Asset.filter({ family_id: familyId }),
    enabled: !!familyId
  });

  const { data: investmentBoxes = [] } = useQuery({
    queryKey: ['investmentBoxes', familyId],
    queryFn: () => apiClient.entities.InvestmentBox.filter({ family_id: familyId }),
    enabled: !!familyId
  });

  const { data: stockInvestments = [] } = useQuery({
    queryKey: ['stockInvestments', familyId],
    queryFn: () => apiClient.entities.StockInvestment.filter({ family_id: familyId }),
    enabled: !!familyId
  });

  const { data: debts = [] } = useQuery({
    queryKey: ['debts', familyId],
    queryFn: () => apiClient.entities.Debt.filter({ family_id: familyId }),
    enabled: !!familyId
  });

  // Mutações
  const createAssetMutation = useMutation({
    mutationFn: (data) => apiClient.entities.Asset.create({ ...data, family_id: familyId }),
    onSuccess: () => {
      queryClient.invalidateQueries(['assets']);
      setIsAssetModalOpen(false);
      setNewAsset({ nome: '', tipo: 'IMOVEL', valor: '', descricao: '' });
      toast.success('Bem adicionado ao patrimônio!');
    }
  });

  const deleteAssetMutation = useMutation({
    mutationFn: (id) => apiClient.entities.Asset.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['assets']);
      toast.success('Bem removido com sucesso.');
    }
  });

  const handleSaveAsset = () => {
    if (!newAsset.nome || !newAsset.valor) {
      toast.error("Preencha o nome e o valor estimado do bem.");
      return;
    }
    createAssetMutation.mutate({
      ...newAsset,
      valor: parseFloat(newAsset.valor.replace(',', '.'))
    });
  };

  const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  // Cálculos de Totais
  const totalAssetsFisicos = assets.reduce((acc, curr) => acc + (curr.valor || 0), 0);
  const totalCaixinhas = investmentBoxes.reduce((acc, curr) => acc + (curr.saldo_atual || 0), 0);
  const totalBolsa = stockInvestments.reduce((acc, curr) => acc + (curr.quantidade * (curr.preco_atual || curr.preco_medio)), 0);
  
  const totalAtivos = totalAssetsFisicos + totalCaixinhas + totalBolsa;
  
  const totalPassivos = debts.filter(d => d.status === 'ATIVA').reduce((acc, curr) => acc + (curr.saldo_atual || 0), 0);
  
  const patrimonioLiquido = totalAtivos - totalPassivos;

  // Dados para o Gráfico de Ativos
  const chartDataAtivos = [
    { name: 'Dinheiro/Caixinhas', value: totalCaixinhas, color: '#10B981' },
    { name: 'Ações/Fundos', value: totalBolsa, color: '#06B6D4' },
    ...assets.map(a => ({
      name: a.nome,
      value: a.valor,
      color: ASSET_TYPES[a.tipo]?.color || '#64748B'
    }))
  ].filter(i => i.value > 0);

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      <div className="bg-slate-900 px-4 sm:px-6 lg:px-8 pt-10 pb-24">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">Balanço Patrimonial</h1>
            <p className="text-slate-400 mt-2">Visão consolidada do verdadeiro patrimônio da família.</p>
          </motion.div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="p-6 border-0 shadow-lg bg-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
              <div className="relative">
                <div className="flex items-center gap-3 text-emerald-600 mb-2">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <ArrowUpRight className="w-5 h-5" />
                  </div>
                  <span className="font-semibold text-sm">Ativos (Bens e Direitos)</span>
                </div>
                <h3 className="text-3xl font-bold text-slate-800">{formatCurrency(totalAtivos)}</h3>
                <p className="text-xs text-slate-400 mt-2">Tudo que possui valor financeiro</p>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card className="p-6 border-0 shadow-lg bg-white relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
              <div className="relative">
                <div className="flex items-center gap-3 text-red-600 mb-2">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <ArrowDownRight className="w-5 h-5" />
                  </div>
                  <span className="font-semibold text-sm">Passivos (Dívidas)</span>
                </div>
                <h3 className="text-3xl font-bold text-slate-800">{formatCurrency(totalPassivos)}</h3>
                <p className="text-xs text-slate-400 mt-2">Obrigações e financiamentos</p>
              </div>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <Card className={cn(
               "p-6 border-0 shadow-lg relative overflow-hidden group text-white",
               patrimonioLiquido >= 0 ? "bg-gradient-to-br from-indigo-500 to-blue-700" : "bg-gradient-to-br from-red-500 to-rose-700"
            )}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-bl-full -mr-8 -mt-8 transition-transform group-hover:scale-110" />
              <div className="relative">
                <div className="flex items-center gap-3 text-indigo-100 mb-2">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Landmark className="w-5 h-5" />
                  </div>
                  <span className="font-semibold text-sm">Patrimônio Líquido Real</span>
                </div>
                <h3 className="text-3xl font-bold">{formatCurrency(patrimonioLiquido)}</h3>
                <p className="text-xs text-indigo-100 mt-2">A verdadeira riqueza da família</p>
              </div>
            </Card>
          </motion.div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Lista de Ativos Cadastrados */}
            <Card className="p-6 shadow-sm border-0 border-t-4 border-t-indigo-500 bg-white">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-800">Meus Bens Físicos e Direitos</h2>
                  <p className="text-sm text-slate-500">Casas, carros, terrenos e heranças.</p>
                </div>
                <Button onClick={() => setIsAssetModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700">
                  <Plus className="w-4 h-4 mr-2" /> Adicionar Bem
                </Button>
              </div>

              {assets.length === 0 ? (
                <div className="text-center py-12 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-4">
                    <Home className="w-8 h-8 text-indigo-400" />
                  </div>
                  <h3 className="text-slate-800 font-medium mb-1">Nenhum bem cadastrado</h3>
                  <p className="text-slate-500 text-sm max-w-sm mx-auto">
                    Adicione seus imóveis, veículos e outros bens para calcular o verdadeiro patrimônio líquido.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AnimatePresence>
                    {assets.map(asset => {
                      const TypeIcon = ASSET_TYPES[asset.tipo]?.icon || HardDrive;
                      const typeColor = ASSET_TYPES[asset.tipo]?.color || '#64748B';
                      return (
                        <motion.div
                          key={asset.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="p-4 rounded-xl border border-slate-100 bg-slate-50 relative group hover:shadow-md transition-shadow"
                        >
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white shadow-sm" style={{ color: typeColor }}>
                                <TypeIcon className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="font-semibold text-slate-800 leading-tight">{asset.nome}</h4>
                                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 mt-1 inline-block">
                                  {ASSET_TYPES[asset.tipo]?.label}
                                </span>
                              </div>
                            </div>
                            <button 
                              onClick={() => {
                                if(confirm('Remover este bem do seu patrimônio?')) deleteAssetMutation.mutate(asset.id);
                              }}
                              className="text-slate-300 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="mt-4">
                            <p className="text-2xl font-bold text-slate-800">{formatCurrency(asset.valor)}</p>
                            {asset.descricao && (
                              <p className="text-sm text-slate-500 mt-1 truncate">{asset.descricao}</p>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              )}
            </Card>

            {/* Outros componentes que formam o patrimônio: Investimentos e Dívidas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="p-5 shadow-sm border-0 bg-white">
                 <div className="flex items-center gap-3 mb-4 text-slate-800">
                    <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg"><Coins className="w-5 h-5"/></div>
                    <h3 className="font-bold">Investimentos (Ativos)</h3>
                 </div>
                 <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-600 font-medium">Caixinhas (Renda Fixa)</span>
                      <span className="font-bold text-slate-800">{formatCurrency(totalCaixinhas)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-600 font-medium">Bolsa de Valores (Ações)</span>
                      <span className="font-bold text-slate-800">{formatCurrency(totalBolsa)}</span>
                    </div>
                    <p className="text-xs text-slate-400 text-center mt-2 px-4">
                      Estes valores são atualizados diretamente das suas carteiras de investimentos.
                    </p>
                 </div>
              </Card>

              <Card className="p-5 shadow-sm border-0 bg-white">
                 <div className="flex items-center gap-3 mb-4 text-slate-800">
                    <div className="p-2 bg-red-100 text-red-600 rounded-lg"><ArrowDownRight className="w-5 h-5"/></div>
                    <h3 className="font-bold">Dívidas (Passivos)</h3>
                 </div>
                 <div className="space-y-3">
                    {debts.filter(d => d.status === 'ATIVA').slice(0, 3).map(d => (
                       <div key={d.id} className="flex justify-between items-center p-3 bg-red-50/50 rounded-lg">
                          <span className="text-sm text-slate-700 font-medium truncate max-w-[140px]">{d.nome_divida}</span>
                          <span className="font-bold text-red-600">{formatCurrency(d.saldo_atual)}</span>
                       </div>
                    ))}
                    {debts.length === 0 && <p className="text-sm text-slate-500 p-3 text-center">Nenhuma dívida ativa registrada.</p>}
                    <p className="text-xs text-slate-400 text-center mt-2 px-4">
                      Saldos de dívidas e financiamentos subtraem o seu patrimônio.
                    </p>
                 </div>
              </Card>
            </div>
          </div>

          <div className="lg:col-span-1">
            <Card className="p-6 shadow-sm border-0 bg-white sticky top-6">
              <h3 className="font-bold text-slate-800 mb-6 text-lg">Distribuição dos Ativos</h3>
              {totalAtivos > 0 ? (
                <>
                  <div className="h-64 mb-6 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={chartDataAtivos}
                          innerRadius={60}
                          outerRadius={85}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {chartDataAtivos.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                           formatter={(value) => formatCurrency(value)}
                           contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 15px rgba(0,0,0,0.1)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                       <span className="text-xs text-slate-400 font-medium">Total Ativos</span>
                       <span className="text-sm font-bold text-slate-800">{formatCurrency(totalAtivos)}</span>
                    </div>
                  </div>
                  <div className="space-y-3 max-h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                    {chartDataAtivos.sort((a,b)=> b.value - a.value).map((item, i) => (
                      <div key={i} className="flex justify-between items-center">
                        <div className="flex items-center gap-2 overflow-hidden">
                           <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                           <span className="text-sm text-slate-600 truncate">{item.name}</span>
                        </div>
                        <span className="text-sm font-semibold text-slate-800 pl-2">
                           {((item.value / totalAtivos) * 100).toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-10 opacity-50">
                   <Landmark className="w-16 h-16 mx-auto mb-2 opacity-50 text-slate-300" />
                   <p className="text-sm text-slate-500">Adicione bens para ver o gráfico.</p>
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={isAssetModalOpen} onOpenChange={setIsAssetModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Adicionar Bem ao Patrimônio</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Bem</Label>
              <Input 
                placeholder="Ex: Apartamento Centro, BMW X1..." 
                value={newAsset.nome} 
                onChange={e => setNewAsset({...newAsset, nome: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                 <Label>Tipo de Bem</Label>
                 <Select value={newAsset.tipo} onValueChange={v => setNewAsset({...newAsset, tipo: v})}>
                   <SelectTrigger>
                     <SelectValue />
                   </SelectTrigger>
                   <SelectContent>
                     {Object.entries(ASSET_TYPES).map(([key, data]) => (
                       <SelectItem key={key} value={key}>
                         <div className="flex items-center gap-2">
                            <data.icon className="w-4 h-4" style={{ color: data.color }}/>
                            {data.label}
                         </div>
                       </SelectItem>
                     ))}
                   </SelectContent>
                 </Select>
               </div>
               <div className="space-y-2">
                 <Label>Valor Estimado (R$)</Label>
                 <Input 
                   type="number"
                   placeholder="0.00" 
                   value={newAsset.valor} 
                   onChange={e => setNewAsset({...newAsset, valor: e.target.value})}
                 />
               </div>
            </div>
            <div className="space-y-2">
              <Label>Descrição Adicional (Opcional)</Label>
              <Input 
                placeholder="Ex: Herança avó materna, Quitado..." 
                value={newAsset.descricao} 
                onChange={e => setNewAsset({...newAsset, descricao: e.target.value})}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAssetModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveAsset} className="bg-indigo-600 hover:bg-indigo-700">
               Adicionar ao Patrimônio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}