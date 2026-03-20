import React, { useState } from 'react';
import { apiClient } from '@/api/apiClient';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Loader2, Users, Search, Target, Home } from 'lucide-react';

export default function AdminFamilies() {
  const [search, setSearch] = useState('');

  const { data: families = [], isLoading } = useQuery({
    queryKey: ['admin-families'],
    queryFn: () => apiClient.entities.Family.list('-created_date', 500),
  });

  const filtered = families.filter(f => 
    !search || 
    f.nome_familia?.toLowerCase().includes(search.toLowerCase()) || 
    f.created_by?.toLowerCase().includes(search.toLowerCase())
  );

  const handleAcessar = (familyId) => {
    localStorage.setItem('selectedFamilyId', familyId);
    window.location.href = '/Dashboard';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black text-white">Famílias Cadastradas</h2>
          <p className="text-slate-400 text-sm mt-1">Acesse e gerencie as famílias registradas no sistema</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400 text-xs font-medium">Total de Famílias</span>
          </div>
          <p className="text-3xl font-black text-emerald-400">{families.length}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <Input
          placeholder="Buscar por nome da família ou email do criador..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10 bg-slate-900 border-slate-800 text-white placeholder:text-slate-500 max-w-md"
        />
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500 bg-slate-900 rounded-2xl border border-dashed border-slate-800">
          <Home className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhuma família encontrada.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(f => (
            <div key={f.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-4 transition-all">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 flex items-center justify-center text-white flex-shrink-0">
                <Home className="w-5 h-5" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="font-bold text-white text-lg">{f.nome_familia}</span>
                  <Badge className="bg-slate-800 text-slate-300 border-slate-700 font-normal">
                    {(!f.tipo_familia || f.tipo_familia === 'SEM_FILHOS') 
                      ? '💑 Sem Filhos' 
                      : `👨‍👩‍👧‍👦 ${f.tipo_familia.replace('_FILHOS', '').replace('5', '5+')} Filhos`}
                  </Badge>
                </div>
                <div className="flex flex-wrap text-sm gap-x-4 gap-y-1 text-slate-400">
                  <span>Criado por: <strong className="text-slate-300">{f.created_by}</strong></span>
                  {f.created_date && (
                    <span>Data: {new Date(f.created_date).toLocaleDateString('pt-BR')}</span>
                  )}
                  <span>ID: <code className="text-xs text-slate-500">{f.id}</code></span>
                </div>
              </div>

              <div className="flex-shrink-0">
                <Button 
                  onClick={() => handleAcessar(f.id)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                >
                  <Target className="w-4 h-4 mr-2" />
                  Acessar Dados
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
