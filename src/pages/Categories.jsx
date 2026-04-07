import React, { useState } from 'react';
import { apiClient } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, Pencil, Trash2, Tag, ChevronDown, ChevronRight, Check, X, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

const PRESET_COLORS = [
  '#10B981','#3B82F6','#8B5CF6','#EC4899','#EF4444',
  '#F97316','#EAB308','#06B6D4','#14B8A6','#6366F1',
  '#64748B','#84CC16','#F43F5E','#A855F7','#0EA5E9'
];

const emptyCategory = () => ({ nome: '', tipo: 'DESPESA', cor: '#10B981', ordem_exibicao: 0 });

export default function Categories() {
  const queryClient = useQueryClient();

  // ── Modal State ──
  const [catModal, setCatModal] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [catForm, setCatForm] = useState(emptyCategory());

  const [subModal, setSubModal] = useState(false);
  const [editingSub, setEditingSub] = useState(null);
  const [selectedCat, setSelectedCat] = useState(null);
  const [subForm, setSubForm] = useState({ nome: '' });

  const [expanded, setExpanded] = useState({});
  const [deleteConfirm, setDeleteConfirm] = useState(null); // { type, item }

  // ── Data ──
  const { data: user } = useQuery({ queryKey: ['currentUser'], queryFn: () => apiClient.auth.me() });

  const { data: families = [] } = useQuery({
    queryKey: ['families', user?.email],
    queryFn: () => apiClient.entities.Family.filter({ created_by: user.email }),
    enabled: !!user
  });

  const selectedFamilyId = localStorage.getItem('selectedFamilyId');
  const family = selectedFamilyId ? families.find(f => f.id === selectedFamilyId) : families[0];

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories', family?.id],
    queryFn: () => apiClient.entities.Category.filter({ family_id: family.id }),
    enabled: !!family
  });

  const { data: allSubcategories = [] } = useQuery({
    queryKey: ['subcategories'],
    queryFn: () => apiClient.entities.Subcategory.list()
  });

  // ── Category Mutations ──
  const saveCatMutation = useMutation({
    mutationFn: ({ data, id }) => id
      ? apiClient.entities.Category.update(id, data)
      : apiClient.entities.Category.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success(editingCat ? 'Categoria atualizada!' : 'Categoria criada!');
      closeCatModal();
    },
    onError: (e) => toast.error('Erro: ' + e.message)
  });

  const deleteCatMutation = useMutation({
    mutationFn: async (cat) => {
      // Delete subcategories first
      const subs = allSubcategories.filter(s => s.category_id === cat.id);
      for (const sub of subs) {
        await apiClient.entities.Subcategory.delete(sub.id);
      }
      await apiClient.entities.Category.delete(cat.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['subcategories'] });
      toast.success('Categoria excluída!');
      setDeleteConfirm(null);
    },
    onError: (e) => {
      toast.error('Não foi possível excluir: esta categoria está sendo usada em transações.');
      setDeleteConfirm(null);
    }
  });

  // ── Subcategory Mutations ──
  const saveSubMutation = useMutation({
    mutationFn: ({ data, id }) => id
      ? apiClient.entities.Subcategory.update(id, data)
      : apiClient.entities.Subcategory.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcategories'] });
      toast.success(editingSub ? 'Subcategoria atualizada!' : 'Subcategoria criada!');
      closeSubModal();
    },
    onError: (e) => toast.error('Erro: ' + e.message)
  });

  const deleteSubMutation = useMutation({
    mutationFn: (id) => apiClient.entities.Subcategory.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subcategories'] });
      toast.success('Subcategoria excluída!');
      setDeleteConfirm(null);
    },
    onError: () => {
      toast.error('Não foi possível excluir: subcategoria em uso em transações.');
      setDeleteConfirm(null);
    }
  });

  // ── Helpers ──
  const closeCatModal = () => { setCatModal(false); setEditingCat(null); setCatForm(emptyCategory()); };
  const closeSubModal = () => { setSubModal(false); setEditingSub(null); setSubForm({ nome: '' }); };

  const openNewCat = () => {
    setEditingCat(null);
    setCatForm({ ...emptyCategory(), ordem_exibicao: categories.length });
    setCatModal(true);
  };
  const openEditCat = (cat) => {
    setEditingCat(cat);
    setCatForm({ nome: cat.nome, tipo: cat.tipo || 'DESPESA', cor: cat.cor || '#10B981', ordem_exibicao: cat.ordem_exibicao || 0 });
    setCatModal(true);
  };
  const openNewSub = (cat) => {
    setSelectedCat(cat);
    setEditingSub(null);
    setSubForm({ nome: '' });
    setSubModal(true);
  };
  const openEditSub = (cat, sub) => {
    setSelectedCat(cat);
    setEditingSub(sub);
    setSubForm({ nome: sub.nome });
    setSubModal(true);
  };

  const handleSaveCat = () => {
    if (!catForm.nome.trim()) { toast.error('Nome é obrigatório'); return; }
    saveCatMutation.mutate({ data: { ...catForm, family_id: family.id, ativo: true }, id: editingCat?.id });
  };

  const handleSaveSub = () => {
    if (!subForm.nome.trim()) { toast.error('Nome é obrigatório'); return; }
    saveSubMutation.mutate({ data: { ...subForm, category_id: selectedCat.id, ativo: true }, id: editingSub?.id });
  };

  const getSubs = (catId) => allSubcategories.filter(s => s.category_id === catId);
  const sorted = [...categories].sort((a, b) => (a.ordem_exibicao || 0) - (b.ordem_exibicao || 0));
  const despesas = sorted.filter(c => c.tipo !== 'RECEITA');
  const receitas = sorted.filter(c => c.tipo === 'RECEITA');

  if (!family) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-emerald-50">
        <p className="text-slate-500">Selecione uma família primeiro</p>
      </div>
    );
  }

  const CategoryRow = ({ cat }) => {
    const subs = getSubs(cat.id);
    const isOpen = expanded[cat.id];
    return (
      <div className="border border-slate-200 rounded-xl overflow-hidden mb-3 bg-white shadow-sm hover:shadow transition-shadow">
        {/* Main row */}
        <div className="flex items-center gap-3 p-4">
          <button
            onClick={() => setExpanded(p => ({ ...p, [cat.id]: !p[cat.id] }))}
            className="p-1 rounded hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            {isOpen
              ? <ChevronDown className="w-4 h-4 text-slate-500" />
              : <ChevronRight className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Color dot */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: (cat.cor || '#10B981') + '22' }}
          >
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: cat.cor || '#10B981' }} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-800 truncate">{cat.nome}</p>
            <p className="text-xs text-slate-500">
              {subs.length > 0 ? `${subs.length} subcategoria${subs.length !== 1 ? 's' : ''}` : 'Sem subcategorias'}
              <span className={`ml-2 px-1.5 py-0.5 rounded text-[10px] font-semibold ${cat.tipo === 'RECEITA' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {cat.tipo === 'RECEITA' ? 'Receita' : 'Despesa'}
              </span>
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => openNewSub(cat)}
              title="Adicionar subcategoria"
              className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors text-xs flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline text-xs">Sub</span>
            </button>
            <button
              onClick={() => openEditCat(cat)}
              title="Editar categoria"
              className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </button>
            <button
              onClick={() => setDeleteConfirm({ type: 'category', item: cat })}
              title="Excluir categoria"
              className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Subcategories */}
        {isOpen && (
          <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-2">
            {subs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-2">Nenhuma subcategoria</p>
            ) : (
              subs.map(sub => (
                <div key={sub.id} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-slate-100">
                  <Tag className="w-3 h-3 text-slate-400 flex-shrink-0" />
                  <span className="text-sm text-slate-700 flex-1 truncate">{sub.nome}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => openEditSub(cat, sub)}
                      className="p-1.5 rounded text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm({ type: 'subcategory', item: sub })}
                      className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
            <button
              onClick={() => openNewSub(cat)}
              className="w-full flex items-center justify-center gap-1 py-1.5 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors border border-dashed border-emerald-200"
            >
              <Plus className="w-3 h-3" /> Nova subcategoria
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      <div className="max-w-3xl mx-auto px-4 py-8 pb-24">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Categorias</h1>
            <p className="text-slate-500 text-sm mt-0.5">{family.nome_familia} · {categories.length} categorias</p>
          </div>
          <Button onClick={openNewCat} className="bg-emerald-600 hover:bg-emerald-700 shadow-sm">
            <Plus className="w-4 h-4 mr-2" /> Nova Categoria
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-emerald-600" /></div>
        ) : (
          <>
            {/* Despesas */}
            {despesas.length > 0 && (
              <div className="mb-6">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  Despesas ({despesas.length})
                </h2>
                {despesas.map(cat => <CategoryRow key={cat.id} cat={cat} />)}
              </div>
            )}

            {/* Receitas */}
            {receitas.length > 0 && (
              <div className="mb-6">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Receitas ({receitas.length})
                </h2>
                {receitas.map(cat => <CategoryRow key={cat.id} cat={cat} />)}
              </div>
            )}

            {categories.length === 0 && (
              <div className="text-center py-16 text-slate-400">
                <Tag className="w-14 h-14 mx-auto mb-3 opacity-30" />
                <p className="text-lg font-medium">Nenhuma categoria ainda</p>
                <p className="text-sm">Crie sua primeira categoria para organizar suas finanças</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Category Modal ── */}
      <Dialog open={catModal} onOpenChange={(v) => { if (!v) closeCatModal(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCat ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                autoFocus
                value={catForm.nome}
                onChange={e => setCatForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Alimentação"
                onKeyDown={e => e.key === 'Enter' && handleSaveCat()}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo *</Label>
              <RadioGroup
                value={catForm.tipo}
                onValueChange={v => setCatForm(f => ({ ...f, tipo: v }))}
                className="flex gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="DESPESA" id="t-despesa" />
                  <Label htmlFor="t-despesa" className="cursor-pointer">💸 Despesa</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="RECEITA" id="t-receita" />
                  <Label htmlFor="t-receita" className="cursor-pointer">💰 Receita</Label>
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              {/* Preset colors */}
              <div className="flex flex-wrap gap-2 mb-2">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCatForm(f => ({ ...f, cor: c }))}
                    className="w-8 h-8 rounded-lg transition-all hover:scale-110"
                    style={{
                      backgroundColor: c,
                      outline: catForm.cor === c ? '3px solid #0F172A' : 'none',
                      outlineOffset: '2px'
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={catForm.cor}
                  onChange={e => setCatForm(f => ({ ...f, cor: e.target.value }))}
                  className="w-10 h-10 rounded-lg border border-slate-200 cursor-pointer p-0.5"
                />
                <Input
                  value={catForm.cor}
                  onChange={e => setCatForm(f => ({ ...f, cor: e.target.value }))}
                  placeholder="#10B981"
                  className="font-mono text-sm"
                />
                <div className="w-10 h-10 rounded-lg border flex-shrink-0" style={{ backgroundColor: catForm.cor }} />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={closeCatModal}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleSaveCat}
                disabled={saveCatMutation.isPending}
              >
                {saveCatMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                {editingCat ? 'Atualizar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Subcategory Modal ── */}
      <Dialog open={subModal} onOpenChange={(v) => { if (!v) closeSubModal(); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingSub ? 'Editar Subcategoria' : 'Nova Subcategoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            {selectedCat && (
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: selectedCat.cor || '#10B981' }} />
                <span className="text-sm font-medium text-slate-700">{selectedCat.nome}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                autoFocus
                value={subForm.nome}
                onChange={e => setSubForm(f => ({ ...f, nome: e.target.value }))}
                placeholder="Ex: Supermercado"
                onKeyDown={e => e.key === 'Enter' && handleSaveSub()}
              />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={closeSubModal}>
                Cancelar
              </Button>
              <Button
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={handleSaveSub}
                disabled={saveSubMutation.isPending}
              >
                {saveSubMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                {editingSub ? 'Atualizar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Modal ── */}
      <Dialog open={!!deleteConfirm} onOpenChange={(v) => { if (!v) setDeleteConfirm(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" /> Confirmar Exclusão
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            {deleteConfirm?.type === 'category' ? (
              <div className="space-y-3">
                <p className="text-slate-700">
                  Deseja excluir a categoria <strong>"{deleteConfirm.item.nome}"</strong>?
                </p>
                {getSubs(deleteConfirm.item.id).length > 0 && (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                    ⚠️ Esta ação também excluirá <strong>{getSubs(deleteConfirm.item.id).length} subcategoria(s)</strong> vinculadas.
                  </div>
                )}
                <p className="text-xs text-slate-500">
                  Transações já lançadas com esta categoria não serão afetadas.
                </p>
              </div>
            ) : (
              <p className="text-slate-700">
                Deseja excluir a subcategoria <strong>"{deleteConfirm?.item.nome}"</strong>?
              </p>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={deleteCatMutation.isPending || deleteSubMutation.isPending}
              onClick={() => {
                if (deleteConfirm.type === 'category') {
                  deleteCatMutation.mutate(deleteConfirm.item);
                } else {
                  deleteSubMutation.mutate(deleteConfirm.item.id);
                }
              }}
            >
              {(deleteCatMutation.isPending || deleteSubMutation.isPending)
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Trash2 className="w-4 h-4 mr-1" />}
              Excluir
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}