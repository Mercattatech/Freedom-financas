import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";

const PAYMENT_METHODS = [
  { value: 'PIX', label: 'PIX' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'DEBITO', label: 'Débito' },
  { value: 'CREDITO', label: 'Crédito' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'TRANSFERENCIA', label: 'Transferência' },
  { value: 'OUTRO', label: 'Outro' }
];

export default function ExpenseModal({ open, onOpenChange, onSave, expense, monthId, categories, subcategories }) {
  const [formData, setFormData] = useState({
    descricao: '',
    valor: '',
    data: new Date().toISOString().split('T')[0],
    category_id: '',
    subcategory_id: '',
    forma_pagamento: 'PIX',
    recorrente: false,
    observacoes: ''
  });

  useEffect(() => {
    if (expense) {
      setFormData({
        descricao: expense.descricao || '',
        valor: expense.valor?.toString() || '',
        data: expense.data || new Date().toISOString().split('T')[0],
        category_id: expense.category_id || '',
        subcategory_id: expense.subcategory_id || '',
        forma_pagamento: expense.forma_pagamento || 'PIX',
        recorrente: expense.recorrente || false,
        observacoes: expense.observacoes || ''
      });
    } else {
      setFormData({
        descricao: '',
        valor: '',
        data: new Date().toISOString().split('T')[0],
        category_id: categories[0]?.id || '',
        subcategory_id: '',
        forma_pagamento: 'PIX',
        recorrente: false,
        observacoes: ''
      });
    }
  }, [expense, open, categories]);

  const filteredSubcategories = subcategories.filter(s => s.category_id === formData.category_id);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      ...formData,
      month_id: monthId,
      valor: parseFloat(formData.valor) || 0
    }, expense?.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{expense ? 'Editar Despesa' : 'Nova Despesa'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Descrição *</Label>
            <Input
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              placeholder="Ex: Supermercado"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.valor}
                onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
                placeholder="0,00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Data *</Label>
              <Input
                type="date"
                value={formData.data}
                onChange={(e) => setFormData({ ...formData, data: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Categoria *</Label>
            <Select value={formData.category_id} onValueChange={(v) => setFormData({ ...formData, category_id: v, subcategory_id: '' })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.cor || '#10B981' }} />
                      {cat.nome}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filteredSubcategories.length > 0 && (
            <div className="space-y-2">
              <Label>Subcategoria</Label>
              <Select value={formData.subcategory_id} onValueChange={(v) => setFormData({ ...formData, subcategory_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {filteredSubcategories.map(sub => (
                    <SelectItem key={sub.id} value={sub.id}>{sub.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Forma de Pagamento</Label>
            <Select value={formData.forma_pagamento} onValueChange={(v) => setFormData({ ...formData, forma_pagamento: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_METHODS.map(m => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label>Despesa Recorrente</Label>
            <Switch
              checked={formData.recorrente}
              onCheckedChange={(v) => setFormData({ ...formData, recorrente: v })}
            />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              placeholder="Notas adicionais..."
              rows={2}
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