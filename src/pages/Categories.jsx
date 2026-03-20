import React, { useState } from 'react';
import { apiClient } from '@/api/apiClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Plus, MoreVertical, Pencil, Trash2, Tag, ChevronDown, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export default function Categories() {
  const queryClient = useQueryClient();
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [subcategoryModalOpen, setSubcategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingSubcategory, setEditingSubcategory] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});

  const [categoryForm, setCategoryForm] = useState({
    nome: '',
    tipo: 'DESPESA',
    cor: '#10B981',
    ordem_exibicao: 0
  });

  const [subcategoryForm, setSubcategoryForm] = useState({
    nome: ''
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

  const { data: categories = [] } = useQuery({
    queryKey: ['categories', family?.id],
    queryFn: () => apiClient.entities.Category.filter({ family_id: family.id }),
    enabled: !!family
  });

  const { data: allSubcategories = [] } = useQuery({
    queryKey: ['subcategories'],
    queryFn: () => apiClient.entities.Subcategory.list()
  });

  const saveCategoryMutation = useMutation({
    mutationFn: ({ data, id }) => id
      ? apiClient.entities.Category.update(id, data)
      : apiClient.entities.Category.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['categories']);
      setCategoryModalOpen(false);
      setEditingCategory(null);
      setCategoryForm({ nome: '', tipo: 'DESPESA', cor: '#10B981', ordem_exibicao: 0 });
    }
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (categoryId) => {
      const subs = allSubcategories.filter(s => s.category_id === categoryId);
      for (const sub of subs) {
        await apiClient.entities.Subcategory.delete(sub.id);
      }
      await apiClient.entities.Category.delete(categoryId);
    },
    onSuccess: () => queryClient.invalidateQueries(['categories', 'subcategories'])
  });

  const saveSubcategoryMutation = useMutation({
    mutationFn: ({ data, id }) => id
      ? apiClient.entities.Subcategory.update(id, data)
      : apiClient.entities.Subcategory.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['subcategories']);
      setSubcategoryModalOpen(false);
      setEditingSubcategory(null);
      setSubcategoryForm({ nome: '' });
    }
  });

  const deleteSubcategoryMutation = useMutation({
    mutationFn: (id) => apiClient.entities.Subcategory.delete(id),
    onSuccess: () => queryClient.invalidateQueries(['subcategories'])
  });

  const handleSaveCategory = () => {
    if (!categoryForm.nome.trim()) return;
    saveCategoryMutation.mutate({
      data: {
        ...categoryForm,
        family_id: family.id,
        ativo: true
      },
      id: editingCategory?.id
    });
  };

  const handleSaveSubcategory = () => {
    if (!subcategoryForm.nome.trim()) return;
    saveSubcategoryMutation.mutate({
      data: {
        ...subcategoryForm,
        category_id: selectedCategory.id,
        ativo: true
      },
      id: editingSubcategory?.id
    });
  };

  const toggleExpand = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const getSubcategories = (categoryId) => {
    return allSubcategories.filter(s => s.category_id === categoryId);
  };

  const sortedCategories = [...categories].sort((a, b) =>
    (a.ordem_exibicao || 0) - (b.ordem_exibicao || 0)
  );

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
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Categorias</h1>
            <p className="text-slate-500 mt-1">Gerencie categorias e subcategorias de {family.nome_familia}</p>
          </div>
          <Button
            onClick={() => {
              setEditingCategory(null);
              setCategoryForm({ nome: '', tipo: 'DESPESA', cor: '#10B981', ordem_exibicao: categories.length });
              setCategoryModalOpen(true);
            }}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            <Plus className="w-4 h-4 mr-2" /> Nova Categoria
          </Button>
        </motion.div>

        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="divide-y divide-slate-100">
            {sortedCategories.map((category) => {
              const subcategories = getSubcategories(category.id);
              const isExpanded = expandedCategories[category.id];

              return (
                <div key={category.id}>
                  <div className="p-4 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <button
                          onClick={() => toggleExpand(category.id)}
                          className="p-1 hover:bg-slate-200 rounded"
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-slate-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-600" />
                          )}
                        </button>
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: (category.cor || '#10B981') + '20' }}
                        >
                          <div
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: category.cor || '#10B981' }}
                          />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{category.nome}</p>
                          <p className="text-sm text-slate-500">{subcategories.length} subcategorias</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedCategory(category);
                            setEditingSubcategory(null);
                            setSubcategoryForm({ nome: '' });
                            setSubcategoryModalOpen(true);
                          }}
                        >
                          <Plus className="w-3 h-3 mr-1" /> Subcategoria
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => {
                              setEditingCategory(category);
                              setCategoryForm({
                                nome: category.nome,
                                tipo: category.tipo || 'DESPESA',
                                cor: category.cor || '#10B981',
                                ordem_exibicao: category.ordem_exibicao || 0
                              });
                              setCategoryModalOpen(true);
                            }}>
                              <Pencil className="w-4 h-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                if (confirm(`Excluir categoria "${category.nome}" e todas as subcategorias?`)) {
                                  deleteCategoryMutation.mutate(category.id);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-slate-50 border-t border-slate-100"
                      >
                        <div className="p-4 pl-16 space-y-2">
                          {subcategories.map((sub) => (
                            <div key={sub.id} className="flex items-center justify-between p-2 bg-white rounded-lg">
                              <div className="flex items-center gap-2">
                                <Tag className="w-3 h-3 text-slate-400" />
                                <span className="text-sm text-slate-700">{sub.nome}</span>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7">
                                    <MoreVertical className="w-3 h-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => {
                                    setSelectedCategory(category);
                                    setEditingSubcategory(sub);
                                    setSubcategoryForm({ nome: sub.nome });
                                    setSubcategoryModalOpen(true);
                                  }}>
                                    <Pencil className="w-3 h-3 mr-2" /> Editar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    className="text-red-600"
                                    onClick={() => {
                                      if (confirm(`Excluir subcategoria "${sub.nome}"?`)) {
                                        deleteSubcategoryMutation.mutate(sub.id);
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-3 h-3 mr-2" /> Excluir
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          ))}
                          {subcategories.length === 0 && (
                            <p className="text-sm text-slate-500 text-center py-4">Nenhuma subcategoria</p>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Category Modal */}
      <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome da Categoria *</Label>
              <Input
                value={categoryForm.nome}
                onChange={(e) => setCategoryForm({ ...categoryForm, nome: e.target.value })}
                placeholder="Ex: Alimentação"
              />
            </div>
            <div className="space-y-3">
              <Label>Tipo *</Label>
              <RadioGroup 
                value={categoryForm.tipo} 
                onValueChange={(v) => setCategoryForm({ ...categoryForm, tipo: v })}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="DESPESA" id="cat-despesa" />
                  <Label htmlFor="cat-despesa">Despesa</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="RECEITA" id="cat-receita" />
                  <Label htmlFor="cat-receita">Receita</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={categoryForm.cor}
                  onChange={(e) => setCategoryForm({ ...categoryForm, cor: e.target.value })}
                  className="w-20 h-10"
                />
                <Input
                  value={categoryForm.cor}
                  onChange={(e) => setCategoryForm({ ...categoryForm, cor: e.target.value })}
                  placeholder="#10B981"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setCategoryModalOpen(false)}>
                Cancelar
              </Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveCategory}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subcategory Modal */}
      <Dialog open={subcategoryModalOpen} onOpenChange={setSubcategoryModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSubcategory ? 'Editar Subcategoria' : 'Nova Subcategoria'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedCategory && (
              <div className="p-3 bg-slate-50 rounded-lg">
                <p className="text-sm text-slate-500">Categoria:</p>
                <p className="font-medium text-slate-800">{selectedCategory.nome}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Nome da Subcategoria *</Label>
              <Input
                value={subcategoryForm.nome}
                onChange={(e) => setSubcategoryForm({ ...subcategoryForm, nome: e.target.value })}
                placeholder="Ex: Supermercado"
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setSubcategoryModalOpen(false)}>
                Cancelar
              </Button>
              <Button className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={handleSaveSubcategory}>
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}