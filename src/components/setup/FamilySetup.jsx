import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Users, Heart, Baby } from "lucide-react";
import { motion } from "framer-motion";

const FAMILY_TYPES = [
  { value: 'SEM_FILHOS', label: 'Sem Filhos', icon: Heart, description: 'Casal sem dependentes' },
  { value: '2_FILHOS', label: '2 Filhos', icon: Baby, description: '2 crianças/dependentes' },
  { value: '3_FILHOS', label: '3 Filhos', icon: Baby, description: '3 crianças/dependentes' },
  { value: '4_FILHOS', label: '4 Filhos', icon: Baby, description: '4 crianças/dependentes' },
  { value: '5_FILHOS', label: '5 Filhos', icon: Baby, description: '5+ crianças/dependentes' }
];

export default function FamilySetup({ onComplete }) {
  const [nome, setNome] = useState('');
  const [tipoFamilia, setTipoFamilia] = useState('SEM_FILHOS');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!nome.trim()) return;
    onComplete({
      nome_familia: nome.trim(),
      tipo_familia: tipoFamilia,
      moeda: 'BRL'
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-slate-50 flex items-center justify-center p-4"
    >
      <Card className="w-full max-w-lg p-8 border-0 shadow-xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Users className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Bem-vindo ao Freedom</h1>
          <p className="text-slate-500 mt-2">Vamos configurar sua família para começar</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Nome da Família</Label>
            <Input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Família Silva"
              className="h-12"
              required
            />
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-medium">Tipo de Família</Label>
            <RadioGroup value={tipoFamilia} onValueChange={setTipoFamilia} className="grid gap-3">
              {FAMILY_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <div key={type.value}>
                    <RadioGroupItem value={type.value} id={type.value} className="peer sr-only" />
                    <Label
                      htmlFor={type.value}
                      className="flex items-center gap-4 p-4 border-2 rounded-xl cursor-pointer transition-all peer-data-[state=checked]:border-emerald-500 peer-data-[state=checked]:bg-emerald-50 hover:bg-slate-50"
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center peer-data-[state=checked]:bg-emerald-100">
                        <Icon className="w-5 h-5 text-slate-600" />
                      </div>
                      <div>
                        <p className="font-medium text-slate-800">{type.label}</p>
                        <p className="text-sm text-slate-500">{type.description}</p>
                      </div>
                    </Label>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          <Button type="submit" className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-base font-medium">
            Começar Agora
          </Button>
        </form>
      </Card>
    </motion.div>
  );
}