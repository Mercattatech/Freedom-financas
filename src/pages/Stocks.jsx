import React, { useState } from 'react';
import { apiClient } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Plus, TrendingUp, TrendingDown, MoreVertical, Pencil, Trash2, RefreshCw, BarChart3 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import MarketPanel from "@/components/stocks/MarketPanel";
import NewsPanel from "@/components/stocks/NewsPanel";
import AlertManager from "@/components/stocks/AlertManager";

const TIPOS = [
  { value: 'ACAO_BR', label: 'Ação BR' },
  { value: 'ACAO_EUA', label: 'Ação EUA' },
  { value: 'FII', label: 'FII' },
  { value: 'ETF', label: 'ETF' },
  { value: 'BDR', label: 'BDR' },
];

const formatCurrency = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);
const formatPercent = (v) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

const EMPTY_FORM = {
  ticker: '', nome_empresa: '', tipo: 'ACAO_BR', quantidade: '', preco_medio: '',
  preco_atual: '', data_primeira_compra: '', setor: ''
};

export default function Stocks() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [updatingPrice, setUpdatingPrice] = useState(null);
  const [newPrice, setNewPrice] = useState('');

  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => apiClient.auth.me() });
  const { data: families = [] } = useQuery({
    queryKey: ['families', user?.email],
    queryFn: () => apiClient.entities.Family.filter({ created_by: user.email }),
    enabled: !!user
  });
  const selectedFamilyId = localStorage.getItem('selectedFamilyId');
  const family = selectedFamilyId ? families.find(f => f.id === selectedFamilyId) : families[0];

  const { data: stocks = [] } = useQuery({
    queryKey: ['stocks', family?.id],
    queryFn: () => apiClient.entities.StockInvestment.filter({ family_id: family.id, ativo: true }),
    enabled: !!family
  });

  const { data: alerts = [] } = useQuery({
    queryKey: ['stockAlerts', family?.id],
    queryFn: () => apiClient.entities.StockAlert.filter({ family_id: family.id, is_active: true }),
    enabled: !!family
  });

  const saveMutation = useMutation({
    mutationFn: ({ data, id }) => id
      ? apiClient.entities.StockInvestment.update(id, data)
      : apiClient.entities.StockInvestment.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['stocks']);
      setModalOpen(false);
      toast.success(editing ? 'Ativo atualizado!' : 'Ativo adicionado!');
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => apiClient.entities.StockInvestment.update(id, { ativo: false }),
    onSuccess: () => { queryClient.invalidateQueries(['stocks']); toast.success('Ativo removido!'); }
  });

  const handleOpen = (stock = null) => {
    if (stock) {
      setEditing(stock);
      setForm({ ...EMPTY_FORM, ...stock });
    } else {
      setEditing(null);
      setForm(EMPTY_FORM);
    }
    setModalOpen(true);
  };

  const handleSave = () => {
    saveMutation.mutate({
      data: {
        ...form,
        family_id: family.id,
        quantidade: parseFloat(form.quantidade),
        preco_medio: parseFloat(form.preco_medio),
        preco_atual: form.preco_atual ? parseFloat(form.preco_atual) : parseFloat(form.preco_medio),
      },
      id: editing?.id
    });
  };

  const handleUpdatePrice = (stock) => {
    if (!newPrice) return;
    apiClient.entities.StockInvestment.update(stock.id, { preco_atual: parseFloat(newPrice) })
      .then(() => {
        queryClient.invalidateQueries(['stocks']);
        setUpdatingPrice(null);
        setNewPrice('');
        toast.success('Preço atualizado!');
      });
  };

  // Totals
  const totalInvestido = stocks.reduce((s, st) => s + (st.quantidade * st.preco_medio), 0);
  const totalAtual = stocks.reduce((s, st) => s + (st.quantidade * (st.preco_atual || st.preco_medio)), 0);
  const totalRetorno = totalAtual - totalInvestido;
  const totalRetornoPct = totalInvestido > 0 ? (totalRetorno / totalInvestido) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Carteira de Ações</h1>
            <p className="text-slate-500 mt-1">Registre e acompanhe seus investimentos</p>
          </div>
          <Button onClick={() => handleOpen()} className="bg-emerald-600 hover:bg-emerald-700">
            <Plus className="w-4 h-4 mr-2" /> Adicionar Ativo
          </Button>
        </motion.div>

        {/* Summary Cards */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Valor Investido', value: formatCurrency(totalInvestido), color: 'text-slate-700', bg: 'bg-slate-50' },
            { label: 'Valor Atual', value: formatCurrency(totalAtual), color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: 'Retorno Total', value: formatCurrency(totalRetorno), color: totalRetorno >= 0 ? 'text-emerald-700' : 'text-red-700', bg: totalRetorno >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
            { label: 'Retorno %', value: formatPercent(totalRetornoPct), color: totalRetornoPct >= 0 ? 'text-emerald-700' : 'text-red-700', bg: totalRetornoPct >= 0 ? 'bg-emerald-50' : 'bg-red-50' },
          ].map((card, i) => (
            <Card key={i} className={cn("p-5 border-0 shadow-sm", card.bg)}>
              <p className="text-xs text-slate-500 mb-1">{card.label}</p>
              <p className={cn("text-2xl font-bold", card.color)}>{card.value}</p>
            </Card>
          ))}
        </motion.div>

        {/* Market Panel */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-6">
          <MarketPanel portfolioTickers={stocks.map(s => s.ticker)} />
        </motion.div>

        {/* News Panel */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-6">
          <NewsPanel tickers={stocks.map(s => s.ticker)} />
        </motion.div>

        {/* Alert Manager */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-6">
          <AlertManager 
            alerts={alerts}
            familyId={family?.id}
            stocks={stocks}
            currentPrices={stocks.reduce((acc, s) => ({ ...acc, [s.ticker]: s.preco_atual || s.preco_medio }), {})}
          />
        </motion.div>

        {/* Stocks Table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="border-0 shadow-sm overflow-hidden">
            {stocks.length === 0 ? (
              <div className="p-16 text-center">
                <BarChart3 className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">Nenhum ativo cadastrado</p>
                <p className="text-slate-400 text-sm">Adicione suas ações, FIIs ou ETFs para acompanhar sua carteira</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                      <th className="text-left p-4 font-medium">Ativo</th>
                      <th className="text-right p-4 font-medium">Qtd</th>
                      <th className="text-right p-4 font-medium">Preço Médio</th>
                      <th className="text-right p-4 font-medium">Preço Atual</th>
                      <th className="text-right p-4 font-medium">Total Invest.</th>
                      <th className="text-right p-4 font-medium">Total Atual</th>
                      <th className="text-right p-4 font-medium">Retorno</th>
                      <th className="p-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {stocks.map((stock) => {
                      const totalInvest = stock.quantidade * stock.preco_medio;
                      const totalAtualStock = stock.quantidade * (stock.preco_atual || stock.preco_medio);
                      const retorno = totalAtualStock - totalInvest;
                      const retornoPct = totalInvest > 0 ? (retorno / totalInvest) * 100 : 0;
                      const isPositive = retorno >= 0;

                      return (
                        <tr key={stock.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
                                <span className="text-blue-700 font-bold text-xs">{stock.ticker.slice(0, 3)}</span>
                              </div>
                              <div>
                                <p className="font-semibold text-slate-800">{stock.ticker}</p>
                                <p className="text-xs text-slate-400">{stock.nome_empresa || stock.setor || '-'}</p>
                              </div>
                              <Badge variant="outline" className="text-xs">{stock.tipo?.replace('_', ' ')}</Badge>
                            </div>
                          </td>
                          <td className="p-4 text-right text-slate-700 font-mono">{stock.quantidade}</td>
                          <td className="p-4 text-right text-slate-700 font-mono">{formatCurrency(stock.preco_medio)}</td>
                          <td className="p-4 text-right">
                            {updatingPrice === stock.id ? (
                              <div className="flex items-center gap-2 justify-end">
                                <Input
                                  type="number"
                                  value={newPrice}
                                  onChange={(e) => setNewPrice(e.target.value)}
                                  className="w-24 h-7 text-xs text-right"
                                  placeholder="Novo preço"
                                />
                                <Button size="sm" className="h-7 text-xs" onClick={() => handleUpdatePrice(stock)}>OK</Button>
                                <Button size="sm" variant="ghost" className="h-7" onClick={() => setUpdatingPrice(null)}>✕</Button>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setUpdatingPrice(stock.id); setNewPrice(stock.preco_atual || ''); }}
                                className="text-blue-600 font-mono hover:underline flex items-center gap-1 ml-auto"
                                title="Clique para atualizar"
                              >
                                {formatCurrency(stock.preco_atual || stock.preco_medio)}
                                <RefreshCw className="w-3 h-3 text-slate-300" />
                              </button>
                            )}
                          </td>
                          <td className="p-4 text-right text-slate-700 font-mono">{formatCurrency(totalInvest)}</td>
                          <td className="p-4 text-right font-mono font-semibold text-slate-800">{formatCurrency(totalAtualStock)}</td>
                          <td className="p-4 text-right">
                            <div className={cn("flex flex-col items-end", isPositive ? "text-emerald-600" : "text-red-500")}>
                              <span className="font-semibold font-mono">{formatCurrency(retorno)}</span>
                              <span className="text-xs flex items-center gap-0.5">
                                {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                {formatPercent(retornoPct)}
                              </span>
                            </div>
                          </td>
                          <td className="p-4">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleOpen(stock)}>
                                  <Pencil className="w-4 h-4 mr-2" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-red-600"
                                  onClick={() => deleteMutation.mutate(stock.id)}
                                >
                                  <Trash2 className="w-4 h-4 mr-2" /> Remover
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Ativo' : 'Adicionar Ativo'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Ticker *</Label>
                <Input value={form.ticker} onChange={e => setForm(p => ({ ...p, ticker: e.target.value.toUpperCase() }))} placeholder="PETR4" />
              </div>
              <div className="space-y-1">
                <Label>Tipo</Label>
                <Select value={form.tipo} onValueChange={v => setForm(p => ({ ...p, tipo: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Nome da Empresa</Label>
              <Input value={form.nome_empresa} onChange={e => setForm(p => ({ ...p, nome_empresa: e.target.value }))} placeholder="Petrobras" />
            </div>
            <div className="space-y-1">
              <Label>Setor</Label>
              <Input value={form.setor} onChange={e => setForm(p => ({ ...p, setor: e.target.value }))} placeholder="Energia, Financeiro..." />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>Quantidade *</Label>
                <Input type="number" value={form.quantidade} onChange={e => setForm(p => ({ ...p, quantidade: e.target.value }))} placeholder="100" />
              </div>
              <div className="space-y-1">
                <Label>Preço Médio *</Label>
                <Input type="number" step="0.01" value={form.preco_medio} onChange={e => setForm(p => ({ ...p, preco_medio: e.target.value }))} placeholder="32.50" />
              </div>
              <div className="space-y-1">
                <Label>Preço Atual</Label>
                <Input type="number" step="0.01" value={form.preco_atual} onChange={e => setForm(p => ({ ...p, preco_atual: e.target.value }))} placeholder="35.00" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Data da Primeira Compra</Label>
              <Input type="date" value={form.data_primeira_compra} onChange={e => setForm(p => ({ ...p, data_primeira_compra: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!form.ticker || !form.quantidade || !form.preco_medio}>
              {editing ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}