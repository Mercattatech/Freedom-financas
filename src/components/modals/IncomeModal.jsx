import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const INCOME_TYPES = [
  { value: 'SALARIO_MARIDO', label: 'Salário do Marido' },
  { value: 'SALARIO_ESPOSA', label: 'Salário da Esposa' },
  { value: 'PENSAO_ALIMENTICIA', label: 'Pensão Alimentícia' },
  { value: 'COMISSOES', label: 'Comissões' },
  { value: 'RESTITUICAO_IR', label: 'Restituição IR' },
  { value: 'RENDA_EXTRA', label: 'Renda Extra' },
  { value: 'OUTRAS', label: 'Outras' }
];

export default function IncomeModal({ open, onOpenChange, onSave, income, monthId }) {
  const [formData, setFormData] = useState({
    tipo: 'SALARIO_MARIDO',
    descricao: '',
    valor: '',
    data_recebimento: new Date().toISOString().split('T')[0],
    recorrente: false,
    ativo: true
  });

  useEffect(() => {
    if (income) {
      setFormData({
        tipo: income.tipo || 'SALARIO_MARIDO',
        descricao: income.descricao || '',
        valor: income.valor?.toString() || '',
        data_recebimento: income.data_recebimento || new Date().toISOString().split('T')[0],
        recorrente: income.recorrente || false,
        ativo: income.ativo !== false
      });
    } else {
      setFormData({
        tipo: 'SALARIO_MARIDO',
        descricao: '',
        valor: '',
        data_recebimento: new Date().toISOString().split('T')[0],
        recorrente: false,
        ativo: true
      });
    }
  }, [income, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...formData,
      month_id: monthId,
      valor: parseFloat(formData.valor) || 0
    }, income?.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{income ? 'Editar Renda' : 'Nova Renda'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Renda</Label>
            <Select value={formData.tipo} onValueChange={(v) => setFormData({ ...formData, tipo: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {INCOME_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Input
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Ex: Salário mensal"
            />
          </div>

          <div className="space-y-2">
            <Label>Valor (R$)</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.valor}
              onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
              placeholder="0,00"
            />
          </div>

          <div className="space-y-2">
            <Label>Data de Recebimento</Label>
            <Input
              type="date"
              value={formData.data_recebimento}
              onChange={(e) => setFormData({ ...formData, data_recebimento: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label>Recorrente</Label>
            <Switch
              checked={formData.recorrente}
              onCheckedChange={(v) => setFormData({ ...formData, recorrente: v })}
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