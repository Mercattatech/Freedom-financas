import React, { useState } from 'react';
import { apiClient } from '@/api/apiClient';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertCircle, Bell, Trash2, Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function AlertManager({ alerts = [], familyId, currentPrices = {}, stocks = [] }) {
  const [open, setOpen] = useState(false);
  const [ticker, setTicker] = useState('');
  const [filteredStocks, setFilteredStocks] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [targetPrice, setTargetPrice] = useState('');
  const [alertType, setAlertType] = useState('PISO');
  const queryClient = useQueryClient();

  const handleTickerChange = (value) => {
    const upper = value.toUpperCase();
    setTicker(upper);
    if (upper) {
      setFilteredStocks(stocks.filter(s => s.ticker.includes(upper)).slice(0, 5));
      setShowDropdown(true);
    } else {
      setFilteredStocks([]);
      setShowDropdown(false);
    }
  };

  const selectTicker = (selectedTicker) => {
    setTicker(selectedTicker);
    setFilteredStocks([]);
    setShowDropdown(false);
  };

  const createAlertMutation = useMutation({
    mutationFn: async () => {
      const newAlert = {
        family_id: familyId,
        ticker: ticker.toUpperCase(),
        target_price: parseFloat(targetPrice),
        alert_type: alertType,
        is_active: true
      };
      return await apiClient.entities.StockAlert.create(newAlert);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stockAlerts'] });
      toast.success('Alerta criado com sucesso');
      setTicker('');
      setTargetPrice('');
      setAlertType('PISO');
      setOpen(false);
    },
    onError: (error) => {
      toast.error('Erro ao criar alerta');
      console.error(error);
    }
  });

  const deleteAlertMutation = useMutation({
    mutationFn: (alertId) => apiClient.entities.StockAlert.delete(alertId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stockAlerts'] });
      toast.success('Alerta removido');
    },
    onError: () => {
      toast.error('Erro ao remover alerta');
    }
  });

  const toggleAlertMutation = useMutation({
    mutationFn: (alert) => 
      apiClient.entities.StockAlert.update(alert.id, { is_active: !alert.is_active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stockAlerts'] });
    },
    onError: () => {
      toast.error('Erro ao atualizar alerta');
    }
  });

  const getAlertStatus = (alert) => {
    const currentPrice = currentPrices[alert.ticker];
    if (!currentPrice) return null;

    if (alert.alert_type === 'TETO' && currentPrice >= alert.target_price) return 'ATINGIDO';
    if (alert.alert_type === 'PISO' && currentPrice <= alert.target_price) return 'ATINGIDO';
    return null;
  };

  const alertsTriggered = alerts.filter(a => getAlertStatus(a) === 'ATINGIDO');

  return (
    <Card className="border-0 shadow-sm">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-blue-500" />
          <h2 className="font-semibold text-slate-800">Alertas de Preço</h2>
          {alertsTriggered.length > 0 && (
            <Badge className="bg-red-100 text-red-700 ml-2">{alertsTriggered.length}</Badge>
          )}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-2">
              <Plus className="w-4 h-4" /> Novo Alerta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Alerta de Preço</DialogTitle>
              <DialogDescription>Defina um preço alvo para receber notificações</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
               <div className="relative">
                 <label className="text-sm font-medium text-slate-700 mb-1 block">Ticker</label>
                 <Input 
                   placeholder="Busque uma ação..."
                   value={ticker}
                   onChange={(e) => handleTickerChange(e.target.value)}
                   onFocus={() => ticker && setShowDropdown(true)}
                   maxLength="10"
                 />
                 {showDropdown && filteredStocks.length > 0 && (
                   <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                     {filteredStocks.map((stock) => (
                       <button
                         key={stock.id}
                         onClick={() => selectTicker(stock.ticker)}
                         className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 flex justify-between items-center"
                       >
                         <span className="font-medium text-slate-800">{stock.ticker}</span>
                         <span className="text-xs text-slate-500">{stock.nome_empresa}</span>
                       </button>
                     ))}
                   </div>
                 )}
               </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Preço Alvo</label>
                <Input 
                  type="number"
                  placeholder="ex: 25.50"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  step="0.01"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Tipo de Alerta</label>
                <div className="flex gap-2">
                  <Button 
                    variant={alertType === 'PISO' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setAlertType('PISO')}
                  >
                    📉 Piso (Comprar)
                  </Button>
                  <Button 
                    variant={alertType === 'TETO' ? 'default' : 'outline'}
                    size="sm"
                    className="flex-1"
                    onClick={() => setAlertType('TETO')}
                  >
                    📈 Teto (Vender)
                  </Button>
                </div>
              </div>
              <Button 
                onClick={() => createAlertMutation.mutate()}
                disabled={!ticker || !targetPrice || createAlertMutation.isPending}
                className="w-full"
              >
                Criar Alerta
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="divide-y divide-slate-100">
        {alertsTriggered.length > 0 && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-900 text-sm">{alertsTriggered.length} alerta(s) atingido(s)!</p>
                <p className="text-xs text-red-700 mt-1">
                  {alertsTriggered.map(a => `${a.ticker} atingiu R$ ${a.target_price.toFixed(2)}`).join(', ')}
                </p>
              </div>
            </div>
          </div>
        )}

        {alerts.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">Nenhum alerta configurado</div>
        ) : (
          alerts.map((alert) => {
            const status = getAlertStatus(alert);
            const currentPrice = currentPrices[alert.ticker] || '-';
            
            return (
              <div key={alert.id} className={cn(
                "p-4 flex items-center justify-between hover:bg-slate-50 transition-colors",
                status === 'ATINGIDO' && "bg-red-50"
              )}>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-800">{alert.ticker}</span>
                    <Badge variant="outline" className="text-xs">
                      {alert.alert_type === 'PISO' ? '📉 Piso' : '📈 Teto'}
                    </Badge>
                    {status === 'ATINGIDO' && (
                      <Badge className="bg-red-100 text-red-700 text-xs">⚠️ Atingido</Badge>
                    )}
                  </div>
                  <div className="text-sm text-slate-600">
                    <span>Alvo: R$ {alert.target_price.toFixed(2)}</span>
                    <span className="mx-2">•</span>
                    <span>Atual: R$ {typeof currentPrice === 'number' ? currentPrice.toFixed(2) : currentPrice}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                   <Button 
                     size="icon"
                     variant="ghost"
                     onClick={() => toggleAlertMutation.mutate(alert)}
                     className="h-8 w-8"
                     title={alert.is_active ? "Desativar alerta" : "Ativar alerta"}
                   >
                     <Bell className={cn("w-4 h-4", !alert.is_active && "opacity-50")} />
                   </Button>
                   <Button 
                     size="icon"
                     variant="ghost"
                     onClick={() => {
                       if (confirm(`Deseja excluir o alerta de ${alert.ticker}?`)) {
                         deleteAlertMutation.mutate(alert.id);
                       }
                     }}
                     disabled={deleteAlertMutation.isPending}
                     className="h-8 w-8 text-red-600 hover:text-red-700"
                     title="Excluir alerta"
                   >
                     <Trash2 className="w-4 h-4" />
                   </Button>
                 </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}