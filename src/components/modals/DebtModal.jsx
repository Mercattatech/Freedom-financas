import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DEBT_TYPES = [
  { value: 'CARTAO_CREDITO', label: 'Cartão de Crédito' },
  { value: 'FINANCIAMENTO', label: 'Financiamento' },
  { value: 'EMPRESTIMO', label: 'Empréstimo' },
  { value: 'IMPOSTO', label: 'Imposto' },
  { value: 'OUTROS', label: 'Outros' }
];

export default function DebtModal({ open, onOpenChange, onSave, debt, familyId }) {
  const [formData, setFormData] = useState({
    nome_divida: '',
    credor: '',
    tipo: 'EMPRESTIMO',
    saldo_inicial: '',
    saldo_atual: '',
    juros_mensal_percent: '',
    data_inicio: new Date().toISOString().split('T')[0],
    vencimento_dia: '',
    status: 'ATIVA'
  });

  useEffect(() => {
    if (debt) {
      setFormData({
        nome_divida: debt.nome_divida || '',
        credor: debt.credor || '',
        tipo: debt.tipo || 'EMPRESTIMO',
        saldo_inicial: debt.saldo_inicial?.toString() || '',
        saldo_atual: debt.saldo_atual?.toString() || '',
        juros_mensal_percent: debt.juros_mensal_percent?.toString() || '',
        data_inicio: debt.data_inicio || new Date().toISOString().split('T')[0],
        vencimento_dia: debt.vencimento_dia?.toString() || '',
        status: debt.status || 'ATIVA'
      });
    } else {
      setFormData({
        nome_divida: '',
        credor: '',
        tipo: 'EMPRESTIMO',
        saldo_inicial: '',
        saldo_atual: '',
        juros_mensal_percent: '',
        data_inicio: new Date().toISOString().split('T')[0],
        vencimento_dia: '',
        status: 'ATIVA'
      });
    }
  }, [debt, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const saldoAtual = parseFloat(formData.saldo_atual) || 0;
    const saldoInicial = parseFloat(formData.saldo_inicial) || saldoAtual;
    
    onSave({
      ...formData,
      family_id: familyId,
      saldo_inicial: saldoInicial,
      saldo_atual: saldoAtual,
      juros_mensal_percent: parseFloat(formData.juros_mensal_percent) || 0,
      vencimento_dia: formData.vencimento_dia ? parseInt(formData.vencimento_dia) : null
    }, debt?.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{debt ? 'Editar Dívida' : 'Nova Dívida'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Dívida *</Label>
            <Input
              value={formData.nome_divida}
              onChange={(e) => setFormData({ ...formData, nome_divida: e.target.value })}
              placeholder="Ex: Financiamento do Carro"
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Credor</Label>
            <Input
              value={formData.credor}
              onChange={(e) => setFormData({ ...formData, credor: e.target.value })}
              placeholder="Ex: Banco X"
            />
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DEBT_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Saldo Inicial (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.saldo_inicial}
                onChange={(e) => setFormData({ ...formData, saldo_inicial: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Saldo Atual (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.saldo_atual}
                onChange={(e) => setFormData({ ...formData, saldo_atual: e.target.value })}
                placeholder="0,00"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Juros Mensal (%)</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.juros_mensal_percent}
                onChange={(e) => setFormData({ ...formData, juros_mensal_percent: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Dia Vencimento</Label>
              <Input
                type="number"
                min="1"
                max="31"
                value={formData.vencimento_dia}
                onChange={(e) => setFormData({ ...formData, vencimento_dia: e.target.value })}
                placeholder="15"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Data de Início</Label>
            <Input
              type="date"
              value={formData.data_inicio}
              onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700">
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}