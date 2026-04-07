import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CreditCard } from "lucide-react";

const PAYMENT_METHODS = [
  { value: 'PIX', label: 'PIX' },
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'DEBITO', label: 'Débito' },
  { value: 'CREDITO', label: 'Crédito' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'TRANSFERENCIA', label: 'Transferência' },
  { value: 'OUTRO', label: 'Outro' }
];

export default function ExpenseModal({ open, onOpenChange, onSave, expense, monthId, categories, subcategories, creditCards = [] }) {
  const [formData, setFormData] = useState({
    descricao: '',
    valor: '',
    data: new Date().toISOString().split('T')[0],
    category_id: '',
    subcategory_id: '',
    forma_pagamento: 'PIX',
    recorrente: false,
    observacoes: '',
    credit_card_id: ''
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
        observacoes: expense.notes || '',
        credit_card_id: expense.credit_card_id || ''
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
        observacoes: '',
        credit_card_id: ''
      });
    }
  }, [expense, open, categories]);

  const filteredSubcategories = subcategories.filter(s => s.category_id === formData.category_id);
  const isCredit = formData.forma_pagamento === 'CREDITO';
  const activeCards = creditCards.filter(c => c.ativo !== false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = {
      descricao: formData.descricao,
      valor: parseFloat(formData.valor) || 0,
      data: formData.data,
      category_id: formData.category_id || undefined,
      subcategory_id: formData.subcategory_id || undefined,
      forma_pagamento: formData.forma_pagamento,
      recorrente: formData.recorrente,
      notes: formData.observacoes || undefined,
      month_id: monthId,
      credit_card_id: isCredit && formData.credit_card_id ? formData.credit_card_id : undefined,
    };
    onSave(payload, expense?.id);
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
            <Select value={formData.forma_pagamento} onValueChange={(v) => setFormData({ ...formData, forma_pagamento: v, credit_card_id: v !== 'CREDITO' ? '' : formData.credit_card_id })}>
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

          {/* Credit Card Selector - only when CREDITO is selected */}
          {isCredit && activeCards.length > 0 && (
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-indigo-500" />
                Cartão de Crédito
              </Label>
              <Select value={formData.credit_card_id} onValueChange={(v) => setFormData({ ...formData, credit_card_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cartão" />
                </SelectTrigger>
                <SelectContent>
                  {activeCards.map(card => (
                    <SelectItem key={card.id} value={card.id}>
                      <span className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: card.cor || '#6366F1' }} />
                        {card.nome} {card.ultimos_digitos ? `(•••• ${card.ultimos_digitos})` : ''}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {isCredit && activeCards.length === 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              Nenhum cartão cadastrado. Vá em <strong>Cartões de Crédito</strong> para adicionar.
            </div>
          )}

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